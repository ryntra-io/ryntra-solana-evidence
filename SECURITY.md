# Security policy

## Supported release

Security fixes are accepted for the latest tagged source release. This v0.1
repository is a read-only source distribution and is not an npm package.

## Reporting

Please use the repository's private GitHub Security Advisory flow. Do not open a
public issue containing an exploit, credential, private endpoint, user data,
wallet material or provider secret.

Include the affected commit, minimal reproduction, impact and whether the issue
crosses any of these boundaries:

- the read-only boundary: any path that could build, sign or submit a
  transaction, hold key material, or call a state-changing RPC method;
- the endpoint boundary: any way a tool caller, rather than the operator, could
  choose what this process connects to;
- request/response byte, depth, node and string limits;
- provenance binding — a fact rendered without the source it came from, or an
  issuer-declared value presented as an on-chain one;
- receipt verification — any case where a tampered receipt reads as valid, or a
  signature from an untrusted key reads as a trusted one;
- log and error redaction, including a rejected tool call echoing its input.

Never send a seed phrase, private key, signing request or funds as part of a
report. Ryntra does not need them to reproduce an issue, and this kit has no
code path that would accept them.

## Security model

This kit reads. It does not authorize, sign, fund, submit or settle. The only
RPC method it calls is `getAccountInfo`, and `packages/solana-evidence-sdk/boundaries.test.mjs`
enumerates every RPC call and every signing-shaped identifier across the shipped
sources on each run.

A policy verdict reports the absence of known blockers under a policy the caller
declared. It is not a safety judgement, and receipt verification reports four
independent axes rather than one word — a sound signature from a key you have
not chosen to trust is reported as exactly that.
