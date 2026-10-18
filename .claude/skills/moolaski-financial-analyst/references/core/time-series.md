# Period grids and timing flags

Every time-based model is a grid: one row per line item, one column per period, and one formula per row across every period. The timing block decides which periods each row is "on". Get this right and everything downstream is a multiplication by a flag.

## Layout

- Columns: **label · units · total/constant · blank spacer · period 0 … period N**.
  - The spacer makes `opening = prior closing` read 0 in the first period, so the first period uses the same formula as every other.
  - The total/constant column holds each row's total, or a single constant computed from the row (a value, an IRR).
- Period 0 is the transaction date (closing). Run the grid past the last event by as much as any forward-looking value needs, e.g. 12 months past exit for forward NOI.
- Every other time sheet takes its period and date header rows by linking to the timing sheet, so all sheets share the same columns.

## Timing block

1. **Index**: `IF(ISNUMBER(prior), prior + 1, 0)`. **Date**: `EOMONTH(start, index)` (monthly), `start + 7 × index` (weekly), or `EDATE` for quarters. **Year**: `ROUNDUP(index / periods per year, 0)`.
2. **Derive every event from one chain of inputs.** For example, construction end = start + duration − 1, and sale = construction end + marketing. Never enter two dates for the same event.
3. **Flags**, one row each: `1*(index = event)` for points and `1*AND(index >= start, index <= end)` for windows. Write `1*(…)`, not `--(…)`: both give 1 or 0 in Excel, but Python recalculation engines keep `--(…)` as TRUE/FALSE, and a sum over TRUE/FALSE is 0. Build compound flags by multiplying other flags: occupied × hold, or on × (index = month). For recurring events: `window × (MOD(index − start, interval) = 0)`.
4. **Use the flags**: `amount × growth^(year − 1) × [flag]`. Never test dates inside every formula.

## Totals, lookups, roll-ups

| Need | Formula |
|---|---|
| Total over the model window only | `SUMPRODUCT(row, [in-model flag])` |
| Value in a given period | `INDEX(row, 1, period + 1)` (period 0 is column 1) |
| Sum over a forward window | `SUMPRODUCT(row, [window flag])` |
| Annual from monthly/weekly | `SUMIFS(row, year row, this year, in-model flag, 1)` |
| Annual lookup into periods | `INDEX(annual row, 1, year + 1)` |
| Periods in a partial year | `COUNTIFS(year row, this year, hold flag, 1)` |

## Build steps

1. Inputs: start date, durations, switches. Derive the event periods on the input sheet.
2. Timing sheet: index, date, year, then one flag per window and event, each with a total in the constant column (a flag's sum is its length, which makes a quick check).
3. Write each row once in the first period column and copy it right across the grid.
4. Add checks: the last event plus any forward window fits the grid; event order holds (start ≤ end ≤ sale); each flag's sum matches its intended length.

## Common mistakes

- A first-period formula that differs from the rest, usually because the prior column holds the total. The spacer prevents this.
- `IF(index = "", "", …)` blanking. It turns numbers into text and breaks sums; multiply by flags instead.
- Growth on rounded years: `(1 + g)^ROUND(months/12)` grows a 126-month hold by 11 years. Use months / 12, or grow per period.
- Totals that include forward-window periods, so the exit NOI leaks into hold totals.
- A grid that silently stops short when the timeline gets longer, with no check.
- Two inputs for one event (rent start and opex start) that can disagree.
