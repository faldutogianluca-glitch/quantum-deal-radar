# Scenarios, sensitivities and breakevens

Every model gets asked the same follow-ups: what if price is 5% lower, what does the downside look like, which assumption matters most, and how far can it move before the answer flips. Answer each with a live recomputation that can be checked against the model. Never use a pasted table, a macro that overwrites inputs, or a goal-seek result typed in as an assumption. Three rules carry most of it: **inputs have one source**, **the model reads only the live values**, and **every what-if reproduces the model at its centre**.

## Scenario manager

- Put a scenario block on `Inputs`, one row per driver: **Used · Live · Base · Upside · Downside · Custom · Flex**. Live = `CHOOSE(selector, Base, Upside, Downside, Custom)`. Used = Live × (1 + flex) for amounts, or Live + flex for rates. Name only the Used cells. The calculation then can't reach a scenario column by accident.
- The selector accepts only the values it implements, and a check flags anything else. Custom starts as a copy of Base and belongs to the user. The flex column is zero at base: "rents 5% lower" goes there, and no scenario gets edited.
- Scenarios change drivers, not structure. Each column is a complete, internally consistent case (the downside moves price, volume and cost together), with a one-line rationale per scenario.
- Show the live scenario on every output page and on the `Cover`, from one label cell: "Live scenario: Downside + 1 what-if flex".
- **Comparison table**: every scenario's headline outputs side by side, at the same time. Recompute each scenario in a compact engine block that reads its own column (formulas in [scenarios-mechanics](scenarios-mechanics.md)), or use a closed form where the output allows. Show the live model's row under it, and check that the selected scenario's row equals it.

## Sensitivities: pick the cheapest honest method

How the output depends on the driver decides the method. Centre every grid on the model as it stands (live scenario plus flexes), so the centre cell always equals the model.

| The output is | Method | Example |
|---|---|---|
| Linear in the driver | Closed form: split cash flow into driver families that sum to it, and scale each family's PV | NPV against price, volume, unit cost, fixed cost, capex |
| A rate applied to fixed flows | Rediscount: `SUMPRODUCT(CF row, (1 + w)^−t row)` | NPV against WACC |
| A row reshaped linearly, then rediscounted | `SUMPRODUCT(CF row + (s − 1) × family row, …)`; `IRR(CF row + (s − 1) × family row)` for IRR | WACC × price, IRR against price |
| Anything else | Engine blocks: the calculation rerun once per case | Growth paths, timing, debt sizing, `MAX(0, …)` tax, waterfalls |

Build one-way grids (a driver down, NPV, IRR and the change against the model across) and two-way grids (5 × 5, with the steps as inputs).

**Excel data tables** (`TABLE()`) are acceptable only for a quick look in a model you own. Every cell reruns the whole model, so large tables make recalculation slow. Workbooks then get left on "automatic except tables", and the tables go stale without warning. The input cells must sit on the table's own sheet. The table is invisible to formula audits and to most recalculation engines. It breaks when the grid is moved, and some tools can't create one at all. If you use one anyway, label it, keep calculation automatic, and check its centre.

## Tornado and spider

- **Tornado**: move each driver alone to its low and high value, with every other driver at the model. Report NPV and its change at each end, the swing, and a rank (`RANK` + `COUNTIF` breaks ties), then a copy sorted by rank that is ready to chart. Take the ranges from the Downside and Upside columns to see what matters under realistic uncertainty, or use ±X% to compare elasticities. Say which you used. Nonlinear drivers need engine blocks. For linear drivers, check the engine against the closed form.
- **Spider**: NPV at the same % change (−20% … +20%) in each driver. The slope of each line is the driver's leverage on the answer.

## Breakevens (the value where the answer flips)

- Linear driver: solve the closed form. For price, `Price × −(PV of every other family) / PV of the price family`.
- The discount rate: the IRR, by definition.
- Otherwise, bracket the root: run a bisection in rows (a fixed number of iterations, each an engine block that keeps the half whose ends differ in sign), then take one secant step. Or interpolate between two grid points that bracket zero, and say that it is interpolated. Show "n/a" and raise a warning if the bracket doesn't straddle zero.
- Plug every breakeven back into an engine block, and check that the output is about zero. Goal seek is fine for exploring, but its result never goes into an input.
- Lead with it: "NPV turns negative if price falls below $X, 4% under the plan". Name the top two or three tornado drivers with their NPV changes, and give the downside-to-upside range.

## Checks

- The selected scenario's row equals the live model, whenever no flex is applied.
- The Live and Used cells are formulas: count them with `ISFORMULA`, since a pasted value there is an error.
- The engine at the model's drivers equals the model, which is the tornado's base.
- Each grid's centre equals the model. The driver families sum to cash flow every year. The engine agrees with the closed form for linear drivers.
- Each breakeven plugs back to an output of about zero. The selector and the tornado mode are valid.
- Warnings: the Custom scenario is live; flexes are off base (so outputs are not a named scenario); the growth bracket misses zero; scenario outputs are out of order (Downside ≤ Base ≤ Upside).

## Common mistakes

- Calculation sheets that read the Base column directly, so switching the scenario changes nothing, or changes only part of the model.
- Sensitivities centred on base inputs instead of the live model, so the centre cell disagrees with the model the moment anything moves.
- Grids, scenario tables or goal-seek results pasted as values, which go stale on the next change.
- Macros that loop over cases by overwriting inputs. When one stops halfway, the model is left on the wrong case.
- A flex left on after a what-if, with no flag. The headline is then no longer any named scenario.
- Moving one of two linked drivers (price without the volume it implies) without saying so.
- `IF(range > 0, …)` in a plain formula, which Excel may evaluate one cell at a time. Use `SUMPRODUCT` or a helper column.

## References

- [scenarios-mechanics.md](scenarios-mechanics.md): scenario block and label formulas, driver families, grid cells, engine blocks, tornado ranking, closed-form breakevens and the bisection rows
