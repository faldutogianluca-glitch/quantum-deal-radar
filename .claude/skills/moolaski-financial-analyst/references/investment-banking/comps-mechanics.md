# Comps mechanics

Notation: companies run across the columns (peers, then the subject in the last column); `P` = share price, `K` = option strike, `n` = options in a tranche, `[in]` = a 1/0 row that is 1 when the company or deal counts in a statistic, `V` = a multiple row. Statistic ranges cover the peer columns only. Units in millions and $/share.

## Diluted shares and enterprise value

| Row | Formula |
|---|---|
| Net new shares, each tranche | `IF(P > 0, n × MAX(0, 1 − K / P), 0)` |
| Diluted shares | basic + RSUs + Σ tranches |
| Equity value | `P × diluted` |
| Enterprise value | `equity + debt + preferred + minority interest − cash − equity-method investments` |
| Net claims | `EV − equity` (what the subject's bridge subtracts later) |
| Check, closed form | `P × (basic + RSU) + Σ n × MAX(0, P − K) + claims − EV = 0` |

Add leases, pension deficits or other debt-like items to the bridge only if you add them for every company and use the matching metric (EBITDA before rent if leases are debt).

## LTM, adjustments and calendarization

| Row | Formula |
|---|---|
| FYE month | `MONTH(last fiscal year end)` |
| LTM end | `EOMONTH(last fiscal year end, months reported since)` |
| LTM age, months | `YEARFRAC(LTM end, valuation date) × 12` |
| LTM, as reported | `last FY + year to date − same months last year` |
| One-offs | restructuring + impairment + other (a charge positive, a gain negative) |
| Adjusted EBITDA, EBIT | `reported + one-offs` |
| Adjusted EPS | `reported + one-offs × (1 − tax) / diluted shares` |
| w1, w2 | `FYE month / 12`, `(12 − FYE month) / 12` |
| CY1 metric | `w1 × FY1 + w2 × FY2`, where FY1 is the fiscal year ending in the calendar year |
| CY2 metric | `w1 × FY2 + w2 × FY3` |

The last fiscal year must end in CY1 or the year before; otherwise FY1–FY3 don't line up with CY1–CY2. Check it. A December year end has w1 = 1, which makes the formula the identity.

## Multiples and flags

| Row | Formula |
|---|---|
| EV multiple | `IF(metric > 0, EV / metric, 0)`, with number format `0.0"x";(0.0"x");"n/m"` |
| P / E | `IF(EPS > 0, P / EPS, 0)` |
| PEG | `IF(AND(EPS CY1 > 0, g > 0), P/E CY1 / (g × 100), 0)`, `g = EPS CY2 / EPS CY1 − 1` |
| `[in]`, trading | `include × (metric > 0)`; PEG also × `(g > 0)` |
| `[in]`, precedents | `include × (age ≤ lookback) × (metric > 0)`; premiums also need an unaffected price |
| Outlier flag | `[in] × (ABS(V − median) > k × std dev)`, `k` an input (2) |
| Negative-EBITDA flag | `include × ((EBITDA LTM ≤ 0) + (CY1 ≤ 0) + (CY2 ≤ 0) > 0)` |

## Statistics (one row per multiple)

| Statistic | Formula |
|---|---|
| n | `SUM([in])` |
| Mean | `SUMPRODUCT([in], V) / n` |
| Median | `AGGREGATE(17, 6, V / [in], 2)` |
| Percentile p | `AGGREGATE(16, 6, V / [in], p)` (PERCENTILE.INC) |
| Low, high | `AGGREGATE(15, 6, V / [in], 1)`, `AGGREGATE(14, 6, V / [in], 1)` |
| Std dev | `SQRT(SUMPRODUCT([in], (V − mean)^2) / (n − 1))` |
| Check route | `AVERAGEIFS(V, include, 1, metric, ">0")` and `COUNTIFS(…)` must equal the mean and n |

`V / [in]` divides by zero for every excluded company; option 6 makes `AGGREGATE` skip those errors, so no helper column or array entry is needed. Functions 14–19 take arrays; 1–13 (including `MEDIAN`, code 12) do not, which is why the median uses the quartile function.

## Precedents

| Row | Formula |
|---|---|
| Age, years | `YEARFRAC(announced, valuation date)` |
| Recency weight | `0.5 ^ (age / half-life)` |
| Weighted mean | `SUMPRODUCT(weight, [in], V) / SUMPRODUCT(weight, [in])` |
| Premium | `IF(unaffected > 0, offer / unaffected − 1, 0)` for 1 day and 4 weeks |
| Stale flag | `[in] × (age > staleness threshold)` |

## Implied value of the subject

For each method: low = `IF(ISNUMBER(override), override, percentile)`, the same for high; show the median beside them.

| Method | EV | Equity | Price |
|---|---|---|---|
| EV multiple | `multiple × subject metric` | `EV − net claims` | solve `P × diluted(P) = equity` |
| P / E | `equity + net claims` | `P × diluted(P)` | `multiple × subject EPS` |
| Premium | `equity + net claims` | `P × diluted(P)` | `current price × (1 + premium)` |

Show a method as not meaningful (0, with a warning) when the subject's own metric is zero or negative.

**Solving for the price with dilution.** `P × diluted(P) = P × B + Σ n × MAX(0, P − K)`, with `B` = basic + RSUs, is increasing and piecewise linear in `P`. With tranches sorted by strike, `K1 ≤ K2`, try each region in turn:

```
Pa = E / B                                      valid if Pa <= K1
Pb = (E + n1·K1) / (B + n1)                     valid if Pb <= K2
Pc = (E + n1·K1 + n2·K2) / (B + n1 + n2)        otherwise
P  = MAX(0, IF(Pa <= K1, Pa, IF(Pb <= K2, Pb, Pc)))
```

Check `P × diluted(P) − E = 0` for every method, and that the strikes are in ascending order. More tranches extend the chain the same way. Dividing equity by today's diluted count instead misstates value whenever the implied price crosses a strike.

## Football field

One row per method: `low`, `bar = high − low`, `high`, the current price, and the value at the median. Chart `low` and `bar` as a stacked horizontal bar with the first series unfilled, and draw the current price as a vertical line. The summary row takes the lowest low and highest high across the methods shown, skipping any not-meaningful method (`AGGREGATE(15, 6, low / (low > 0), 1)`).
