# Cap table, financing rounds and exit waterfall

Tracks who owns a venture-backed company from incorporation to exit: founders' common, the option pool, SAFEs and convertible notes, and each priced round's preferred. Then it splits an exit between them. It answers "what do we own after this round?", "what does this term sheet really value us at?" and "who gets what if we sell for $X?". Rounds are the periods: one column per financing event, and every row is one formula across them. The exit waterfall is a second grid, with exit values as its columns.

Three things make it hard, and they are the point. First, **the round price, the pool top-up and the conversions depend on each other**. Solve them in closed form, never with a circular reference or goal seek. Second, **each instrument converts on its own definition of capitalization**, and the post-money SAFE's differs from the pre-money SAFE's and the note's. Third, **the waterfall's conversion choices depend on the answer**. Settle them with ordered breakpoints, not iteration.

## Before you build

- Gather the current cap table by holder and class: common, options granted (with strikes), the unallocated pool, each preferred series (shares, original issue price), and any SAFEs, notes or warrants outstanding.
- Gather each instrument's document terms. For a SAFE: amount, cap, discount, and whether it is post-money or pre-money. For a note: principal, interest rate, simple or compound, day count, issue date, cap and discount. Also note which capitalization each cap is measured on, and whether it includes the pool increase.
- Gather each new round's term sheet: pre-money valuation, money raised by investor, the pool target (% of post-money, unallocated or total), liquidation multiple, participation and its cap, and seniority (pari passu or stacked).
- Gather the exit: equity value after debt and deal costs, or a range of values. Also any carve-out or escrow.
- The documents decide. When one is silent (unvested options at exit, pool increase in a SAFE's capitalization), pick a convention, label it, and list it next to the answer.
- Follow [conventions](../core/conventions.md), [returns](../core/returns.md) and [scenarios](../core/scenarios.md). Formulas are in [cap-table-mechanics](cap-table-mechanics.md).

## Build steps

1. **Round grid**, one column per event (founding, SAFE or note issues, each priced round). Put per-round inputs in rows: closing date, priced flag, pre-money, money by investor, pool target, grants and their strike, and the series terms. Each column is the state after its event.
2. **Capitalization before the round**: S0 = the previous fully diluted count + shares issued + pool reserved, and U = the unallocated pool after the column's grants.
3. **Instruments.** Each converts at the first priced round after it is issued, and once only. A note converts principal plus accrued interest to the closing date on its day count. The conversion price is the lower of the cap price and `round price × (1 − discount)`. The cap price is the cap divided by the right capitalization:
   - **post-money SAFE**: the company capitalization *including all converting securities but excluding the new money* (and, in the standard form, the round's pool increase). The holder owns exactly amount / cap of it.
   - **pre-money SAFE, note**: the pre-money capitalization *excluding* the converting securities, usually including the pool increase.
4. **Priced round in closed form.** With y = 1 / price, every quantity is linear in y once you know which branch each holder is on (cap or discount; pool topped up or not). Solve each combination of branches, then take the largest y, which is the lowest price: each holder gets the better branch, and that combination is the consistent one. Then price = pre-money / pre-money fully diluted shares. The pre-money shares include the pool top-up and the conversion shares, and new shares = money / price. Document the algebra next to the rows ([cap-table-mechanics](cap-table-mechanics.md)).
5. **Effective pre-money** = headline − pool top-up × price − conversion shares × price, which equals S0 × price. Show it next to the headline. The gap is the option pool shuffle and the conversions, and existing holders pay for both.
6. **Cap table by holder and by class** after every column: ownership %, and each founder's stake before and after each round with the dilution.
7. **Exit waterfall** ([cap-table-mechanics](cap-table-mechanics.md)). Pay preferences by seniority up to the full stack. Above it, each class takes the better of its preference and conversion (non-participating), or preference plus participation up to its cap (participating). Options are exercised when in the money, net of strike (state the choice, or use the treasury method). Find the common value per share from the breakpoint table. Report proceeds by class and by person, $ per share, and each investor's multiple.
8. **Exit range and breakpoints.** Run the waterfall across exit values as columns, and list the exit value at which each class kicks in, converts or hits its cap. These are the questions a board asks: below what price do founders get nothing, and above what price does the lead convert?

## Checks

- Shares by holder = shares by class, and ownership = 100%, in every column.
- Post-money = pre-money + new money. Pre-money shares = S0 + pool top-up + conversion shares. New shares × price = money. The pool after the round equals the target (or the existing pool, if that is already larger).
- Each conversion's shares × its conversion price, recomputed directly from cap and discount, = its amount. The post-money SAFE's shares / company capitalization = amount / cap.
- Every instrument converts exactly once. Every branch combination is solvable (a positive denominator).
- Waterfall: classes and persons each sum to the exit value, at every exit. No class is paid less than zero. No rank is paid while a more senior rank is short. The breakpoints ascend, and the first equals the preference stack.
- Warnings: a founder below a minimum stake, participating preferred without a cap, an exit inside the preference stack, underwater options, a down round, an uncapped SAFE or note.

## Common mistakes

- A circular reference (or goal seek) between price, pool top-up and conversions, instead of a closed-form solve.
- A post-money SAFE converted as a percentage of the post-money including new money, or at cap / pre-money shares like a pre-money SAFE. It owns amount / cap of the company capitalization before the new money.
- The pool top-up placed on the wrong side of the round. In the pre-money (the usual term), existing holders bear all of it. In the post-money, the new investor shares it. Sizing it as a percentage of the pre-money misses the target.
- Quoting the headline pre-money as the founders' valuation. The effective pre-money is lower by the pool top-up and the conversions.
- Note interest left out of the conversion amount, or accrued on a 360-day year when the note says 365.
- Every preferred series assumed to convert, or none, at every exit. A non-participating series converts only when common per share beats its preference per share, and that point differs by series.
- Participating preferred with a cap that never converts back to common above the cap, which understates it at high exits.
- The unallocated pool, or out-of-the-money options, paid at exit, so common's share is spread too thin.
- One stacked-or-pari-passu assumption, never stated, when the charter decides who is paid at a low exit.

## References

- [cap-table-mechanics.md](cap-table-mechanics.md): the round algebra with the branch combinations, conversion formulas by instrument type, the cap-table rows, the class payoff formula, the breakpoint table and the waterfall rows
- [equity-waterfall](../real-estate/equity-waterfall.md): IRR-hurdle promote waterfalls between a sponsor and its investors, which this is not. The conservation and ordering checks carry over.
