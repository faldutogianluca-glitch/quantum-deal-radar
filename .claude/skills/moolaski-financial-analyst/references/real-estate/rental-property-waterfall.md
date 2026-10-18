# Sponsor / investor waterfall (monthly, pref → capital → promote)

For IRR hurdles, a GP catch-up, several promote tiers, or American vs European, see [equity-waterfall](equity-waterfall.md).

For a small deal with a sponsor (GP) and a few investors, all contributing pro rata. Each partner row below is repeated per partner, with a total row under each block.

## Deal-level rows

| Row | Formula |
|---|---|
| Acquisition fee | `fee % × price × [acquisition]` |
| Disposition fee | `fee % × sale price × [exit]` |
| Equity called | `MAX(0, −levered CF) + acquisition fee` |
| Distributable | `MAX(0, levered CF) − disposition fee` |

## Per partner

Keep two balances per partner, not one:

| Row | Formula |
|---|---|
| Contribution | `equity called × share` |
| Capital, opening | `prev capital closing` |
| Pref, opening | `prev pref closing` |
| Pref accrued | `(capital opening + compound × pref opening) × pref rate / 12` |
| Tier 1: pref paid | `IF(due = 0, 0, MIN(distributable, due) × (pref opening + accrued) / due)`, where `due` = total pref opening + total accrued |
| Tier 2: capital returned | `IF(cap due = 0, 0, MIN(left after tier 1, cap due) × (capital opening + contribution) / cap due)`, where `cap due` = total capital opening + total contributions |
| Tier 3: promote | `left after tier 2 × promote %` |
| Capital, closing | `capital opening + contribution − tier 2` |
| Pref, closing | `pref opening + accrued − tier 1` |
| Net cash flow | `−contribution + tier 1 + tier 2 + tier 3` (+ fees, for the sponsor, if fees are paid to it) |

Why separate balances matter:

- Pref accrues on **unreturned** capital, so once a refi returns capital, pref stops accruing on it. Accruing on cumulative contributions keeps charging pref on money already returned.
- Unpaid pref is its own balance, paid before capital. Folding it into the capital account turns pref into "return of capital" and hides whether the hurdle was met.
- Accruing on the opening balance means a contribution starts earning in the following month.

## Fees

State whether acquisition and disposition fees go to a third party or to the sponsor. If they go to the sponsor, add them to its cash flow as a separate line, so the sponsor's IRR includes its fee income.

## Checks

- `Σ partner net CF = Σ levered CF − (1 − fees to sponsor) × (Σ acquisition fee + Σ disposition fee)`
- Shares sum to 100%; promote splits sum to 100%.
- Distributable ≥ 0 in every month.
- At exit, closing capital and closing pref are zero whenever sale proceeds are enough. If not, the investors didn't get their money back, which is worth showing on the outputs.

## Report

For each partner and in total: contributed, distributed, profit, IRR `(1 + IRR(monthly))^12 − 1`, multiple.
