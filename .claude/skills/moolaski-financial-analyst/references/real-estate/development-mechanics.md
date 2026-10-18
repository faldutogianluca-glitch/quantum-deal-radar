# Development mechanics

Notation: `m` = month (0 = land close), `y = ROUNDUP(m/12, 0)`, `[flag]` = a 1/0 row on the timing sheet, `prev` = the prior column, `C` = conversion (stabilisation), `R` = refinance, `X` = sale, `r` = construction rate. Costs are negative. The grid runs to `X + 12` for forward NOI.

## Timing and units

| Row | Formula |
|---|---|
| Construction start / completion `Mc` | `predev + 1` / `predev + construction months` |
| First delivery | `Mc − delivery months + 1` (delivery months = 1: all at completion) |
| Units delivered | `units / delivery months × [delivering]` |
| Units leased | `MIN(prev + pace × (m ≥ first delivery), delivered to date, units × stabilised occupancy)` |
| Stabilisation `C` | `COUNTIF(leased row, "<" & stabilised units)` (leased never falls, so this is the first month at target) |
| `R`, `X`, takeout | `C + refi lag`, `C + hold`, `IF(refinance, R, X)` |
| Flags | predev, construction, delivering, after completion, lease-up (first delivery…`C`), funding (0…`C`), conversion, refinance, takeout, sale, in model (0…`X`), forward windows `AND(m > E, m ≤ E + 12)` |
| Lease-up slower by N months | pace = `target / (target / pace + N)` |

## Budget

| Row | Formula |
|---|---|
| Hard cost S-curve | `[construction] × (COS(PI() × (m − start) / n) − COS(PI() × (m − start + 1) / n)) / 2`, summing to 1 for any n |
| Hard costs, contingency | `−hard total × S-curve`, then `hard × contingency %` |
| Front-loaded soft cost | `−total × (front share × [predev] / predev months + (1 − front share) × [construction] / construction months)` |
| Lump soft cost | `−amount × [construction start]` |
| Back-loaded (marketing) | `−amount × [lease-up] / SUM(lease-up flag)` |
| Property tax, all months | `−rate / 12 × IF(m > Mc, assessed % × (land + hard), land) × (1 + g)^(y − 1)`, split into a budget row (up to `Mc`) and an operating row (after) |

## Operations

| Row | Formula |
|---|---|
| Gross potential rent | `delivered to date × rent × (1 + g)^(y − 1)` |
| Vacancy | `−(delivered − leased) × rent` |
| Concessions | `−concession % × leased × rent × [lease-up]` (one month free on 12 = 8.33%) |
| Other income, credit loss | `per unit × leased × growth`; `−loss % × (GPR + vacancy + concessions + other)` |
| Opex, management | `−per unit / 12 × delivered × growth`; `−% × EGI` |
| NOI → cash flow before debt | `EGI + opex + management + tax`, then `− reserves per delivered unit` |
| Forward NOI after E | `SUMPRODUCT(NOI, [forward window after E])` |
| Untrended stabilised NOI | `units × occupancy × (rent + other) × 12 × (1 − loss) × (1 − mgmt %) − opex × units − tax on reassessed value` |

## Loan sizing: the closed form

Need (funding period only): `need = (−development costs + MAX(0, −cash flow before debt)) × [funding]`. Positive lease-up cash flow is kept out of the need (see the lease-up account).

| Row | Formula |
|---|---|
| Growth to conversion | `g = (1 + r/12)^(C − m) × [funding]` |
| Cumulative need, cumulative need × g | running sums |
| Tail (loan at `C` if it funds every later month) | `tail = Σ(need × g) − cumulative (need × g)` |
| LTC solve, loan share of this month | `p = (LTC × cumulative need − tail × k) / (g × k + LTC)`, `k = 1 − LTC × (1 + fee %)` |
| Valid month | `[funding] × (need > 0) × (p > 0) × (p ≤ need)`, first one only |
| Loan by LTC | `tail + p × g` in the valid month |
| Commitment `L` | `MIN(loan by LTC, LTV × forward NOI after C / sizing cap)` |
| Equity run-out for `L` | `p = (L − tail) / g`, first valid month |
| Loan-funded need `S` | `Σ need − cumulative need + p` in that month |
| Interest reserve / equity / total cost | `L − S` / `Σ need + fee % × L − S` / `equity + L` |

Why it's exact: equity funds the head of the need curve, the loan funds the tail, and a dollar drawn in month t is `(1 + r/12)^(C − t)` of loan at conversion because interest compounds on the opening balance. The fee is paid at close from equity, so it never lands in the tail. For LTC the unknown is linear in `p`, so no iteration is needed.

## Construction loan and lease-up account

| Row | Formula |
|---|---|
| Interest | `−opening × r / 12` (capitalised in the funding period, paid in cash after) |
| Equity funding | `[funding] × MAX(0, MIN(need + fee, equity − equity to date))` |
| Draw | `[funding] × (need + fee + interest − equity)` |
| Lease-up account deposit | `[funding] × MAX(0, cash flow before debt)` |
| Applied at conversion | `−(account opening + deposit) × [conversion]` |
| Repayment | `−(opening + draw + applied) × [takeout]` |
| Checks | `(opening + draw)` at `C` = `L`; Σ equity funding = equity; Σ capitalised interest = `L − S` |

## Takeout

| Item | Formula |
|---|---|
| Permanent loan | `MIN(LTV × forward NOI / cap, forward NOI / DSCR / (12 × PMT(rate/12, years × 12, −1)), forward NOI / debt yield)` |
| Net refinance proceeds | `loan × (1 − fee %) − construction payoff` (can be negative) |
| Sale | `forward NOI after X / exit cap × (1 − selling %)` |
| Levered CF | `unlevered + construction loan flows − lease-up deposits + permanent loan flows`; `= −equity funding` in the funding period |
| Yield on cost, spread | `forward NOI after C / total cost`; `− exit cap` |

## Waterfall rows

`LP` = LP share of contributions; per-period rates `i_p` (pref) and `i_h = (1 + h)^(1/P) − 1` (hurdle). Tier amounts are for all equity; the LP takes its split of each.

| Row | Formula |
|---|---|
| Pref accrued | `IF(compound, (capital + unpaid pref) × i_p, capital × rate / P)` on opening balances |
| 1a pref paid | `MIN(distributable, (unpaid pref + accrued) / LP)` |
| 1b capital returned | `IF(AND(American, NOT capital event), 0, MIN(left, (capital + LP contribution) / LP))` |
| 2 catch-up | `on × MIN(left, MAX(0, (s × (P_prev + 1a) − (G_prev + GP × 1a)) / (c − s)))` |
| Hurdle account before tier 3 | `opening × (1 + i_h) + LP contribution − LP share of tiers 1–2` |
| Multiple shortfall | `M × LP contributions to date − LP distributions to date − LP share of tiers 1–2` |
| 3 to the hurdle | `MIN(left, MAX(0, account, multiple shortfall) / LP split 3)` |
| Hurdle account, closing | `account − MIN(LP split 3 × tier 3, MAX(0, account))` |
| 4 above the hurdle | whatever is left |
| Clawback at sale | `[sale] × MIN(MAX(0, promote to date), LP capital + unpaid pref)` |

## Scenario blocks

Write the engine once and emit it twice: across the model's sheets, and as one sheet per scenario with its own parameters (hard-cost factor, lease-up months slower, exit-cap shift, rent factor) at the top. The scenario sheet then reruns sizing, interest, timing and the waterfall. Check that the base scenario sheet equals the model, and that every scenario sheet passes its own engine checks.
