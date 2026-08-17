# Contributing

Thanks for looking. This repository is a bounded, read-only source distribution,
so the most useful contributions are usually corrections: a Token Extension
whose meaning sentence is wrong or has become wrong, a decoder gap, a claim that
outruns its evidence.

## Before a pull request

```bash
npm ci
npm run verify
```

`verify` runs lint, typecheck, the network-free tests and the boundary gate.
All four must pass. The tests never reach a network: mint behaviour is proven
over raw account bytes captured from mainnet, and receipt behaviour over signed
fixtures, so a bad afternoon at somebody's RPC provider cannot turn this
repository red.

## What will not be merged

- Anything that builds, signs or submits a transaction, holds key material, or
  calls an RPC method outside the read allowlist. That is not a preference; the
  boundary gate fails the build.
- A verdict, label or sentence that says or implies an asset is safe, endorsed,
  guaranteed or audited. This kit reports facts and the absence of known
  blockers under a declared policy.
- A second copy of something that already exists here once. Canonicalization,
  hashing and the evidence core are single-source on purpose.
- A meaning sentence that describes a capability slot rather than its current
  setting. "A program runs on every transfer" is false when the hook program id
  is the all-zero key, and a test enforces the distinction.

## Style

Match the surrounding code. Comments explain *why* something is the way it is,
particularly where the obvious implementation would be wrong — those comments
are load-bearing, and deleting one usually means the next person reintroduces
the defect it describes.
