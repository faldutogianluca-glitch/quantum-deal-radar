# Capital budgeting

Answers "should we make this investment?" for a company: a new plant or line, an expansion, a product launch, replacing a machine, or a choice between alternatives. It values the **incremental** after-tax cash flow of the decision at a hurdle rate. It is not a valuation of the whole company ([dcf](../investment-banking/dcf.md)): the project ends, so there is no terminal value and no equity bridge. Nor is it [project-finance](../project-finance/project-finance.md): the company funds it, so no debt is sized and there are no lender ratios. Most wrong appraisals get the cash flow wrong, not the discounting. They count what the decision doesn't change, or miss what it does.

## Before you build

- Gather the decision and its alternative ("build the line" against "carry on as now", or "A" against "B"), the life, and the decision date.
- Gather capex by year, installation and commissioning (capitalized), start-up costs (expensed), working capital as a % of revenue, salvage value, and decommissioning or site-restoration costs.
- Gather operating drivers (volume and ramp-up, price, unit and fixed costs, escalation), and what the project takes from existing products (cannibalization) or saves them.
- Gather assets the company already owns that the project would use (land, space, a spare machine), with their market and tax book values.
- Gather tax: the rate, the tax depreciation method and life (or the statutory table), and whether losses can be used against the company's other profits.
- Gather the hurdle: the company WACC plus a premium for the project's risk, and the inflation assumption. For MIRR, also a finance rate and a reinvestment rate.
- Follow [conventions](../core/conventions.md), [time-series](../core/time-series.md), [returns](../core/returns.md) and [scenarios](../core/scenarios.md).

## Build steps

1. **Incremental cash flow**: the company with the project, less the company without it. Build that view, or at least build each line to its rule:
   - **Exclude sunk costs** (studies and prototypes already paid for). Show them as a memo, so nobody adds them back.
   - **Include opportunity costs** at their after-tax value: land you own could be sold, so its after-tax sale value is an outflow at year 0, and it comes back at the end.
   - **Include cannibalization** as the existing products' lost *contribution*, not their lost revenue.
   - **Include only incremental overhead.** An allocation of overhead the company pays anyway is a reshuffle, not a cost of the decision.
   - **Exclude financing flows**: interest, draws and repayments belong in the hurdle rate. Tax is on operating profit.
2. **Investment**: capex by year plus capitalized installation; start-up costs expensed (they shelter tax at once); working capital built with revenue and recovered in the last year.
3. **Tax depreciation**, by a method switch: straight line, declining balance switching to straight line, or a statutory table by age. Depreciate each year's additions by vintage, and roll the tax book value forward as a corkscrew ([balances](../core/balances.md)). At the end, tax on the sale = rate × (salvage − tax book value). A gain is taxed, and a sale below book is a loss that shelters tax.
4. **Replacement**: the increment of replacing now over keeping the old asset. It adds the old asset's sale proceeds now, after tax on the gain or loss over its book value, and subtracts the old asset's forgone depreciation tax shield and its forgone salvage at the horizon. Compare over the same horizon (the old asset's remaining life).
5. **Metrics** ([capital-budgeting-mechanics](capital-budgeting-mechanics.md)): NPV at the hurdle, IRR, MIRR, profitability index, simple and discounted payback, and the equivalent annual annuity (EAA).
6. **Mutually exclusive projects**: compute each project's metrics, the difference row A − B, the **crossover rate** `IRR(A − B)` where their NPVs are equal, and an NPV profile (NPV of each over a range of rates, ready to chart). With unequal lives and projects that would be repeated, rank on EAA.
7. **Inflation**: nominal cash flows at a nominal rate. Escalate price and each cost at its own rate. Tax depreciation stays in nominal money, since it is not indexed. Show that real flows at the real rate give the same NPV.
8. **Scenarios, tornado and breakevens** ([scenarios](../core/scenarios.md)). Split the cash flow into driver families. With tax losses relieved against the group, the flow is linear in price, volume, unit cost, fixed cost, capex and the cannibalization rate. Scenarios, grids and breakevens are then exact closed forms. Lead with the breakeven price or volume and the breakeven capex (the overrun the project can absorb).

## Which metric decides

- **NPV governs.** It is the value the decision adds, in today's money, at the rate the capital costs. When IRR and NPV rank two projects differently, the cause is scale or timing: a small or front-loaded project can have the higher IRR and the lower NPV. Below the crossover rate, the NPV ranking holds. IRR also assumes reinvestment at the IRR itself.
- **Multiple IRRs**: with more than one sign change (an overhaul year, a decommissioning outflow), NPV can cross zero more than once, and `IRR` returns whichever root its guess finds. Count the sign changes, and try a low and a high guess. Report NPV, with MIRR as the rate: MIRR has one answer.
- **PI** ranks projects when capital is rationed. It doesn't choose between exclusive ones. **Payback** is a liquidity and risk screen, never the decision.

## Checks

- NPV = `NPV()` + year 0, and = `XNPV` at dates built as start + 365 × year (`XNPV` counts days / 365, so leap days would break the identity).
- NPV at the IRR ≈ 0; `XIRR` = IRR on the same dates; MIRR by hand = `MIRR` over the life only; PI − 1 has the sign of NPV.
- Working capital fully recovered (Σ ΔNWC = 0); tax book value at sale = cost − accumulated depreciation; book value never negative, and zero after the sale.
- With − without = the project's incremental line, every year. A replacement built directly = replace − keep.
- NPV of A = NPV of B at the crossover rate. Real NPV = nominal NPV. The driver families sum to the cash flow. The selected scenario and each grid's centre equal the model.
- Warnings: more than one sign change (possible multiple IRRs), or IRR that depends on its guess; payback beyond the life; IRR or EAA ranking A and B differently from NPV; more than one crossover; planned capex outside the life.

## Common mistakes

- Counting sunk costs, or charging the project an overhead allocation the company pays anyway.
- Using owned land or space as if it were free.
- Deducting interest from the cash flow while also discounting at WACC, which counts financing twice.
- Real cash flows at a nominal rate, or nominal flows at a real rate. Also inflating depreciation along with everything else.
- Choosing between exclusive projects by IRR, PI or payback. Or comparing NPVs of unequal, repeatable lives instead of EAAs.
- Running Excel's `MIRR` over a grid with trailing zeros, which compounds to the grid's end instead of the life's.
- Salvage taxed in full rather than on the gain over tax book value, or working capital never recovered.
- A replacement case that forgets the old asset's forgone depreciation shield and salvage, or compares unequal horizons.

## References

- [capital-budgeting-mechanics.md](capital-budgeting-mechanics.md): formulas for the incremental lines, depreciation by method and vintage, tax on sale, replacement rows, every metric, crossover, NPV profile, real terms and breakevens
