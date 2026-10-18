# Acquisition mechanics

Notation: `m` = month (0 = close), `y = ROUNDUP(m/12, 0)`, `[flag]` = a 1/0 row on the timing sheet, `prev` = the prior column, `H` = the sale month, `N` = the last month in the grid (≥ H + 12), `T` = market lease term in years, `p` = renewal probability. Suite inputs come from the rent-roll sheet. Signs: inflows +, outflows −.

## Rent roll to months

| Column | Formula |
|---|---|
| Month index of a date | `(YEAR(d) − YEAR(close)) × 12 + MONTH(d) − MONTH(close)`: a lease from the 1st of month `s0` to the end of month `e0` pays in months `s0…e0` |
| In-place start `s0` / expiry `e0` | the index of the dates if occupied; vacant: `s0 = 1`, `e0 = 0` |
| Pro-rata share | `suite sf / building sf` (or the lease's own share) |
| Remaining term (years) | `occupied × e0 / 12` |
| Mark-to-market | `market rent / in-place rent − 1` on the same suite, same recovery basis |

## Blended market leasing assumptions

| Term | Formula |
|---|---|
| Rent factor | `p × renewal % of market + (1 − p)` |
| Free months, TI $/sf, LC % | `p × renewal + (1 − p) × new` |
| Downtime `D` | `ROUND(p × D_renewal + (1 − p) × (D_new + shift), 0)` (Excel rounds 4.5 up; Python's `round` does not) |
| First rollover of a suite vacant at close | `p1 = 0`, `D1 = MAX(0, lease-up months + shift)`; otherwise `p1 = p`, `D1 = D` |
| Lease base rent over a term, in years of starting rent | `IF(bump = 0, T, ((1 + bump)^T − 1) / bump)` |

## The lease chain (one block per suite)

| Row | Formula |
|---|---|
| Cycle `c` | `IF(m = 0, 0, prev c + (m > prev e))` |
| Current expiry `e` | `IF(m = 0, e0, IF(m > prev e, prev e + IF(prev c = 0, D1, D) + 12T, prev e))` |
| Current (or next) start `s` | `IF(c = 0, s0, e − 12T + 1)` |
| Renewal weight `p_c` | `IF(c ≤ 1, p1, p)` |
| Occupied | `[operating] × (m ≥ s)` |
| Rent in force, $/sf/yr | `IF(c = 0, in-place, market)`; in-place `= cur × (1 + b)^n` or `cur + b × n`, `n = INT((m − s0)/12) − INT(−s0/12)`; market `= market today × (1 + g)^(ROUNDUP(s/12) − 1) × rent factor(p_c) × (1 + bump)^MAX(0, INT((m − s)/12))` |
| Potential rent | `[operating] × sf × rent / 12` (in downtime, the next lease's starting rent) |
| Turnover vacancy | `−(1 − occupied) × potential` |
| Free rent | `−occupied × potential × IF(c = 0, MIN(1, MAX(0, F0 − m + 1)), MIN(1, MAX(0, F(p_c) − (m − s))))` |
| Recoveries | `occupied × sf / 12 × CHOOSE(type, pool, MAX(0, pool − stop), 0)`; stop = the rent roll's for `c = 0`, else `INDEX(pool row, 1, MAX(0, MIN(s, N)) + 1)` (the pool of the start year) |
| TI, LC at lease start | `−(c ≥ 1) × (m = s) × sf × TI(p_c) × expense index`; `−(c ≥ 1) × (m = s) × sf × rent × annuity × LC(p_c)` |
| Area expiring | `sf × occupied × (m = e)` |
| Months check | `SUM(occupied)` = `occ0 × MIN(e0, N) + IF(s1 > N, 0, K × 12T + MIN(12T, N − (s1 + K × L) + 1))`, with `s1 = e0 + D1 + 1`, `L = D + 12T`, `K = INT((N − s1)/L)` |

The recursion needs no count of lease generations: a 1-year term or a 30-year hold just produces more cycles.

## Building

| Row | Formula |
|---|---|
| Expense pool, $/sf/yr | `(fixed + variable × gross-up % + insurance / sf) × (1 + g_exp)^(y − 1) + taxes / sf × (1 + g_tax)^(y − 1)` |
| Other income | `$/sf × occupied sf / 12 × market growth index` |
| Potential gross revenue (PGR) | `potential rent + recoveries + other income` |
| General vacancy and credit loss | `−[operating] × MAX(0, GV % × PGR + turnover vacancy)` (turnover vacancy is negative) |
| EGI | `potential + turnover vacancy + free rent + recoveries + other + general vacancy` |
| Opex | fixed `× building sf`, variable `× occupied sf`, insurance, taxes, `−management % × EGI` |
| Cash flow before debt service | `NOI + TI + LC − reserves` |
| Recoveries check | `recoveries ≤ fixed + variable + insurance + taxes incurred`, every month; gross-up ≤ 100% |
| Year-1 NOI, exit NOI | `SUMPRODUCT(NOI, [months 1–12])`, `SUMPRODUCT(NOI, [H + 1…H + 12])` |

## Price, loan, sale

| Item | Formula |
|---|---|
| Price | `IF(mode = 1, NOI_y1 / going-in cap, input price)`; implied cap `= NOI_y1 / price` |
| Amortising constant `k` | `12 × PMT(rate / 12, years × 12, −1)` |
| Loan | `MIN(LTV × price, NOI_y1 / DSCR / k, NOI_y1 / debt yield)`; show which binds |
| Payment, principal | `PMT(rate / 12, years × 12, −loan)`; principal `= −IF(opening > 0, (1 − [IO]) × (payment − opening × rate / 12), 0)` |
| Sale | `exit NOI / exit cap × [H]`, less selling % |
| Equity at close | `price + closing + up-front capital + loan fee − loan` |
| DSCR, debt yield (year) | `NOI / debt service`; `NOI / loan balance at the start of the year` |
| Cash-on-cash (year) | `(CFBDS + debt service) / equity`, excluding sale and payoff |
| Leverage spread | `going-in cap − k` (negative = negative leverage) |

## Maximum price at a target levered IRR (closed form)

Discount factor `v = (1 + target)^(−(date − close)/365)`, the day count XIRR uses. Levered CF = `A + x × P + L × D`, where `P = −(1 + closing %)` at close and `D = financing row / loan` (fee, interest, principal and payoff all scale with the loan).

| Cell | Formula |
|---|---|
| `ND` | `SUMPRODUCT(financing, v) / loan` |
| `NA` | `SUMPRODUCT(levered, v) + price × (1 + cc) − loan × ND` |
| LTV binds | `x1 = NA / (1 + cc − LTV × ND)`, valid if `LTV × x1 ≤ L_cf` (the DSCR and debt-yield limit) |
| Cash-flow limit binds | `x2 = (NA + L_cf × ND) / (1 + cc)`, valid if `LTV × x2 ≥ L_cf` |
| Max price | `IF(valid1, x1, x2)`; loan there `= MIN(LTV × x*, L_cf)` |
| Plug-back row | `levered − (x* − price) × (1 + cc) × [close] + (L* − loan) × financing / loan`; its XIRR must equal the target |

The max price doesn't depend on the price entered, which makes a quick test. If taxes reassess on the price, or the loan has an LTC test on a budget that moves with price, the flows are no longer linear in price: bisect in rows ([scenarios-mechanics](../core/scenarios-mechanics.md)).

**Verify every IRR.** Excel's XIRR can return a false root (about 3e-9) when the flows have none. Check `ABS(SUMPRODUCT(CF, (1 + IRR)^(−(date − close)/365)))` against a tolerance.

## Rent-roll metrics

| Metric | Formula |
|---|---|
| WALT by area / by rent | `SUMPRODUCT(sf, occ, remaining) / SUMPRODUCT(sf, occ)`; `SUMPRODUCT(annual rent, remaining) / SUM(annual rent)` |
| Expirations by year | `SUMIFS(sf, expiry year, y, occupied, 1)`, % of building and cumulative; plus vacant area, so the column sums to the building. Show a second column from the engine's area-expiring row, which includes market leases signed in the hold |
| Occupancy by month | `occupied sf / building sf` |

## Multifamily unit mix

| Row | Formula |
|---|---|
| GPR at market | `Σ units × market rent × 12 × (1 + g)^(y − 1)` |
| Loss-to-lease % | `LTL_ss + (LTL_0 − LTL_ss) × (1 − burn)^(y − 1)`, `LTL_0 = 1 − in-place roll / GPR at market` |
| Renovated to date (type) | `MIN(program units, program units / program years × y)`; this year's = difference |
| Premium | `(renovated at the start of the year + this year's / 2) × premium × 12 × growth` |
| Renovation downtime | `−this year's × months offline × market rent × growth` |
| Vacancy, concessions, bad debt | `−vac % × (GPR + LTL + premium)`, `−conc % × GPR` (higher in year 1), `−bad debt % × net rental income` |
| Renovation cost (below NOI), return on cost | `−this year's × cost per unit`; `premium × 12 / cost per unit` |

## Scenario sheets

Write the engine once and emit it on one sheet per case, with the parameters at the top: renewal probability, market growth, exit cap, downtime shift, and the model's price. Base, Upside and Downside read the scenario block's columns; one-way sheets move a single driver from the live model (clamp probabilities to 0–100%). Check that the selected scenario sheet reproduces the model and that every sheet passes its engine checks.
