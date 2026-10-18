# Reviewing an inherited model

The goal is a list of findings that someone can act on, each saying where, what goes wrong, and the fix, plus a verdict on whether the model is worth using. Read the whole model before judging any single cell: most errors show up as two parts of the model that disagree, not as one wrong formula.

## Before you start

- Open it safely. Disable macros and don't update external links, so nothing runs and no dialog blocks you. Keep an untouched copy of the file.
- List the sheets, used ranges, defined names (with what each refers to), external links and VBA modules. Names and macros are often where the logic hides.

## Steps

1. **Map it.** For each sheet, record its role and key outputs. Trace the flow of calculation: inputs → timing → operations → financing → returns → partners. Note every place a number enters the model.
2. **Record the base case.** Write down the headline outputs as they stand, so a rebuild or fix can be tied out against them.
3. **Scan formulas mechanically.** See [model-review-checklist.md](model-review-checklist.md) for the full list. On an `.xlsx`, [check_workbook.py](../../scripts/check_workbook.py) runs the first three scans below, lists error values after recalculation, and flags defined names Excel reads as cells. The core scans:
   - Row consistency: compare each time-series row's formulas in R1C1 form. A correct row reads identically in every period, so any change of pattern is a finding (often the first period).
   - Numbers typed into formulas, other than 0, 1, 12 and genuine unit constants like 52 or 365.
   - Inputs that are really outputs: fractional "inputs" that came from goal seek or copy-paste.
4. **Reconcile.** Make the model's own numbers agree with each other:
   - Profit from the cash-flow row = profit on the summary.
   - Sources = uses = funded costs.
   - Partner totals = deal cash flow (less fees).
   - Equity on every sheet = the sum of negative levered periods.
   - Annual roll-up = periodic total.
   - Each backup or budget table feeds the number it claims to support.
   A difference between any of these is almost always an error. Size it and name its cause.
5. **Test timing edges.** Change the hold, start dates and switches (refi on/off, IO/amortizing), then watch for silent breaks: rows that stop at a hardcoded column, payoffs that skip a period, grids too short for the new timeline.
6. **Grade.** Grade every finding:
   - `error`: gives a wrong result now.
   - `risk`: fragile or hidden; wrong once an input changes.
   - `style`: convention or labelling.
   For each, give where, the problem (with its size where you can), and the correction.
7. **Verdict:**
   - `good`: use as-is.
   - `usable-with-corrections`: the structure is sound and the errors are fixable.
   - `reject`: the structure itself is wrong, so rebuild from scratch.

## What to report

A short structure table, the flow of calculation with cell references, the base-case outputs, the findings table (most severe first), and the verdict with one line of reasoning. Quote cell addresses so every finding can be checked.

## Common mistakes

- Judging formulas one at a time and missing that two sheets define "equity" (or "IRR", or "total cost") differently.
- Reporting "check cells say OK" as evidence. Read what each check compares: many compare a % to a $, test the wrong item, point at the wrong sheet, or wrap the test in `IFERROR(…,"OK")` so an error reads as a pass.
- Reviewing a blank template as shipped. Zero inputs and `IFERROR(…,0)` make every formula return 0, so nothing looks wrong. Type a plausible case into the inputs before judging it.
- Treating a summary table's differing formulas as inconsistency. Only time-series rows should be uniform.
- Stopping at the first sheet's errors without reconciling totals across sheets.
