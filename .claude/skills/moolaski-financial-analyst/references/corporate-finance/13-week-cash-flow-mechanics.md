# 13-week cash flow mechanics

Notation: `t` = the week row (1 in the first column), `A` = the as-of week, `H` = the horizon (13), `N` = weeks on the grid, `e` = week-ending date, `[flag]` = a 1/0 timing row: `[act]` (t ≤ A), `[fc]` (A < t ≤ A + H), `[fut]` (t > A), `[lev]` (t ≥ lever start). Money in the report is signed: receipts +, payments −.

## Dates and the payment calendar

| Row | Formula |
|---|---|
| First week end | `open date + 1 + MOD(weekday − WEEKDAY(open date + 1), 7)`; check that week 1 starts the day after the open date |
| Week end, start | `first end + 7 × (t − 1)`; `end − 6` |
| Pay date in week | `(e ≥ anchor) × (MOD(e − anchor, interval) < 7)` |
| Day d of the month (d ≤ 28) | candidate `c = DATE(YEAR(e), MONTH(e), d)`, or `EDATE(c, −1)` if `c > e`; flag `1*(e − c < 7)` |
| Quarterly | the day flag × `(MOD(MONTH(c) − first quarter month, 3) = 0)` |
| Dated items by category k | `SUMPRODUCT(amount, 1*(cat = k), 1*(date ≥ start), 1*(date ≤ e))` |
| Holiday factor, seasonality | `1 − SUMPRODUCT(cut, date in week)`; `INDEX(month index, MONTH((start + e) / 2))` |

## Receipts

**Opening bucket b** (balance `B`, average age `a`, bad debt `d`, curve `c_b(p)` by week p, cumulative `C_b`):

| Row | Formula |
|---|---|
| Collected | `B × c_b(t)` |
| Written off | `B × d × (t = write-off week)`, write-off week = `MAX(1, ROUNDUP((write-off age − a) / 7, 0))` |
| Still owed | `B × (1 − C_b(t) − d × (t ≥ write-off week))` (a closed form, independent of the roll) |
| Age | `a + 7t`, which puts it in an aging bucket each week |

**New sales** on a lag curve `c(p)`, p = weeks after the sale; bad debt = `1 − Σ c`; the remaining share at lag p is `r(p) = 1 − Σ_{q≤p} c(q) − bad debt × (p ≥ write-off lag)`, and the invoice age at lag p is `7p + 7/2`.

Collections in week t are a convolution, `Σ_{s≤t} sales(s) × c(t − s)`. Put a **reversed** copy of the curve on the grid (column j holds lag `N − j`), and each cell is one non-array formula:

```
= SUMPRODUCT(INDEX(sales, 1, 1):INDEX(sales, 1, t),
             INDEX(rev_curve, 1, N − t + 1):INDEX(rev_curve, 1, N))
```

The same formula with `r(p)` masked to each aging bucket gives the new-sales aging, and with the write-off row it gives the write-offs. If that is too clever for the audience, use a vintage block instead (one row per sale week, `sales(v) × c(t − v)`): it is more transparent and larger.

**Tie-out**: AR opening + sales − collections − write-offs = closing, and closing = Σ buckets' still-owed + Σ new-sales aging, every week.

## Payables

Terms `DPO / 7 = k + f` (k whole weeks, k ≥ 1):

| Row | Formula |
|---|---|
| Paid on purchases | `(1 − f) × P(t − k) + f × P(t − k − 1)`, each `IF(index ≥ 1, INDEX(P, 1, index), 0)` |
| Opening AP | paid in its due week: `SUMPRODUCT(amount, 1*(due week = t))` |
| Unpaid cohorts | `SUM(INDEX(P, 1, MAX(1, t − k + 1)):INDEX(P, 1, t)) + f × P(t − k)` + opening AP not yet due |

Purchases made before the as-of week keep their old terms; later purchases take the scenario's terms, as two lag rows.

## Timing-shift operator (slippage, acceleration, stretch, deferral)

Move a flow row F from week E by s weeks (s > 0 later, s < 0 earlier, fractional allowed): each week's flow is spread evenly over its week, then shifted.

| Row | Formula |
|---|---|
| Cumulative | `CC(t) = CC(t − 1) + F(t)` |
| Position read | `x = IF(t < E, t, MAX(E − 1, t − s))` |
| Shifted cumulative | `(1 − (x − INT(x))) × CC(INT(x)) + (x − INT(x)) × CC(INT(x) + 1)`, with `CC(j) = 0` for j < 1, capped at N |
| Shifted flow | `CC'(t) − CC'(t − 1)` |

Weeks before E are untouched (check it). Flows pulled earlier than E land in E, and flows pushed past the grid drop off (show them). The balance behind the flow moves by `CC − CC'`: deferred collections stay in AR, deferred payments stay in AP.

## Borrowing base and revolver

| Row | Formula |
|---|---|
| Base (prior week-end collateral) | `MAX(0, AR_adv × MAX(0, (AR − over-90) × (1 − other inel.)) + MIN(inv cap, Inv_adv × Inv × (1 − inel.)) − reserves)` |
| Capacity | `MAX(0, MIN(base, commitment) − LCs)` |
| Interest and fees | `−(opening × rate + MAX(0, commitment − opening − LCs) × unused + LCs × LC fee) × 7 / 365` |
| Cash before revolver | opening cash + net cash flow (interest included) |
| Draw | `MIN(MAX(0, min cash − pre), MAX(0, capacity − opening))` |
| Repay | `MIN(opening, MAX(0, pre − min cash, opening − capacity))`: sweep, or forced paydown |
| Availability; liquidity | `MAX(0, capacity − closing)`; closing cash + availability |
| Breach | `[fc] × (liquidity < covenant)` |

In forecast weeks, collateral = forecast balance + (last certificate − forecast at week A), less timing reversals collected since.

## Outputs over the window

| Output | Formula |
|---|---|
| Lowest liquidity | `MIN(INDEX(liq, 1, A + 1):INDEX(liq, 1, A + H))` |
| Its week | `MATCH(lowest, that range, 0) + A` |
| First breach | `IF(ISNUMBER(lowest), IFERROR(MATCH(1, INDEX(breach, 1, A + 1):INDEX(breach, 1, A + H), 0) + A, "none"), "error")` |
| Runway | the same on `[fc] × (liquidity < 0)` |
| 13-week total | `SUMPRODUCT(row, [fc])` |

## Actuals, variance, reversals

| Row | Formula |
|---|---|
| Report line | `[act] × actual + (1 − [act]) × (forecast + reversal)` |
| Variance, cumulative | `SUMPRODUCT(actual, [act]) − SUMPRODUCT(forecast, [act])`; % on `ABS(forecast)` |
| Timing $; permanent $ | `share × variance`; `variance − timing` |
| Reversal row | `−timing $ × (t = reversal week) × (1 − [act])` |
| Completeness | `(ROWS(block) − COUNT(block)) × [act]` for each week column: must be 0 |

Checks: the reversal weeks fall in the window whenever `ABS(timing) >` tolerance (a reversed timing variance leaves a floating residue). Σ reversal rows = −Σ timing, and Σ line variances = the net-cash-flow variance.

## Cases

Split each sales-driven row into plan + (scale − 1) × its post-as-of part. That is exact, since collections, purchases, inventory and freight are all linear in sales. Each case block then reruns only the shift operators, the terms lag, the collateral and the revolver ([scenarios-mechanics](../core/scenarios-mechanics.md)). Add a block at the live drivers, and check that it equals the model every week.
