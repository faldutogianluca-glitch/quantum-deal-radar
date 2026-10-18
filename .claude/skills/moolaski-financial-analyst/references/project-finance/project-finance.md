# Project finance

Answers how much senior debt a single-asset project (a solar or wind farm, a toll road, a plant) can carry, and what the equity earns on top: construction and its funding, operations, tax, debt sized from cash flow, reserve accounts, the cash waterfall, cover ratios and returns. Two things decide whether a project finance model can be trusted: **the debt is sized from CFADS, and every obvious way of doing that is circular** (debt → interest → tax → CFADS → debt, and debt → IDC and fees → project cost → gearing cap → debt), so the loops have to be broken on purpose and the result proved; and **CFADS is defined once** and the sizing, the DSCR, the LLCR and the waterfall all read that one row.

## Before you build

- Gather timing: financial close date, construction length, COD, operating life, PPA or concession term, debt tenor. Work in half-years (or quarters) from close, since lenders test cover ratios semi-annually.
- Gather construction: the capex budget by line (EPC, grid or connection, owner's costs, development fee), its drawdown profile, contingency, and whether equity goes in pro rata or first.
- Gather operations: capacity, yield or traffic at P50 and P90, availability, degradation, seasonality; the contracted price, its escalation and term, then the merchant price; fixed costs by line with their escalators; major maintenance events and cost.
- Gather tax: rate, depreciation method and life, whether losses carry forward.
- Gather debt terms: target DSCR per case (P50, P90, contracted vs merchant), gearing cap, tenor, base rate and hedge share, margin grid, upfront and commitment fees, DSRA months, lock-up ratio.
- Follow [core/conventions.md](../core/conventions.md), [core/time-series.md](../core/time-series.md), [core/balances.md](../core/balances.md) and [core/returns.md](../core/returns.md).

## Build steps

1. **Timing.** Derive every event from one chain: COD = close + construction (+ any delay input); maturity = COD + tenor; PPA end, end of life likewise. Flags for close, construction, COD, operations, PPA, debt periods, first half of each operating year, last period. A day-count fraction row feeds every interest and discounting formula.
2. **Construction.** Spend each budget line on its profile (an S-curve for EPC, straight-line for owner's costs, fees at close), contingency with the costs it covers. Keep base costs, which don't depend on the debt, apart from financing costs, which do.
3. **Operations.** Generation = capacity × yield (P50/P90 switch) × availability × degradation × seasonal share. Revenue = generation × contracted price while the contract runs, merchant after. Opex by line, major maintenance as dated events, receivables on days.
4. **Tax** on taxable income after depreciation and interest, with a loss corkscrew (opening + generated − used = closing). Accelerated depreciation usually means no tax for years; model the carryforward or the early CFADS is understated.
5. **Size the debt before modelling construction funding** ([debt-sculpting.md](debt-sculpting.md)): sizing CFADS from operations only, capacity = PV of CFADS / target DSCR at the loan's own rates, debt = the lesser of that and gearing cap × project cost. Estimate the financing costs in the project cost with an allowance, then check actual gearing against the cap.
6. **Fund construction with that fixed loan.** Upfront fee at close, commitment fee on the undrawn balance, IDC on the opening balance, the initial DSRA at COD, all added to the funding need. Draw the loan pro rata (need × debt / planned cost) or after equity; in the COD period draw whatever is left, so the loan is fully drawn. Equity is the balancing source.
7. **Debt corkscrew.** Interest = opening × all-in rate × day fraction; principal = scheduled debt service − interest. The loan equals the PV of its debt service at the same rates, so the balance hits zero at maturity exactly.
8. **Waterfall**, in order: CFADS → senior interest and principal (DSRA drawn for a shortfall) → DSRA top-up to target or release above it → MRA contribution → lock-up test on historic DSCR → distributions. Trapped cash sits in a lock-up account and is released when the test passes. Formulas in [project-finance-mechanics.md](project-finance-mechanics.md).
9. **Ratios** per period: DSCR, LLCR (PV of CFADS to maturity / opening debt) and PLCR (to end of life); minimum and average DSCR, loan life, weighted average life, and the tail (contract or life left after maturity).
10. **Returns.** Project IRR on pre-financing, post-tax cash flow (tax without the interest shield); equity IRR with `XIRR` on dated contributions and distributions; NPVs at stated rates; LCOE as PV of costs / PV of generation if the user asks for it.
11. **Sensitivities** as scenario blocks (a full recomputation per case, not a data table): P90, capex overrun, opex up, merchant price down, COD delay. **Hold the signed debt** in downside cases (an overrun is equity's problem); **re-size it** when the question is a bid tariff. Solve the tariff for a target equity IRR by interpolating a tariff grid, and say it is interpolated.

## Checks

- Sources = uses; the loan fully drawn at COD; balance zero from maturity on and never negative; PV of scheduled debt service at the debt rates = the loan.
- DSCR on the sizing definition ≥ target in every debt period; actual gearing ≤ cap.
- DSRA at target when funded; waterfall conserves cash every period; no unpaid debt service; reserve and lock-up balances never negative; reserves and trapped cash empty at the end of life.
- Whole-life identity: Σ equity cash flow + balances left = Σ(operating cash − maintenance − tax) − base costs − fees − all interest.
- The base scenario block reproduces the model. A dependency scan (or iterative calculation off) finds no circular reference.
- Warnings: minimum DSCR under the lock-up ratio, periods locked up, DSRA drawn, MRA shortfall, negative principal, a tail shorter than lenders require, LLCR under its floor, equity IRR under target.

## Common mistakes

- Sizing debt on CFADS that includes the interest shield of the debt being sized, then resolving the loop with iteration or a copy-paste macro nobody reruns.
- A gearing cap applied to a project cost that includes IDC computed from the same debt: circular, or silently wrong when the IDC row is stale.
- Three CFADS definitions: one for sizing, one for the DSCR, one in the waterfall. Reserve contributions above the line in one and below it in another.
- Re-sizing the debt in a downside case, which makes every downside look fine: the DSCR stays at target by construction.
- DSRA funded but never released at maturity, or MRA contributions below debt service with no warning when thin cover starves them.
- Interest on the closing balance, or a draw that earns interest in the period it lands.
- A merchant tail inside the tenor sized at the contracted DSCR.
- Periodic `IRR × 2` reported as annual on a semi-annual grid.

## References

- [debt-sculpting.md](debt-sculpting.md) — sculpted vs annuity repayment, the capacity formula, two-pass tax, gearing interplay, the checks that prove it
- [project-finance-mechanics.md](project-finance-mechanics.md) — timing flags, S-curve, funding, rate and discount factors, tax passes, waterfall and reserve rows, ratios, returns
