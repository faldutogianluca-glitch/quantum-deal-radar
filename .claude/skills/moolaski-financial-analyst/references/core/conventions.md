# Financial model conventions

Every model follows the same conventions, so any model can be read, checked, and extended the same way. The model guides assume these and only describe what differs.

## Layout

- Sheet order follows the flow of calculation: `Cover` → `Inputs` → `Timing` → calculation sheets → `Outputs` → `Checks`.
- Inputs live only on input sheets. Calculation sheets hold no hardcoded numbers except structural constants (1, 12, 0).
- Time runs left to right in columns; one row = one line item; every time-series row uses the same formula across all columns.
- Columns reserved at the left of every calc sheet: label, units, total/constant, a blank spacer, then the first period. The spacer lets `opening = prior closing` use the same formula in the first period as in every other.
- Totals cover the model window only (e.g. `SUMPRODUCT` with an in-model flag) when the timeline runs past it for forward-looking values.

## Inputs

- Every rate, fee, percentage and term gets its own named input cell, never a literal inside a formula (`=Price*0.75`, `=Rate+4%`).
- One source per number: a detailed budget or backup table must feed the total the model uses.
- Derive each event from one chain of inputs, so two inputs can never describe the same date.
- A switch accepts only the values it implements, and a check flags anything else.
- Defined names are case-insensitive: `Rev_0` and `REV_0` are one name, and the later definition silently wins.
- A defined name must not look like a cell address. `NOI2`, `CoC1`, `FY25` and `Q1` are cells, so `=NOI2` silently reads an empty cell; use `NOI_Y2`.
- Solved values (goal seek, targets) are never pasted over inputs; solve breakevens by formula instead ([scenarios](scenarios.md)).

## Formatting

| Cell type | Font color |
|---|---|
| Hardcoded input | blue |
| Formula | black |
| Link to another sheet | green |

Units are stated on every row. Totals and subtotals are visually distinct (bold, top border).

## Signs

Cash inflows positive, outflows negative, applied consistently; label the convention on the `Cover` sheet.

## Timing

See [core/time-series.md](time-series.md) for the grid, flags, window totals and roll-ups. Drive periods from flags (`1`/`0` rows such as construction, operations, debt outstanding) computed from start dates and durations on `Timing`, and multiply by flags rather than writing `IF` on dates inside every formula.

## Returns

See [core/returns.md](returns.md). Report one IRR definition everywhere and label it. From monthly flows, the annual rate is `(1 + IRR)^12 − 1`, which is not `IRR × 12`.

## Checks

A `Checks` sheet sums every check into one master flag shown on the `Cover`. Wrap each flag in `IFERROR(…, 1)` so an error value counts as a failure instead of breaking the master flag. Keep warnings (inputs worth a second look) separate from errors, which mean the model is wrong: list the errors first, then the warnings under a heading row labelled `Warnings`, each flag in the first value column (1 = raised). At minimum: balance sheet balances, cash never negative unless allowed, sources = uses, and debt fully repaid by maturity.

Balances (debt, draws, capital, accruals) follow [core/balances.md](balances.md). To review someone else's model, use [core/model-review.md](model-review.md).

## Avoid

- Circular references (break interest-on-average-balance circularity with a copy-paste macro or prior-period balance, and say which).
- Merged cells, hidden rows holding logic, and formulas that mix inputs with logic (`=B5*1.03`).
