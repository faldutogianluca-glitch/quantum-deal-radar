# Discounted cash flow

Values a business as the cash it can hand to all its capital providers, discounted at their blended required return. The arithmetic is easy; almost every wrong DCF is wrong for one of three reasons: the cash flow doesn't match the discount rate, the terminal value is never sanity-checked, or the bridge from enterprise value to per-share value quietly drops something.


For a single investment decision inside a company (no terminal value, no equity bridge), see [capital-budgeting](../corporate-finance/capital-budgeting.md).
## Before you build

- You need a forecast: EBIT, D&A, capex and the change in net working capital for each year (see [corporate-finance/three-statement.md](../corporate-finance/three-statement.md)).
- Gather: risk-free rate, beta, equity risk premium, target capital structure, pre-tax cost of debt, tax rate, horizon, terminal growth and/or exit multiple, **the valuation date** (rarely a year end), and the current share price if there is one.
- For the bridge: debt, cash, and diluted share count at the valuation date, plus any minority interest, associates, pensions or preferred stock.
- Follow [core/conventions.md](../core/conventions.md), [core/time-series.md](../core/time-series.md) and [core/returns.md](../core/returns.md).

## Build steps

1. **Unlevered free cash flow**: `EBIT × (1 − tax) + D&A − capex − increase in NWC`. Tax is on EBIT, not on profit before tax: the interest deduction belongs in the discount rate, not the cash flow. Never let interest, debt draws or dividends into this row.
2. **WACC**: cost of equity = risk-free + beta × ERP; after-tax cost of debt = pre-tax × (1 − tax); weight them by **target** capital structure, which keeps the discount rate independent of this year's balance sheet and out of any circular loop.
3. **Valuation date and the stub period**: the valuation date is an input, independent of the forecast's period ends. For each period, the cash-flow window starts at `MAX(valuation date, prior period end)`; the share of that period still ahead of you is `(period end − window start) / (period end − prior period end)`, and cash flow is prorated by it. Nobody values a company only on 31 December, and a model that assumes they do overstates the first year.
4. **Discounting on elapsed time**: exponent = (the window's mid-point under mid-year convention, else the period end, less the valuation date) / 365. Put it on the timing sheet as one row that every discounting formula reads, sensitivities included. Whole-period discounting is then just the case where the valuation date is a period end.
5. **Terminal value, both ways, always**:
   - perpetuity growth: `UFCF(N) × (1 + g) / (WACC − g)`
   - exit multiple: `EBITDA(N) × multiple`
   One switch picks which drives the answer. Show the other alongside, plus the **implied** counterpart: the exit multiple implied by your growth rate, and the growth implied by your multiple. If the implied figures are absurd, the assumption is absurd.
   Discount the terminal value over the elapsed time to the final period end, not a half period earlier, even when the explicit flows use mid-year convention. Say which you used.
6. **Bridge**: enterprise value = PV(forecast) + PV(terminal). Equity value = EV − debt + cash − minority interest − preferred + associates. Value per share = equity / diluted shares. List every bridge item, even when zero, so nothing is silently missing.
7. **Against the market** (when the company is listed): market capitalisation, the enterprise value the market implies, the upside from the current price to your value, and the IRR a buyer at today's price would earn — `XIRR` over the entry at market enterprise value, the prorated cash flows and the terminal value. A valuation with nothing to compare it against invites anchoring on its own output; the implied IRR also gives a sanity read, since it should sit near WACC when the market agrees with you.
8. **Sensitivities**: a WACC × growth grid and a WACC × multiple grid. Build them as formulas that rediscount the UFCF row — `SUMPRODUCT(UFCF, forecast flag, (1 + w)^−exponent)` plus the discounted terminal value at that cell's inputs. They then survive a rebuild, work without Excel's what-if tables, and can be checked: **the centre cell must equal the model's own value per share.** Make that a check.

## Checks

- Centre of each sensitivity grid = the DCF's value per share, including every bridge item.
- The valuation date sits between the last actual period end and the first forecast period end.
- With mid-year discounting off, the model's own discounting equals `XNPV` over the same flows and dates. That tests the whole chain — stub, exponents, factors — against Excel's own implementation.
- WACC > terminal growth (otherwise the perpetuity is meaningless).
- EV = PV(forecast) + PV(terminal), and the equity bridge ties.
- Forecast horizon fits the grid.
- Warnings: terminal value above ~75–80% of EV; implied exit multiple or implied growth outside a sane band; terminal-year ROIC below WACC while growth is positive, which values growth that destroys value.

## Common mistakes

- Taxing EBT instead of EBIT, so the interest shield is counted twice: once in the cash flow and again in the WACC.
- Levered free cash flow discounted at WACC, or unlevered discounted at the cost of equity.
- A terminal growth rate above long-run GDP growth, or above WACC, which produces a finite-looking number from a divergent series.
- Mid-year discounting applied to the explicit period but silently not to the terminal value, or vice versa.
- A bridge that forgets minority interest, preferred stock or leases, or that uses a basic rather than diluted share count.
- Discount rate built from the current capital structure, which moves as the model's debt moves and can loop.
- Sensitivity tables pasted as values, which go stale the moment a driver changes.
- A first forecast year taken whole when the valuation date sits inside it, which quietly adds months of cash flow you don't own.
- Averaging the perpetuity and exit-multiple terminal values into one number. The disagreement between them is information; averaging throws it away.
- Terminal value at 90% of enterprise value, treated as a result rather than a warning that the horizon is too short.

## References

- [dcf-mechanics.md](dcf-mechanics.md) — formulas for UFCF, WACC, discount factors, both terminal values and their implied counterparts, the bridge, and sensitivity cells
