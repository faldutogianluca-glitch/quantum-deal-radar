# Merger model mechanics

Notation: `E` = purchase equity (price paid for the target's diluted equity), `P_A` = acquirer share price, `S_A` = acquirer diluted shares, `s` = stock share of `E`, `b` = share of cash uses paid from the acquirer's cash, `φ` = financing fee % of new debt, `f` = transaction fee % of EV, `ND_T` = target net debt, `R` = 1 if the target's debt is refinanced (0 if assumed), `t` = marginal tax rate on adjustments. Year 0 is the last actual year and the deal closes at its end; `[fc]` is the 1/0 forecast flag.

## Diluted shares (treasury stock method)

| Item | Formula |
|---|---|
| Net shares, tranche i | `n_i × MAX(0, 1 − K_i / P)` |
| Diluted shares | `basic + RSUs + Σ tranches` |
| Equity value, closed form | `P × (basic + RSUs) + SUMPRODUCT(n, (P − K) × (P > K))` = `P × diluted shares` |
| Slope of equity in price | `basic + RSUs + SUMPRODUCT(n, 1 × (P > K))` |

Target at the offer price → purchase equity. Target at its unaffected price → its standalone EPS. Acquirer at its own price → `S_A`. Convertibles that are in the money at the price used convert into their shares; otherwise they count as debt.

## Offer and consideration

| Item | Formula |
|---|---|
| Offer price | `unaffected price × (1 + premium)` |
| Purchase equity `E` | `offer price × target diluted shares at the offer` |
| Transaction EV | `E + ND_T` |
| Stock / cash consideration | `s × E` / `(1 − s) × E` |
| New shares | `s × E / P_A` |
| Exchange ratio | `s × offer price / P_A` (acquirer shares per target share) |
| Check | `new shares − exchange ratio × target diluted shares at the offer = 0` |

## Funding and sources and uses

| Item | Formula |
|---|---|
| Uses before financing fees `U₀` | `(1 − s) × E + R × ND_T + f × (E + ND_T)` |
| Total cash uses `U` | `U₀ / (1 − (1 − b) × φ)` |
| New debt `D` | `(1 − b) × U` |
| Financing fees | `φ × D` (capitalized, amortized) |
| Acquirer cash used `C` | `b × U`, must be ≤ cash − minimum cash |
| Uses | `E + R × ND_T + transaction fees + financing fees` |
| Sources | `s × E + C + D`, equal to uses |

## Purchase price allocation

| Item | Formula |
|---|---|
| Net identifiable assets | `book equity − existing goodwill + PP&E write-up + intangibles write-up − DTL` |
| Deferred tax liability | `(write-ups) × t` in a share deal; 0 where the tax basis steps up |
| Goodwill | `E − net identifiable assets`, must be ≥ 0 |
| Incremental D&A, year y | `write-up / life × (y ≤ life) × [fc]`, per asset class |

## Pro forma net income (per year)

| Row | Formula |
|---|---|
| Acquirer NI + target NI | standalone, `× [fc]` |
| Target interest removed | `−target net interest × (1 − target tax) × R` (interest is negative, so this adds back) |
| Synergies | `(cost run-rate × cost phase-in + revenue run-rate × revenue phase-in × margin) × (1 − t)` |
| Integration costs | `−cost × (1 − t) × switch` |
| Incremental D&A | `−Σ write-up D&A × (1 − t)` |
| New interest | `−opening debt × rate × (1 − t)`; repayment `MIN(opening, % × D)` |
| Fee amortization | `−MIN(opening fees, fees / years) × (1 − t)` |
| Forgone interest | `−C × rate on cash × (1 − t)` |
| Pro forma EPS | `pro forma NI / (S_A + new shares)` |
| Accretion | `pro forma EPS / acquirer EPS − 1` |

## Breakeven

Synergies, per year: `(acquirer EPS × pro forma shares − pro forma NI) / (1 − t)` extra pre-tax synergies (negative = cushion).

Price, per year. Let `X` = pro forma NI before new interest, fee amortization and forgone interest. Per dollar of new debt, the after-tax cost is `k_D = (1 − t) × (rate × MAX(0, 1 − repay % × (y − 1)) + φ × MIN(MAX(0, 1 − (y − 1) / fee years), 1 / fee years))`, and per dollar of cash used it is `k_C = (1 − t) × rate on cash`. Every financing cost is then `k × U₀` with:

```
k        = (k_D × (1 − b) + k_C × b) / (1 − (1 − b) × φ)
U₀(E)    = u₁ × E + u₀,   u₁ = 1 − s + f,   u₀ = (R + f) × ND_T
shares   = S_A + (s / P_A) × E
E*       = (X − k × u₀ − EPS_A × S_A) / (k × u₁ + EPS_A × s / P_A)
```

Check first that `X − k × U₀` reproduces pro forma NI at the model's own price. Then invert the TSM for the offer price with Newton steps from the model's offer price, `P ← P + (E* − equity(P)) / slope(P)`. Equity is convex and piecewise linear in price, so this lands exactly within one step more than the number of option tranches. Breakeven premium = `P* / unaffected − 1`; when `E* ≤ 0`, the deal dilutes at any price. The premium offered doesn't enter `E*`, so changing the premium must leave the breakeven price unchanged, which makes a quick test.

Substitution test: at `E*`, rebuild `U₀`, `D`, `C` and the shares from the funding formulas, and confirm pro forma EPS = acquirer EPS.

## Contribution, ownership, credit

| Item | Formula |
|---|---|
| Contribution, per metric | `acquirer / (acquirer + target)` and `target / (acquirer + target)` for revenue, EBITDA, NI; market value at unaffected prices |
| Ownership | `S_A / (S_A + new shares)` and `new shares / (S_A + new shares)` |
| Pro forma net debt | `acquirer net debt + (1 − R) × ND_T + D + C` |
| Leverage | `pro forma net debt / (EBITDA_A + EBITDA_T + synergies)` |

**Paper merger.** Before synergies, D&A on write-ups and fees, an all-stock deal is accretive when the target's P/E at the offer is **below** the acquirer's P/E. An all-debt deal is accretive when the target's earnings yield at the offer (1 / P/E) is **above** the after-tax cost of debt, and a cash-funded deal when it is above the after-tax yield on cash. A mix blends the two, weighted by the stock %. Stock is expensive currency when the acquirer's P/E is low, and debt is cheap when rates are low.

## Sensitivity cells

Premium `p` across (helper rows: offer price `P = unaffected × (1 + p)`, then `E(P)` from the closed form), stock % `s` down:

```
U₀   = (1 − s) × E + R × ND_T + f × (E + ND_T)
cell = IFERROR(((X₁ − k₁ × U₀) / (S_A + s × E / P_A)) / EPS_A,1 − 1, "n/a")
```

`X₁`, `k₁` and `EPS_A,1` are the year-1 cells of the rows above, referenced rather than retyped. For a synergy axis `m` (share of planned year-1 synergies), add `(m − 1) × synergies₁ × (1 − t)` to `X₁` and hold `s` at the model's value. Each centre cell must equal the model's year-1 accretion.
