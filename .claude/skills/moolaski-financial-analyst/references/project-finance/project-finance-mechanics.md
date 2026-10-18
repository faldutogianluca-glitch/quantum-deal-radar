# Project finance mechanics

Notation: period 0 is financial close; each later period is a half-year (`P` = 2 per year). `Pc` = COD period, `p` = period index, `[flag]` = a 1/0 row on the timing sheet, `dcf` = days / 365, `D` = senior debt. Cash-flow rows carry their sign (in +, out −); balances are positive.

## Timing

| Row | Formula |
|---|---|
| Period end | `EDATE(close, 12 / P × p)` |
| Day fraction | `(end − prior end) / 365`, 0 at close |
| COD period | `construction periods + delay` (maturity, PPA end and end of life add `P × years` to it) |
| Construction | `1*AND(p >= 1, p <= Pc)`; funding window `1*(p <= Pc)` |
| Operations | `1*AND(p > Pc, p <= end of life)`; operating period `(p − Pc) × [ops]`; year `ROUNDUP(op period / P, 0)` |
| Debt period | `[ops] × (p <= maturity)` |
| First half of an operating year | `[ops] × (MOD(op period, P) = 1)` |

## Construction and funding

| Row | Formula |
|---|---|
| S-curve share, period k of n | `[constr] × (COS(PI() × (k − 1) / n) − COS(PI() × k / n)) / 2` (sums to 1 for any n) |
| Planned project cost | `base costs × (1 + financing allowance %)` |
| Upfront fee | `fee % × D × [close]` |
| Commitment fee | `fee % × (D − opening drawn) × dcf × [constr]` |
| IDC | `opening drawn × all-in rate × dcf × [constr]` |
| Initial DSRA | `DSRA target × [COD]` |
| Need | base costs + upfront + commitment + IDC + initial DSRA |
| Draw, pro rata | `MIN(D − drawn, need × D / planned cost)` |
| Draw, equity first | `MIN(D, MAX(0, cumulative need − (planned cost − D))) − drawn` |
| Draw, COD period | `D − drawn` (the loan is always fully drawn) |
| Equity | `(need − draw) × [funding]`; negative only as a true-up refund at COD |

## Operations and tax

| Row | Formula |
|---|---|
| Generation | `[ops] × capacity × CHOOSE(case, P50 yield, P90 yield) × availability × (1 − degradation)^(year − 1) × seasonal share` |
| Price | `[ppa] × tariff × (1 + esc)^(year − 1) + ([ops] − [ppa]) × merchant × (1 + esc_m)^(year − 1)` |
| Opex line | `−annual × (1 + inflation)^(year − 1) / P × [ops]` |
| Major maintenance | `−cost × index × [first half] × (year >= first) × (MOD(year − first, interval) = 0)` |
| Receivables | `revenue × days / period days × (1 − [last])`; Δ working capital = `−(receivables − prior)` |
| Depreciation | straight-line `base / (P × life) × (op period <= P × life)`, or `VDB(base, 0, P × life, MIN(op period − 1, P × life), MIN(op period, P × life), factor)` |
| Taxable income | `(EBITDA + maintenance + depreciation − interest) × [ops]` |
| Losses used | `MIN(opening losses, MAX(0, taxable))`; generated `MAX(0, −taxable)` |
| Tax | `−rate × (MAX(0, taxable) − losses used)` |

Run the tax block three times: **unlevered** (interest 0: sizing pass 1 and the project IRR), **pass 2** (interest of the pass-1 loan) and **actual** (interest of the real loan). Each has its own loss corkscrew.

## Rates, discount factors and sizing

| Row | Formula |
|---|---|
| All-in rate | `hedge % × swap + (1 − hedge %) × floating + margin` (margin by construction / year band) |
| Discount factor | `IF(p <= Pc, 1, prior DF / (1 + rate × dcf))` to the end of life |
| Target DSCR | `[debt] × (case target + ([ops] − [ppa]) × merchant add-on)` |
| Sizing CFADS | `revenue + opex + Δ working capital + tax of the pass` |
| Capacity row | `IF([debt], sizing CFADS / target, 0)` |
| Sculpted capacity | `SUMPRODUCT(capacity row, DF)` |
| Annuity capacity | `MINIFS(capacity row, [debt], 1) × SUMPRODUCT(DF, [debt])` |
| Gearing limit | `cap × planned project cost` |
| Debt | `MIN(gearing limit, capacity)` (pass 1, then pass 2) |
| Debt service, sculpted | `capacity row × D / capacity` |
| Debt service, annuity | `D / SUMPRODUCT(DF, [debt]) × [debt]` |
| Interest | `opening × rate × dcf × ([constr] + [debt])` |
| Principal | `(debt service − interest) × [debt]` |

The pass-1 loan needs its own small schedule (opening, interest, debt service, closing = `[COD] × D₁ + [debt] × (opening + interest − debt service)`) only to produce the interest that pass 2 deducts.

## Waterfall (per operating period, in order)

| Row | Formula |
|---|---|
| MRA release | `MIN(opening MRA, −maintenance)` |
| CFADS | `revenue + opex + Δ working capital + actual tax + maintenance + MRA release` |
| DSRA draw | `MIN(opening DSRA, MAX(0, −(CFADS − debt service))) × [debt]` |
| Cash after debt service | `CFADS − debt service + DSRA draw` |
| DSRA target | `SUMPRODUCT(debt service row × (p row > p) × (p row <= p + months × P / 12)) × (p >= Pc)` |
| DSRA top-up | `−MIN(MAX(0, cash after DS), MAX(0, target − (opening − draw))) × [ops]` |
| DSRA release | `MAX(0, opening − draw − target) × [ops]` (the whole balance at maturity) |
| MRA scheduled | `[ops] × SUMPRODUCT(−maintenance row × (p row > p) × (p row <= p + build periods)) / build periods` |
| MRA contribution | `−MIN(MAX(0, cash after DSRA), scheduled)` |
| Historic DSCR | `(CFADS + prior CFADS) / (debt service + prior debt service) × [debt]` |
| Lock-up | `[debt] × (historic DSCR < lock-up ratio)` |
| Trapped / released | `lock × MAX(0, available)` / `(1 − lock) × opening lock-up balance` |
| Distribution | `(1 − lock) × MAX(0, available) + released` |
| Conservation | CFADS − debt service + DSRA draw + top-up + release + MRA contribution − trapped + released − distribution `= 0` |

## Ratios and returns

| Item | Formula |
|---|---|
| DSCR | `CFADS / debt service` in debt periods |
| LLCR at p | `SUMPRODUCT(CFADS, DF, [debt], 1*(p row >= p)) / prior DF / opening balance` |
| PLCR at p | the same with `[ops]` in place of `[debt]` |
| Weighted average life | `SUMPRODUCT(principal, op period) / P / D` |
| Project cash flow | `−base costs + (CFADS before tax and maintenance + maintenance + unlevered tax) × [ops]` |
| Equity cash flow | `−equity contributions + distributions` |
| IRRs | `XIRR(row, period-end dates)`; NPV `XNPV(rate, row, dates)` to close |
| LCOE | `XNPV(r, base costs + opex + maintenance) / XNPV(r, generation)` |
| Whole-life identity | `Σ equity CF + DSRA, MRA and lock-up left = Σ(CFADS before tax and maintenance + maintenance + actual tax) − base costs − fees − Σ interest incl. IDC` |

**Tariff for a target equity IRR.** Build scenario blocks at tariff ± 1 and ± 2 steps with the debt re-sized, then in the segment whose IRRs bracket the target: `T₁ + (target − IRR₁) × (T₂ − T₁) / (IRR₂ − IRR₁)`. Set the model to the result and read the IRR back: the gap is the interpolation error, usually a few basis points; re-centre the grid to tighten it.
