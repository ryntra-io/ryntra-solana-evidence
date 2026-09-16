# @ryntra/evidence

The market-evidence layer a Trading Plan's conditions stand on at
[ryntra.io/app/strategies](https://ryntra.io/app/strategies). An observation
about a token — how much was traded, what moved to or from the addresses a
source labels — arrives with its provenance: the provider, the window, when
Ryntra asked, how far behind the source may be, when the figures stop
counting as current, and the attribution the source's terms require. A person
writes a rule on one of its figures; before anything is signed the rule is
judged against a fresh observation, and a rule that cannot be judged is never
a pass.

These are the modules the Ryntra product runs on, imported rather than copied.
The product's shared cache and shared credit ledger sit above them and are not
part of this package.

## What is here

| Module | What it does | Network |
|---|---|---|
| `metrics` | The registry: seven figures, their units, the windows they serve, and whether a figure may refuse an order (`whole-market`) or only warn (`cohort` — a labelled group's movement is a transfer, not a trade). Words in English and Ukrainian. | none |
| `snapshot` | The normalized observation: `fetchedAt` (when we asked), `observedAt` (the source's own statement, or null), `providerLagSeconds` (the source's documented cache), `expiresAt` (our freshness rule), figures with `null` where the source answered none — never a zero in their place. | none |
| `conditions` | `validateEvidenceConditions` (the registry applied: metric, window, operator, threshold's sign and unit, mode and its unknown-policy) and `judgeEvidenceCondition` (pass · fail · unknown, with figure strings both languages read). | none |
| `rights` | The rights map read from the provider's redistribution guide and API terms: which families may be shown, which fields the mapper may read, how long a copy may be held, the attribution. Anything restricted or prohibited is not callable. | none |
| `governor` | The credit governor's contract and a one-process implementation for scripts. | none |
| `providers/nansen` | The client (one key from the environment, one retry on a mendable failure, only the families the rights map allows), the mapper (named fields only), the adapter (reserve → call → settle on the provider's own credit headers). | Nansen API, read-only |

## Judge a rule

```ts
import { judgeEvidenceCondition, validateEvidenceConditions } from "@ryntra/evidence";

const rule = { metric: "dex_volume_usd", window: "24h", operator: "gte", threshold: 250_000, mode: "required", onUnknown: "block" };
validateEvidenceConditions([rule]); // [] — the registry serves this figure, this window, this mode

const judged = judgeEvidenceCondition(rule, read, Date.now());
// read is a MarketEvidenceRead: FRESH | STALE with a snapshot, UNKNOWN, or UNAVAILABLE with a reason
// judged.outcome   "pass" | "fail" | "unknown"
// judged.expected  "24h DEX trading volume ≥ $250,000"
// judged.actual    "$1,284,530 · asked 11:58 UTC"   (or "stale", "no data", "unavailable")
```

`unknown` is every honest state that is not a measurement — no snapshot, a
snapshot for another window, a figure the source did not answer, a snapshot
past its expiry, a provider or a budget that refused — and a `required` rule
blocks on it, because a pass the data did not earn is the one thing this
module exists to prevent. A rule on a labelled group's movement is refused
at write time if it asks to block: it may inform, never refuse.

## Read an observation with your own key

```
NANSEN_API_KEY=<your key> node packages/evidence/src/live-read.mjs DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263 24h --rule "dex_volume_usd gte 500000"
```

Two governed calls (the token screener filtered to the mint, flow
intelligence for the labelled groups), one credit each on the provider's
published prices, a ceiling of four credits unless `--ceiling` says otherwise;
the snapshot printed with its times and attribution, the rule judged, the
governor's ledger last. The key is read from the environment and never
printed.

```ts
import { createMemoryGovernor, createNansenAdapter, createNansenClient } from "@ryntra/evidence";

const adapter = createNansenAdapter({ client: createNansenClient({ key: process.env.NANSEN_API_KEY ?? null }), governor: createMemoryGovernor(4) });
const read = await adapter.read({ mint, window: "24h", nowMs: Date.now() });
```

## Boundaries

- Figures are shown under the provider's redistribution terms with the
  attribution beside them; the rights map names what is allowed, restricted
  and prohibited, and the client refuses any family outside it.
- A movement to or from a labelled group is a transfer, not a trade; a label
  is the source's classification, not a person; an address count is
  addresses, not people.
- Nothing here is a price, a quote or advice. A met condition says the rule
  held at that moment; it says nothing about whether a trade is good.
- No storage, no signing, no order placement. The product's cache, credit
  ledger, review and execution are not in this package.

Apache-2.0.
