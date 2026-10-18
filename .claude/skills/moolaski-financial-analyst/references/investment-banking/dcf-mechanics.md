# DCF mechanics

Notation: `N` = forecast horizon in years, `w` = WACC, `g` = terminal growth, `[flag]` = a 1/0 row on the timing sheet. Year 0 is the valuation date and carries no cash flow.

## Unlevered free cash flow

| Row | Formula |
|---|---|
| EBIT | from the forecast × `[forecast]` |
| Tax on EBIT | `−tax rate × MAX(0, EBIT)` |
| NOPAT | `EBIT + tax on EBIT` |
| plus D&A | from the forecast |
| less capex | `−capex` |
| less increase in NWC | `−(NWC − prior NWC)` |
| **UFCF** | sum of the above |

A loss-making year gets no tax benefit unless you model NOLs; `MAX(0, …)` states that choice explicitly.

## Valuation date, stub and elapsed time

| Row | Formula |
|---|---|
| Window start | `MAX(valuation date, prior period end)` |
| Stub share | `[forecast] × MAX(0, MIN(1, (period end − window start) / (period end − prior period end)))` |
| Window mid-point | `window start + (period end − window start) / 2` |
| Years from valuation date | `[forecast] × (IF(mid-year, mid-point, period end) − valuation date) / 365` |
| Date row for XNPV/XIRR | `IF(period = 0, valuation date, period end)` |
| Cash flow to value | `UFCF × stub share` |

With the valuation date on a period end the stub share is 1 and the exponents come out as 0.5, 1.5, … under mid-year convention, so this generalizes whole-period discounting rather than replacing it.

## Discount rate and factors

| Item | Formula |
|---|---|
| Cost of equity | `rf + β × ERP` (add a size or country premium as its own input if used) |
| After-tax cost of debt | `pre-tax rate × (1 − tax rate)` |
| WACC | `(1 − Wd) × cost of equity + Wd × after-tax cost of debt`, `Wd` = target debt weight |
| Discount factor | `[forecast] × (1 + w)^−exponent`, exponent from the table above |
| PV of forecast | `SUM(cash flow to value × discount factor)` |

To relever a beta from comparables: `βL = βU × (1 + (1 − tax) × D/E)`. Keep `βU` and the target `D/E` as inputs, not buried in the formula.

## Terminal value

| Item | Formula |
|---|---|
| Perpetuity growth | `UFCF(N) × (1 + g) / (w − g)`, guarded by `IF(w <= g, 0, …)` |
| Exit multiple | `EBITDA(N) × multiple` |
| Years to the terminal period end | `(period end at N − valuation date) / 365` |
| Terminal discount factor | `(1 + w)^−those years` |
| PV of terminal value | `TV × terminal discount factor` |
| Implied exit multiple | `TV / EBITDA(N)` |
| Implied growth | `(TV × w − UFCF(N)) / (TV + UFCF(N))` |
| TV share of EV | `PV(TV) / EV` |

`UFCF(N)` and `EBITDA(N)` come from `INDEX(row, 1, N + 1)` when year 0 sits in the first column — that way the horizon stays an input rather than a hardcoded column.

The implied-growth formula is the perpetuity rearranged; it tells you what growth an exit multiple is really assuming.

## Bridge

| Item | Sign |
|---|---|
| Enterprise value | `PV(forecast) + PV(terminal)` |
| Less debt (all drawn facilities, plus leases if capitalized) | − |
| Plus cash and equivalents (less any restricted or operating cash) | + |
| Less minority interest, preferred stock, unfunded pensions | − |
| Plus associates and investments | + |
| **Equity value** | |
| Value per share | `equity / diluted shares` |

Use balances at the valuation date, which is year 0 — `INDEX(row, 1, 1)` — not the terminal year.

## Against the market

| Item | Formula |
|---|---|
| Market capitalisation | `share price × diluted shares` |
| Enterprise value implied by the market | `market cap + debt − cash + minority + preferred − associates` |
| Upside | `value per share / share price − 1` |
| Cash flow to a buyer at market | period 0: `−market enterprise value`; forecast periods: prorated UFCF, plus terminal value in the final period |
| IRR at the market price | `XIRR(that row, date row)` |

When the market agrees with your assumptions, that IRR lands near WACC. Well above it means you think the shares are cheap; well below it, expensive.

## Sensitivity cell

For WACC `w` down the rows and growth `g` across the columns:

```
=IF(w <= g, "n/a",
    (SUMPRODUCT(cash_flow_to_value_row, forecast_flag_row, (1 + w)^-exponent_row)
     + INDEX(UFCF_row, 1, N + 1) * (1 + g) / (w - g) * (1 + w)^-years_to_terminal
     + bridge) / shares)
```

For an exit-multiple grid, replace the terminal term with `INDEX(EBITDA_row, 1, N + 1) * multiple * (1 + w)^-years_to_terminal`.

`bridge` is every item between enterprise and equity value — net debt, minority, preferred, associates — referenced from the cells that hold them, so a change to any of them moves the grid with the model. The explicit period uses the **prorated** cash-flow row; the terminal value uses full-year UFCF.

`SUMPRODUCT` with `(1 + w)^−exponent_row` discounts the whole row elementwise, which is what makes each cell a real recomputation. The centre cell should reproduce the model's own value per share exactly; check it.
