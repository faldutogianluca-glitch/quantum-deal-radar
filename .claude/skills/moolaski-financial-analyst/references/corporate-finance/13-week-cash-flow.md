# 13-week cash flow

Forecasts cash week by week by the direct method: what customers will pay, what goes out and when, and what is left against the revolver and the covenant. It answers "will we run out of cash, and when?", and "what buys us time?". Treasury runs it every week, asset-based lenders ask for it, and in a restructuring it is the model everyone reads. It is not a profit forecast. Revenue and expense matter only through the week they turn into cash, so the model is built from receivables, payables and a payment calendar, not from an income statement ([three-statement](three-statement.md) does that, monthly or annually).

Three things make it hard, and they are the point: **receipts come from the receivables aging, not from sales**; **the revolver lends against a borrowing base that moves with those receivables**; and **the forecast has to roll** every week against actuals, without breaking.


The monthly plan it rolls against is the [operating-budget](operating-budget.md).
## Before you build

- Gather opening balances at a week end: bank cash, the revolver and LCs, term debt, inventory, the **AR aging by bucket** (with the customers who are slow or at risk), and **AP by due date**.
- Gather the collection history: how much of each bucket, and of each week's new invoices, arrives in each following week, and how much is never collected.
- Gather the sales forecast by week (seasonality, holiday weeks), gross margin, the purchasing plan, and vendor terms.
- Gather the payment calendar: payroll dates and cadence (net pay and payroll taxes), rent and other monthly bills with their due days, debt service dates, tax dates, and a dated list of one-offs (capex, deposits, severance, adviser fees, asset sales, refunds).
- Gather the borrowing-base terms (advance rates, ineligibles, caps, reserves), the commitment, the pricing, the minimum operating cash, and every liquidity covenant.
- Gather the actuals for the weeks since the forecast was made: bank-reconciled cash by line and the latest borrowing-base certificate.
- Follow [conventions](../core/conventions.md), [time-series](../core/time-series.md), [balances](../core/balances.md) and [scenarios](../core/scenarios.md).

## Build steps

1. **Week grid.** A week-ending date on a chosen weekday, driven from the opening balance date, which must itself be a week end. Add a few weeks past the 13 so a roll and the purchase lead still fit. Put these flags on `Timing`: actual (up to the as-of week), forecast window, after the as-of week, and the payment calendar (pay dates from an anchor and an interval, the day-of-month rules, quarter months), all by date logic. Never type an amount into a week's column.
2. **Receipts from the aging.** Collect each opening bucket on its own weekly curve. Collect each week's new invoices on a lag curve by customer terms; the part never collected is bad debt, written off at an age. Roll AR forward, and **tie it to a projected aging** built cohort by cohort. The over-90 bucket it produces feeds the borrowing base as ineligible.
3. **Disbursements on their dates.** Pay purchases on vendor terms: pay each week's purchases a fractional number of weeks later, split across two weeks. Tie the AP roll-forward to its unpaid cohorts, the same way. Pay payroll on its actual dates, with net pay and payroll taxes as separate lines. Put the monthly bills, debt service, taxes and dated one-offs in the week that contains their date.
4. **The report.** Receipts, operating disbursements and operating cash flow; then restructuring costs, then debt service; then net cash flow before the revolver. Keep the operating and non-operating lines apart: lenders and boards read the operating line first.
5. **Revolver and liquidity** ([balances](../core/balances.md)). The borrowing base comes from the prior week-end's collateral. Capacity = lesser of base and commitment, less LCs. Draw to the minimum cash balance, and sweep above it. Repay when the base falls below the balance (an overadvance). Charge interest on the opening balance, which keeps the model free of circularity. Liquidity = cash + availability. Flag the covenant every week, and report the **first breach week**, the lowest liquidity and its week, and the runway.
6. **Actuals and variance.** Each line reads `actual × [actual week] + forecast × [forecast week]`. Show a variance for each line, cumulative and for the latest week, in $ and %. Split each variance into **timing** (it will reverse: give the week) and **permanent** (it won't). The timing part goes back into the forecast in its reversal week. Check that actual closing cash equals the bank balance.
7. **Levers and scenarios** ([scenarios](../core/scenarios.md)). Levers: stretch payables, accelerate collections, delay capex, cut discretionary spend, each with a start week. Scenarios: sales, collection slippage, vendor terms, all from the week after the as-of week. **Rerun the revolver for each case.** A lever's cash is not its liquidity: collecting faster also shrinks the borrowing base. Show every case side by side with its first breach week.

## Rolling it forward each week

Type the week's actuals, bank-reconciled, together with the new borrowing-base certificate. Then add 1 to the as-of week. The actual flag moves, the window moves with it, and a new week 13 appears, with no formula edited. Classify the new variances, and move any reversal week that has passed. Read the checks. Every month or so, **re-base**: move the opening date to the latest week end, load the new aging and AP, and start a new forecast of record. A forecast that is never re-based drifts further from the ledger with every week.

## Checks

- Cash roll ties every week; actual closing cash = bank; revolver ≥ 0, ≤ capacity, and + LCs ≤ commitment.
- AR roll-forward = the projected aging, and AP roll-forward = the unpaid cohorts, every week; every curve plus its bad debt ≤ 100%.
- Dates continuous from the opening date; flags consistent (every week actual, forecast or after the window, and actuals only up to the as-of week); actuals complete for every elapsed week.
- Timing variances reverse inside the window; variance lines sum to the net-cash-flow variance; levers and slippage leave earlier weeks untouched; the engine at the live drivers reproduces the model.
- Warnings: liquidity below the covenant, revolver fully drawn, negative cash, cash below the minimum, overadvance, cumulative variance beyond what the lender permits.

## Common mistakes

- Receipts as a percentage of sales ("collections = last month's revenue"), with no aging and no tie-out, so a slow customer never shows.
- A borrowing base held flat while receivables fall, or availability counted on top of a base that the same collections just reduced.
- Payroll spread evenly by month, which misses the months with three pay dates, or paid at net pay without the taxes.
- Monthly items typed into a week's column, so the next roll puts them in the wrong week.
- Actuals pasted over the forecast cells, which leaves nothing to measure the variance against and no way to roll.
- Every variance called timing. If it hasn't come back by the week promised, reclassify it as permanent.
- Levers summed as cash without rerunning the revolver, the base and the covenant test.
- A first-breach formula wrapped in `IFERROR(…, "none")`. It reports "no breach" when the liquidity row is full of errors; test that the row is numeric first.

## References

- [13-week-cash-flow-mechanics.md](13-week-cash-flow-mechanics.md): formulas for the date flags, the collection curves and the convolution, the lag split, the aging tie-out, the borrowing base and revolver, the first-breach outputs, the actual/forecast switch and reversals, and the timing-shift operator behind the levers
