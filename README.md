# Ryntra Solana Evidence Kit

[![verify](https://github.com/ryntra-io/ryntra-solana-evidence/actions/workflows/ci.yml/badge.svg)](https://github.com/ryntra-io/ryntra-solana-evidence/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

Read-only Solana tooling for developers: inspect mints, check proposed transfers
against a caller-defined policy, and verify supplied receipts offline.

Part of [Ryntra](https://ryntra.io), a Solana-first product for financial
actions governed by user-defined rules. This repository contains the evidence
kit, not the application or its live transaction flows.

[Application](https://ryntra.io/app) · [Product documentation](https://ryntra.io/docs) ·
[SDK](packages/solana-evidence-sdk/README.md) ·
[MCP server](packages/solana-evidence-mcp/README.md) ·
[CLI](examples/solana-evidence-cli/README.md)

## What works

| Capability | Output | Network access |
|---|---|---|
| Mint inspection | Asset identity, authorities and SPL / Token-2022 extension data with provenance | Read-only Solana RPC |
| Transfer preflight | Mint-based fee calculations, structural constraints and a verdict against the declared owner policy | Read-only Solana RPC |
| Receipt verification | Separate schema, integrity, issuer-signature and Solana-binding results | None |

All three are available through the typed SDK, local stdio MCP server and CLI.
The MCP server also exposes an editable example owner policy.
[Four JSON Schemas](docs/solana/schemas) describe asset passports, owner policies,
policy verdicts and transfer preflights.

## Run locally

Use Node.js 24 and npm. No wallet or API key is needed for the offline checks.

```bash
git clone https://github.com/ryntra-io/ryntra-solana-evidence.git
cd ryntra-solana-evidence
npm ci
npm run verify
```

Verification runs lint, type checking, network-free SDK/MCP/CLI tests and
boundary checks. [GitHub Actions](https://github.com/ryntra-io/ryntra-solana-evidence/actions)
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
  The only RPC method used by the kit is `getAccountInfo`.
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
- This is source-distributed software, not a published npm package or hosted
  service. Public kit versions and the application may evolve independently.

## Contributing and security

[Contributing](CONTRIBUTING.md) · [Security policy](SECURITY.md) ·
[Changelog](CHANGELOG.md) · [License](LICENSE) · [Notice](NOTICE)

Selected developer interfaces and evidence tooling are open source. The Ryntra
product remains proprietary. Code included in this repository is Apache-2.0,
including its declared-policy evaluation and evidence utilities. The hosted
application, operational infrastructure and live execution services are separate.
