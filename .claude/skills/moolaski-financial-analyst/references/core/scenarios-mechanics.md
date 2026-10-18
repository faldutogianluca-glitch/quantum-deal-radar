# Scenario and sensitivity mechanics

Notation: `s` = a scale factor (1 + % change), `w` = discount rate, `t` = the year row, `[flag]` = a 1/0 timing row. `CF` is the cash-flow row the output is computed from. For NPV, the year-0 flow sits in the first column.

## Scenario block

| Column | Formula | Named? |
|---|---|---|
| Used | amount: `= Live × (1 + Flex)`; rate: `= Live + Flex` | yes, one name per driver (`Price`, `WACC`, …) |
| Live | `= CHOOSE(Scen_Sel, Base, Upside, Downside, Custom)` | range only, for the formula check |
| Base · Upside · Downside · Custom | blue inputs | the header row, for scenario names |
| Flex | blue, 0 at base | range, for the off-base count |

| Cell | Formula |
|---|---|
| Scenario name | `IFERROR(INDEX(Scen_Names, 1, Scen_Sel), "invalid")` |
| Flexes applied | `SUMPRODUCT(1 * (Flex_Rng <> 0))` |
| Live label (row 2 of every output sheet) | `"Live scenario: " & name & IF(flexes > 0, " + " & flexes & " what-if flex(es)", "")` |
| Formula check | `SUMPRODUCT(1 * NOT(ISFORMULA(Live_Rng))) + SUMPRODUCT(1 * NOT(ISFORMULA(Used_Rng)))` = 0 |
| Selector check | `OR(Scen_Sel < 1, Scen_Sel > 4, Scen_Sel <> INT(Scen_Sel))` |

## Engine blocks

One block per case, with the same rows as the model but compacted. At the top are the driver constants in the constant column, then each time-series row reads those constants. For example:

```
volume  = [d_vol] × (1 + [d_g])^(t − 1) × [ops]
revenue = volume × [d_price] × (1 − [d_erosion])^(t − 1) / 1000
…
NPV     = SUMPRODUCT(CF_block, (1 + [d_w])^−t)
```

The driver constants of each kind of block read:

| Block | Driver constants |
|---|---|
| Model drivers | the Used names |
| Scenario k | column k of the scenario table (the one legitimate reader of those columns) |
| Tornado, driver i, side A or B | Used, except driver i = `IF(mode = 1, Downside_i, Used_i × (1 − X))` (or Upside_i / `(1 + X)`) |
| Bisection iteration | Used, except the solved driver = this iteration's midpoint |
| Plug-back | Used, except the driver = its breakeven |

Generate the blocks from one spec in code, never by copying cells. Then check that the model-drivers block equals the model: that one check proves the engine and the model are the same calculation.

## Driver families (closed forms)

Split the cash-flow row into rows, each linear in one set of drivers, that sum to it:

| Family | Row | Scales with |
|---|---|---|
| R: revenue | `revenue × (1 − tax) − ΔNWC` (NWC as a % of revenue) | price × volume |
| V: variable cost | `variable cost × (1 − tax)` | volume × unit cost |
| F: fixed cost | `fixed cost × (1 − tax)` | fixed cost |
| K: capital | `−capex + tax × depreciation` | capex |

`PV_x = SUMPRODUCT(row_x, discount factor row)`. Check that `Σ rows = CF` every year and that `Σ PV = NPV`. Then:

```
NPV(sp, sv, sc, sf, sk) = PV_R × sp × sv + PV_V × sv × sc + PV_F × sf + PV_K × sk
```

This is exact only while every line is linear in these drivers. Tax on losses (`MAX(0, …)`), a debt that resizes, or a threshold breaks it, and those drivers need engine blocks.

## Grid cells

| Grid | Cell |
|---|---|
| NPV against price | `Model_NPV + (sp − 1) × PV_R` |
| IRR against price | `IRR(FCF_Row + (sp − 1) × CFR_Row)` (row arithmetic inside `IRR`) |
| NPV against WACC | `SUMPRODUCT(FCF_Row, (1 + w)^−Year_Row)` |
| Price × volume | `PV_R × sp × sv + PV_V × sv + PV_F + PV_K` |
| WACC × price | `SUMPRODUCT(FCF_Row + (sp − 1) × CFR_Row, (1 + w)^−Year_Row)` |
| Spider, linear driver | `Model_NPV + x × PV_family` (volume: `PV_R + PV_V`) |
| Spider, WACC | `SUMPRODUCT(FCF_Row, (1 + WACC × (1 + x))^−Year_Row)` |

The row and column headers are `(k − 2) × step` for k = 0…4, with the step an input, so the centre is always 0 or the model's value.

## Tornado

| Column | Formula |
|---|---|
| NPV A / B | the tornado blocks' NPV |
| Change A / B | `NPV − Model_NPV` |
| Swing | `ABS(NPV B − NPV A)` |
| Rank | `RANK(swing, swings) + COUNTIF(swings from the first row to this one, swing) − 1` |
| Sorted row k | `INDEX(column, MATCH(k, rank column, 0))` |
| Closed form (linear drivers) | `Model_NPV + (input / Used − 1) × PV_family`, which must equal the block |

To chart it, use a clustered bar of Change A and Change B against the driver, with overlap 100% and the axis at 0 (the model's NPV).

## Breakevens

| Driver | Breakeven |
|---|---|
| Price | `Price × −(PV_V + PV_F + PV_K) / PV_R` |
| Volume | `Vol × −(PV_F + PV_K) / (PV_R + PV_V)` |
| Unit cost | `Cost × −(PV_R + PV_F + PV_K) / PV_V` |
| Fixed cost | `Fixed × −(PV_R + PV_V + PV_K) / PV_F` |
| Capex | `Capex × −(PV_R + PV_V + PV_F) / PV_K` |
| Discount rate | IRR |

A closed-form breakeven depends on the other drivers but not on its own current value. Flexing price leaves the breakeven price unchanged, which makes a quick test.

**Bisection in rows** for anything else. Evaluate the bracket ends `lo`, `hi` in two blocks. Each iteration block then carries `lo, hi, NPV(lo), NPV(hi)` and `mid = (lo + hi) / 2`, runs the engine at `mid`, and passes on:

```
same = SIGN(NPV(mid)) = SIGN(NPV(lo))
lo' = IF(same, mid, lo)      NPV(lo)' = IF(same, NPV(mid), NPV(lo))
hi' = IF(same, hi, mid)      NPV(hi)' = IF(same, NPV(hi), NPV(mid))
```

Twelve iterations shrink the bracket 4,096-fold. Then take a secant step inside it: `x* = lo − NPV(lo) × (hi − lo) / (NPV(hi) − NPV(lo))`, guarded by `IFERROR(…, mid)`. Show "n/a" unless `SIGN(NPV(lo₀)) <> SIGN(NPV(hi₀))`. Plug `x*` into one more block, and check that `|NPV| <` a tolerance set as an input.
