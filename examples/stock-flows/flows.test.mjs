import assert from "node:assert/strict";
import test from "node:test";

import { findStock, guard, parseFlowRow, parseRule, parseUniverse, pickStocks, rankReadings, readFlows, thresholdUsd, usd } from "./flows.ts";
import { colorWanted, parseArgs, restoreBoard } from "./radar.ts";
import { escapeHtml, renderReport } from "./report.ts";

/* A row shaped exactly as flow intelligence answered for NVDAx over 7 days on 2026-09-25. */
const NVDAX_7D = {
  public_figure_net_flow_usd: -73867.3,
  public_figure_wallet_count: 140,
  top_pnl_net_flow_usd: -910722.9,
  top_pnl_wallet_count: 33,
  whale_net_flow_usd: 57450.4,
  whale_wallet_count: 8,
  smart_trader_net_flow_usd: -42951.2,
  smart_trader_wallet_count: 91,
  exchange_net_flow_usd: -275841.9,
  exchange_wallet_count: 0,
  fresh_wallets_net_flow_usd: 17255758.1,
  fresh_wallets_wallet_count: 0,
};
const NVDAX_VOLUME = 22_661_567;

function row(values) {
  const base = { top_pnl_net_flow_usd: 0, smart_trader_net_flow_usd: 0, whale_net_flow_usd: 0, public_figure_net_flow_usd: 0, exchange_net_flow_usd: 0, fresh_wallets_net_flow_usd: 0 };
  return parseFlowRow({ ...base, ...values });
}

const fresh = (read) => ({ state: "FRESH", read, reason: null });
const missing = { state: "UNAVAILABLE", read: null, reason: "the provider could not be reached" };

test("a flow-intelligence row becomes six group flows; groups the provider does not count carry no wallet count", () => {
  const read = parseFlowRow(NVDAX_7D, ["exchange_wallet_count is always 0 (not tracked)"]);
  assert.ok(read);
  assert.equal(read.groups.top_pnl.netUsd, -910722.9);
  assert.equal(read.groups.top_pnl.wallets, 33);
  assert.equal(read.groups.exchange.wallets, null);
  assert.equal(read.groups.fresh_wallets.wallets, null);
  assert.deepEqual(read.warnings, ["exchange_wallet_count is always 0 (not tracked)"]);
  assert.equal(parseFlowRow({ top_pnl_net_flow_usd: "12.5" }).groups.top_pnl.netUsd, 12.5);
});

test("an empty or foreign answer is no answer, never a quiet market", () => {
  assert.equal(parseFlowRow(null), null);
  assert.equal(parseFlowRow({}), null);
  assert.equal(parseFlowRow({ token_address: "x", volume: 5 }), null);
  assert.equal(parseFlowRow("row"), null);
});

test("the threshold is 2 % of a day's volume and never below $10,000", () => {
  assert.equal(thresholdUsd(null), 10_000);
  assert.equal(thresholdUsd(0), 10_000);
  assert.equal(thresholdUsd(100_000), 10_000);
  assert.equal(thresholdUsd(NVDAX_VOLUME), 453_231);
});

test("money is short, signed and uses a true minus sign", () => {
  assert.equal(usd(17_255_758), "+$17M");
  assert.equal(usd(-910_723), "−$911K");
  assert.equal(usd(-4_400), "−$4.4K");
  assert.equal(usd(1_000), "+$1K");
  assert.equal(usd(4_700_000), "+$4.7M");
  assert.equal(usd(0), "$0");
  assert.equal(usd(null), "—");
  assert.equal(usd(-954_000, false), "$954K");
});

test("NVDAx: the best traders sending out while new wallets take in is a smart exit", () => {
  const reading = readFlows(parseFlowRow(NVDAX_7D), { dailyVolumeUsd: NVDAX_VOLUME });
  assert.equal(reading.verdict, "SMART_EXIT");
  assert.equal(Math.round(reading.informedUsd), -953674);
  assert.match(reading.sentence, /sent out \$954K; new wallets took in \$17M/);
  assert.equal(reading.sellers[0].group, "top_pnl");
  assert.equal(reading.buyers[0].group, "fresh_wallets");
});

test("each verdict is reached by the move it names", () => {
  const volume = 1_000_000; // threshold $20,000
  assert.equal(readFlows(row({ top_pnl_net_flow_usd: 500_000 }), { dailyVolumeUsd: volume }).verdict, "SMART_ENTRY");
  assert.equal(readFlows(row({ smart_trader_net_flow_usd: -500_000 }), { dailyVolumeUsd: volume }).verdict, "SMART_SELLING");
  assert.equal(readFlows(row({ exchange_net_flow_usd: 1_000_000 }), { dailyVolumeUsd: volume }).verdict, "TO_EXCHANGES");
  assert.equal(readFlows(row({ whale_net_flow_usd: 1_000_000 }), { dailyVolumeUsd: volume }).verdict, "WHALES_LOADING");
  assert.equal(readFlows(row({ exchange_net_flow_usd: -535_000, fresh_wallets_net_flow_usd: 2_800_000 }), { dailyVolumeUsd: volume }).verdict, "MIXED");
  assert.equal(readFlows(row({ top_pnl_net_flow_usd: -352, whale_net_flow_usd: 2_900 }), { dailyVolumeUsd: volume }).verdict, "QUIET");
});

test("the guard waits while the best traders are leaving and they have not turned buyers today", () => {
  const week = fresh(parseFlowRow(NVDAX_7D));
  const day = fresh(row({ top_pnl_net_flow_usd: -4_400, smart_trader_net_flow_usd: -7_400, fresh_wallets_net_flow_usd: 2_600_000 }));
  const result = guard({ week, day, dailyVolumeUsd: NVDAX_VOLUME });
  assert.equal(result.decision, "WAIT");
  assert.match(result.because, /sent out \$954K over 7 days while new wallets took in \$17M; in the last 24 hours they have not turned buyers \(−\$12K\)/);
});

test("the guard buys when the best traders turned buyers in the last day, or were not sellers at all", () => {
  const week = fresh(parseFlowRow(NVDAX_7D));
  const turned = fresh(row({ top_pnl_net_flow_usd: 600_000 }));
  assert.equal(guard({ week, day: turned, dailyVolumeUsd: NVDAX_VOLUME }).decision, "BUY");
  const calm = fresh(row({ top_pnl_net_flow_usd: 90_000, fresh_wallets_net_flow_usd: 1_000_000 }));
  assert.equal(guard({ week: calm, day: missing, dailyVolumeUsd: NVDAX_VOLUME }).decision, "BUY");
});

test("an unknown is never a pass: a missing window or a missing figure is a WAIT with the reason", () => {
  const result = guard({ week: missing, day: missing, dailyVolumeUsd: NVDAX_VOLUME });
  assert.equal(result.decision, "WAIT");
  assert.match(result.because, /did not answer \(the provider could not be reached\)/);
  const noInformed = fresh(parseFlowRow({ whale_net_flow_usd: 5_000 }));
  assert.equal(guard({ week: noInformed, day: missing }).decision, "WAIT");
  const noDay = guard({ week: fresh(parseFlowRow(NVDAX_7D)), day: missing, dailyVolumeUsd: NVDAX_VOLUME });
  assert.equal(noDay.decision, "WAIT");
  assert.match(noDay.because, /the 24-hour read did not answer/);
});

test("a written rule decides instead, over the window it names, and refuses what it cannot judge", () => {
  const week = fresh(parseFlowRow(NVDAX_7D));
  const day = fresh(row({ whale_net_flow_usd: -36_000 }));
  assert.equal(guard({ week, day, rule: parseRule("whale >= 0") }).decision, "BUY");
  assert.equal(guard({ week, day, rule: parseRule("whale >= 0 24h") }).decision, "WAIT");
  assert.equal(guard({ week, day, rule: parseRule("informed >= -1000000 7d") }).decision, "BUY");
  assert.equal(guard({ week, day: missing, rule: parseRule("top_pnl >= 0 24h") }).decision, "WAIT");
  assert.equal(parseRule("whales >= 0"), null);
  assert.equal(parseRule("whale > 0"), null);
  assert.equal(parseRule("whale >= lots"), null);
  assert.equal(parseRule("whale >= 0 30d"), null);
  assert.deepEqual(parseRule("fresh_wallets <= 5e6 24h"), { group: "fresh_wallets", operator: "<=", usd: 5_000_000, window: "24h" });
});

const UNIVERSE = {
  rows: [
    { mint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh", symbol: "NVDAx", name: "NVIDIA", issuer: "xstocks", volume: 22_661_567, price: 225.05, tradable: true },
    { mint: "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh", symbol: "SPACEX", name: "SpaceX", issuer: "prestocks", volume: 90_000, price: 400 },
    { mint: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W", symbol: "SPYx", name: "SP500", issuer: "xstocks", volume: 18_100_000 },
    { mint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh", symbol: "NVDAx", name: "duplicate", issuer: "xstocks", volume: 1 },
    { mint: "not-a-mint", symbol: "BAD", issuer: "xstocks", volume: 5 },
    { mint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp", symbol: "AAPLx", name: "Apple", issuer: "xstocks", volume: 5, tradable: false },
  ],
};

test("the universe keeps real, tradable, unique mints and ranks by a day's volume", () => {
  const stocks = parseUniverse(UNIVERSE);
  assert.deepEqual(stocks.map((stock) => stock.symbol), ["NVDAx", "SPACEX", "SPYx"]);
  assert.deepEqual(pickStocks(stocks, { top: 2, issuer: "all" }).map((stock) => stock.symbol), ["NVDAx", "SPYx"]);
  assert.deepEqual(pickStocks(stocks, { top: 5, issuer: "prestocks" }).map((stock) => stock.symbol), ["SPACEX"]);
  assert.equal(findStock(stocks, "nvdax")?.name, "NVIDIA");
  assert.equal(findStock(stocks, "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh")?.symbol, "SPACEX");
  assert.equal(findStock(stocks, "TSLAx"), null);
  assert.deepEqual(parseUniverse({ nothing: true }), []);
});

test("the board puts the largest move by the best and smart traders first and the unanswered last", () => {
  const volume = 1_000_000;
  const rows = [
    { name: "quiet", reading: readFlows(row({ top_pnl_net_flow_usd: 10 }), { dailyVolumeUsd: volume }) },
    { name: "none", reading: null },
    { name: "exchanges", reading: readFlows(row({ exchange_net_flow_usd: 9_000_000 }), { dailyVolumeUsd: volume }) },
    { name: "small exit", reading: readFlows(row({ top_pnl_net_flow_usd: -100_000, fresh_wallets_net_flow_usd: 1_000_000 }), { dailyVolumeUsd: volume }) },
    { name: "big entry", reading: readFlows(row({ smart_trader_net_flow_usd: 700_000 }), { dailyVolumeUsd: volume }) },
  ];
  assert.deepEqual(rankReadings(rows).map((entry) => entry.name), ["big entry", "small exit", "exchanges", "quiet", "none"]);
});

test("the report escapes everything that came from outside and carries the attribution", () => {
  const stock = { symbol: "<script>x</script>", name: "A & B", mint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh", issuer: "xstocks", dailyVolumeUsd: NVDAX_VOLUME, priceUsd: 1 };
  const read = parseFlowRow(NVDAX_7D);
  const html = renderReport([{ stock, read, reading: readFlows(read, { dailyVolumeUsd: NVDAX_VOLUME }), reason: null }], { window: "7d", askedAt: "2026-09-25 23:50 UTC", calls: 1, credits: 1, remaining: 19_965, universeSource: "ryntra.io/api/stocks/universe" });
  assert.ok(!html.includes("<script"));
  assert.ok(html.includes("&lt;script&gt;x&lt;/script&gt;"));
  assert.ok(html.includes("A &amp; B"));
  assert.ok(html.includes("Powered by Nansen API"));
  assert.ok(html.includes("Smart exit"));
  assert.ok(html.includes("movement, not a trade"));
  assert.equal(escapeHtml(`"'<>&`), "&quot;&#39;&lt;&gt;&amp;");
});

test("the command line: defaults, the three commands, and every bad value refused with a reason", () => {
  const board = parseArgs([]);
  assert.equal(board.command, "board");
  assert.equal(board.top, 20);
  assert.equal(board.window, "7d");
  assert.equal(board.issuer, "all");
  assert.equal(parseArgs(["guard", "NVDAx", "--usd", "1", "--rule", "informed >= 0"]).target, "NVDAx");
  assert.equal(parseArgs(["render", "board.json", "--html", "out.html"]).html, "out.html");
  assert.equal(parseArgs(["--no-color"], { NO_COLOR: "1" }).color, false);
  assert.match(parseArgs(["guard"]).error, /needs a symbol/);
  assert.match(parseArgs(["render"]).error, /needs the board/);
  assert.match(parseArgs(["--top", "0"]).error, /--top/);
  assert.match(parseArgs(["--window", "30d"]).error, /--window/);
  assert.match(parseArgs(["--rule", "whales > 1"]).error, /not one this tool can judge/);
  assert.match(parseArgs(["--html"]).error, /needs a value/);
  assert.match(parseArgs(["sell"]).error, /Unknown command/);
  assert.equal(colorWanted({}, true), true);
  assert.equal(colorWanted({}, false), false);
  assert.equal(colorWanted({ FORCE_COLOR: "1" }, false), true);
  assert.equal(colorWanted({ FORCE_COLOR: "0" }, false), false);
  assert.equal(colorWanted({ NO_COLOR: "1", FORCE_COLOR: "1" }, true), false);
});

test("a board saved with --json redraws offline with the same verdicts", () => {
  const read = parseFlowRow(NVDAX_7D);
  const saved = {
    window: "7d",
    askedAt: "2026-09-25 23:50 UTC",
    universe: "ryntra.io/api/stocks/universe",
    ledger: { requests: 1, usedCredits: 1, remainingReported: 19_965 },
    rows: [{ ...UNIVERSE.rows[0], dailyVolumeUsd: NVDAX_VOLUME, verdict: "SMART_EXIT", groups: read.groups, warnings: [] }],
  };
  const restored = restoreBoard(JSON.parse(JSON.stringify(saved)));
  assert.ok(restored);
  assert.equal(restored.rows[0].reading.verdict, "SMART_EXIT");
  assert.equal(restored.meta.remaining, 19_965);
  assert.equal(restoreBoard({ rows: "no" }), null);
});
