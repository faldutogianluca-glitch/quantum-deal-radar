# Operating budget mechanics

Notation: `t` = the month (1 in the first column), `A` = the as-of month, `L` = the lever month (L > A), `[flag]` = a 1/0 timing row: `[act]` (t ≤ A), `[rem]` (t > A), `[lev]` (t ≥ L), `[price]` (t ≥ price month). `mstart`, `mend` and `days` are the month's first day, last day and length. Costs are negative on every calculation sheet.

## Revenue: two pools

**Price factor**: `pf = (1 + plan increase × [price]) × (1 + scenario increase × [lev])`, and `pf₋₁` the same on t − 1.

**Monthly plans** (movements on the 1st; revenue = the month's MRR; churn c = `1 − (1 − annual rate)^(1/12)`):

| Row | Formula |
|---|---|
| Customers | `opening + new × (1 − annual share) − opening × c` |
| MRR, new | `new monthly customers × ARPA × pf` |
| MRR, expansion; price | `opening × expansion rate`; `opening × (pf / pf₋₁ − 1)` |
| MRR, churn | `−opening × c` |

**Annual-upfront contracts**, from a per-month input of last year's contracts by renewal month (`PY ACV(t)`, `PY customers(t)`), with non-renewal rate r at renewal:

| Row | Formula |
|---|---|
| Kept at renewal | `PY ACV(t) × (1 − r)` |
| Price; expansion at renewal | `kept × (pf − 1)`; `kept × pf × uplift` |
| New ACV | `new × annual share × ACV × pf` |
| Billings | `new ACV + kept + price + expansion` (a year upfront) |
| MRR bridge | `opening + (new + price + expansion − PY ACV × r) / 12` |
| MRR, direct (tie-out) | `(SUM(billings, months 1…t) + SUMPRODUCT(PY ACV, 1*(month > t))) / 12` |

Revenue from the pool = its MRR (ratable). ARR = 12 × (MRR of both pools). Bookings = new ACV + 12 × new monthly MRR + expansion ACV (commissionable); renewals are a memo line. Billings = monthly-plan revenue + annual billings + services.

**Deferred revenue**: opening `= SUMPRODUCT(PY ACV, month − 1) / 12`; + annual billings − annual revenue = closing. Tie-out, the unexpired months of every contract in force:

```
( SUMPRODUCT(billings, 12 − 1 − t + month, 1*(month <= t))
+ SUMPRODUCT(PY ACV, month − 1 − t, 1*(month > t)) ) / 12
```

## Payroll: one row per roster line

| Row | Formula |
|---|---|
| Effective start (constant) | `IF(AND(delay > 0, start >= lever start date), EDATE(start, delay), start)` |
| FTE | `heads × MAX(0, MIN(mend, IF(end > 0, end, mend)) − MAX(mstart, eff) + 1) / days` |
| Gross salary | `FTE × salary / 12 × (1 + merit × [merit] × (start < cut-off))` |
| Capped employer tax | `IF(heads > 0, rate × heads × (MIN(cum / heads, cap) − MIN((cum − gross) / heads, cap)), 0)`, cum = `SUM(INDEX(gross row, 1, 1):this month)` |

Department rows: `SUMPRODUCT(1*(dept range = d), the month's column of line rows)` for FTE, salaries and capped tax; bonus = bonus % × `SUMPRODUCT(1*(dept = d), eligible flags, gross column)`. Then employer taxes = capped + uncapped rate × salaries (+ tax on commissions), benefits = % × salaries, commissions = rate × bookings, recruiting = % × `SUMPRODUCT(heads, salary, 1*(start >= year start), 1*(eff >= mstart), 1*(eff <= mend))`.

**Headcount** (from dates, per department):

| Row | Formula |
|---|---|
| Closing, counted | `SUMPRODUCT(heads, 1*(dept = d), 1*(eff <= mend), 1*(end = 0) + 1*(end > mend))` |
| Hires; leavers | eff within `[mstart, mend]`; end within `[mstart, mend]` |
| Opening, month 1 | the count at the start of the year: check it against HR |
| Roll | opening + hires − leavers = the count, every month |

## Opex, capex, tax

| Row | Formula |
|---|---|
| Opex line i | `−(fixed + per FTE × CHOOSE(dept, FTE rows) + % × subscription revenue + % × revenue + one-offs) × (1 − cut × cuttable × [lev])` |
| One-offs | `SUMPRODUCT(amount, 1*(line = i), 1*(month = t))` |
| Prepaid contract expense | `IF(t < renewal month, old contract, new contract) / 12` |
| Depreciation | `SUMPRODUCT(amount, 1 / (life + 1*(life = 0)), 1*(in service <= t), 1*(t < in service + life))` + cumulative equipment / its life |
| Tax | `−(rate × MAX(0, YTD EBIT − losses b/f) − the same for t − 1)`: the floor applies to the year, not the month |

## Cash view

| Row | Formula |
|---|---|
| Receivables | `billings × DSO / days` |
| Payables | `non-payroll spend (not prepaid contracts) × DPO / days` |
| Prepaid | opening + paid at renewal − expensed; tie to the unexpired months of the contract in force |
| Bonus, commissions accrued | opening + accrued − paid (last year's bonus in its month; commissions the next month) |
| Net cash flow | `EBITDA − Δreceivables + Δdeferred − Δprepaid + Δpayables + Δaccruals − tax paid − capex` |
| Direct (tie-out) | `(opening AR + billings − AR) − payroll paid − (opening AP + spend − AP) − prepaid paid − capex − tax paid` |
| Latest-estimate cash | `[act] × (bank − prior bank) + [rem] × net cash flow`, rolled from opening cash |
| Runway | `IF(burn > 0, year-end cash / burn, "no burn")`, burn = `−SUMPRODUCT(LE net cash flow, [window]) / window` |

## Actuals, latest estimate, variance

| Row | Formula |
|---|---|
| Latest estimate, per line | `[act] × actual + [rem] × budget` |
| Displayed amount | `type × signed amount` (type +1 revenue and profit, −1 cost) |
| Month | `type × IF(A > 0, INDEX(row, 1, A), 0)` |
| YTD; full year | `type × SUMPRODUCT(row, [act])`; `type × (SUMPRODUCT(actual, [act]) + SUMPRODUCT(budget, [rem]))` |
| Variance; %; F/U | `actual − budget`; `IF(budget = 0, "n/a", var / ABS(budget))`; `IF(ABS(var) < tol, "-", IF(type × var > 0, "F", "U"))` |
| Sign test | `SUMPRODUCT(detail flag, type, var) − EBITDA var = 0`, and no detail line where F and `type × var < 0` (or U and `> 0`) |
| Department overrun | `1*(YTD actual > YTD budget × (1 + threshold))` on each department total |
| Completeness | per month: `[act] × (ROWS(block) − COUNT(block))` = 0, and `[rem] × COUNT(block)` flags early entries |

**Flex variances (YTD)**:

| Split | Volume | Rate |
|---|---|---|
| Revenue: customer-months × revenue per customer-month | `(CMₐ − CM_b) × rate_b` | `(rateₐ − rate_b) × CMₐ` |
| Variable cost (e.g. hosting): flexed = `(budget cost / budget revenue) × actual revenue` | `flexed − budget` | `actual − flexed` |
| Salaries: FTE-months × cost per FTE-month | `(FTEₐ − FTE_b) × cost_b` | `(costₐ − cost_b) × FTEₐ` |

Each pair must sum to the total variance.

## Lever cases

Churn compounds through the bridge, a hiring delay moves prorated months and capped taxes, and annual billing moves cash apart from EBITDA. So none of these levers is a closed form: rerun each case in an engine block ([scenarios-mechanics](../core/scenarios-mechanics.md)). A block holds the price factor, new logos, both pools' MRR and billings, deferred revenue, bookings, the roster rows (FTE, gross, capped tax) at the case's delay, department FTE, payroll, opex at the case's cut, EBITDA, receivables, payables, accruals and net cash flow. The latest-estimate outputs follow: full-year EBITDA = `SUMPRODUCT(actual EBITDA, [act])` + the case's EBITDA over `[rem]`, year-end cash, lowest cash and runway. Add a block at the model's drivers and check it equals the model every month. Then check that the selected scenario's block equals the model when no flex is on.
