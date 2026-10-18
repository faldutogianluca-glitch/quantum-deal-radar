# SFR monthly model: row formulas

Notation: `m` = month index (0 = closing), `y` = `ROUNDUP(m/12, 0)` (0 at closing), `[flag]` = a 1/0 row on `Timing`, `prev` = the prior column of the same row. Signs: inflows +, outflows −.

Leave a blank spacer column between the totals/constants column and month 0. Then `prev` is blank (= 0) in month 0, and every row keeps one formula across all months.

## Timing

| Row | Formula |
|---|---|
| Month | `IF(ISNUMBER(prev), prev + 1, 0)` |
| Year | `ROUNDUP(m/12, 0)` |
| Month ending | `EOMONTH(purchase date, m)` |
| Occupancy start (input sheet) | `renovation months + 1` |
| Exit month (input sheet) | `renovation + hold + marketing months` |
| Lease start | `[occupied] × (MOD(m − occupancy start, lease term) = 0)` |
| Acquisition-loan repaid | `IF(refi on, [refi], [exit])` |
| Forward window after X | `AND(m > X, m ≤ X + 12)` |

## Operations

| Row | Formula |
|---|---|
| Rent | `rent × (1 + rent growth)^(y − 1) × [occupied]` |
| Move-in fee | `fee × (1 + rent growth)^(y − 1) × [move-in]` |
| Vacancy | `−days vacant / 365 × rent` |
| Tax, insurance, HOA | `−amount × (1 + expense growth)^(y − 1) × [operating]` |
| Variable opex | `−amount × (1 + expense growth)^(y − 1) × [occupied]` |
| Leasing fee | `−fee % × rent × [lease start]` |
| Management | `−mgmt % × EGR` |
| Capital reserve | `−INDEX(reserve by year, 1, y + 1) × [reserve]` |
| Cash flow before debt | `(NOI + reserve) × [hold]` |

Fixed costs start at month 1, even during renovation. Rent, variable opex and the reserve start at occupancy. NOI runs through the forward window so it can be capitalized, but only hold months enter returns.

## Component reserve (by year)

`reserve per month (year y) = IF(y < 1, 0, IF(AND(y ≤ remaining, remaining > 0), cost / remaining, cost / useful) / 12 × (1 + inflation)^(y − 1))`

Items near the end of their life are reserved heavily until replacement, then at the steady-state rate. Remaining life should not exceed useful life.

## Valuation

| Constant | Formula |
|---|---|
| Forward NOI after X | `SUMPRODUCT(NOI row, [forward window after X])` |
| Value at month X | `IF(method = growth, price × (1 + value growth)^(X / 12), forward NOI / cap)` |
| Implied cap | `forward NOI / value` |
| Refi loan | `refi on × value at refi × refi LTV` |
| Refi DSCR | `forward NOI after refi / (12 × refi payment)` |

## Debt corkscrew (one block per loan)

| Row | Formula |
|---|---|
| Opening | `prev closing` |
| Drawdown | `amount × [draw month]` |
| Scheduled principal | `−IF(opening > 0, (1 − IO) × (payment − opening × rate / 12), 0)` |
| Repayment | `−(opening + scheduled principal) × [repay month]` |
| Closing | `opening + drawdown + principal + repayment` |
| Interest | `−opening × rate / 12` |
| Loan costs | `−cost × [draw month]` |

Payment = `IF(IO, amount × rate / 12, PMT(rate / 12, years × 12, −amount))`. A loan drawn in month X pays from X + 1. A loan repaid in month X still pays interest in X.

Refi proceeds to equity = `refi drawdown + refi costs + acquisition-loan repayment × [refi]`. This can be negative (cash-in refi).

## Sale and returns

| Row | Formula |
|---|---|
| Sale price | `value at exit × [exit]` |
| Broker, other selling costs | `−% × sale price` |
| Unlevered CF | `acquisition total + cash flow before debt + net sale` |
| Financing CF | sum of every loan's drawdown, costs, interest, principal, repayment |
| Levered CF | `unlevered + financing` |
| IRR (annual) | `(1 + IRR(row))^12 − 1` |
| Equity multiple | `SUMIF(row, ">0") / −SUMIF(row, "<0")` |
| Equity required | `−SUMIF(levered row, "<0")` (includes carry during renovation) |
