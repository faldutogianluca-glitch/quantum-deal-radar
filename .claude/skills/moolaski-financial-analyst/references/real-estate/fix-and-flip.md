# Fix-and-flip pro forma

Answers whether a flip is worth doing at this price. It shows how much cash it takes, when that cash is needed, what's left after financing and selling costs, and how sensitive the profit is to the renovation and hold running long. Use weekly periods for holds under about a year, where carry and draw timing matter; monthly is fine for longer projects.

## Before you build

- Gather: purchase price and closing %, and the renovation budget by line item. For each line: amount, and when it's spent (straight-line over a window, lump at start, or lump at end).
- Also gather: construction start and duration, the marketing period after construction, and carry costs (tax and insurance as a %/year of price, utilities per month).
- Also gather: the ARV (sale price) and selling cost %. The purchase loan: % of price, fee, rate, amortization or IO. The construction/hard-money loan: commitment, fee, rate, and the share of each draw it funds.
- If there are partners: equity shares, an optional investor pref, and the profit split. Also a target return and the max-offer rule %.
- Follow [core/conventions.md](../core/conventions.md). Derive every date from one chain: construction end = start + duration − 1, and sale = construction end + marketing.

## Structure

`Inputs` (incl. the budget table) → `Timing` (period index, dates, flags) → `Budget` (spend by line by period) → `CF` (loans, sale, equity, partners, returns) → `Outputs` (S&U, returns, partners, price checks) → `Checks`.

## Build steps

1. **Timing flags**: acquisition, hold (1…sale), construction (start…end), construction start, sale.
2. **Budget rows**: purchase and closing at period 0. One row per rehab line, spread by its method over its window; a line with no window of its own follows the construction window. Carry = annual % × price ÷ periods per year × hold. See [fix-and-flip-formulas.md](fix-and-flip-formulas.md).
3. **Purchase loan**: a corkscrew in the model's own period, not monthly payments converted to weeks. Interest is on the opening balance; the loan is repaid from its closing balance at sale.
4. **Construction loan**: draw = `MIN(undrawn commitment, draw % × this period's rehab spend)`. Interest is on the opening balance; the fee is charged at the first draw; the loan is repaid at sale.
5. **Sale**: ARV less selling costs at the sale period.
6. **Equity and distributions**: pre-sale CF = costs + draws + fees + interest + principal. Equity called = −pre-sale CF. Distributions = net sale − loan payoffs. Levered CF = distributions − equity. Take every equity number from these rows.
7. **Returns**: profit, margin on total cost (including financing), profit ÷ ARV, ROE = profit ÷ equity, `XIRR` on period dates, and multiple. If you show ROE ÷ years, label it as simple annualization.
8. **Partners** (optional): at sale, return capital pro rata, then pay the investor pref (accrued on opening capital), then split the rest. A loss comes out of capital pro rata.
9. **Price checks**: max offer = rule % × ARV − rehab budget, shown next to the price used. To find the price that hits a target ROE, use Goal Seek on the ROE cell by changing the price. Keep the price an input: never paste a solved price as though it were an assumption.

## Checks

- Errors: the sale fits the grid; construction ends by the sale; budget methods are valid; each rehab line spreads to its total; both loans are zero after the sale and never negative; draws stay within the commitment; pre-sale CF ≤ 0 (loans never fund more than the costs); sources = uses; partner CF = levered CF; levered = unlevered + financing.
- Warnings: price above the max-offer rule; a rehab line outside the construction window; ROE below target.
- Make every flag `IFERROR(…, 1)`, so a broken input shows as a failing check rather than `#REF!`.

## Common mistakes

- Taking equity or the multiple from a subtotal that leaves out one loan's interest or fee. Partner splits then add up to more than the deal's profit.
- A sources & uses table built separately from the cash flow, which quietly stops balancing.
- Mixing periods: monthly `PMT` × 12/52 charged weekly, with payoff from `PV` after rounded months. Principal paid then doesn't match principal credited.
- Construction loan drawn straight-line, not with the spend, and charged interest on the same period's draw.
- Rates typed into formulas (loan % of price, fees, "senior + 4%", closing 1%, tax 1%).
- A spend-method column that accepts any text but only computes one value, silently zeroing other lines.
- A goal-sought price left in the input cell, so the "target return" no longer holds once anything else changes.

## References

- [fix-and-flip-formulas.md](fix-and-flip-formulas.md) — budget spread, carry, both loan corkscrews, equity and distributions, partner split, returns, price checks
