# Trading plans

A Trading Plan is the set of rules a person writes **before** they sign: why
this asset, how much money, at what entry, where the thesis is wrong, how the
position exits. The plan is kept with versions under *My strategies*
([ryntra.io/app/strategies](https://ryntra.io/app/strategies)), its size is
computed deterministically from the rules, the pre-signature Review judges the
exact order against it, and the result is recorded beside the plan once the
operation is done.

![The plan builder in three steps — why this stock, money, prices — with the estimate computed beside it: units, the modelled loss at the invalidation, the costs modelled, the entry's validity](../screenshots/trading-plan-builder.png)

*The plan builder: the thesis in the person's words, the budget and the planned risk, the entry and the price where the thesis is wrong; the estimate on the right updates as the person types and names what it assumes.*

## The rules

| Step | Rules | Notes |
|---|---|---|
| Why this stock | the thesis in the person's words; optionally why now, the horizon, sources and assumptions | the thesis is kept with every version |
| Money | the budget; the planned risk — the most the person plans to lose if the price falls to the invalidation | a reserve for costs is kept back from the budget |
| Prices | the entry; the price where the thesis is wrong (the invalidation); an optional maximum entry price above which the Review refuses | per underlying share, or per token for a pre-IPO instrument |
| More rules | the entry's validity, the modelled cost buffer, an optional target and time exit, the slippage bound, the maximum quote age, the maximum reference deviation, whether a reference is required, a minimum liquidity | each with a default that holds |

The invalidation is a rule the person acts on, not an exit order: the plan
places no order at that price, and the page says so.

## The size

```
lossPerShare        = entry − invalidation + entry × costBufferBps / 10 000
riskLimitedUnits    = plannedRiskUsd / lossPerShare
capitalLimitedUnits = (budgetUsd − reserveForCostsUsd) / entry
units               = min(riskLimitedUnits, capitalLimitedUnits)
notionalUsd         = units × entry
```

The size is limited either by the planned risk or by the budget, and the
estimate says which. Costs are modelled once, in the loss per share; the
budget is spent net of the reserve; nothing is subtracted twice. The same
function sizes the form in the browser and the stored version on the server,
so no client keeps a second financial logic. It is published as
[`@ryntra/trading-plans`](../../packages/trading-plans/README.md), with the
reader of decimal input the builder uses (`0,5` is a half; an empty field is
never zero).

The figure is a planning model under stated assumptions. A gap through the
invalidation, slippage, missing liquidity or a missed exit change what is
lost; the assumptions travel with the figure and are shown beside it.

## From the plan to the deal

1. The person opens the asset from the plan (or the plan from the asset) and
   types the amount in Spot.
2. The Review's **Strategy block** judges the exact order against the plan:
   the executable price against the entry bound, the amount against the budget
   net of the reserve, the modelled loss against the planned risk, the quote's
   deviation against the plan's reference rule, the quote's age and slippage
   against the plan's execution limits. A rule that fails refuses the order and
   is named.
3. The wallet signs; the execution is bound to the plan version it was judged
   against.
4. The result — what was executed, at what price, against what was planned —
   is recorded with the plan under *Results*.

## What a plan is not

- Not advice. Ryntra checks the person's own rules; it does not write them.
- Not an order. No entry, stop or target order is placed by a plan.
- Not a promise. The modelled loss is a model; the market decides what is
  lost.
