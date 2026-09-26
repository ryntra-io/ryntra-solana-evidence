#!/usr/bin/env node
/**
 * stock-flows — who is on the other side of a tokenized-stock trade.
 *
 *   NANSEN_API_KEY=<your key> node examples/stock-flows/radar.ts [--top 20] [--window 7d|24h]
 *       [--issuer all|xstocks|prestocks|ondo|backpack] [--html radar.html] [--json]
 *   NANSEN_API_KEY=<your key> node examples/stock-flows/radar.ts guard <SYMBOL|mint> [--usd 1] [--rule "informed >= 0 7d"] [--json]
 *
 * The board reads Nansen's flow intelligence for the most traded tokenized
 * stocks on Solana and ranks them by what the wallets with a record of being
 * right are doing. The guard reads one stock over both windows before a
 * purchase and answers BUY or WAIT with its reason; its exit code (0 BUY,
 * 3 WAIT) lets a script or a bot ask it first.
 *
 * Every call goes through the evidence kit's own Nansen client (bounded time,
 * one retry for what a retry can mend, the key never printed) and its credit
 * governor (a hard ceiling per run). The list of stocks comes from Ryntra's
 * public API without a key, or from the snapshot beside this file.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createMemoryGovernor, createNansenClient, firstRow, NANSEN_FLOWS_FAMILY, NANSEN_TIMEFRAMES, nansenKeyFromEnv, warningsOf, type CreditGovernor, type NansenCall, type NansenClient } from "../../packages/evidence/src/index.ts";
import { findStock, GROUP_WORDS, guard, ISSUER_WORDS, parseFlowRow, parseRule, parseUniverse, pickStocks, rankReadings, readFlows, usd, VERDICT_WORDS, type FlowGroup, type FlowRead, type FlowWindow, type GuardResult, type Stock, type WindowRead } from "./flows.ts";
import { renderReport, type BoardRow } from "./report.ts";

export const UNIVERSE_URL = "https://ryntra.io/api/stocks/universe?shape=slim";
const HERE = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT = join(HERE, "universe.snapshot.json");

const USAGE = `stock-flows — who is on the other side of a tokenized-stock trade (data: Nansen)

  board   [--top 20] [--window 7d|24h] [--issuer all|xstocks|prestocks|ondo|backpack]
          [--html <file>] [--json] [--max-credits <n>] [--universe <file|url>]
      Read the flows of the N most traded tokenized stocks and rank them.
      One Nansen call per stock.

  guard <SYMBOL|mint> [--usd 1] [--rule "<group> <>=|<=> <usd> [7d|24h]"] [--json]
      Before a purchase: both windows for one stock, one answer — BUY or WAIT.
      Two Nansen calls. Exit code 0 = BUY, 3 = WAIT, 2 = could not run.
      Groups: informed (best + smart traders), ${Object.keys(GROUP_WORDS).join(", ")}.

  render <board.json> [--html <file>]
      Redraw a board saved with --json, offline: no key, no call.

  NANSEN_API_KEY must be set for board and guard; it is read from the
  environment and never printed.
`;

export type Options = Readonly<{
  command: "board" | "guard" | "render" | "help";
  target: string | null;
  top: number;
  window: FlowWindow;
  issuer: string;
  html: string | null;
  json: boolean;
  maxCredits: number | null;
  universe: string | null;
  usdAmount: number;
  rule: string | null;
  color: boolean;
}>;

export function parseArgs(argv: readonly string[], env: Readonly<Record<string, string | undefined>> = {}): Options | { error: string } {
  const flags = new Map<string, string | true>();
  const positional: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const name = arg.slice(2);
    const boolean = name === "json" || name === "no-color" || name === "help";
    if (boolean) flags.set(name, true);
    else {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) return { error: `--${name} needs a value.` };
      flags.set(name, value);
      index += 1;
    }
  }
  const text = (name: string): string | null => {
    const value = flags.get(name);
    return typeof value === "string" ? value : null;
  };
  const first = positional[0];
  const command = flags.has("help") || first === "help" ? "help" : first === "guard" ? "guard" : first === "render" ? "render" : first === undefined || first === "board" ? "board" : null;
  if (command === null) return { error: `Unknown command "${first}".` };
  const top = Number(text("top") ?? "20");
  if (!Number.isInteger(top) || top < 1 || top > 400) return { error: "--top is a whole number from 1 to 400." };
  const window = text("window") ?? "7d";
  if (window !== "7d" && window !== "24h") return { error: "--window is 7d or 24h." };
  const maxText = text("max-credits");
  const maxCredits = maxText === null ? null : Number(maxText);
  if (maxCredits !== null && (!Number.isInteger(maxCredits) || maxCredits < 1)) return { error: "--max-credits is a whole number above zero." };
  const usdAmount = Number(text("usd") ?? "1");
  if (!Number.isFinite(usdAmount) || usdAmount <= 0) return { error: "--usd is an amount above zero." };
  const rule = text("rule");
  if (rule !== null && parseRule(rule) === null) return { error: `The rule "${rule}" is not one this tool can judge; write "<group> >= <usd> [7d|24h]".` };
  const target = command === "guard" || command === "render" ? positional[1] ?? null : null;
  if (command === "guard" && !target) return { error: "guard needs a symbol or a mint, e.g. guard NVDAx." };
  if (command === "render" && !target) return { error: "render needs the board saved with --json, e.g. render board.json." };
  return {
    command,
    target,
    top,
    window,
    issuer: (text("issuer") ?? "all").toLowerCase(),
    html: text("html"),
    json: flags.has("json"),
    maxCredits,
    universe: text("universe"),
    usdAmount,
    rule,
    color: !flags.has("no-color") && !env.NO_COLOR,
  };
}

/* ----------------------------------------------------------------------------
 * Reads.
 * ------------------------------------------------------------------------- */

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function failureWords(call: Extract<NansenCall, { ok: false }>): string {
  switch (call.kind) {
    case "auth":
      return "the provider refused the key";
    case "credits":
      return "the key has no credits left";
    case "rate":
      return "the provider's rate limit was reached";
    case "timeout":
      return "no answer in time";
    case "network":
      return "the provider could not be reached";
    case "geo":
      return "the provider does not serve this region";
    case "server":
      return `the provider answered ${call.status}`;
    default:
      return call.message || `the request was refused (${call.status})`;
  }
}

/** One governed flow read: reserve a credit, call, settle on the provider's own figures, parse. A 429 is waited out once. */
export async function readWindow(client: NansenClient, governor: CreditGovernor, mint: string, window: FlowWindow): Promise<WindowRead & { calls: number }> {
  let calls = 0;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const reserved = await governor.reserve({ expectedCredits: 1, nowMs: Date.now() });
    if (!reserved.ok) return { state: "UNAVAILABLE", read: null, reason: reserved.message, calls };
    const call = await client.call(NANSEN_FLOWS_FAMILY, { chain: "solana", token_address: mint, timeframe: NANSEN_TIMEFRAMES[window].flows });
    calls += 1;
    await governor.settle({
      expectedCredits: 1,
      settlement: { succeeded: call.ok, creditsUsed: call.headers.creditsUsed ?? call.headers.creditsCost, creditsRemaining: call.headers.creditsRemaining, requestId: call.headers.requestId, retried: call.retried, failureKind: call.ok ? null : call.kind },
      nowMs: Date.now(),
    });
    if (call.ok) {
      const read = parseFlowRow(firstRow(call.json), warningsOf(call.json));
      return read ? { state: "FRESH", read, reason: null, calls } : { state: "UNKNOWN", read: null, reason: "the provider has no flows for this token", calls };
    }
    if (call.kind !== "rate" || attempt === 1) return { state: "UNAVAILABLE", read: null, reason: failureWords(call), calls };
    await sleep(Math.min(10, Math.max(1, call.headers.retryAfterSeconds ?? 2)) * 1000);
  }
  return { state: "UNAVAILABLE", read: null, reason: "the provider did not answer", calls };
}

async function loadUniverse(source: string | null): Promise<{ stocks: Stock[]; from: string }> {
  const wanted = source ?? UNIVERSE_URL;
  if (/^https?:\/\//.test(wanted)) {
    /* Two tries: a list served cold, or answered empty while its own source is busy, usually answers the second time. */
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch(wanted, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
        if (response.ok) {
          const stocks = parseUniverse(await response.json());
          if (stocks.length > 0) return { stocks, from: new URL(wanted).host + new URL(wanted).pathname };
        }
      } catch {
        /* try again, then fall through to the snapshot */
      }
      if (attempt === 0) await sleep(1500);
    }
    if (source !== null) throw new Error(`The universe at ${wanted} did not answer.`);
  } else {
    const stocks = parseUniverse(JSON.parse(readFileSync(wanted, "utf8")));
    if (stocks.length === 0) throw new Error(`${wanted} holds no stocks.`);
    return { stocks, from: wanted };
  }
  const snapshot = JSON.parse(readFileSync(SNAPSHOT, "utf8")) as { savedAt?: string };
  return { stocks: parseUniverse(snapshot), from: `the saved snapshot (${snapshot.savedAt ?? "undated"}) — the live list did not answer` };
}

/** Run `task` over `items` with at most `limit` in flight, keeping the input order. */
async function mapLimited<T, R>(items: readonly T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        results[index] = await task(items[index]);
      }
    }),
  );
  return results;
}

/* ----------------------------------------------------------------------------
 * Printing.
 * ------------------------------------------------------------------------- */

function paint(enabled: boolean) {
  const wrap = (code: string) => (text: string) => (enabled ? `\u001b[${code}m${text}\u001b[0m` : text);
  return { red: wrap("31"), green: wrap("32"), yellow: wrap("33"), dim: wrap("2"), bold: wrap("1"), orange: wrap("38;5;208") };
}

function toneOf(value: number | null, c: ReturnType<typeof paint>) {
  return (text: string) => (value === null || value === 0 ? c.dim(text) : value > 0 ? c.green(text) : c.red(text));
}

const pad = (text: string, width: number) => (text.length >= width ? text.slice(0, width) : text + " ".repeat(width - text.length));
const padStart = (text: string, width: number) => (text.length >= width ? text : " ".repeat(width - text.length) + text);

function verdictPaint(verdict: keyof typeof VERDICT_WORDS, c: ReturnType<typeof paint>) {
  const tone = VERDICT_WORDS[verdict].tone;
  return tone === "sell" ? c.red : tone === "buy" ? c.green : tone === "watch" ? c.yellow : c.dim;
}

export function printBoard(rows: readonly BoardRow[], meta: { window: FlowWindow; askedAt: string; calls: number; credits: number; remaining: number | null; from: string }, color: boolean): string {
  const c = paint(color);
  const lines: string[] = [];
  lines.push(c.bold(`Who is on the other side`) + c.dim(` · tokenized stocks on Solana · net flow by wallet group over ${meta.window} · Nansen, asked ${meta.askedAt}`));
  lines.push("");
  lines.push(c.dim(` #  ${pad("STOCK", 10)} ${pad("ISSUER", 9)} ${pad("VERDICT", 20)} ${padStart("BEST+SMART", 11)} ${padStart("NEW", 9)} ${padStart("WHALES", 9)} ${padStart("EXCHANGES", 10)}`));
  rows.forEach((row, index) => {
    const rank = padStart(String(index + 1), 2);
    const issuer = pad(ISSUER_WORDS[row.stock.issuer] ?? row.stock.issuer, 9);
    if (!row.reading) {
      lines.push(`${rank}  ${pad(row.stock.symbol, 10)} ${issuer} ${c.dim(pad("no answer", 20))} ${c.dim(row.reason ?? "")}`);
      return;
    }
    const r = row.reading;
    const cell = (value: number | null, width: number) => toneOf(value, c)(padStart(usd(value), width));
    lines.push(`${rank}  ${c.bold(pad(row.stock.symbol, 10))} ${issuer} ${verdictPaint(r.verdict, c)(pad(VERDICT_WORDS[r.verdict].title, 20))} ${cell(r.informedUsd, 11)} ${cell(r.newUsd, 9)} ${cell(r.whaleUsd, 9)} ${cell(r.exchangeUsd, 10)}`);
    if (r.verdict !== "QUIET") lines.push(c.dim(`    ${r.sentence}`));
  });
  lines.push("");
  lines.push(c.dim(`${rows.length} stocks · ${meta.calls} Nansen calls · ${meta.credits} credits${meta.remaining !== null ? ` · ${meta.remaining.toLocaleString("en-US")} left on the key` : ""} · universe: ${meta.from}`));
  lines.push(c.dim("A flow is movement, not a trade. A group is Nansen's label, not an identity. Not advice. ") + c.orange("Powered by Nansen API"));
  return lines.join("\n");
}

export function printGuard(stock: Stock, result: GuardResult, input: { usdAmount: number; askedAt: string; week: FlowRead | null; day: FlowRead | null }, color: boolean): string {
  const c = paint(color);
  const line = (label: string, read: FlowRead | null) => {
    if (!read) return `  ${c.dim(label)}  ${c.dim("no answer")}`;
    const groups: FlowGroup[] = ["top_pnl", "smart_trader", "whale", "fresh_wallets", "exchange"];
    return `  ${c.dim(label)}  ${groups.map((group) => `${GROUP_WORDS[group].label.toLowerCase()} ${toneOf(read.groups[group].netUsd, c)(usd(read.groups[group].netUsd))}`).join(c.dim(" · "))}`;
  };
  const decision = result.decision === "BUY" ? c.green(c.bold("BUY")) : c.yellow(c.bold("WAIT"));
  return [
    c.bold(`Buy ${usd(input.usdAmount, false)} of ${stock.symbol}`) + c.dim(` (${stock.name} · ${ISSUER_WORDS[stock.issuer] ?? stock.issuer})?`),
    line("7d ", input.week),
    line("24h", input.day),
    `  → ${decision} — ${result.because}`,
    c.dim(`  Rule: ${result.rule}.`),
    c.dim(`  Data: Nansen flow intelligence, asked ${input.askedAt}. Not advice. `) + c.orange("Powered by Nansen API"),
    c.dim(`  Ryntra runs the same fail-closed check before a signature: https://ryntra.io/app`),
  ].join("\n");
}

/** A board saved with --json, back into rows and the line under the board — the verdicts recomputed from the saved figures. */
export function restoreBoard(json: unknown): { rows: BoardRow[]; meta: { window: FlowWindow; askedAt: string; calls: number; credits: number; remaining: number | null; from: string } } | null {
  if (!json || typeof json !== "object") return null;
  const saved = json as { window?: unknown; askedAt?: unknown; universe?: unknown; ledger?: { requests?: unknown; usedCredits?: unknown; remainingReported?: unknown }; rows?: unknown };
  if (!Array.isArray(saved.rows) || (saved.window !== "7d" && saved.window !== "24h")) return null;
  const window = saved.window;
  const stocks = parseUniverse(saved.rows);
  const rows: BoardRow[] = stocks.map((stock) => {
    const raw = (saved.rows as Record<string, unknown>[]).find((row) => row.mint === stock.mint) ?? {};
    const groups = raw.groups && typeof raw.groups === "object" ? (raw.groups as Record<string, { netUsd?: unknown; wallets?: unknown }>) : null;
    const flat: Record<string, unknown> = {};
    if (groups) for (const [group, flow] of Object.entries(groups)) {
      flat[`${group}_net_flow_usd`] = flow?.netUsd;
      flat[`${group}_wallet_count`] = flow?.wallets;
    }
    const read = groups ? parseFlowRow(flat, Array.isArray(raw.warnings) ? (raw.warnings as string[]) : []) : null;
    return { stock, read, reading: read ? readFlows(read, { dailyVolumeUsd: stock.dailyVolumeUsd }) : null, reason: typeof raw.sentence === "string" && !read ? raw.sentence : null };
  });
  const number = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
  return {
    rows: rankReadings(rows),
    meta: {
      window,
      askedAt: typeof saved.askedAt === "string" ? saved.askedAt : "an unknown time",
      calls: number(saved.ledger?.requests) ?? 0,
      credits: number(saved.ledger?.usedCredits) ?? 0,
      remaining: number(saved.ledger?.remainingReported),
      from: typeof saved.universe === "string" ? saved.universe : "a saved board",
    },
  };
}

/* ----------------------------------------------------------------------------
 * The run.
 * ------------------------------------------------------------------------- */

/** Colour on a terminal, or when FORCE_COLOR asks for it through a pipe; never when NO_COLOR is set. */
export function colorWanted(env: Readonly<Record<string, string | undefined>>, isTTY: boolean = process.stdout.isTTY === true): boolean {
  if (env.NO_COLOR) return false;
  if (env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== "0" && env.FORCE_COLOR !== "false") return true;
  return isTTY;
}

function stamp(now: Date): string {
  return `${now.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2), process.env);
  if ("error" in options) {
    console.error(`${options.error}\n\n${USAGE}`);
    return 2;
  }
  if (options.command === "help") {
    console.log(USAGE);
    return 0;
  }
  if (options.command === "render") {
    const saved = restoreBoard(JSON.parse(readFileSync(options.target ?? "", "utf8")));
    if (!saved) {
      console.error(`${options.target} is not a board saved with --json.`);
      return 2;
    }
    const color = options.color && colorWanted(process.env);
    console.log(printBoard(saved.rows, saved.meta, color));
    if (options.html) {
      writeFileSync(options.html, renderReport(saved.rows, { ...saved.meta, universeSource: saved.meta.from }), "utf8");
      console.log(`
Wrote ${options.html}`);
    }
    return 0;
  }
  const key = nansenKeyFromEnv(process.env);
  if (!key) {
    console.error("NANSEN_API_KEY is not set. Nothing was called.\nCreate a key at https://app.nansen.ai/api and run: NANSEN_API_KEY=<your key> node examples/stock-flows/radar.ts");
    return 2;
  }
  const color = options.color && !options.json && colorWanted(process.env);
  const client = createNansenClient({ key });
  const { stocks, from } = await loadUniverse(options.universe);

  if (options.command === "guard") {
    const stock = findStock(stocks, options.target ?? "");
    if (!stock) {
      console.error(`${options.target} is not a tokenized stock in the universe (${from}).`);
      return 2;
    }
    const governor = createMemoryGovernor(options.maxCredits ?? 4);
    if (!options.json) console.error(paint(options.color && colorWanted(process.env)).dim(`Reading ${stock.symbol} over 7d and 24h from Nansen — 2 calls…`));
    const [week, day] = await Promise.all([readWindow(client, governor, stock.mint, "7d"), readWindow(client, governor, stock.mint, "24h")]);
    const rule = options.rule ? parseRule(options.rule) : null;
    const result = guard({ week, day, dailyVolumeUsd: stock.dailyVolumeUsd, rule });
    const askedAt = stamp(new Date());
    if (options.json) {
      console.log(JSON.stringify({ stock, usd: options.usdAmount, decision: result.decision, because: result.because, rule: result.rule, week: result.reading7d, day: result.reading24h, askedAt, ledger: governor.state(), attribution: "Powered by Nansen API — https://nansen.ai" }, null, 2));
    } else {
      console.log(printGuard(stock, result, { usdAmount: options.usdAmount, askedAt, week: week.read, day: day.read }, color));
    }
    return result.decision === "BUY" ? 0 : 3;
  }

  const picked = pickStocks(stocks, { top: options.top, issuer: options.issuer });
  if (picked.length === 0) {
    console.error(`No tokenized stocks for issuer "${options.issuer}". Issuers: all, ${Object.keys(ISSUER_WORDS).join(", ")}.`);
    return 2;
  }
  const governor = createMemoryGovernor(options.maxCredits ?? picked.length + 5);
  if (!options.json) console.error(paint(color).dim(`Reading ${options.window} flows for ${picked.length} tokenized stocks from Nansen — ${picked.length} calls…`));
  const reads = await mapLimited(picked, 4, (stock) => readWindow(client, governor, stock.mint, options.window));
  const rows: BoardRow[] = rankReadings(
    picked.map((stock, index) => {
      const read = reads[index];
      return { stock, read: read.read, reading: read.read ? readFlows(read.read, { dailyVolumeUsd: stock.dailyVolumeUsd }) : null, reason: read.reason };
    }),
  );
  const ledger = governor.state();
  const askedAt = stamp(new Date());
  const meta = { window: options.window, askedAt, calls: ledger.requests, credits: ledger.usedCredits, remaining: ledger.remainingReported, from };
  if (options.html) {
    writeFileSync(options.html, renderReport(rows, { ...meta, universeSource: from }), "utf8");
  }
  if (options.json) {
    console.log(JSON.stringify({ window: options.window, askedAt, universe: from, ledger, attribution: "Powered by Nansen API — https://nansen.ai", rows: rows.map((row) => ({ ...row.stock, verdict: row.reading?.verdict ?? null, sentence: row.reading?.sentence ?? row.reason, informedUsd: row.reading?.informedUsd ?? null, newUsd: row.reading?.newUsd ?? null, whaleUsd: row.reading?.whaleUsd ?? null, exchangeUsd: row.reading?.exchangeUsd ?? null, thresholdUsd: row.reading?.thresholdUsd ?? null, groups: row.read?.groups ?? null, warnings: row.read?.warnings ?? [] })) }, null, 2));
  } else {
    console.log(printBoard(rows, meta, color));
    if (options.html) console.log(`\nWrote ${options.html}`);
  }
  return ledger.succeeded > 0 ? 0 : 2;
}

/* Run only when this file is the program, not when a test imports it. */
const entry = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (entry.toLowerCase() === import.meta.url.toLowerCase()) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 2;
    },
  );
}
