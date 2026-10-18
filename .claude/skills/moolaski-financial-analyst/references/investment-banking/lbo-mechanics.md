# LBO mechanics

Notation: year 0 is the close, the hold runs years 1…`H`, `[close]`, `[hold]`, `[exit]` and `[in model]` are 1/0 rows on the timing sheet, `E₀` = EBITDA at close, `M₀` / `M₁` = entry / exit multiple. Balances are positive, cash-flow rows carry their sign, and every balance row is multiplied by `[in model]` so that values after the exit read 0 and exit values come from `INDEX(row, 1, H + 1)`.

## Sources and uses

| Item | Formula |
|---|---|
| Enterprise value | `M₀ × E₀` |
| Purchase of equity | `EV − existing net debt` |
| Transaction fees | `% × EV` (expensed at close: retained earnings start at `−fees`) |
| Financing fees | `Σ tranche size × fee %` + revolver commitment × upfront fee (capitalized) |
| Uses | purchase of equity + existing net debt + transaction fees + financing fees + cash to balance sheet |
| Tranche size | `x EBITDA × E₀` for each term loan and note; the revolver's drawn amount at close as an input |
| Sponsor equity | `uses − Σ debt − rollover` |
| Goodwill | `EV − NWC − PP&E` at close (no step-up; add a purchase price allocation as its own block if needed) |

Identity used by the attribution: `equity invested = EV − (debt − cash at close) + transaction fees + financing fees`.

## Interest, fees and tax (per hold year)

| Row | Formula |
|---|---|
| Base rate | `MAX(base rate driver, floor) × [hold]` |
| Revolver | `−(opening × (base + spread) + (commitment − opening) × undrawn fee) × [hold]` |
| Term loans | `−opening × (base + spread) × [hold]` |
| Notes, cash | `−opening × cash coupon × [hold]` |
| Notes, PIK | `opening × PIK rate × [hold]`, added to the notes' closing balance |
| Interest income | `opening cash × rate × [hold]` |
| Fee amortization | `−MIN(opening fees, total fees / years) × [hold]` |
| EBT | `EBIT + cash interest − PIK + fee amortization + interest income` |
| Free cash flow | `EBT + tax + D&A + PIK − fee amortization − ΔNWC − capex` (tax row is negative) |

## Waterfall (per hold year, in this order)

| Row | Formula |
|---|---|
| Available | `(opening cash + FCF − minimum cash) × [hold]` (may be negative) |
| Mandatory, each term loan | `−MIN(opening, amortization % × original size) × [hold]` |
| After mandatory | `available + Σ mandatory` |
| Revolver draw | `MIN(MAX(0, −after mandatory), commitment − opening revolver) × [hold]` |
| Revolver repay | `−MIN(opening revolver, MAX(0, after mandatory)) × [hold]` |
| Sweep pool | `MAX(0, after mandatory + revolver repay) × sweep % × [hold]` |
| Sweep, tranche 1 | `−eligible₁ × MIN(opening₁ + mandatory₁, pool)` |
| Sweep, tranche k | `−eligibleₖ × MIN(openingₖ + mandatoryₖ, pool + Σ earlier sweeps)` (earlier sweeps are negative); for PIK notes, the cap is opening + PIK |
| Closing cash | `IF([close], cash at close, opening + FCF + Σ mandatory + draw + repay + Σ sweeps) × [in model]` |
| Closing, each tranche | `IF([close], size at close, opening + mandatory + sweep (+ PIK)) × [in model]` |

## Credit statistics

| Row | Formula |
|---|---|
| Total / senior / net leverage | `debt / EBITDA`, `(revolver + term loans) / EBITDA`, `(debt − cash) / EBITDA` |
| Interest cover | `EBITDA / −cash interest` |
| Fixed-charge cover | `(EBITDA − capex + tax) / (−cash interest − Σ mandatory)` (tax and mandatory rows are negative) |
| Covenant breach | `[hold] × (leverage > max covenant)`, `[hold] × (cover < min covenant)`, both covenant levels as per-year drivers |
| Interest-cap flag | `[hold] × (−cash interest + PIK − interest income > cap % × EBITDA)` |

## Exit and returns

| Item | Formula |
|---|---|
| Exit EV | `M₁ × INDEX(EBITDA, 1, H + 1)` |
| Exit costs | `−% × exit EV` |
| Net debt at exit | `INDEX(Σ tranches incl. PIK and revolver − cash, 1, H + 1)` |
| Exit equity | `exit EV + exit costs − net debt at exit` |
| Incentive pool | `pool % × MAX(0, exit equity − equity invested)` |
| Holder proceeds | `MAX(0, exit equity − pool) × contribution / total equity` |
| Holder cash flow | `−contribution × [close] + proceeds × [exit]` |
| MOIC | `proceeds / contribution` (0 when the contribution isn't positive) |
| IRR, headline | `XIRR(cash flow row, date row)`, with year-end dates `EDATE(close, 12 × year)` |
| IRR identities | `XIRR = MOIC^(365 / days) − 1` and `IRR(annual row) = MOIC^(1 / H) − 1` when there are only two flows |

**Paper LBO.** Without a spreadsheet: equity = EV + fees − debt; exit net debt ≈ debt − Σ free cash flow after interest and tax; exit equity = `M₁ × exit EBITDA − exit net debt`; IRR ≈ `MOIC^(1 / years) − 1`. Over five years, 2.0x is about 15%, 2.5x about 20% and 3.0x about 25%. Over three years, 2.0x is about 26%.

## Attribution

| Driver | Formula |
|---|---|
| EBITDA growth | `M₀ × (E_H − E₀)` |
| Multiple expansion | `(M₁ − M₀) × E_H` |
| Deleveraging | `net debt at close − net debt at exit` |
| Fees and costs | `exit costs − transaction fees − financing fees` |
| Sum | `= exit equity − equity invested`, exactly (check it) |

Valuing the EBITDA growth at the entry multiple and the multiple change at exit EBITDA is a convention: the cross term lands in multiple expansion. State it on the sheet.

## Sensitivity cells

Entry multiple `m` down, exit multiple `x` across, with `days` = exit date − close date:

```
equity(m)   = m × E₀ × (1 + transaction fee %) + financing fees + cash at close − Σ debt
exit_eq(x)  = E_H × x × (1 − exit cost %) − net debt at exit
IRR cell    = IF(equity(m) − rollover <= 0, "n/a",
                 (MAX(0, exit_eq(x) − pool % × MAX(0, exit_eq(x) − equity(m))) / equity(m))^(365 / days) − 1)
```

For MOIC, drop the exponent. `equity(m)` and `exit_eq(x)` sit in helper cells along each axis. Each holder's proceeds / contribution is the same ratio, so the pro-rata split cancels.

Leverage `L` down: build one scenario block per row, each a full copy of the fee, interest, tax, FCF and waterfall rows with every tranche and its financing fee scaled by `L / base leverage`. Read `equity(L)` and `net debt at exit(L)` into the grid's helper columns, then apply the IRR cell above with `exit_eq = E_H × x × (1 − exit cost %) − net debt at exit(L)`. The middle block must reproduce the model's own exit net debt.
