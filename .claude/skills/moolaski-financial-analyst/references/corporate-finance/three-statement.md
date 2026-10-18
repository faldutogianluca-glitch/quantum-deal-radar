# Three-statement model

Forecasts a company from operating drivers and produces three statements that agree with each other. It answers how much cash the business throws off, when it needs to borrow, and what its balance sheet looks like along the way. It is also the base a DCF, an LBO or a credit analysis sits on.

Two things make this harder than a single cash-flow model, and they're the whole point: **the balance sheet has to balance every period**, and **interest depends on debt balances that depend on the cash flow that interest affects**.


For week-by-week liquidity against a revolver and a covenant, see [13-week-cash-flow](13-week-cash-flow.md).
## Before you build

- Gather: the last historical year's revenue and balance sheet (cash, receivables, inventory, PP&E, goodwill, payables, accruals, debt, share capital), and the forecast horizon.
- Gather drivers, per year: revenue growth, COGS and SG&A as % of revenue, D&A, capex, DSO / DIO / DPO days, accruals, tax rate, dividend payout.
- Gather debt terms: opening balances, rates, amortization, a revolver commitment, and the minimum cash balance.
- Follow [core/conventions.md](../core/conventions.md) and [core/time-series.md](../core/time-series.md). Balances use [core/balances.md](../core/balances.md).

## Structure

`Inputs` (scalars) → `Timing` (year index, flags) → `Drivers` (per-year assumptions, blue) → `IS` → `WC` (working capital and PP&E) → `Debt` → `BS` → `CFS` → `Checks`.

Year 0 is the last historical year; the forecast runs 1…N. Keep drivers on their own sheet as input rows across the years, flat by default, so any single year can be overridden without breaking the row.

If history is shown, back-solve each driver from the historical statements on the **same base the forecast formula uses** (opening, closing or average balance), and name that base in the label: "D&A % of opening PP&E". A historical ratio on closing PP&E next to a forecast on opening PP&E can't justify the input, and the first forecast year jumps for no business reason.

## Build steps

1. **Income statement**: revenue = prior × (1 + growth) in forecast years, the historical input in year 0. COGS and SG&A as % of revenue; EBITDA; D&A from the PP&E schedule; EBIT; interest from the Debt sheet; tax = rate × max(0, EBT); net income; dividends = payout × net income.
2. **Working capital** on days: receivables from revenue, inventory and payables from COGS, accruals from SG&A. Net working capital and its change feed both the cash flow statement and any DCF. Compute year 0 from the same days, so the opening balance sheet is consistent with the drivers.
3. **PP&E**: opening + capex − depreciation = closing, with year 0 set to the historical input.
4. **Debt and cash** — the part to get right, see [three-statement-circularity.md](three-statement-circularity.md):
   - Term loan corkscrew with scheduled amortization and an optional cash sweep.
   - Cash flow before the revolver = net income + D&A − ΔNWC − capex + debt movements − dividends.
   - Revolver draw = shortfall below the minimum cash balance; repayment sweeps cash above it.
   - **Charge interest on opening balances.** The model then has no circular reference at all, and every result is reproducible. Offer average balances as a switch for those who want it, and say plainly that it needs iterative calculation on.
5. **Balance sheet**: assets (cash, receivables, inventory, net PP&E, goodwill) and liabilities and equity (payables, accruals, revolver, term loan, share capital, retained earnings). Retained earnings roll forward: opening + net income − dividends. Set year 0 retained earnings as the plug that balances the opening balance sheet, so every later year is a genuine test.
6. **Cash flow statement**: operating, investing, financing, then the change in cash. Its closing cash must equal the balance sheet's cash line — that equality is the model's main check, not a formality.
7. **History**, if shown, is linked like the forecast: the historical cash flow statement's net income, D&A and working-capital change point at the historical income statement and schedules, and every corkscrew's opening balance points at the prior closing, in history too. Typed historical lines let the statements drift apart while both checks still pass, because historical cash is typed as well.
8. **A monthly first year** (common in budgets) rolls into the annual columns: flows are the sum of the twelve months, balances are the December closing. Check the annual year 1 against the monthly sums line by line.

## Checks

- Assets = liabilities + equity in every year. Report the sum of absolute differences, so no year can hide.
- Cash flow statement closing cash = balance sheet cash.
- Retained earnings roll forward exactly.
- Revolver and term loan never negative; cash never below its minimum.
- Tax rates and ratios within sane bounds.
- A check flag must fail on an error, not hide it. `IFERROR(IF(ABS(diff)>tol,"ERROR","OK"),"OK")` reports a `#REF!` as OK; test `ISERROR` first and report it as a failure.
- If average-balance interest is on, a warning that iterative calculation is required.

## Common mistakes

- **Plugging the balance sheet.** If a line is "whatever makes it balance", the model can no longer tell you when it's wrong. Only year-0 retained earnings may be a plug.
- Interest on closing or average balances without realising it creates circularity, then fighting the warning with manual iteration and stale values.
- A revolver that draws but never repays, or that ignores the minimum cash balance.
- Depreciation as a % of revenue while PP&E also rolls forward, with the two never reconciled. Pick one and make the schedule authoritative.
- Working capital forecast as a % of revenue for some lines and days for others, so the cash conversion cycle is unreadable.
- Dividends or buybacks that don't reduce retained earnings and cash by the same amount.
- Working capital that leaves out a balance-sheet line. Every operating current asset and liability on the balance sheet (prepaids, accruals, deferred revenue) must be in the change in NWC, or the balance sheet stops balancing as soon as that line is non-zero.
- Payroll expensed at employees' net pay. The employer's cost is gross pay plus employer contributions; taxes withheld from employees are a payable, not a saving.
- Monthly tax or bonus floors (`MAX(0, month's profit) × rate`) that overcharge a year with a loss month. Apply floors to the year, or carry losses forward.
- Excel defined names are **case-insensitive**: `Rev_0` and `REV_0` are one name, and the second definition silently wins.

## References

- [three-statement-circularity.md](three-statement-circularity.md) — where circularity comes from, the three ways to handle it, and how to test that a model resolved rather than got stuck
