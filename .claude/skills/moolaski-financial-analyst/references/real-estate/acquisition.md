# Income-property acquisition (rent roll)

Answers what to pay for a stabilised or near-stabilised income property, and what the equity earns at that price: office, industrial, retail or multifamily, bought with an acquisition loan, held and sold. Use monthly periods; leases start, expire and abate in specific months. Three things decide whether an acquisition model can be trusted. First, **revenue is a sum of leases, not a rent × area**: every commercial suite runs its in-place lease to expiry and then a chain of market leases, each with its own downtime, free rent, TIs and commissions. Second, **vacancy has two layers**: the rent roll's own vacancy (vacant suites and downtime between leases) and a general allowance that applies only above it, so the two are never counted twice. Third, **the price is the answer**: solve the maximum price at the target return by formula, with the loan re-sized at that price, rather than reporting an IRR at the asking price.

For a single house, see [rental-property](rental-property.md). For a building still to be built or leased up from empty, see [development](development.md). To split the levered cash between a sponsor and investors, see [equity-waterfall](equity-waterfall.md).

## Before you build

- The rent roll, one row per suite (commercial) or per unit type (multifamily). Commercial: area, tenant, lease start and expiry dates, current rent, bumps (fixed % or $ steps, on the lease anniversary), free rent still to burn, recovery structure (NNN, base-year stop with its stop, full service) and pro-rata share, and market rent for that suite. Multifamily: units, average size, market rent and in-place rent per type.
- Market leasing assumptions: renewal probability; for renewals and for new tenants, rent as % of market, free months, TI $/sf, commission %, downtime months; lease term and bumps; market rent growth. Months to lease each vacant suite.
- Operating expenses split fixed and variable, taxes and insurance, growth rates, the gross-up % for recoveries, management %, other income, general vacancy and credit loss, capital reserves.
- Price or going-in cap, closing costs and the up-front capital budget; loan terms (max LTV, min DSCR, min debt yield, rate, IO months, amortisation, fee); hold, exit cap, selling costs; target levered IRR.
- Follow [conventions](../core/conventions.md), [time-series](../core/time-series.md), [balances](../core/balances.md), [returns](../core/returns.md) and [scenarios](../core/scenarios.md).

## Build steps

1. **Grid.** Month 0 is the close; run 12 months past the sale so the forward NOI the exit is priced on exists. Turn every rent-roll date into a month index once, on the rent-roll sheet.
2. **Blend the market leasing assumptions** by the renewal probability p: each term = `p × renewal + (1 − p) × new`, downtime rounded to whole months. A suite vacant at close leases on new-tenant terms after its own lease-up months.
3. **One block of rows per suite: the lease chain.** Cycle, current expiry and current start come from a recursion on the prior month (when the month passes the expiry, the next lease starts after the downtime and runs one term), so the chain handles any number of rollovers without a fixed count of lease generations. Occupied = `month ≥ current start`. Rent in force: the in-place rent grown by its bumps; then the market rent of the lease's start year, times the blended rent factor, bumped on anniversaries. See [acquisition-mechanics](acquisition-mechanics.md).
4. **Revenue per suite.** Potential rent on every suite (at the next lease's rent while vacant), turnover vacancy = potential × (1 − occupied), free rent in the first months of each lease, recoveries by structure: NNN pays its share of the expense pool, base-year pays `MAX(0, pool − stop)` per sf with the stop set by the pool of the lease's start year, full service pays nothing. Gross the variable expenses up to a stated occupancy for the pool.
5. **Building.** Sum the suites; other income on occupied area; general vacancy = `−MAX(0, GV % × potential gross revenue − rent-roll vacancy)`; EGI; fixed and variable opex, taxes, insurance, management % of EGI; NOI. TIs and commissions at each market lease's start, and reserves, sit below NOI: they are capital, not operating expenses.
6. **Price, loan, sale.** Price from a going-in cap on forward NOI, or an input price with its implied cap. Loan = `MIN(LTV × price, NOI / DSCR / loan constant, NOI / debt yield)`, IO then amortising, repaid at sale. Sale = forward (year after the sale) NOI / exit cap, less selling costs.
7. **Returns and credit metrics.** XIRR and multiple, unlevered and levered; cash-on-cash, DSCR and debt yield by year with year-1 and hold averages; the leverage spread (going-in cap less the loan constant).
8. **Maximum price at the target levered IRR.** Levered cash flow is linear in the price and the loan, so the NPV at the target is linear in price within each loan-sizing regime; solve each regime in closed form, keep the valid one, and plug it back ([acquisition-mechanics](acquisition-mechanics.md)). Otherwise bisect in rows ([scenarios-mechanics](../core/scenarios-mechanics.md)).
9. **Rent-roll metrics.** WALT by area and by rent, the lease-expiration schedule (area and % of the building by year, from the rent roll and again from the engine: market leases signed in the hold expire together five or ten years later, so the rent roll alone can hide the worst year), occupancy by month, mark-to-market (market rent / in-place rent − 1 on the same suites), and price, loan and leasing costs per sf.
10. **Scenarios.** Renewal probability, market rent growth, exit cap and downtime move lease timing and leasing costs, so rerun the whole engine per case at the model's price; each case also re-sizes the loan and re-solves the max price. In a short-WALT building the leasing assumptions often move the max price more than the exit cap does; show both.
11. **Multifamily**: replace steps 3–4 with a unit-mix block. GPR at market by type, loss-to-lease burning off as leases roll, physical vacancy, concessions, bad debt, other income; a renovation program adds a premium on renovated units after their downtime, with its cost below NOI. See [acquisition-mechanics](acquisition-mechanics.md).

## Checks

- Suite areas sum to the building; occupied area never exceeds it in any month (no suite leased twice). Each suite's occupied months equal the closed-form count from its lease chain.
- In-place leases started by close and expire after it; recovery and bump types valid; renewal probability and gross-up within 0–100%.
- Recoveries never exceed the recoverable expenses actually incurred. Sources = uses; the loan within all three limits and repaid at sale; levered = unlevered + financing; annual = monthly.
- The max-price plug-back returns the target IRR; the selected scenario reproduces the model. Every IRR discounts its own flows to zero: XIRR can return a false root near zero when there is none.
- Warnings: more than a set share of the building expiring in one year; DSCR below the minimum in any year; negative leverage (going-in cap below the loan constant); price above the max price.

## Common mistakes

- A single occupancy % applied to the building, with no lease expiries, so rollover costs and downtime never appear.
- General vacancy applied on top of the downtime already in the rent roll, which counts the same vacancy twice. The reverse also bites: while rent-roll vacancy sits inside the allowance, extra downtime costs nothing, so a longer-downtime case can show a higher year-1 NOI. Say so, or size the allowance for credit loss only.
- TIs and commissions left out, or put above NOI, which also distorts the cap rate on which the exit is priced.
- Base-year stops recovered on total expenses rather than the growth over the stop. Or variable expenses not grossed up, so every tenant's recovery falls when the building empties; or grossed up above 100%, so tenants pay for more than is spent.
- Exit priced on the sale year's NOI instead of the forward year's, or a forward year that still carries a large free-rent burn nobody mentions.
- Downtime typed as a fixed vacancy month for every suite instead of blended by the renewal probability.
- Loan sized on LTV alone, with no DSCR or debt-yield test on year-1 NOI.
- Max price found by goal seek and pasted in as the price.

## References

- [acquisition-mechanics.md](acquisition-mechanics.md) — rent roll to months, blended leasing terms, the lease-chain rows, recoveries, general vacancy, loan sizing, the max-price solve, WALT and expirations, and the multifamily unit mix
