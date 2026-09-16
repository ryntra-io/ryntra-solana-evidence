# Changelog

## [1.4.0] — 2026-09-16

- `@ryntra/evidence` 0.2.0: a second provider on the same registry — the
  token's structure as point-in-time figures (`now`): the top-ten holder
  share, the holder count, the mint and freeze authority (a flag a rule can
  name: renounced or present), the transfer tax, and the source's sniper,
  bundler and developer shares as cohort figures that may warn, never
  refuse; the condition validator and judge extended to percent, count and
  flag units; `readsOf` — the (provider, window) reads a list of conditions
  needs; the rights map for DD.xyz (derived aggregates with attribution;
  address lists never pass; plan-gated and unsupported families named and
  never called); the address evidence a recipient check reads (sanctions in
  the source's own words, findings as counts by severity with the source's
  own figure and band, unsupported for a program-owned account — never
  clean) with one summary word, none of which is "safe"; the compact
  structure state with no threshold behind it; the DD.xyz client (one key,
  `chain=sol` on every call, one request a second, a retry only for a network
  error or a timeout), mapper (a zero the engine could not have measured is
  an absence) and adapter (reserve → call → settle on the provider's own
  `x-webacy-cu` price). Network-free tests over a fake provider.
- Product documentation: *Rules on how the token is built* under trading
  plans; screenshots of the Risk & due diligence card and the recipient
  check in Send.

## [1.3.0] — 2026-09-16

- Add `@ryntra/evidence`: the market-evidence layer a Trading Plan's
  conditions stand on — a metric registry (seven figures; a labelled group's
  movement may warn, never refuse), a normalized observation with its three
  times kept apart and `null` where the source answered nothing, a condition
  validator on the registry and a judge where unmet, stale, unknown and
  unavailable are never a pass, a rights map read from the provider's
  redistribution guide and API terms, a credit-governor contract with a
  one-process governor for scripts, and the Nansen adapter (one key from the
  environment, one retry on a mendable failure, only the families the rights
  map allows, every call reserved and settled on the provider's own credit
  headers). Network-free tests over a fake provider; `live-read.mjs` reads a
  real observation with your own key under a four-credit ceiling.
- Product documentation: *Conditions on what the market did* under trading
  plans.

## [1.2.0] — 2026-09-16

- Add `@ryntra/tokenized-stocks`: the model of a tokenized stock on Solana —
  instrument class, unit basis and holder rights; the Token-2022 transfer fee
  from a mint's own config and the current epoch; the issuer lifecycle of a
  token from a pause, a verified issuer notice or the catalogue; scaled-unit
  arithmetic with an exact integer ratio; the state of a reference price
  judged from the source's observation time against the exchange session.
  Pure functions, network-free tests.
- Add `@ryntra/trading-plans`: deterministic sizing of a spot-long position
  from an entry, an invalidation, a budget and a planned risk, with the
  assumptions the figure stands on; and a reader of decimal input that
  understands `0,5`, `1 000,50` and refuses what it cannot read without
  guessing. Pure functions, network-free tests.
- Add `BUILDLOG.md`, the public record of what shipped in the Ryntra product
  and when, generated from structured entries; `docs/product` with the
  product documentation; `docs/product/status.json` with the live address,
  the public capabilities and the latest public update; `docs/screenshots`
  with selected screenshots of the live application.
- README: the *Ryntra product development* section states the boundary
  between the private production repository and this public projection.
- `scripts/verify-boundaries.mjs` admits `BUILDLOG.md` at the top level;
  every other new file is named by the public file list as before.

## [1.1.0] — 2026-09-14

- Move the shared evidence envelope to `lib/evidence/envelope.ts`; the Solana
  modules import the neutral implementation and no longer reach into a
  Stellar path. Public JSON formats, hashes and API signatures are unchanged.
- Harden `scripts/verify-boundaries.mjs`: sensitive filenames are refused in
  every path segment, every dependency must resolve from the public npm
  registry, and every file outside the repository template must be named by
  the public file list.
- Documentation: the README describes the toolkit's scope,
  quick start and boundaries; the organization profile points here.



- Fix the CLI's JSON verification exit status: tampered or unrecognised receipts
  now exit with code 2, matching text output. Verification results are unchanged.
- Clarify the toolkit's scope, quick start and integration boundaries.

## [1.0.0] — 2026-08-26

### Included

- SPL Token and Token-2022 mint inspection with asset passports, issuer
  authorities, extension semantics and provenance.
- Transfer preflight with integer fee calculations and caller-defined policy
  evaluation.
- Offline Outcome Receipt verification: schema, integrity, issuer signature and
  Solana binding reported separately.
- Typed SDK, local stdio MCP server, CLI and four JSON Schemas.
- Base58 address checks, receipt fixtures and network-free tests.
- Continuous lint, type checking and read-only boundary verification.

### Boundaries

This release does not build, simulate, sign or submit transactions. Receipt
verification does not independently establish on-chain settlement. A policy
verdict is not a safety judgement. The software has not been independently
audited.

[1.0.0]: https://github.com/ryntra-io/ryntra-solana-evidence/releases/tag/v1.0.0
