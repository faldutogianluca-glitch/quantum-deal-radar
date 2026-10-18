# Capital budgeting mechanics

Notation: `L` = project life in years, `h` = hurdle rate (WACC + project risk premium), `T` = tax rate, `t` = the year row, `[flag]` = a 1/0 timing row: `[invest]` (year 0), `[ops]` (1…L), `[last]` (= L), `[life]` (0…L). Year 0 is the decision date, in the first period column. Run the grid a year or two past L, so that a longer life still fits.

## Incremental cash flow

| Row | Formula |
|---|---|
| Revenue | `volume × ramp × price × (1 + price esc)^(t − 1) × [ops]` |
| Variable, fixed cost | `−volume × unit cost × (1 + cost esc)^(t − 1)`; `−fixed × (1 + esc)^(t − 1) × [ops]` |
| Incremental overhead | `−(company overhead with − without)`, never the allocation |
| Cannibalization | `−rate × new revenue × existing contribution margin` |
| Start-up (expensed), decommissioning | `−amount × [invest]`; `−amount × [last]` |
| Tax | `−T × (EBITDA − tax depreciation)`: negative (a relief) in a loss year when the company has other profits. Otherwise `MAX(0, …)` with losses carried forward |
| Salvage; tax on sale | `% × capitalized cost × [last]`; `−T × (salvage − tax book value at sale)` |
| Owned land (opportunity cost) | `−(MV − T × (MV − book)) × [invest] + (MV_L − T × (MV_L − book)) × [last]`, `MV_L = MV × (1 + g)^L` |
| NWC; its change | `% × revenue × (1 − [last])`; `−(NWC − prior NWC)` |
| Capex | `−(plan + installation) × [life]` |
| **FCF** | EBITDA + tax + salvage + tax on sale + land + ΔNWC + capex |

**With − without view.** The company's EBITDA without the project (existing contribution − overhead), and with it (existing revenue less the cannibalized revenue, times margin, plus the new contribution, the fixed costs, overhead plus only the incremental part, and the one-offs). Their difference must equal the project's EBITDA row every year. An allocation shows up as a memo row, and it drops out of the difference. Keep memos with their PVs for the sunk cost, the allocation and the interest on any project loan. Then an "NPV with each mistake made" table shows what each error is worth.

## Tax depreciation

Build a rate row by asset age (the columns read as age 0…N), then depreciate each vintage on it.

| Row | Formula |
|---|---|
| Straight line | `1*(age >= 1)*(age <= Tlife) / Tlife` |
| Declining balance, opening per 1 of cost | `prior closing + 1*(age = 1)` |
| Declining balance rate | `IF(AND(age >= 1, age <= Tlife), MAX(open × f / Tlife, open / (Tlife − age + 1)), 0)`: switches to straight line on the remainder and reaches zero at Tlife |
| Table | typed by age (for a half-year convention it runs one year past the class life); check that it sums to 100% |
| Rate used | `CHOOSE(method, SL, DB, table)` |
| Vintage v (one row each, v in the constant column) | `INDEX(additions, 1, v + 1) × INDEX(rate, 1, MAX(0, year − v) + 1) × (year >= v)` |
| Depreciation | `Σ vintages × [life]`: it stops at the sale |
| Book value | `opening + additions − depreciation`, then disposal `−(balance before disposal) × [last]` |

Check that book value at sale = `Σ additions − Σ depreciation` over the life, and that the closing balance after the sale is 0.

## Replacement (replace now − keep)

| Row | Formula |
|---|---|
| Net investment, year 0 | `−(new cost + installation) + old MV − T × (old MV − old book value) ± NWC released` |
| Operating savings | `(old opex − new opex) × (1 − T) × [ops]` |
| Change in depreciation shield | `T × (new basis × rate(age) − old remaining depreciation) × [ops]`: the old asset's shield is forgone |
| Terminal | `(new salvage − T × (new salvage − new book at horizon)) − (old salvage − T × (old salvage − old book at horizon))` |
| NWC | reverse at the horizon what was released at year 0 |

Build it both ways: two full cases (keep and replace) and their difference, and these direct rows. They must tie. The horizon is the old asset's remaining life. If the lives differ, compare equivalent annual costs.

## Metrics

| Metric | Formula |
|---|---|
| NPV | `SUMPRODUCT(FCF, (1 + h)^−t)`. Also `NPV(h, year 1…N) + year 0`, and `XNPV(h, FCF, start + 365 × t)` |
| IRR | `IRR(FCF row)`; also `IRR(row, low guess)` and `IRR(row, high guess)` |
| MIRR by hand | `(SUMPRODUCT((FCF > 0) × FCF × (1 + reinv)^(L − t) × [life]) / −SUMPRODUCT((FCF < 0) × FCF × (1 + fin)^−t × [life]))^(1/L) − 1` |
| MIRR by Excel | `MIRR(INDEX(row,1,1):INDEX(row,1,L+1), fin, reinv)`: the life only. Trailing zeros would compound to the grid's end |
| Profitability index | `1 + NPV / PV(capital outlays)`, where outlays = capex and installation, plus assets taken from other uses |
| Payback year k | `MATCH(TRUE, INDEX(cum >= 0, 0), 0) − 1`, "beyond life" if none |
| Payback, interpolated | `k − 1 − INDEX(cum, 1, k) / INDEX(FCF, 1, k + 1)`; discounted: the same on cumulative PV |
| EAA | `NPV × h / (1 − (1 + h)^−L)` (`NPV / L` when h = 0) |
| Sign changes | helper `sgn = IF(FCF <> 0, SIGN(FCF), prior sgn)`; change = `1*(FCF <> 0)*(prior sgn <> 0)*(SIGN(FCF) <> prior sgn)`. Zeros between flows can't hide a change |

**Crossover rate** = `IRR(A − B row)`. Check that `SUMPRODUCT(A, (1 + x)^−t) = SUMPRODUCT(B, (1 + x)^−t)` at it. **NPV profile**: rates `k × step` down a column, with `SUMPRODUCT(A row, (1 + rate)^−t)` and the same for B across. Chart it as lines: each line meets zero at that project's IRR, and they cross at the crossover. A − B with more than one sign change can have more than one crossover.

## Real and nominal

| Item | Formula |
|---|---|
| Real FCF | `FCF × (1 + i)^−t` |
| Real rate | `(1 + h) / (1 + i) − 1`, not `h − i` |
| Identity | `SUMPRODUCT(real FCF, (1 + real)^−t)` = nominal NPV; `(1 + real IRR)(1 + i) − 1` = nominal IRR |

A real build needs the depreciation shield deflated too (`T × dep × (1 + i)^−t`), since tax depreciation is fixed in nominal money. So when higher inflation raises the nominal hurdle, the shield is worth less, and NPV falls even if prices and costs are fully indexed.

## Driver families and breakevens

With tax relief on losses, FCF splits exactly into families. Take their PVs at h:

| Family | Row | Scales with |
|---|---|---|
| R | `revenue × (1 − T) + ΔNWC` | price × volume |
| C₁ | `−existing margin × revenue × (1 − T)` (per 100% cannibalization) | price × volume × rate |
| V | `variable cost × (1 − T)` | volume × unit cost |
| F | `fixed cost × (1 − T)` | fixed cost |
| K | `capex + T × depreciation + salvage + tax on sale` | capex scale |
| O | everything else (overhead, one-offs, land) | none |

`PV_RC = PV_R + rate × PV_C1`. Breakevens: price `= price × −(PV_V + PV_F + PV_K + PV_O) / PV_RC`; volume `= volume × −(PV_F + PV_K + PV_O) / (PV_RC + PV_V)`; capex scale `= scale × −(PV_RC + PV_V + PV_F + PV_O) / PV_K` (the overrun the project can absorb); cannibalization rate `= −(PV_R + PV_V + PV_F + PV_K + PV_O) / PV_C1`; hurdle = IRR. A scenario's NPV is `SUMPRODUCT(sp·sv·(R + c·C₁) + sv·su·V + sf·F + sk·K + O, (1 + WACC + premium)^−t)`, and its IRR is `IRR` of the same row expression (see [scenarios-mechanics](../core/scenarios-mechanics.md)). Plug each breakeven back into the rows, and check that NPV ≈ 0.
