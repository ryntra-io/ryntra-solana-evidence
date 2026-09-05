# Changelog

## Unreleased

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
