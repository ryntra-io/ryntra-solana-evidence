/**
 * The board as one self-contained HTML page — no script, no build step, one
 * file a person can open, attach or put on a screen. Every value that came
 * from outside (a symbol, a name, a provider warning) is escaped before it is
 * written; the page carries the provider's attribution and the three rules
 * of reading a flow.
 */

import { GROUP_WORDS, ISSUER_WORDS, usd, VERDICT_WORDS, type FlowGroup, type FlowRead, type FlowWindow, type Reading, type Stock, type Verdict } from "./flows.ts";

export type BoardRow = Readonly<{ stock: Stock; read: FlowRead | null; reading: Reading | null; reason: string | null }>;

export type BoardMeta = Readonly<{
  window: FlowWindow;
  askedAt: string;
  calls: number;
  credits: number;
  remaining: number | null;
  universeSource: string;
}>;

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

const TONE_CLASS: Readonly<Record<string, string>> = { sell: "t-sell", buy: "t-buy", watch: "t-watch", calm: "t-calm" };

function flowClass(value: number | null): string {
  if (value === null || value === 0) return "f-zero";
  return value > 0 ? "f-in" : "f-out";
}

/** The groups in the order a buyer reads them: those with a record first, the crowd last. */
const CARD_GROUPS: readonly FlowGroup[] = ["top_pnl", "smart_trader", "whale", "public_figure", "exchange", "fresh_wallets"];

/**
 * One group's net flow as a bar that grows left (out) or right (in) from the
 * card's centre line. Bars share one square-root scale per card, so a $900K
 * move stays visible beside a $17M one; the exact figure is printed beside
 * every bar and the scale is said in the footer.
 */
function flowRow(label: string, value: number | null, scale: number, strong: boolean): string {
  const share = value === null || value === 0 || scale <= 0 ? 0 : Math.min(1, Math.sqrt(Math.abs(value)) / Math.sqrt(scale));
  const width = `${(share * 100).toFixed(1)}%`;
  const bar = `<span class="bar ${flowClass(value)}" style="--w:${width}"></span>`;
  return `<div class="row${strong ? " strong" : ""}"><span class="who">${escapeHtml(label)}</span><span class="half left">${value !== null && value < 0 ? bar : ""}</span><span class="axis"></span><span class="half right">${value !== null && value > 0 ? bar : ""}</span><b class="${flowClass(value)}">${escapeHtml(usd(value))}</b></div>`;
}

function card(row: BoardRow, rank: number): string {
  const { stock, reading, read } = row;
  const issuer = escapeHtml(ISSUER_WORDS[stock.issuer] ?? stock.issuer);
  const head = `<div class="head"><span class="rank">${rank}</span><div class="id"><b>${escapeHtml(stock.symbol)}</b><span>${escapeHtml(stock.name)}</span></div><span class="issuer">${issuer}</span></div>`;
  if (!reading || !read) {
    return `<article class="card muted">${head}<p class="verdict t-calm">No answer</p><p class="sentence">${escapeHtml(row.reason ?? "The provider did not answer for this token.")}</p></article>`;
  }
  const words = VERDICT_WORDS[reading.verdict];
  const scale = Math.max(1, ...CARD_GROUPS.map((group) => Math.abs(read.groups[group].netUsd ?? 0)));
  const informedLed = reading.verdict === "SMART_EXIT" || reading.verdict === "SMART_SELLING" || reading.verdict === "SMART_ENTRY";
  const rows = CARD_GROUPS.map((group) => flowRow(GROUP_WORDS[group].label, read.groups[group].netUsd, scale, informedLed && (group === "top_pnl" || group === "smart_trader"))).join("");
  const aria = CARD_GROUPS.map((group) => `${GROUP_WORDS[group].label} ${usd(read.groups[group].netUsd)}`).join(", ");
  return `<article class="card">${head}
<p class="verdict ${TONE_CLASS[words.tone]}">${escapeHtml(words.title)}</p>
<div class="flows" role="img" aria-label="${escapeHtml(aria)}">${rows}</div>
<p class="sentence">${escapeHtml(reading.sentence)}</p>
</article>`;
}

/** The summary's order: the verdicts about the best and smart traders first. */
const SUMMARY_ORDER: readonly Verdict[] = ["SMART_EXIT", "SMART_SELLING", "SMART_ENTRY", "WHALES_LOADING", "TO_EXCHANGES", "MIXED", "QUIET"];

export function renderReport(rows: readonly BoardRow[], meta: BoardMeta): string {
  const counts = new Map<Verdict, number>();
  for (const row of rows) if (row.reading) counts.set(row.reading.verdict, (counts.get(row.reading.verdict) ?? 0) + 1);
  const summary = [...counts.entries()]
    .sort((a, b) => SUMMARY_ORDER.indexOf(a[0]) - SUMMARY_ORDER.indexOf(b[0]))
    .map(([verdict, count]) => `<span class="sum ${TONE_CLASS[VERDICT_WORDS[verdict].tone]}">${count} · ${escapeHtml(VERDICT_WORDS[verdict].title)}</span>`)
    .join("");
  const windowWords = meta.window === "7d" ? "7 days" : "24 hours";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Who is on the other side — tokenized stocks on Solana</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
:root{color-scheme:dark;--bg:#080D13;--panel:#0E1620;--line:#22303E;--text:#E8EDF2;--dim:#8A97A6;--accent:#FF681C;--in:#3DD68C;--out:#FF5A5F;--watch:#F5B544}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--text);font-family:Geist,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1280px;margin:0 auto;padding:40px 24px 56px}
header h1{font-size:clamp(2rem,5vw,3rem);font-weight:650;line-height:1.05;margin:0 0 12px;letter-spacing:-.025em}header h1 span{color:var(--accent)}
header p{margin:0;color:var(--dim);font-size:.9375rem;line-height:1.55}
.sums{display:flex;flex-wrap:wrap;gap:8px;margin:22px 0 26px}.sum{font-size:.875rem;padding:6px 10px;border-radius:999px;border:1px solid var(--line);background:var(--panel)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:10px}
.card.muted{opacity:.6}
.head{display:flex;align-items:center;gap:10px}.rank{font-family:"Geist Mono",ui-monospace,monospace;color:var(--dim);font-size:.75rem;width:18px}
.id{display:flex;flex-direction:column;min-width:0;flex:1}.id b{font-size:1.125rem;font-weight:600;letter-spacing:-.01em}.id span{color:var(--dim);font-size:.875rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.issuer{font-size:.75rem;color:var(--dim);border:1px solid var(--line);border-radius:6px;padding:3px 6px}
.verdict{margin:0;font-weight:600;font-size:.9375rem}.t-sell{color:var(--out)}.t-buy{color:var(--in)}.t-watch{color:var(--watch)}.t-calm{color:var(--dim)}
.flows{display:flex;flex-direction:column;gap:5px}
.row{display:grid;grid-template-columns:96px 1fr 2px 1fr 64px;gap:6px;align-items:center;font-size:.75rem;color:var(--dim)}
.row .who{white-space:nowrap}.row.strong .who{color:var(--text);font-weight:600}
.row .axis{height:14px;background:var(--line);border-radius:2px}
.half{display:flex;height:10px}.left{justify-content:flex-end}.right{justify-content:flex-start}
.bar{display:block;height:100%;width:var(--w);min-width:2px;border-radius:4px}.bar.f-in{background:var(--in)}.bar.f-out{background:var(--out)}.bar.f-zero{background:transparent;min-width:0}
.row b{font-family:"Geist Mono",ui-monospace,monospace;font-size:.75rem;font-weight:500;text-align:right;font-variant-numeric:tabular-nums}
.row.strong b{font-size:.875rem;font-weight:600}
b.f-in{color:var(--in)}b.f-out{color:var(--out)}b.f-zero{color:var(--dim)}
.sentence{margin:0;color:var(--text);font-size:.875rem;line-height:1.5}
footer{margin-top:28px;color:var(--dim);font-size:.875rem;line-height:1.6;border-top:1px solid var(--line);padding-top:16px}footer a{color:var(--text)}
@media (max-width:520px){main{padding:28px 16px 40px}}
</style>
</head>
<body>
<main>
<header>
<h1>Who is on the <span>other side</span></h1>
<p>Tokenized stocks on Solana · net flow by wallet group over ${windowWords} · the ${rows.length} most traded · data from Nansen, asked ${escapeHtml(meta.askedAt)}</p>
</header>
<div class="sums">${summary}</div>
<section class="grid">
${rows.map((row, index) => card(row, index + 1)).join("\n")}
</section>
<footer>
<p><a href="https://nansen.ai">Powered by Nansen API</a> — flow intelligence, one call per token. ${meta.calls} calls · ${meta.credits} credits${meta.remaining !== null ? ` · ${meta.remaining.toLocaleString("en-US")} left on the key` : ""}. Universe: ${escapeHtml(meta.universeSource)}.</p>
<p>A flow is movement, not a trade: tokens that arrived in or left the group's wallets, in USD; bars share a square-root scale within each card, the figures are exact. A group is Nansen's label, not an identity. Best + smart traders = Nansen's top-PnL and smart-trader wallets together. Nothing here is advice.</p>
<p>Made with <code>examples/stock-flows</code> in <a href="https://github.com/ryntra-io/ryntra-solana-evidence">ryntra-solana-evidence</a>. <a href="https://ryntra.io/app">Ryntra</a> runs the same fail-closed check before a signature.</p>
</footer>
</main>
</body>
</html>
`;
}
