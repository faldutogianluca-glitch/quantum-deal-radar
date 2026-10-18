# Return metrics

Most return errors aren't arithmetic. They come from two sheets defining "equity" or "IRR" differently, or from a label that doesn't match the math. So define every metric once, from one levered cash-flow row (and one unlevered row), and name each one for exactly what it computes.

## Base rows

- **Unlevered CF**: acquisition/development costs + operating cash flow + net sale, before any financing.
- **Levered CF**: unlevered + every financing flow (draws, fees, interest, principal, repayments).
- Take equity, distributions and profit from the levered row, and nowhere else.

## Definitions

| Metric | Formula | Notes |
|---|---|---|
| Profit | `SUM(levered CF)` | Same number on every sheet |
| Equity required | `−SUMIF(levered CF, "<0")` | Includes carry-period shortfalls, not just closing equity |
| Distributions | `SUMIF(levered CF, ">0")` | |
| Equity multiple (MOIC) | distributions / equity | |
| IRR, dated flows | `XIRR(CF row, date row)` | Best when periods are weeks or irregular |
| IRR, regular periods | `(1 + IRR(CF row))^P − 1` | P = periods per year. `IRR × P` is the nominal rate, which is lower; label it if you show it. |
| Return on equity | profit / equity | Not a "margin" |
| Simple annualized ROE | ROE / (hold periods / P) | Label as simple. For short holds it differs a lot from IRR. |
| Margin on cost | profit / total cost incl. financing | What flippers and developers mean by "margin" |
| Profit on sale | profit / sale price | |
| Cash-on-cash (year y) | operating CF after debt service in y / equity | Excludes refi and sale proceeds; annualize partial years |
| Yield on cost | stabilized NOI / total cost | Unlevered |
| Payback | first period where cumulative levered CF ≥ 0 | `MATCH(TRUE, INDEX(cum ≥ 0, 0), 0)` |

## Rules

- **One IRR definition per model**, stated on the cover. If the grid is monthly, report `(1 + IRR)^12 − 1` or XIRR, not both on different sheets.
- **Partner metrics come from partner cash-flow rows** that sum to the deal's levered CF (less third-party fees). Check it.
- **Sensitivities**: show IRR and multiple together. A short hold can give a huge IRR on a small profit.
- **Targets**: to find the price or rent that hits a target return, solve by formula — a closed form, the IRR itself, or a bisection laid out in rows ([scenarios](scenarios.md)). Goal Seek is for exploring only. Keep the input as an input; never paste a solved value in as if it were an assumption.

## Checks

- Profit on the summary = `SUM(levered CF)`; multiple × equity − equity = profit.
- Σ partner CF = deal levered CF less fees.
- IRR is not an error value (for example, a sign change exists), and trailing zero periods are fine. Discount the flows at the IRR and confirm the result is about zero: `XIRR` can return a false root near zero and still look like a number.

## Common mistakes

- Equity defined as "closing equity" on one sheet and "all negative periods" on another.
- Leaving one loan's interest out of the outflows used for equity or the multiple, so partner profit exceeds deal profit.
- `IRR(monthly) × 12` reported as the annual IRR next to an annual-grid IRR, so the two sheets disagree.
- "Profit margin" that is really ROE, and "annualized" that is really simple division.
