# Debt sizing and sculpting

Answers how much a lender will lend against a stream of cash flows, and how the loan repays. Sculpting sets debt service in each period to CFADS / target DSCR, so cover is flat at the target, and the debt is the present value of that debt service at the loan's own rates. It lends more than a level (annuity) repayment on the same cash flows, because a level payment is capped by the weakest period. Two things decide whether a sizing can be trusted: **it must not be circular**, since the tax in CFADS depends on the interest of the debt being sized, and **the loan must repay to exactly zero at maturity**, which is a property of the PV identity, not of a plug.

## Before you build

- You need CFADS per period from operations (see [project-finance.md](project-finance.md)), computed **before anything that depends on the debt**.
- Gather: target DSCR per case (a P50 ratio, a stricter P90 or merchant ratio), tenor, base rate and hedge share, margin grid by year, day count, gearing cap, and the project cost the cap applies to.
- Follow [core/conventions.md](../core/conventions.md) and [core/balances.md](../core/balances.md).

## Build steps

1. **Define sizing CFADS once**: revenue − opex − tax ± working capital, with any reserve funded above the line (and nothing funded below it) treated the same way in the waterfall. Write down whether major maintenance is in it or reserved below debt service.
2. **Target DSCR row**: the case ratio in every debt period, plus a merchant add-on in any debt period past the contract.
3. **Discount factor row** at the all-in rate of each period: 1 up to COD, then `prior × 1 / (1 + rate × day fraction)`. Use the same rates and day count as the loan's interest, or the balance won't close.
4. **Capacity**:
   - sculpted: debt service capacity = CFADS / target; capacity = `SUMPRODUCT(capacity row, discount factors)`;
   - annuity: capacity = `MIN(CFADS / target over debt periods) × Σ discount factors`.
5. **Debt = MIN(capacity, gearing cap × project cost).** When the gearing cap binds, scale the sculpted debt service by debt / capacity; cover then sits above target in every period.
6. **Break the tax loop in two passes.** Pass 1: tax without any interest deduction, size, schedule the pass-1 loan and its interest. Pass 2: re-tax deducting that interest, size again. The final loan is bigger than pass 1's, so its interest is higher, actual tax is no higher, and actual DSCR can only land at or above target. Prove it with a check. The first pass alone is valid but leaves the interest shield on the table.
7. **Break the cost loop with an allowance.** Financing costs (IDC, fees, the initial DSRA) depend on the debt. Put them into the capped project cost as a percentage allowance, fund construction with the loan fixed, then check actual gearing ≤ cap. Keep the allowance at or below the actual financing costs, or the cap is breached.
8. **Schedule**: debt service = capacity row × debt / capacity (sculpted) or debt / Σ discount factors (annuity); interest = opening × rate × day fraction; principal = debt service − interest; closing = opening − principal.
9. **Report** the debt, the binding constraint (DSCR or gearing), minimum and average DSCR, LLCR at COD, weighted average life, and the annuity alternative beside it for contrast.

## Checks

- PV of scheduled debt service at the debt rates = the loan; balance zero at maturity and never negative.
- DSCR on the sizing definition ≥ target in every debt period (equal to it when sculpting binds).
- LLCR at COD ≈ the target DSCR under pure sculpting at a flat target: a quick test that the sculpt is right.
- Principal never negative (debt service below interest means the profile or the rates are wrong).
- Gearing ≤ cap on actual project cost.
- No circular reference, and iterative calculation off while you check.

## Common mistakes

- Taxing sizing CFADS with the interest of the sculpted loan and turning on iteration. It usually converges; nobody can then tell whether a change moved the answer or the iteration.
- Discounting capacity at one rate and charging interest at another (or a different day count), so the balance misses zero at maturity and a final-period plug hides it.
- Sizing on P50 CFADS and then showing a "P90 case" that re-sculpts to P90: the DSCR stays at target and the downside looks free. Hold the debt.
- Using the minimum DSCR as evidence of headroom under sculpting: it equals the target by construction. LLCR, PLCR and the tail show the headroom.
- A level repayment compared with sculpting on different CFADS or different rates.
- A sculpted profile in a period of negative or tiny CFADS, which gives zero or negative debt service and a principal holiday nobody agreed.

## References

- [project-finance.md](project-finance.md) — the whole model around the sizing: construction, funding, waterfall, reserves, returns
- [project-finance-mechanics.md](project-finance-mechanics.md) — row-by-row formulas for discount factors, both capacities, the two tax passes and the schedule
