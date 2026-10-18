# Comparable companies and precedent transactions

Values a company by what the market pays for similar ones: trading multiples of listed peers, and multiples and premiums paid in past acquisitions, applied to the subject's own metrics to give a range of value per share. The arithmetic is division; nearly every bad comps sheet fails on **comparability**, a numerator and denominator measured differently from company to company or from the subject, or on **statistics that hide their working**, outliers and loss-makers averaged in, or dropped, with no trace of which.

## Before you build

- Pick the peers for business mix, end markets, size, growth and margin, not just the industry code. Six to twelve is typical; say why each is in.
- Gather per company, at one valuation date: share price, basic shares, RSUs, options by tranche (number, strike), debt, preferred, minority interest, cash, and equity-method investments. Take them from the latest filing and say which.
- Gather per company: the last fiscal year end and months reported since, reported revenue, EBITDA, EBIT and diluted EPS for the last fiscal year, the year to date and the same months a year earlier, the one-offs in that period (restructuring, impairment, gains), and estimates for the next three fiscal years before one-offs.
- Per precedent: announcement date, parties, consideration (cash, stock, mixed), EV at the offer, the target's LTM revenue and EBITDA on the same definition, the offer price, and the unaffected share price one day and four weeks before any leak or announcement.
- The subject needs exactly the same inputs as a peer. Follow [core/conventions.md](../core/conventions.md). A DCF is the intrinsic cross-check: [investment-banking/dcf.md](dcf.md).

## Build steps

1. **Lay companies across the columns**, peers first and the subject last, so every line item is one formula copied across, exactly like a period row. The subject then gets the same EBITDA definition and the same calendarization as the peers by construction, and statistics read the peer columns only, so the subject can never land in its own set.
2. **Diluted shares and EV.** Treasury stock method per option tranche, `n × MAX(0, 1 − strike / price)`, plus RSUs. EV = price × diluted shares + debt + preferred + minority interest − cash − equity-method investments. Minority interest is added because consolidated EBITDA includes 100% of subsidiaries; associates are subtracted because their profit sits below EBITDA. Use one bridge for every company.
3. **LTM** = last fiscal year + year to date − same period last year. Put each company's LTM end date on the sheet and warn when one is stale.
4. **Adjust for one-offs** in an explicit column per item: add back restructuring and impairment, take out gains. Adjusted EPS adds back the after-tax amount per diluted share. Forward estimates are usually already before one-offs. **Whatever definition you use for the peers, use it for the subject**, and for the precedents' target EBITDA too.
5. **Calendarize** each forward metric to the common year end: `CY = (FYE month / 12) × FY ending in that year + (1 − FYE month / 12) × the next FY`. A March year-end company's calendar year is 3/12 of one fiscal year and 9/12 of the next. Don't calendarize LTM; it is already the latest twelve months.
6. **Multiples** per company: EV / revenue, EV / EBITDA, EV / EBIT (LTM, CY1, CY2), P / E, and PEG if growth matters. Pair enterprise value with pre-interest metrics and price with EPS, never EV with net income. A multiple on a zero or negative metric is "n/m", not a number. Put margins, growth and leverage beside the multiples, so a high multiple can be explained rather than just dropped.
7. **Statistics** from 1/0 flags: `in = include switch × (metric > 0)`. Report n, mean, median, 25th and 75th percentiles, low and high. `AGGREGATE(16, 6, values / in, k)` gives a percentile of the included values only (formulas in [comps-mechanics.md](comps-mechanics.md)). Every exclusion is a visible switch with a stated reason. Lead with the median; a mean with one 30x name in it is not a benchmark.
8. **Precedents**: EV / LTM EBITDA, EV / LTM revenue, and the premium over the unaffected price at one day and four weeks. Filter by date (a lookback window) and show a recency-weighted mean. These prices include control and synergies, so precedent multiples sit above trading multiples; never pool the two sets.
9. **Implied value of the subject.** The selected range defaults to the 25th–75th percentiles; overrides are separate inputs, never typed over the statistic. EV = multiple × subject metric; equity = EV − the subject's net claims; per share = equity / diluted shares **at the implied price**. Options that are out of the money today may be in the money at the implied value. P/E gives the price directly. Always show the result against the current price.
10. **Football field**: low, high and the gap per method (trading EV/EBITDA and P/E years, precedents, premiums) against the current price. A stacked bar with an invisible first series draws it.

## Checks

- Each company's EV recomputes in closed form from price, share inputs and claims.
- Calendarization weights sum to 1 and lie in [0, 1]; the LTM end is not after the valuation date; each fiscal year lines up with the calendar year it is weighted into.
- The TSM never adds negative shares, and diluted shares are never below basic.
- The statistics ignore excluded companies: the mean and n recomputed with `AVERAGEIFS` / `COUNTIFS` straight from the switches agree.
- Low ≤ 25th ≤ median ≤ 75th ≤ high; every implied range has low ≤ high; implied price × diluted shares at that price = implied equity.
- Warnings: a multiple more than two standard deviations from the median; an included peer with zero or negative EBITDA; a precedent older than your staleness threshold; a stale LTM; one-offs above ~10% of reported EBITDA; a statistic resting on fewer than four companies; a method where the subject's own metric isn't positive.

## Common mistakes

- Basic shares, or options valued at today's price when the implied price is far from it.
- EV that forgets minority interest, preferred or leases for some peers but not others, or that nets out associates while leaving their share of profit in EBITDA.
- Fiscal years treated as calendar years, so a June year-end peer's "2026" is half a year out of step with everyone else's.
- Adjusted EBITDA for the peers and reported EBITDA for the subject (or the reverse). The difference passes for a valuation gap.
- Loss-makers left in with a huge or negative multiple, or dropped silently with no switch and no reason.
- The mean quoted when one outlier drags it, or a range picked by eye with nothing behind it.
- Precedent and trading multiples averaged together, or a decade-old deal weighted like last quarter's.
- Premiums measured against a price that had already moved on rumours.

## References

- [comps-mechanics.md](comps-mechanics.md) — TSM and the EV bridge, LTM and calendarization, one-off adjustments, flag-driven statistics, precedent weighting and premiums, the implied-price solve with dilution, and the football-field table
