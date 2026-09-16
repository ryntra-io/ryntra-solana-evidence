# Risk review

Every operation in Ryntra passes a **Review** before the wallet is asked to
sign. The Review is not a score and not an opinion: it quotes the amount
again, reads the facts an operation depends on, checks them against the
bounds the person accepted and the rules of the person's own Trading Plan,
and either shows the order ready to sign or refuses it and names the rule that
refused.

## What the Review reads

| Fact | Source | Used for |
|---|---|---|
| The quote, its route and price impact | the execution provider (Jupiter, Circle CCTP, Mayan, Relay) | the amount the person signs on; the slippage bound sets the minimum received |
| The quote's age | the provider's quote time and the clock | a quote older than the plan's maximum is refused, not signed |
| The token's capabilities and transfer fee | the mint's own account on Solana — Token-2022 extensions read directly | a transfer the token cannot clear is refused before it is built; the fee the mint withholds is shown inside the figures |
| The exact fee, rent and simulation | the Solana network, at review time | what the operation costs and whether it would execute |
| The reference price and its state | the issuer's feed or a price feed such as Pyth | the deviation of the executable price; a stale or missing reference blocks a plan that requires one |
| The units | the chain's Scaled UI Amount multiplier | the underlying units and per-share price behind a token amount |
| The plan's rules | the person's own Trading Plan version | the Strategy block: entry bound, budget, planned risk, reference rule, execution limits |
| The token's life | a pause on the mint, a verified issuer notice, the issuer's catalogue | a paused, redeem-only or expired token is not offered for purchase |

Every figure is shown with its source and its time. Nothing is estimated where
a fact can be read.

## What the Review does

1. **Quotes again** for the exact amount and side, so the person signs on
   the price of that moment rather than on a stale estimate.
2. **Checks the bounds** — slippage, quote age, reference deviation, transfer
   fee, minimum liquidity — and, when a plan applies, the plan's rules.
3. **Refuses or shows.** A failed check refuses the order and names the
   rule; a passed Review shows the order as it will be signed: the amount, the
   minimum received, the fees, the units.
4. **Submits once** after the signature, through a one-shot boundary, and
   reads the result back from the chain independently of the provider.
5. **Records** the confirmed operation with its transaction signature, and a
   receipt the person keeps.

## Evidence, not judgement

The Review's vocabulary has no word for *safe*. It reports the absence of
known blockers under the rules it was given, and the presence of a blocker
when it finds one. It is a structural check over facts read at review time — a
person may still lose money on an order that passed every check, and the
pages say so where it matters.

## Open source in this repository

The read-only evidence kit in this repository — the asset passport of a
Token-2022 mint, the exact transfer preflight against a declared owner policy,
and offline receipt verification — is the same code the product's Review and
Send path run on. See the [SDK](../../packages/solana-evidence-sdk/README.md),
the [MCP server](../../packages/solana-evidence-mcp/README.md) and the
[CLI](../../examples/solana-evidence-cli/README.md).
