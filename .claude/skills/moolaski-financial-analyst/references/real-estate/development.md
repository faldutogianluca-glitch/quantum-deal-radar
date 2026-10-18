# Ground-up development

Answers whether a building is worth building: what it costs all-in, how much equity it takes and when, what it yields on that cost against what it would sell for, and what the equity earns through a sale or a refinance. Use monthly periods. Draws, capitalised interest and lease-up all move month by month. Two things decide whether a development model can be trusted. First, **the construction loan funds its own interest**: loan size, interest reserve and total cost depend on each other, and the model must solve that without a circular reference and then prove the loan really funds everything. Second, **lease-up is a schedule, not a vacancy percentage**: when units are delivered and how fast they lease drives the operating deficit, the capitalised interest, and the date the deal can be sold or refinanced.

## Before you build

- Gather: land price and closing costs; unit count; months of predevelopment and construction; how units are delivered (in phases over the last months of construction, or all at completion); the leasing pace in units a month; and stabilised occupancy.
- Gather the budget: hard cost per unit or per square foot, and contingency; soft costs by line (A&E, permits and impact fees, legal and insurance, marketing), with a timing profile for each and a soft contingency; the developer fee; property tax during construction and after reassessment.
- Gather operations: market rent and growth, lease-up concessions, other income, credit loss, opex per unit, management %, and replacement reserves.
- Gather the construction loan (max LTC, max LTV on as-stabilised value, rate, fee, maturity with extensions) and the takeout. For a sale: exit cap and selling costs. For a refinance: max LTV, min DSCR, min debt yield, rate, amortisation and fee.
- For a JV, also gather the equity split and the waterfall (see [equity-waterfall](equity-waterfall.md)).
- Follow [core/conventions.md](../core/conventions.md), [core/time-series.md](../core/time-series.md), [core/balances.md](../core/balances.md) and [core/returns.md](../core/returns.md).

## Build steps

1. **Timing from one chain.** Construction start, completion and first delivery come from the inputs. Units leased = `MIN(prior + pace, delivered to date, stabilised units)`. Stabilisation is the first month at target, and it is derived, never entered. The refinance and the sale are months after stabilisation, so a slower lease-up moves them. Run the grid 12 months past the latest sale.
2. **Budget with timing profiles.** Land at close. Hard costs on an S-curve over construction, plus contingency. Soft costs either front-loaded (design and permits) or back-loaded (marketing over the lease-up). Developer fee over construction. Tax on land until completion, then on the reassessed value. Keep financing out of the budget: the loan fee and capitalised interest come from the funding block.
3. **Operations from units.** Rent on delivered units, vacancy on delivered-not-leased, concessions on leases signed in lease-up, then opex per delivered unit, management and tax. NOI and cash flow after reserves. Operating deficits during lease-up are a development cost and must be funded.
4. **Size the loan without a loop.** The loan is the lesser of LTC × total cost and LTV × as-stabilised value, and total cost includes the loan's own fee and capitalised interest. Solve it in closed form ([development-mechanics.md](development-mechanics.md)): each dollar the loan funds in month t grows to `(1 + r/12)^(C − t)` by conversion, so the loan is the future value of the need it funds, and the month where equity runs out is found by a row of linear solves. The simpler alternative is to size the interest reserve from a first-pass draw schedule, fix the commitment, and let equity absorb any difference.
5. **Prove it with the schedule.** Equity first up to the sized amount, then draws = need + fee + interest − equity, with interest on the opening balance capitalised until conversion. The balance at conversion must equal the commitment, equity funded must equal the sized equity, and capitalised interest must equal the reserve. Hold any positive lease-up cash flow in a lender account and apply it at conversion. Netting it against draws makes the loan peak before conversion.
6. **Takeout, with a switch.** Sale: forward 12-month NOI / exit cap, less selling costs. Refinance: the permanent loan = `MIN(LTV × value, NOI / DSCR / debt constant, NOI / debt yield)`, which repays the construction balance. Show the net proceeds even when they are negative, and show which test binds.
7. **Returns.** Untrended yield on cost (stabilised NOI at today's rents / total cost), trended yield on cost (forward NOI at stabilisation / total cost), and the development spread over the exit cap. Also: profit margin on cost, unlevered and levered XIRR and multiple, peak equity and the peak loan balance.
8. **Sensitivities as scenario blocks.** Hard cost +10%, lease-up 3 months slower, exit cap ±50 bp and rent −5% all move the loan size, the interest and the timing, so rerun the whole engine for each. Hard-code nothing. The base scenario must reproduce the model.

## Checks

- Sources = uses, from the actual schedule rather than the sizing block. The loan stays within LTC and LTV. The balance at conversion equals the commitment and never exceeds it. The interest reserve covers the capitalised interest. The construction loan is repaid at takeout, before maturity.
- Units leased ≤ units delivered every month. Stabilisation comes after completion. The sale plus 12 months fits the grid. The S-curve sums to 100%. All development costs fall inside the funding period.
- In the funding period, levered cash flow = −equity funded. Across the model, levered = unlevered + financing.
- Warnings: development spread below ~100 bp; DSCR at refinance below the minimum; negative levered cash after completion (a capital call); a cash-in refinance; the loan sized by LTV instead of LTC.

## Common mistakes

- Interest reserve typed in as a number or a % of cost, so the loan can't fund its own interest when the schedule moves. Or a circular reference left behind to "solve" it.
- Yield on cost divided by a cost that leaves out capitalised interest, lease-up deficits or the developer fee, which flatters the spread.
- Trended NOI measured against an untrended exit cap without saying so. Quote untrended YoC next to trended YoC.
- Stabilisation typed as a date, so a slower lease-up changes nothing but occupancy.
- Rent on every unit from completion, with no delivery or leasing schedule, and no concessions.
- A sensitivity that moves the sale price but leaves the loan, the interest and the equity untouched.
- A refinance sized only on LTV, with no DSCR or debt yield test.

## References

- [development-mechanics.md](development-mechanics.md) — timing, S-curve, operations from units, the closed-form loan solve, the construction and permanent loan rows, and scenario blocks
- [equity-waterfall.md](equity-waterfall.md) — splitting the levered cash between LP and GP: pref, catch-up, IRR hurdles, promote, American vs European
