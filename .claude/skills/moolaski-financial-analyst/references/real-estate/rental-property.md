# Single-family rental pro forma (monthly)

Answers whether one rental house is worth buying. It shows how much equity it takes, the cash-on-cash while it is held, what a cash-out refinance returns, and the unlevered and levered IRR and multiple at sale. With partners, it also shows how the returns split. Monthly periods matter for SFR: renovation and lease-up are a month or two, fees fire at each lease signing, and a refi lands in a specific month.

For a multi-tenant building or an apartment acquisition with a rent roll, see [acquisition](acquisition.md).

## Before you build

- Gather: price, transfer tax %, closing costs, due diligence, a make-ready budget by item, and renovation months (rent starts the month after). Also gather: rent, move-in fee, days vacant per year, fixed costs (tax, insurance, HOA per month), variable opex, management % of EGR, leasing fee % of a month's rent, growth rates, and replacement components (cost, useful life, remaining life).
- Also gather the loan terms (LTV, cost, rate, amortization, interest-only?), the refi terms (month, LTV, cost, rate, IO?), hold length, value growth or exit cap, and selling costs. If there are partners: equity shares, pref rate, promote split, and fees.
- Follow [core/conventions.md](../core/conventions.md). Keep one timing driver per event: occupancy start is derived from renovation months, never entered separately.

## Structure

`Inputs` → `Timing` (month index, year, flags) → `Capex` (reserve by year) → `CF` (monthly engine) → `Waterfall` (if partners) → `Annual` (SUMIFS by year) → `Outputs` → `Checks`.

Run the monthly grid **12 months past the latest exit** so forward NOI exists for exit value, and another forward window after the refi month for refi value and DSCR. Totals in the constants column sum month 0 to exit only.

## Build steps

1. **Timing flags**: acquisition (m = 0), hold (1…exit), operating (1…exit+12), occupied (occupancy start…exit+12), move-in, lease start (`occupied × (MOD(m − start, lease term) = 0)`), reserve (occupied × hold), refi, exit, acquisition-loan repayment (refi month if refinancing, else exit), and the two forward windows.
2. **Acquisition** at month 0: price, transfer tax, closing, due diligence, make-ready. The make-ready total is the sum of the budget items, so there is only one source for that number.
3. **Operations**: rent × growth^(year−1) × occupied; move-in fee at move-in; vacancy = days vacant / 365 × rent; fixed costs × operating; variable opex × occupied; leasing fee × lease-start flag (this includes the first lease-up); management × EGR → NOI.
4. **Reserve**: for each component, use cost / remaining life while the year ≤ remaining life, then cost / useful life, divided by 12 and inflated; look it up by year. See [rental-property-formulas.md](rental-property-formulas.md).
5. **Valuation constants**: forward-12-month NOI after the refi and after exit. Value comes either from price growth (compound on months / 12, not rounded years) or from forward NOI / cap. Always show the implied cap rate.
6. **Debt**: one corkscrew per loan (opening + drawdown − principal − repayment = closing). Charge interest on the opening balance. Debt service is due whenever the opening balance > 0. The refi loan is drawn in the refi month, repays the old balance, and nets to equity. That net can be negative; don't hide it with `MAX(0, …)`.
7. **Sale** at exit: price less broker and selling costs. The refi loan is repaid on its own repayment line.
8. **Returns**: unlevered = acquisition + (NOI + reserve) × hold + net sale. Levered = unlevered + every loan flow. Report IRR once, as `(1 + IRR(monthly))^12 − 1`, and label it.
9. **Waterfall** (optional): pref → return of capital → promote, with separate capital and unpaid-pref balances per partner. See [rental-property-waterfall.md](rental-property-waterfall.md).
10. **Annual** roll-up with SUMIFS on year and the in-model flag. Cash-on-cash = cash flow after debt service / equity required, annualized for partial years.

## Checks

- Errors: the timeline fits the grid (exit + 12); the refi month is inside the hold; shares and promote each sum to 100%; both loans are at zero at exit and never negative; partner cash flows sum to deal levered CF less third-party fees; distributable cash ≥ 0; annual = monthly; unlevered CF = acquisition + operations + sale.
- Warnings (shown, not fatal): the refi doesn't cover the old balance; refi DSCR is below the minimum; a component's remaining life is longer than its useful life.

## Common mistakes

- Leasing fee tied to model-year starts instead of lease starts. This skips the lease-up fee and charges renewals in the wrong month.
- Zeroing a loan's balance in its payoff month, which silently drops that month's debt service.
- Refi and exit value from appreciation alone, with no implied cap rate or DSCR shown to sanity-check them.
- Pref accrued on cumulative contributions, so it keeps accruing after capital is returned. Or unpaid pref folded into the capital account, so tiers blur.
- Two IRR definitions on different sheets (monthly × 12 vs. annual). The effective annual rate from monthly flows is higher than × 12.
- Detailed budget or backup tables that feed nothing while a hardcoded total drives the model.
- Rows whose first-period formula differs from the rest, or blanking with `IF(x="","",…)` instead of multiplying by flags.

## References

- [rental-property-formulas.md](rental-property-formulas.md) — row-by-row formulas for timing, operations, reserve, debt corkscrew, refi, sale, returns
- [rental-property-waterfall.md](rental-property-waterfall.md) — pref / capital / promote with separate balances, fee treatment, and the tie-out check
