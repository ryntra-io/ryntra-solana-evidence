/**
 * Who is on the other side — the pure half of the stock-flows radar.
 *
 * Nansen's flow intelligence splits a token's net movement over a window
 * among the wallet groups it labels: the best traders by realised profit,
 * smart traders, whales, public figures, exchanges and wallets that are new.
 * This file turns one such answer into the figures a person reads, a verdict
 * in a few words and a decision a buyer can act on. It has no network and no
 * clock of its own, so every rule here is tested offline and the same inputs
 * always give the same answer.
 *
 * Three rules hold everywhere below:
 *  - a flow is movement, not a trade: tokens that arrived in (above zero) or
 *    left (below zero) the group's wallets, valued in USD by the provider;
 *  - a group is the provider's label, not an identity;
 *  - a read that is missing, failed or partial is never a reason to buy —
 *    an unjudgeable rule is a WAIT, the way Ryntra's review before a
 *    signature treats unknown evidence.
 */

export const FLOW_GROUPS = ["top_pnl", "smart_trader", "whale", "public_figure", "exchange", "fresh_wallets"] as const;
export type FlowGroup = (typeof FLOW_GROUPS)[number];

/** The words a person reads for each group, and whether the provider counts its wallets. */
export const GROUP_WORDS: Readonly<Record<FlowGroup, Readonly<{ label: string; plural: string; countsWallets: boolean }>>> = {
  top_pnl: { label: "Best traders", plural: "the best traders", countsWallets: true },
  smart_trader: { label: "Smart traders", plural: "smart traders", countsWallets: true },
  whale: { label: "Whales", plural: "whales", countsWallets: true },
  public_figure: { label: "Public figures", plural: "public figures", countsWallets: true },
  exchange: { label: "Exchanges", plural: "exchanges", countsWallets: false },
  fresh_wallets: { label: "New wallets", plural: "new wallets", countsWallets: false },
};

export type FlowWindow = "24h" | "7d";

export type GroupFlow = Readonly<{
  group: FlowGroup;
  /** Net USD that moved into (above zero) or out of (below zero) the group's wallets; null when the provider gave none. */
  netUsd: number | null;
  /** How many of the group's wallets moved; null when the provider does not count this group. */
  wallets: number | null;
}>;

export type FlowRead = Readonly<{
  groups: Readonly<Record<FlowGroup, GroupFlow>>;
  /** The provider's own warnings, verbatim and bounded. */
  warnings: readonly string[];
}>;

function finite(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * One row of `POST /api/v1/tgm/flow-intelligence` into six group flows.
 * Returns null when the row carries none of the groups — an empty answer is
 * not a quiet market, it is no answer.
 */
export function parseFlowRow(row: unknown, warnings: readonly string[] = []): FlowRead | null {
  if (!row || typeof row !== "object") return null;
  const source = row as Record<string, unknown>;
  let seen = 0;
  const groups = {} as Record<FlowGroup, GroupFlow>;
  for (const group of FLOW_GROUPS) {
    const netUsd = finite(source[`${group}_net_flow_usd`]);
    if (netUsd !== null) seen += 1;
    const counted = GROUP_WORDS[group].countsWallets ? finite(source[`${group}_wallet_count`]) : null;
    groups[group] = { group, netUsd, wallets: counted === null ? null : Math.max(0, Math.round(counted)) };
  }
  if (seen === 0) return null;
  return { groups, warnings: warnings.filter((warning) => typeof warning === "string").map((warning) => warning.slice(0, 200)).slice(0, 5) };
}

export const VERDICTS = ["SMART_EXIT", "SMART_SELLING", "SMART_ENTRY", "TO_EXCHANGES", "WHALES_LOADING", "MIXED", "QUIET"] as const;
export type Verdict = (typeof VERDICTS)[number];

export const VERDICT_WORDS: Readonly<Record<Verdict, Readonly<{ title: string; tone: "sell" | "buy" | "watch" | "calm" }>>> = {
  SMART_EXIT: { title: "Smart exit", tone: "sell" },
  SMART_SELLING: { title: "Smart money selling", tone: "sell" },
  SMART_ENTRY: { title: "Smart money buying", tone: "buy" },
  TO_EXCHANGES: { title: "Moving to exchanges", tone: "watch" },
  WHALES_LOADING: { title: "Whales accumulating", tone: "buy" },
  MIXED: { title: "Mixed", tone: "calm" },
  QUIET: { title: "Quiet", tone: "calm" },
};

/** The smallest move that counts, in USD, whatever the token's size. */
export const MIN_THRESHOLD_USD = 10_000;
/** The share of a day's trading volume a group must move to count. */
export const VOLUME_SHARE = 0.02;

/**
 * What counts as a real move for one token: 2 % of its daily trading volume,
 * and never less than $10,000. Scaled by volume so a $50K swing means
 * something for a thin token and nothing for NVIDIA.
 */
export function thresholdUsd(dailyVolumeUsd: number | null | undefined): number {
  const volume = finite(dailyVolumeUsd);
  if (volume === null || volume <= 0) return MIN_THRESHOLD_USD;
  return Math.max(MIN_THRESHOLD_USD, Math.round(volume * VOLUME_SHARE));
}

export type Reading = Readonly<{
  verdict: Verdict;
  /** The best traders and smart traders together — the groups whose record says they tend to be right. */
  informedUsd: number | null;
  newUsd: number | null;
  whaleUsd: number | null;
  exchangeUsd: number | null;
  thresholdUsd: number;
  /** One sentence a person can repeat. */
  sentence: string;
  /** The groups that moved at least the threshold, largest first. */
  sellers: readonly GroupFlow[];
  buyers: readonly GroupFlow[];
}>;

function sumOrNull(...values: (number | null)[]): number | null {
  const present = values.filter((value): value is number => value !== null);
  return present.length === 0 ? null : present.reduce((total, value) => total + value, 0);
}

/** "+$17.3M", "−$911K", "$0" — signed, short, with a true minus sign. */
export function usd(value: number | null, signed = true): string {
  if (value === null) return "—";
  const sign = !signed || value === 0 ? "" : value > 0 ? "+" : "−";
  const size = Math.abs(value);
  const body =
    size >= 1e9 ? `${(size / 1e9).toFixed(size >= 1e10 ? 0 : 1)}B`
    : size >= 1e6 ? `${(size / 1e6).toFixed(size >= 1e7 ? 0 : 1)}M`
    : size >= 1e3 ? `${(size / 1e3).toFixed(size >= 1e4 ? 0 : 1)}K`
    : `${Math.round(size)}`;
  return `${sign}$${body.replace(/\.0(?=[KMB]$)/, "")}`;
}

/**
 * The verdict for one token over one window. The order of the checks is the
 * order of what a buyer most needs to know: first whether anything moved,
 * then whether the best traders are leaving and to whom, then whether they
 * are arriving, then where the supply is going.
 */
export function readFlows(read: FlowRead, input: { dailyVolumeUsd?: number | null } = {}): Reading {
  const threshold = thresholdUsd(input.dailyVolumeUsd);
  const g = read.groups;
  const informedUsd = sumOrNull(g.top_pnl.netUsd, g.smart_trader.netUsd);
  const newUsd = g.fresh_wallets.netUsd;
  const whaleUsd = g.whale.netUsd;
  const exchangeUsd = g.exchange.netUsd;

  const moved = FLOW_GROUPS.map((group) => g[group]).filter((flow) => flow.netUsd !== null && Math.abs(flow.netUsd) >= threshold);
  const sellers = moved.filter((flow) => (flow.netUsd ?? 0) < 0).sort((a, b) => (a.netUsd ?? 0) - (b.netUsd ?? 0));
  const buyers = moved.filter((flow) => (flow.netUsd ?? 0) > 0).sort((a, b) => (b.netUsd ?? 0) - (a.netUsd ?? 0));

  const informedOut = informedUsd !== null && informedUsd <= -threshold;
  const informedIn = informedUsd !== null && informedUsd >= threshold;
  const newIn = newUsd !== null && newUsd >= threshold;

  let verdict: Verdict;
  let sentence: string;
  if (moved.length === 0 && !informedOut && !informedIn) {
    verdict = "QUIET";
    sentence = `No group moved more than ${usd(threshold, false)}.`;
  } else if (informedOut && newIn) {
    verdict = "SMART_EXIT";
    sentence = `The best and smart traders sent out ${usd(Math.abs(informedUsd ?? 0), false)}; new wallets took in ${usd(newUsd, false)}.`;
  } else if (informedOut) {
    verdict = "SMART_SELLING";
    sentence = `The best and smart traders sent out ${usd(Math.abs(informedUsd ?? 0), false)}.`;
  } else if (informedIn) {
    verdict = "SMART_ENTRY";
    sentence = `The best and smart traders took in ${usd(informedUsd, false)}.`;
  } else if (exchangeUsd !== null && exchangeUsd >= threshold) {
    verdict = "TO_EXCHANGES";
    sentence = `${usd(exchangeUsd, false)} moved onto exchange wallets.`;
  } else if (whaleUsd !== null && whaleUsd >= threshold) {
    verdict = "WHALES_LOADING";
    sentence = `Whales took in ${usd(whaleUsd, false)}.`;
  } else {
    verdict = "MIXED";
    const top = [...sellers.slice(0, 1), ...buyers.slice(0, 1)].map((flow) => `${GROUP_WORDS[flow.group].plural} ${usd(flow.netUsd)}`);
    sentence = top.length > 0 ? `Groups disagree: ${top.join(", ")}.` : `Groups disagree.`;
  }
  return { verdict, informedUsd, newUsd, whaleUsd, exchangeUsd, thresholdUsd: threshold, sentence, sellers, buyers };
}

/* ----------------------------------------------------------------------------
 * The guard: one decision before a purchase.
 * ------------------------------------------------------------------------- */

export type ReadState = "FRESH" | "UNKNOWN" | "UNAVAILABLE";

export type WindowRead = Readonly<{ state: ReadState; read: FlowRead | null; reason: string | null }>;

export type Rule = Readonly<{ group: FlowGroup | "informed"; operator: ">=" | "<="; usd: number; window: FlowWindow }>;

export type GuardResult = Readonly<{
  decision: "BUY" | "WAIT";
  because: string;
  rule: string;
  reading7d: Reading | null;
  reading24h: Reading | null;
}>;

function ruleWords(rule: Rule): string {
  const who = rule.group === "informed" ? "the best and smart traders" : GROUP_WORDS[rule.group].plural;
  return `${who} ${rule.operator === ">=" ? "at or above" : "at or below"} ${usd(rule.usd)} over ${rule.window}`;
}

/**
 * `"top_pnl >= 0"`, `"informed >= -50000 24h"`, `"whale <= 1e6 7d"` → a rule.
 * Returns null for anything else, so a mistyped rule is refused, never
 * guessed at.
 */
export function parseRule(text: string): Rule | null {
  const parts = text.trim().split(/\s+/);
  if (parts.length < 3 || parts.length > 4) return null;
  const [groupText, operator, amountText, windowText] = parts;
  const group = groupText === "informed" ? "informed" : (FLOW_GROUPS as readonly string[]).includes(groupText) ? (groupText as FlowGroup) : null;
  if (group === null) return null;
  if (operator !== ">=" && operator !== "<=") return null;
  const amount = Number(amountText);
  if (!Number.isFinite(amount)) return null;
  const window = windowText === undefined ? "7d" : windowText === "7d" || windowText === "24h" ? windowText : null;
  if (window === null) return null;
  return { group, operator, usd: amount, window };
}

function groupValue(read: FlowRead, group: Rule["group"]): number | null {
  if (group === "informed") return sumOrNull(read.groups.top_pnl.netUsd, read.groups.smart_trader.netUsd);
  return read.groups[group].netUsd;
}

/**
 * BUY or WAIT for a purchase of one token, from both windows.
 *
 * Without a rule: WAIT while the best and smart traders are net sellers over
 * seven days, unless they turned buyers in the last day. With a rule: the
 * rule decides. Either way a window that did not answer, or a figure the
 * rule needs that the provider did not give, is a WAIT with the reason.
 */
export function guard(input: { week: WindowRead; day: WindowRead; dailyVolumeUsd?: number | null; rule?: Rule | null }): GuardResult {
  const { week, day } = input;
  const reading7d = week.state === "FRESH" && week.read ? readFlows(week.read, { dailyVolumeUsd: input.dailyVolumeUsd }) : null;
  const reading24h = day.state === "FRESH" && day.read ? readFlows(day.read, { dailyVolumeUsd: input.dailyVolumeUsd }) : null;

  if (input.rule) {
    const rule = input.rule;
    const words = ruleWords(rule);
    const source = rule.window === "7d" ? week : day;
    if (source.state !== "FRESH" || !source.read) {
      return { decision: "WAIT", because: `The ${rule.window} read did not answer (${source.reason ?? source.state.toLowerCase()}); an unknown is never a pass.`, rule: words, reading7d, reading24h };
    }
    const value = groupValue(source.read, rule.group);
    if (value === null) return { decision: "WAIT", because: `The provider gave no figure for this group over ${rule.window}; an unknown is never a pass.`, rule: words, reading7d, reading24h };
    const met = rule.operator === ">=" ? value >= rule.usd : value <= rule.usd;
    return { decision: met ? "BUY" : "WAIT", because: `The figure is ${usd(value)} — the rule is ${met ? "met" : "not met"}.`, rule: words, reading7d, reading24h };
  }

  const words = "wait while the best and smart traders are net sellers over 7 days, unless they bought in the last 24 hours";
  if (!reading7d) return { decision: "WAIT", because: `The 7-day read did not answer (${week.reason ?? week.state.toLowerCase()}); an unknown is never a pass.`, rule: words, reading7d, reading24h };
  if (reading7d.informedUsd === null) return { decision: "WAIT", because: "The provider gave no figure for the best or smart traders; an unknown is never a pass.", rule: words, reading7d, reading24h };
  const leaving = reading7d.verdict === "SMART_EXIT" || reading7d.verdict === "SMART_SELLING";
  if (!leaving) return { decision: "BUY", because: `Over 7 days the best and smart traders are not net sellers (${usd(reading7d.informedUsd)}).`, rule: words, reading7d, reading24h };
  if (reading24h && reading24h.informedUsd !== null && reading24h.informedUsd >= reading24h.thresholdUsd) {
    return { decision: "BUY", because: `They sold ${usd(Math.abs(reading7d.informedUsd), false)} over 7 days but took in ${usd(reading24h.informedUsd, false)} in the last 24 hours.`, rule: words, reading7d, reading24h };
  }
  const newcomers = reading7d.verdict === "SMART_EXIT" && reading7d.newUsd !== null ? ` while new wallets took in ${usd(reading7d.newUsd, false)}` : "";
  const today = reading24h ? `; in the last 24 hours they have not turned buyers (${usd(reading24h.informedUsd)})` : "; the 24-hour read did not answer";
  return { decision: "WAIT", because: `The best and smart traders sent out ${usd(Math.abs(reading7d.informedUsd), false)} over 7 days${newcomers}${today}.`, rule: words, reading7d, reading24h };
}

/* ----------------------------------------------------------------------------
 * The universe: which tokens are tokenized stocks, and which to read first.
 * ------------------------------------------------------------------------- */

export type Stock = Readonly<{ symbol: string; name: string; mint: string; issuer: string; dailyVolumeUsd: number | null; priceUsd: number | null }>;

export const ISSUER_WORDS: Readonly<Record<string, string>> = { xstocks: "xStocks", prestocks: "PreStocks", ondo: "Ondo", backpack: "Backpack" };

const MINT = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** Rows of Ryntra's public universe (`/api/stocks/universe?shape=slim`) or a saved snapshot into stocks. */
export function parseUniverse(json: unknown): Stock[] {
  const rows = Array.isArray(json) ? json : json && typeof json === "object" ? ((json as { rows?: unknown }).rows ?? (json as { stocks?: unknown }).stocks) : null;
  if (!Array.isArray(rows)) return [];
  const stocks: Stock[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const mint = typeof r.mint === "string" ? r.mint : "";
    const symbol = typeof r.symbol === "string" ? r.symbol.trim() : "";
    if (!MINT.test(mint) || symbol === "" || seen.has(mint)) continue;
    if (r.tradable === false) continue;
    seen.add(mint);
    stocks.push({
      symbol: symbol.slice(0, 16),
      name: typeof r.name === "string" ? r.name.slice(0, 60) : symbol,
      mint,
      issuer: typeof r.issuer === "string" ? r.issuer : "unknown",
      dailyVolumeUsd: finite(r.volume ?? r.dailyVolumeUsd),
      priceUsd: finite(r.price ?? r.priceUsd),
    });
  }
  return stocks;
}

/** The N most traded stocks of the chosen issuers, most traded first. */
export function pickStocks(stocks: readonly Stock[], input: { top: number; issuer: string }): Stock[] {
  const wanted = input.issuer === "all" ? stocks : stocks.filter((stock) => stock.issuer === input.issuer);
  return [...wanted].sort((a, b) => (b.dailyVolumeUsd ?? 0) - (a.dailyVolumeUsd ?? 0)).slice(0, Math.max(1, Math.floor(input.top)));
}

/** One stock by its symbol (any case) or its mint. */
export function findStock(stocks: readonly Stock[], query: string): Stock | null {
  const wanted = query.trim();
  return stocks.find((stock) => stock.mint === wanted) ?? stocks.find((stock) => stock.symbol.toLowerCase() === wanted.toLowerCase()) ?? null;
}

/** How far up the board a verdict goes: what the best and smart traders did first, then whales, then the rest. */
const VERDICT_PRIORITY: Readonly<Record<Verdict, number>> = { SMART_EXIT: 3, SMART_SELLING: 3, SMART_ENTRY: 3, WHALES_LOADING: 2, TO_EXCHANGES: 1, MIXED: 1, QUIET: 0 };

/**
 * The board's order: every stock where the best and smart traders moved, the
 * largest dollar move first; then whales; then everything else by its
 * largest move; then the quiet; the unanswered last.
 */
export function rankReadings<T extends Readonly<{ reading: Reading | null }>>(rows: readonly T[]): T[] {
  const key = (row: T): [number, number, number] => {
    if (!row.reading) return [-1, 0, 0];
    const { reading } = row;
    const other = Math.max(...[reading.newUsd, reading.whaleUsd, reading.exchangeUsd].map((value) => Math.abs(value ?? 0)));
    return [VERDICT_PRIORITY[reading.verdict], Math.abs(reading.informedUsd ?? 0), other];
  };
  return [...rows].sort((a, b) => {
    const [pa, ia, oa] = key(a);
    const [pb, ib, ob] = key(b);
    return pb - pa || ib - ia || ob - oa;
  });
}
