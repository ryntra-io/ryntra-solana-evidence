# Changelog

Notable changes to the Ryntra Solana Evidence Kit. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — unreleased

**Initial public release** of this repository. The kit itself is not new — it
was published as `ryntra-solana-evidence` v0.1.0 on 2026-08-17 — but that
repository is retired with its history rather than continued, so the same
discipline applies across the whole organization: fresh repository, fresh
history, and a first tag that does not imply a predecessor inside it.

No capability changes from v0.1.0. Everything below is publication hygiene.

### Added

- `packages/solana-evidence-sdk/public-files.json` — the list of files this kit
  is made of, carrying paths and roles and nothing else. The boundary test reads
  it, so a file added to the kit without being listed never ships.
- `lib/solana/address.ts`, the Base58 and confusables checks. It was written
  after v0.1.0 and has not been published before.

### Changed

- The boundary gate asserts that the removed manifest's leaked fields cannot
  come back, rather than merely not shipping them.
- Two preflight sentences that named an internal work item now say what is
  actually true of the kit: it builds no transaction, so there is nothing to
  simulate and no fee to quote.
- Comments that referenced internal planning were rewritten to describe the
  code.

### Removed

- `SOURCE-MANIFEST.json`. It published an internal task id, the private export
  paths that generated the tree, and an array that mapped private test layout. Its useful half — the file list — is now
  `public-files.json`.

### Not in this release

- No transaction building, signing, submission or simulation. This kit reads.
- No audit, and no safety judgement. A policy verdict reports the absence of
  known blockers under a policy the caller declared.

## [0.1.0] — 2026-08-17, in the retired repository

Token-2022 asset passports, SPL and Token-2022 transfer preflight against a
declared owner policy, offline receipt verification, four published JSON
Schemas, a typed SDK, a local stdio MCP server and a CLI.

Kept here as the record of when this work was first published. It is not a tag
in this repository — the history it belonged to is not this one.
