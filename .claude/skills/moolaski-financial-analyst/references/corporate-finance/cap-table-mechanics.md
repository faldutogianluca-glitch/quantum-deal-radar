# Cap table mechanics

Notation: `t` = the round column. `V` = pre-money valuation, `I` = new money, `p` = pool target (unallocated, % of post-money fully diluted). `S0` = fully diluted shares before the round (after this column's issues and grants), `U` = the unallocated pool before the round. `y = 1 / P`, where P is the price per share. `[pr]` = 1 in a priced round. For instrument i: `a` = amount, `d` = discount, and `[cv]` = 1 in the round where it converts.

## Instruments

| Row | Formula |
|---|---|
| Converts here | `[pr] × (round # > issue round) × (amount > 0) × (1 − converted by the previous column)` |
| Amount a | `[cv] × principal × (1 + rate × (closing date − issue date) / basis)` (a SAFE has no rate) |
| Discount branch e | `a / (1 − d)`: shares = e × y |
| Pre-money cap branch q | `a / cap` (pre-money SAFE, note): shares = q × W, where W = S0 + pool top-up |
| Post-money cap branch s | `a / cap` (post-money SAFE): shares = s × K, where K = S0 + ω × top-up + all conversion shares |
| No cap | q = s = 0, so the instrument converts at the discount only |

ω = 0 in the standard post-money SAFE: its company capitalization leaves out the new money and the round's pool increase. Make ω a labelled switch.

## Priced round in closed form

The unknowns are `y`, the pool top-up `Δ = MAX(0, p (V + I) y − U)` and each conversion `X = MAX(cap branch, e y)`. They are tied by pre-money shares = `V y = S0 + Δ + ΣX`. Fix a combination c of branches: each instrument on its cap or discount branch, and the pool topped up (π = 1) or not. Then everything is linear:

```
σ = Σ s (cap branch, post-money)   Q = Σ q (cap branch, pre-money)   E = Σ e (discount branch)
G = (1 − σ)(1 − ω) + ω + Q
y_c = ( S0 (1 + Q) − π U G ) / ( (1 − σ) V − π p (V + I) G − E )
y   = MAX over all combinations of y_c        P = 1 / y
```

Every piece is a maximum of linear terms with non-negative coefficients. So the true solution is at least every combination's solution, and it equals one of them: take the largest y, which is the lowest price. Every denominator must be positive; check the smallest one. Lay the combinations out as rows (σ, Q, E, denominator, y), with their bits in a small table, so each row is still one formula across the rounds. With n instruments converting together there are 2ⁿ⁺¹ combinations.

| Row | Formula |
|---|---|
| Pre-money FD; post-money FD | `V y`; `(V + I) y` |
| Pool top-up Δ | `[pr] × MAX(0, p × post FD − U)` |
| W; K | `S0 + Δ`; `pre FD − (1 − ω) Δ` |
| Conversion shares X | `[cv] × MAX(q W + s K, e y)` |
| Conversion price | `a / X`; check against `MIN(cap / IF(post-money, K, W), P (1 − d)) × X = a` |
| New shares, per investor | `investment × y` |
| Post-money | `P × post FD` (= V + I: check) |
| Pool after | `(U + Δ) / post FD` = `MAX(p, U / post FD)` (check) |
| Effective pre-money | `V − Δ P − ΣX P` = `S0 × P` (check) |

## Cap table

| Row | Formula |
|---|---|
| Common per founder; options | previous + issued; previous + grants |
| Unallocated pool | previous + reserved − grants + Δ |
| Shadow preferred per instrument | previous + X |
| Preferred per investor; by series | previous + new shares |
| Fully diluted | Σ by holder = Σ by class (check) |
| Ownership | holder / FD, summing to 100% (check) |
| Founder before; after; dilution | `(previous + issued) / S0`; `holding / FD`; `after / before − 1` |

A converted SAFE or note becomes a shadow series. It carries the round's terms, with an issue price, and so a preference per share, equal to its own conversion price.

## Exit waterfall: breakpoints

One row per class: common, each option tranche, each shadow series, each round's series. Give every class a payout per share at common value `s`, assuming all preferences are paid in full:

```
g(s) = MAX( IF(NC, a + s, MIN(a + s, h)), s − K )
```

| Class | a | h | NC | K |
|---|---|---|---|---|
| Common | 0 | 0 | 1 | 0 |
| Option tranche | 0 | 0 | 0 | strike |
| Non-participating preferred | multiple × issue price | = a | 0 | 0 |
| Participating, capped | multiple × issue price | cap × issue price | 0 | 0 |
| Participating, uncapped | multiple × issue price | — | 1 | 0 |

g has kinks at `s = h − a` and `s = h + K` (when NC = 0): an option comes into the money, a series converts, a participating series hits its cap, or it converts above the cap.

| Row (columns = breakpoints) | Formula |
|---|---|
| τ | `0`, then `SMALL(all thresholds, k − 1)` |
| Class payout at τ | `n × g(τ)` |
| Exit value F(τ) | `Σ n g(τ)`: F(0) = the preference total, ascending (check) |
| Marginal shares | `n × IF(τ − K >= plateau, 1, IF(OR(NC, a + τ < h), 1, 0))`, plateau = `IF(NC, a + τ, MIN(a + τ, h))` |
| Slope | Σ marginal shares, which must be positive |

## Exit waterfall: payouts

| Row (columns = exit values X) | Formula |
|---|---|
| Inside the stack | `1*(X <= preference total)` |
| Common value per share s | `IF(inside, 0, INDEX(τ, k) + (X − INDEX(F, k)) / INDEX(slope, k))`, where `k = MATCH(X, F, 1)` |
| Class payout, inside the stack | preferred only: `MIN(L_rank, MAX(0, X − L_senior)) × L / L_rank` (rank = 1 for all when pari passu) |
| Class payout, above | `n × g(s)` |
| Converts (preferred) | `1*(s >= h)` when NC = 0 |
| Person | `SUMPRODUCT(ownership column, class payouts)` |
| Multiple | `proceeds / money invested` (a note's principal) |

Checks per exit: classes and persons each sum to X. No payout is negative. Below the stack, no rank is paid while a more senior rank is short. A non-participating series never converts below the full stack: its pro-rata share of a residual is smaller than the preference it gives up. So it is exact to settle every conversion in common-value space above the stack, in threshold order.
