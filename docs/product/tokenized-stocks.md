# Tokenized stocks

[ryntra.io/app/stocks](https://ryntra.io/app/stocks) lists stocks as tokens
on Solana — listed equities and ETFs, and exposure to companies before an
IPO — and answers, on every asset page, the four questions a token's price
alone does not: who issues it and what kind of instrument it is, what one unit
means, whether the reference price is current, and whether the issuer still
supports the token.

## Issuers and confirmation

A token is a stock here only when the issuer's own catalogue lists its mint.
Ryntra reads the catalogues of **xStocks (Backed Finance)**, **Backpack**,
**Ondo** for listed equities and ETFs, and **PreStocks** for private
companies — the one issuer of pre-IPO tokens Ryntra shows. A token an issuer
does not list is not shown as a stock, whatever a pool quotes. The issuer, the
underlying and the exchange are stated on the asset page, with a link to the
issuer's own page.

Tokens of another pre-IPO issuer are no longer supported: no list, search,
plan or order offers them, and a person who holds one, or wrote a plan or
bought one before, reads it as history — *no longer supported*, to be sold in
their own wallet.

![The screener on Pre-IPO only: the eight PreStocks companies, the issuer's mark beside each token's price, and the token against that valuation in the column a deviation would hold](../screenshots/stocks-private-screener.png)

*The screener on Pre-IPO only: PreStocks' eight companies; the column that would hold a market reference holds the issuer's own mark, and the column that would hold a deviation holds the token against the issuer's valuation — each labelled as such.*

## Units

On Solana a listed-equity token is a Token-2022 mint with the Scaled UI Amount
extension: the raw balance never changes on a corporate event, and an
issuer-set multiplier changes what the balance means. Ryntra reads the
multiplier from the chain, converts raw amounts to the units a holder
economically owns with integer arithmetic, and puts a token price and a
per-share reference on one basis before comparing them. The multiplier is
applied once, and the page says which unit every figure is in. For xStocks
the issuer reinvests dividends by raising the multiplier, so the page says
they are already in your amount — not a payout to an account.

A pre-IPO token is priced **per token** — the only unit its issuer has stated
in a way that can be checked — and the plan built on it says so.

## Reference prices and sessions

Beside the token's market price the asset page shows the issuer's reference
price for the underlying share and the exchange session — market, extended
hours, overnight, closed — from the issuer's own feed or from a price feed
such as Pyth where the issuer publishes none. The reference carries a state
that is never promoted: *current* when the exchange is open and the figure is
fresh, *last available* when the exchange is closed, *stale* when the source's
own observation time is too old, *unavailable* when nobody stated a figure.
Freshness is judged from the source's observation time, not from the moment
the page fetched it.

The **deviation** is the executable per-share price of a concrete quote
against the reference, as a percentage — a fact about this quote against this
reference at this time, not a signal.

For a pre-IPO token the issuer's own figure is shown as **the issuer's mark**.
It has no observation time, it is the issuer's derivation, and no plan rule
reads it as a reference. The one number a private company's card and page
carry beside its price is the token against that valuation — *30% above
PreStocks' valuation* — with the time the valuation was read, and no tone of
good or bad.

![A private company's page: what the token is not, the issuer's fee on every transfer and its power over the token before any figure, the company's own dated statement, the price with the token against PreStocks' valuation](../screenshots/stock-private-company.png)

*A private company's page: the truth before any figure — not a share, the issuer's fee on every transfer, the issuer can freeze or take the token — the company's own dated statement about tokens like it, and the price with its one number.*

## Rights

What a holder has is stated in the issuer's own terms, never as a legal
opinion: the listed-equity issuers' terms; **price exposure, not a share**
for PreStocks tokens (economic exposure through a holding entity, no ownership,
voting, dividend or information rights). A PreStocks mint withholds the
issuer's fee on every transfer — 1 % today, read from the chain — and its own
settings let the issuer freeze the token, pause transfers, and move or burn it
from any wallet; the page says so before any figure. Where a company has
spoken about tokens like it, that dated statement stands beside the truth, its
sources one press deeper. Availability by jurisdiction is the issuer's, and
the issuer's page is linked beside the statement.

## Lifecycle

Whether a new purchase is offered comes from three facts in order of strength:
a pause on the mint itself stops everything; a verified issuer notice says
what the issuer supports now — a conversion window with the issuer's own
cut-off, a redemption period, an expiry; the issuer's catalogue listing the
mint today says it is offered. A conversion window is treated as expired the
moment the clock passes the issuer's cut-off. A paused, redeem-only or expired
token is not offered for purchase, whatever a pool still quotes; holdings and
history stay visible, and selling a token one holds is the person's own
decision.

## Comparing tokens of one company

When one underlying has several confirmed tokens, the asset page quotes them
together — the same amount, the same settlement asset, the same side — and
shows the per-share price of each through its own multiplier, its costs and
its liquidity. A cheaper token is not the same rights or less risk; the page
says so. A pre-IPO token and a listed token of the same company — SpaceX after
its listing — are shown side by side but never compared: different
instruments with different rights and their own units.

![The asset page of a listed-equity token: the reference price, the deviation and the session in the header; the buy estimate with the per-share price and the units; the confirmed tokens of the same underlying compared for the same amount](../screenshots/stock-listed-asset.png)

*A listed-equity asset page: the reference and the session, the estimate per share through the token's multiplier, and the token alternatives of the same company quoted for the same amount.*

## Buying with a loss limit

The asset page starts with **Buy**. Choose an amount — $10, $20, $50 or $100,
or type one — and, if you want one, a loss limit: **Careful** (limit −5%,
target +10%) or **Balanced** (limit −10%, target +20%). Ryntra prepares the
purchase from those figures as one card: what you can lose at the limit,
including the price cushion the Review allows; where the limit and the target
sit per unit; how you will be warned; and that nothing is bought yet. The card
draws the path every action takes — intent, limits, permission, execution,
proof, oversight — and marks the step you are on.

**Accept and sign** writes the plan and opens the same Review every trade
passes, with the same amount: a fresh executable quote, the plan's price
ceiling and loss limit checked, then your wallet's signature. After the
purchase settles, the plan keeps watching the position against its limit
until the position is closed; reaching it produces one note — on the page,
and on Telegram if you connected it. Ryntra never sells for you: a sale is
yours to open and sign.

A loss limit is a rule of your plan, not an order. The market can move past
it before you act, and you can lose everything you put in.

For a PreStocks token the Review names the issuer's fee on its own line
under all costs — *of which the issuer's fee 1% ≈ $0.10* — and what arrives
is the venue's quote through the token's multiplier, already after that fee,
never reduced by it a second time.

## Open source in this repository

The model behind these pages — instrument class, unit basis and rights; the
transfer fee from a mint's own config; the lifecycle from a pause, a notice or
the catalogue; scaled-unit arithmetic; the state of a reference against a
session — is published as
[`@ryntra/tokenized-stocks`](../../packages/tokenized-stocks/README.md), the
same modules the product runs on.

## Limitations

- Ryntra shows what the issuer states and what the chain holds; it does not
  vouch for an issuer, and the terms are the issuer's.
- A reference may be unavailable or stale; the page says so rather than
  substituting a figure, and a plan may require a current reference before
  its Review passes.
- Pre-IPO issuers restrict availability by jurisdiction in their own terms;
  Ryntra states the restriction and does not work around it.
