# Ryntra — product documentation

Ryntra is a Solana-first application for trading with rules you write before
you sign: swaps, a spot terminal, tokenized stocks, trading plans, a
pre-signature review of every operation, a portfolio and a history with
receipts, and public statistics of what was executed. It runs at
[ryntra.io](https://ryntra.io) in English and Ukrainian, dark and light, on
desktop and phone.

This documentation describes the product that exists today. The application
is developed in a private repository; this public repository carries selected
open-source components, the public technical interfaces, this documentation
and a [build log](../../BUILDLOG.md) of what has shipped.

| Page | What it covers |
|---|---|
| [Trading](trading.md) | Swap, the Spot terminal, the bridge, fees, and what happens between a quote and a confirmed operation |
| [Tokenized stocks](tokenized-stocks.md) | Listed equities and pre-IPO exposure as tokens on Solana: issuers, units, reference prices, rights and lifecycle |
| [Trading plans](trading-plans.md) | The rules a person writes before signing, how the size is computed, how the plan binds the deal |
| [Risk review](risk-review.md) | The Review that runs before every signature, and the evidence it is built on |
| [Analytics](analytics.md) | The public statistics: the operations ledger, the on-chain attributable subset, the public dashboard |
| [`status.json`](status.json) | Machine-readable: the live address, the public capabilities and the latest public update |

## How the pieces fit

```
  discover          decide              review                sign & execute        keep
  Stocks / Spot  →  Trading plan     →  pre-signature Review → wallet signs;        →  History · Portfolio
  market data       thesis, money,      quote, fees, units,     provider executes       receipts · Stats
  issuer facts      entry, exit         reference, plan rules   on Solana
```

Ryntra owns the model — what an instrument is, what one unit means, which
rules a plan states, what the Review checks, how an operation is recorded and
proven. External infrastructure performs execution and supplies evidence:
[Jupiter](https://jup.ag) routes and executes swaps on Solana; Circle's CCTP
moves USDC between Solana and Base; Mayan and Relay route cross-chain
transfers; the issuers' own catalogues confirm which mints are stocks; Pyth and
the issuers supply reference prices and exchange sessions; the Solana network
is the record every confirmed operation is verified against.

## What Ryntra does not do

- It never holds a private key or custody of funds. Every operation is signed
  by the person's own wallet; Ryntra prepares, reviews, submits and records.
- It does not decide for the person. The Review states facts and refuses an
  order that breaks the person's own rules; it does not judge whether a trade
  is a good idea.
- It does not promise results. Prices, references and issuer facts are shown
  with their source and their time; a deviation is a fact about one quote
  against one reference, and the plan's modelled loss is a model.
- It does not change an issuer's terms. Rights, availability by jurisdiction
  and redemption are the issuer's, stated in the issuer's words and linked to
  the issuer's own page.

## Status

Ryntra is in beta. The current public capabilities and the latest public
update are in [`status.json`](status.json); what shipped and when is in the
[build log](../../BUILDLOG.md).
