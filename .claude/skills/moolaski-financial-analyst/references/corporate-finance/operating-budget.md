# Operating budget and budget vs actual

Plans the coming year month by month, from the drivers management controls: customers and price, the hiring plan, what each department spends. Then, once the year starts, it holds actuals against that plan. It answers "what will we spend and earn next year, and what does it leave us in cash?" and, from February on, "are we on plan, why not, and where will we land?". This is the FP&A model: departments own lines in it, and the board reads its variances. It is not a three-statement model ([three-statement](three-statement.md) builds the balance sheet and the financing), and not a weekly liquidity forecast ([13-week-cash-flow](13-week-cash-flow.md)).

Three things make it hard, and they are the point: **revenue and payroll are built from units** (contracts that renew in their month, people with start dates), not from growth rates; **the year has to equal its months** on every line and every balance; and **the variance has to read the right way round** for a cost and for revenue, against a plan that must not move once it is approved.

## Before you build

- Gather the opening position: customers and recurring revenue by plan type, annual contracts by renewal month (value and count), deferred revenue, receivables, payables, accruals (bonus, commissions), prepaid contracts, cash.
- Gather revenue drivers: new customers by month, the mix of monthly and annual-upfront plans, price per new customer, price increases and their month, churn by plan type, expansion, services attached to new deals.
- Gather the roster: every role with department, heads, salary and start date (and end date for known leavers), plus the open requisitions with planned start dates. Then employer tax rates and wage caps, benefits, bonus targets and eligibility, commission plans, merit rate, month and eligibility cut-off, and recruiting costs.
- Gather non-payroll spend by department and GL line, each with its driver: fixed monthly, per head, a percentage of revenue, or a one-off in a named month. Mark which lines are discretionary.
- Gather capex with in-service months and lives, the prior year's actuals by line, and the thresholds the board watches (margin, runway, overspend).
- Follow [conventions](../core/conventions.md), [time-series](../core/time-series.md), [balances](../core/balances.md) and [scenarios](../core/scenarios.md). Formulas are in [operating-budget-mechanics](operating-budget-mechanics.md).

## Build steps

1. **Month grid** for the budget year, with flags on `Timing`: actual (up to the as-of month), remaining, the as-of month, and the month scenario levers start. Annual totals are the sum of the months; balances show opening and closing rows.
2. **Revenue from a customer and ARR bridge.** Roll customers and MRR per pool: opening + new + expansion + price − churn = closing. Renew annual contracts in their anniversary month, billed a year upfront, and recognize them ratably. Keep **bookings** (new and expansion contract value), **billings** (what is invoiced) and **revenue** (what is earned) as separate rows. Roll deferred revenue (opening + annual billings − revenue recognized), and tie it to the unexpired months of every contract in force.
3. **Headcount from a dated roster.** For each line, FTE = heads × days active in the month / days in the month, so partial months prorate. Cost is **gross** salary, plus employer taxes (capped taxes stop at the annual wage base, per employee, on year-to-date pay), benefits, a monthly bonus accrual on eligible pay, commissions on bookings, and the merit raise from its month for staff hired before the cut-off. Recruiting fees and equipment follow hires. Report headcount and FTE by department. Roll opening + hires − leavers = closing, and check it against a count from the dates.
4. **Non-payroll opex** by department and GL line: fixed + rate × department FTE + % of revenue + one-offs in their month. Payment fees and hosting follow revenue; software and travel follow heads.
5. **Capex and depreciation**, straight line from each in-service month, with equipment per new hire.
6. **P&L by month** with three cuts that must agree: by department, by GL line, and by function (cost of revenue, R&D, S&M, G&A) through a department-to-function map. Show gross margin, EBITDA and EBITDA margin. Compute tax on the year to date, so the months add up to the annual floor.
7. **Cash view**, kept light: EBITDA → cash through receivables (days on billings), deferred revenue, prepaid contracts, payables, bonus and commission accruals, tax paid and capex. Prove it by the direct method (receipts less payments). Report year-end cash, burn and runway.
8. **Actuals, latest estimate, variance.** Type actuals into their own block, never over the budget. Latest estimate per line = actual × [actual month] + budget × [remaining]. Report the variance for the month, year to date and full year in $ and %, marked F or U by line type. Split revenue and one variable cost into volume and rate with a flex budget, and flag departments over budget beyond a threshold.
9. **Scenarios and levers** ([scenarios](../core/scenarios.md)): new logos, churn, price, a hiring delay of N months, a cut to discretionary lines. Apply them from a lever month after the as-of month. Rerun revenue, payroll, opex and cash for each case, and show EBITDA, year-end cash and runway side by side.

## Variance rules

- **Sign.** Show amounts positive and give each line a type: +1 for revenue and profit, −1 for costs. Then variance = actual − budget, and it is favourable when type × variance > 0. The detail lines' type × variance must add up to the EBITDA variance.
- **Freeze the budget.** Once approved, it is a record. Re-forecasting goes into the latest estimate, and a scenario or lever never changes an elapsed month. Keep the approved version recoverable (the base scenario with no flex), and flag any other live case.
- **Flex before you blame.** For a variable cost, flexed budget = budget rate × actual volume. Volume variance = flexed − budget, and spending variance = actual − flexed. Revenue splits the same way into customers and revenue per customer. A cost that is over budget because revenue is over budget is not an overspend.
- **Explain, don't just report.** Every material variance gets a driver (volume, price, timing, one-off) and a verdict: does it recur in the latest estimate or not?

## Checks

- Monthly lines sum to the year. Every balance's annual roll (first opening + the year's flows = last closing) ties: customers, ARR, deferred revenue, headcount, receivables, accruals, cash.
- Customer and ARR bridges tie. Deferred revenue = unexpired contracts. Headcount roll = the count from the dates, and the opening count = HR's. The department, GL and function cuts each equal total costs.
- Indirect cash = direct cash every month. Capped tax never exceeds rate × cap per head. The tax months add up to the annual floor.
- As-of month in range; actuals complete for elapsed months; the lever month after the as-of month. The latest estimate = actuals + remaining budget on every line. Sign logic and flex splits add up. The engine at the model's drivers reproduces the model.
- Warnings: a department over budget year to date beyond the threshold, EBITDA margin below target, runway under the minimum, actuals typed past the as-of month, a non-base case live.

## Common mistakes

- Payroll at employees' net pay, or at heads × average salary × 12, with no start dates. The employer's cost is gross pay plus employer taxes and benefits, from the month each person starts.
- Employer taxes as a flat percentage all year, when capped taxes stop partway through the year for higher earners.
- Revenue = billings, or deferred revenue left out of working capital, so annual-upfront billing looks like revenue in the month it is invoiced.
- Churn applied to annual contracts every month instead of at renewal.
- Tax or bonus floored month by month (`MAX(0, month) × rate`), which overcharges a year with a loss month. Floor the year to date.
- An annual column that sums balances, or takes December's opening, or omits a line the monthly total includes.
- Actuals pasted over budget cells, which leaves nothing to vary against; or a re-forecast saved over the approved budget.
- A cost variance read with a revenue sign, so overspend shows as favourable.
- `IFERROR(…, 0)` around lookups and ratios, which turns a broken link into a zero variance.
- Levers summed as EBITDA while cash is ignored: annual billing, payables and one-off hiring costs make a lever's cash effect differ from its EBITDA.

## References

- [operating-budget-mechanics.md](operating-budget-mechanics.md): formulas for the two-pool revenue bridge, renewals, deferred revenue and its tie-out, roster FTE with day proration and hiring delay, capped employer tax, headcount roll, driver-based opex, tax on the year to date, the cash view, the latest estimate, variance signs, flex variances and the lever cases
