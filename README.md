# Ryntra Solana Evidence Kit

[![verify](https://github.com/ryntra-io/ryntra-solana-evidence/actions/workflows/ci.yml/badge.svg)](https://github.com/ryntra-io/ryntra-solana-evidence/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

Read-only Solana tooling for developers: inspect mints, check proposed transfers
against a caller-defined policy, and verify supplied receipts offline — plus
the pure models a venue needs before it shows a price for a tokenized stock or
sizes a trading plan.

Part of [Ryntra](https://ryntra.io), a Solana-first product for trading with
rules you write before you sign. This repository contains the evidence kit and
selected product models, not the application or its live transaction flows.

[Application](https://ryntra.io/app) · [Build log](BUILDLOG.md) ·
[Product documentation](docs/product/README.md) ·
[SDK](packages/solana-evidence-sdk/README.md) ·
[MCP server](packages/solana-evidence-mcp/README.md) ·
[CLI](examples/solana-evidence-cli/README.md) ·
[Tokenized stocks](packages/tokenized-stocks/README.md) ·
[Trading plans](packages/trading-plans/README.md) ·
[Evidence](packages/evidence/README.md)

## Ryntra product development

Ryntra is developed in a private production repository. This public repository
contains selected open-source components, public technical interfaces and a
sanitized record of shipped product development:

- **[BUILDLOG.md](BUILDLOG.md)** — what shipped in the product and when, newest
  first, with screenshots of the live application. Generated from structured
  entries and published with each meaningful slice of work.
- **[docs/product](docs/product/README.md)** — how the product works today:
  [trading](docs/product/trading.md), [tokenized stocks](docs/product/tokenized-stocks.md),
  [trading plans](docs/product/trading-plans.md), the [pre-signature review](docs/product/risk-review.md)
  and the [public analytics](docs/product/analytics.md); architecture boundaries,
  what Ryntra owns, which external infrastructure executes and supplies
  evidence, and the material limitations.
- **[docs/product/status.json](docs/product/status.json)** — machine-readable:
  the live address, the public capabilities, the latest public update.
- **Open-source modules** — the same code the product runs on, imported rather
  than copied: the [evidence kit](#what-works) below, the
  [tokenized-stock model](packages/tokenized-stocks/README.md), the
  [trading-plan helpers](packages/trading-plans/README.md) and the
  [evidence layer](packages/evidence/README.md) a plan's conditions stand on,
  each with network-free tests.

Every file here reaches this repository through an explicit publication list
and a set of boundary checks on the private side; a file nobody named
never ships, and `npm run verify` proves the tree stands on its own.

## What works

| Capability | Output | Network access |
|---|---|---|
| Mint inspection | Asset identity, authorities and SPL / Token-2022 extension data with provenance | Read-only Solana RPC |
| Transfer preflight | Mint-based fee calculations, structural constraints and a verdict against the declared owner policy | Read-only Solana RPC |
| Receipt verification | Separate schema, integrity, issuer-signature and Solana-binding results | None |
| Tokenized-stock model | Instrument class, unit basis and rights; the Token-2022 transfer fee from a mint's config; a token's issuer lifecycle; scaled-unit arithmetic; the state of a reference price against a session | None |
| Trading-plan helpers | Deterministic position sizing with its assumptions; decimal input read as typed | None |
| Evidence layer | A metric registry, a normalized onchain observation with its times and attribution, a condition validator and judge where an unjudgeable rule is never a pass, a rights map read from the provider's terms, and the Nansen adapter that reserves and settles every call | Nansen API, read-only, only through the adapter with your own key |

The first three are available through the typed SDK, local stdio MCP server and
CLI. The MCP server also exposes an editable example owner policy.
[Four JSON Schemas](docs/solana/schemas) describe asset passports, owner policies,
policy verdicts and transfer preflights. The two model packages are plain
TypeScript modules with tests.

## Run locally

Use Node.js 24 and npm. No wallet or API key is needed for the offline checks.

```bash
git clone https://github.com/ryntra-io/ryntra-solana-evidence.git
cd ryntra-solana-evidence
npm ci
npm run verify
```

Verification runs lint, type checking, network-free tests of every package
and the boundary checks. [GitHub Actions](https://github.com/ryntra-io/ryntra-solana-evidence/actions)
runs the same command for changes to `main` and pull requests.

### Check a receipt offline

```bash
npm run cli -- verify lib/solana/fixtures/receipt-solana-matched-signed.json --json
```

The sample is a test fixture, not evidence of a customer's transaction.
Try `receipt-solana-tampered.json` in the same directory to see integrity
verification fail with exit code `2`.

### Inspect a mint

```bash
npm run cli -- inspect 2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo --json
```

This example reads PayPal USD on Solana mainnet. Results reflect the account
data returned by the selected RPC endpoint; public endpoints can be unavailable
or rate-limited. See the [connection options](packages/solana-evidence-sdk/README.md#connection)
to configure an operator-controlled provider.

## Scope and limits

- No private keys, signing, transaction building, simulation or submission.
  The only RPC method used by the kit is `getAccountInfo`; the model packages
  make no network call at all.
- Preflight is a structural calculation, not a simulation or a promise of
  execution. Network fees and compute budget remain unknown.
- `NO_KNOWN_BLOCKER` means no known blocker under the policy supplied by the
  caller. It is not a safety judgement or financial advice.
- Receipt checks cover the supplied artifact. They do not fetch the transaction,
  prove settlement on chain, or compare an original plan and quote with actual
  execution.
- A valid signature is not issuer trust. Supply `trustedPublicKeys` when your
  integration requires a particular issuer; the verifier reports all four axes
  separately.
- The tokenized-stock model states what an issuer states and what a mint
  holds; it does not vouch for an issuer. The plan sizing is a planning model
  under stated assumptions, not a bound on what can be lost.
- This is source-distributed software, not a published npm package or hosted
  service. Public kit versions and the application may evolve independently.

## Contributing and security

[Contributing](CONTRIBUTING.md) · [Security policy](SECURITY.md) ·
[Changelog](CHANGELOG.md) · [License](LICENSE) · [Notice](NOTICE)

Selected developer interfaces and evidence tooling are open source. The Ryntra
product remains proprietary. Code included in this repository is Apache-2.0,
including its declared-policy evaluation and evidence utilities. The hosted
application, operational infrastructure and live execution services are separate.
