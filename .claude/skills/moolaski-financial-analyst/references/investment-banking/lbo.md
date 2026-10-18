# Leveraged buyout

Answers what a financial sponsor earns buying a company with mostly borrowed money, and what it can afford to pay: sources and uses at the close, an operating forecast, a debt schedule that pays down tranches from free cash flow, and the sponsor's MOIC and IRR at exit. Two things decide whether an LBO model can be trusted: **the equity cheque is a balancing item that must be explained**, since sources equal uses and every dollar of the gain traces back to EBITDA growth, the multiple or debt paydown, and **the cash waterfall must respect every tranche's terms**, never repaying more than is owed or letting cash fall below its floor unnoticed.

## Before you build

- Gather: LTM revenue and EBITDA at close (say which EBITDA, reported or adjusted, and use the same definition at exit), the entry multiple, the close date, existing debt and cash being refinanced, opening PP&E and working capital, and fees (transaction as a % of EV, financing as a % of each tranche).
- Gather per tranche: size (x EBITDA), rate (base + spread with any floor, or fixed), cash vs PIK, mandatory amortization, whether it can be swept, and the order it is swept in. For the revolver, gather the commitment, the drawn spread and the undrawn fee.
- Gather drivers per year (revenue growth, EBITDA margin, D&A, capex, NWC, tax rate, base rate, covenant levels), plus minimum cash, sweep %, rollover equity, any management incentive pool, the exit multiple and year, and the exit costs.
- Follow [core/conventions.md](../core/conventions.md), [core/time-series.md](../core/time-series.md), [core/balances.md](../core/balances.md) and [core/returns.md](../core/returns.md). A full forecast comes from [corporate-finance/three-statement.md](../corporate-finance/three-statement.md). A lean one (EBITDA, D&A, capex, NWC, tax) is enough when it still carries a balance sheet that balances.

## Build steps

1. **Transaction.** EV = entry multiple × EBITDA at close. Uses: purchase of equity (EV − existing net debt), refinancing of that net debt, transaction fees, financing fees, and cash left on the balance sheet. Sources: each debt tranche sized off the same EBITDA, rollover equity, and **sponsor equity = total uses − debt − rollover**. Show each line as % of total and x EBITDA, plus leverage at close (total, senior, net) and equity as a share of sources.
2. **Opening balance sheet.** Goodwill = EV − net assets acquired. Transaction fees are expensed against equity; financing fees are capitalized as an asset. Year 0 then balances only if sources = uses, so the balance check also tests the transaction.
3. **Operations**, one row per driver: revenue, EBITDA, D&A, capex, NWC and its change, and PP&E rolled forward. EBT = EBIT − cash interest − PIK − financing fee amortization + interest income, all four deductible; tax = rate × `MAX(0, EBT)`. Free cash flow before debt repayment = net income + D&A + PIK + fee amortization − ΔNWC − capex, adding back the two non-cash charges.
4. **Debt schedule**: a corkscrew per tranche, with interest on **opening balances**, so the model has no circular reference at all. PIK accrues to principal; financing fees amortize straight-line, capped at the balance left. Don't leave an average-balance option behind an `IF`: the reference loop stays in the dependency graph even when that branch is off. If you need average balances, build the circularity deliberately (see [corporate-finance/three-statement-circularity.md](../corporate-finance/three-statement-circularity.md)).
5. **Cash waterfall**, in this order (formulas in [lbo-mechanics.md](lbo-mechanics.md)):
   1. Cash available = opening cash + free cash flow − minimum cash.
   2. Mandatory amortization, capped at each opening balance.
   3. The revolver draws for a shortfall, **capped at its undrawn commitment**. It is also the first thing repaid from surplus.
   4. The sweep takes a % of what's left, applied tranche by tranche in priority order, each capped at its balance after amortization and switched on or off per tranche (notes are usually non-call).
   5. Closing cash = opening cash + free cash flow + every debt flow. When the revolver runs out, cash drops below the minimum and a check fires. That is a financing gap, not a plug.
6. **Credit statistics** per year: total, senior and net debt / EBITDA, EBITDA / cash interest, fixed-charge cover `(EBITDA − capex − tax) / (cash interest + mandatory amortization)`, and cumulative paydown. Put covenant levels on a per-year driver row, so step-downs are inputs, and add a breach flag for each covenant.
7. **Exit and returns.** Exit equity = exit multiple × exit-year EBITDA − exit costs − net debt at exit, where net debt includes accrued PIK and any revolver, less cash. Take the incentive pool off the gain, split the rest pro rata to contributions, floored at zero. Sponsor cash flow row: −equity at close, proceeds at exit. Report MOIC, and XIRR on the date row as the headline IRR.
8. **Attribution.** Invested equity = EV − net debt at close + fees, so the gain splits **exactly** into EBITDA growth (entry multiple × ΔEBITDA), multiple expansion ((exit − entry multiple) × exit EBITDA), deleveraging (net debt at close − at exit), and fees and costs. No "other" bucket: if one is needed, something is wrong.
9. **Sensitivities**, all live formulas, no data tables:
   - **Entry × exit multiple.** The entry multiple doesn't change the debt, so each cell is a closed form: equity at that entry price, exit equity at that exit multiple, then `(proceeds / invested)^(365 / days) − 1`.
   - **Leverage × exit multiple.** Leverage changes interest, tax and paydown, so rerun the whole waterfall once per leverage level in scenario blocks. Scaling only the equity cheque is a fake sensitivity.

## Checks

- Sources = uses; sponsor equity positive; the balance sheet balances every year; closing cash on the cash flow = the debt schedule's cash.
- No tranche ever negative; cash ≥ minimum in every hold year; revolver within its commitment.
- Attribution sums to the equity gain; sponsor, rollover and pool proceeds sum to exit equity.
- IRR sanity: with no interim distributions, XIRR = `MOIC^(365 / days) − 1` and `(1 + periodic IRR)^years` = MOIC. XIRR must be a number whenever there are proceeds, since a total loss is −100% and not an error.
- Each grid's centre = the model's IRR and MOIC; the leverage scenario at base leverage reproduces the model's exit net debt, which tests the debt schedule a second way.
- Hold period a whole number within the grid; switches take only the values they implement.
- Warnings: leverage at close above a threshold, a thin equity share, any covenant breach, fixed-charge cover below 1.0x, net interest above a deductibility cap (many regimes limit it to a share of EBITDA), revolver drawn at exit, exit multiple above entry, and IRR below target.

## Common mistakes

- Exit net debt that leaves out accrued PIK or the revolver, which overstates equity by exactly that amount.
- A sweep not capped at the balance, so a tranche goes negative, or a sweep that runs before mandatory amortization or before the revolver is repaid.
- A revolver with no commitment cap, which quietly funds any shortfall and hides the fact that the deal can't pay its debt.
- Financing fees expensed at close, or capitalized but never amortized, so the tax shield is lost or the balance sheet drifts.
- Entry EBITDA adjusted, exit EBITDA reported (or the reverse), which manufactures or hides multiple expansion.
- A return that depends on the exit multiple being above the entry multiple, presented without saying so. Show the attribution.
- A leverage sensitivity that only changes the equity cheque, and not interest, tax and paydown.
- `IRR` on annual flows next to `XIRR` on dates with no label, or an attribution with a balancing "other" line.
- Ignoring the management pool or rollover, so the sponsor's MOIC is quoted on 100% of the exit equity.

## References

- [lbo-mechanics.md](lbo-mechanics.md) — sources and uses, fee accounting, the waterfall row by row, credit statistics, exit bridge, IRR identities, attribution, and sensitivity cells
