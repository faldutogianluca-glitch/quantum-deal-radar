# Fix-and-flip: row formulas

Notation: `w` = period index (0 = closing), `P` = periods per year (52 weekly, 12 monthly), `[flag]` = a 1/0 row on `Timing`, `prev` = the prior column of the same row. Costs are negative. Put a blank spacer column before period 0 (see [core/conventions.md](../core/conventions.md)).

## Timing

| Row | Formula |
|---|---|
| Period | `IF(ISNUMBER(prev), prev + 1, 0)` |
| Date | `start date + 7 × w` (weekly) or `EOMONTH(start, w)` (monthly) |
| Construction end (input sheet) | `construction start + duration − 1` |
| Sale period (input sheet) | `construction end + marketing periods` |
| Flags | acquisition `w = 0`; hold `1 ≤ w ≤ sale`; construction `start ≤ w ≤ end`; construction start; sale |

## Budget

Rehab line with total `T`, method `m`, window `s…e` (blank → construction start/end):

`−T × IF(m = 1, AND(w ≥ s, w ≤ e) / MAX(1, e − s + 1), IF(m = 2, w = s, IF(m = 3, w = e, 0)))`

Methods: 1 = straight-line, 2 = lump at start, 3 = lump at end. Any other code gives 0 and trips a check.

| Row | Formula |
|---|---|
| Purchase | `−price × [acquisition]` |
| Closing | `−closing % × price × [acquisition]` |
| Tax, insurance | `−annual % × price / P × [hold]` |
| Utilities | `−monthly $ × 12 / P × [hold]` |

## Purchase loan (corkscrew)

| Row | Formula |
|---|---|
| Opening | `prev closing` |
| Drawdown | `amount × [acquisition]` |
| Principal | `−IF(opening > 0, (1 − IO) × (payment − opening × rate / P), 0)` |
| Repayment | `−(opening + drawdown + principal) × [sale]` |
| Closing | `opening + drawdown + principal + repayment` |
| Interest | `−opening × rate / P` |
| Fee | `−fee % × amount × [acquisition]` |

Payment = `IF(IO, amount × rate / P, PMT(rate / P, years × P, −amount))`.

## Construction / hard-money loan

| Row | Formula |
|---|---|
| Drawdown | `MAX(0, MIN(commitment − prev cumulative, −draw % × rehab spend this period))` |
| Cumulative | `prev cumulative + drawdown` |
| Repayment | `−(opening + drawdown) × [sale]` |
| Closing | `opening + drawdown + repayment` |
| Interest | `−opening × rate / P` (interest-only) |
| Fee | `−fee % × commitment × [construction start]` |

If the lender funds a share of the purchase too, add it as a separate draw at period 0.

## Equity, distributions, returns

| Row / constant | Formula |
|---|---|
| Pre-sale CF | costs + all drawdowns + fees + interest + principal |
| Equity called | `−pre-sale CF` (must never be negative) |
| Distributions | `net sale + all loan repayments` (repayments are negative) |
| Levered CF | `distributions − equity called`, which equals unlevered + financing |
| Total cost incl. financing | `−(Σ costs + Σ interest + Σ fees)` |
| Margin on cost | `profit / total cost` |
| ROE | `profit / Σ equity` |
| IRR | `XIRR(levered CF row, date row)` |
| Multiple | `Σ distributions / Σ equity` |

Sources & uses from the same rows. Uses = costs + fees + interest + principal paid before the sale. Sources = loan drawdowns + equity.

## Partner split at sale

| Constant | Formula |
|---|---|
| Investor pref accrued | `Σ (prev investor capital × pref / P × [hold])` |
| Return of capital | `MIN(distributions, equity)` |
| Pref paid | `MIN(distributions − capital returned, pref accrued)` |
| Remainder | `distributions − capital returned − pref paid` |
| Sponsor | `capital returned × sponsor share + remainder × sponsor split` |
| Investor | `capital returned × investor share + pref paid + remainder × (1 − sponsor split)` |

Partner CF row = `−contribution + distribution × [sale]`; XIRR and multiple per partner. Check: partner CFs sum to levered CF.

## Price checks

- Max offer (rule) = `rule % × ARV − rehab budget` (commonly 70%); show headroom = max offer − price.
- The price for a target ROE comes from Goal Seek (set ROE to target by changing price). Profit and equity are both linear in price, so it converges in one step.
