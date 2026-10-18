# Merger model

Answers whether an acquisition raises or lowers the buyer's earnings per share, and how much it can pay before it does: diluted shares for both companies, the offer and how it is paid for, sources and uses, a purchase price allocation, synergies, and pro forma EPS against the acquirer's own, year by year. Two things decide whether a merger model can be trusted. **Every pro forma adjustment is the after-tax earnings effect of one decision** (how the price is paid, what gets written up, which synergies arrive when), built once and taxed once. And **the breakeven is solved, not searched for**: pro forma earnings and shares are both linear in the price paid, so the maximum price and the synergies needed are formulas rather than goal seek.

## Before you build

- Gather for both companies: share price (the target's **unaffected** price, before any deal news), basic shares, the option table (number and strike per tranche) and RSUs, net debt and its rate, tax rate, and a 3–5 year forecast of revenue, EBITDA and net income on the same fiscal year end. Calendarize if the year ends differ. Consensus EPS will do when nothing better exists; say so.
- Gather the offer: premium or offer price, the stock / cash mix, whether the target's debt is refinanced or assumed, transaction and financing fees, and the new debt's rate, repayment and fee amortization period. Also gather how much of the cash comes from the acquirer's balance sheet, what that cash earns, and the acquirer's minimum cash.
- Gather the target's book equity and existing goodwill, the write-ups (PP&E, identified intangibles) and their lives, run-rate cost and revenue synergies with a phase-in by year, integration costs, and one marginal tax rate for the adjustments.
- Follow [core/conventions.md](../core/conventions.md), [core/time-series.md](../core/time-series.md) and [core/balances.md](../core/balances.md). A full forecast comes from [corporate-finance/three-statement.md](../corporate-finance/three-statement.md); whether the price is worth paying is a [dcf](dcf.md) question, not an EPS one.

## Build steps

1. **Diluted shares** by the treasury stock method: `n × MAX(0, 1 − strike / price)` per tranche, plus RSUs. Dilute the target at the **offer** price for the purchase price, and at its unaffected price for its own EPS. Equity value has a closed form, `P × (basic + RSUs) + Σ n × MAX(0, P − strike)`. Compute it as a second route and check that the two agree.
2. **Offer.** Offer price = unaffected price × (1 + premium); purchase equity = offer price × diluted shares at the offer; transaction EV = purchase equity + target net debt. Show EV/EBITDA and P/E at the offer, last year and next, beside the acquirer's own P/E.
3. **Consideration.** New shares = stock % × purchase equity / acquirer price. Exchange ratio = stock % × offer price / acquirer price, in acquirer shares per target share, with the all-stock ratio beside it.
4. **Funding.** Cash uses = cash consideration + target debt refinanced + transaction fees + financing fees. Financing fees are a % of the debt they help size, so solve in closed form instead of iterating: with a share `b` from balance-sheet cash and fee rate `φ`, total cash uses = uses before financing fees / (1 − (1 − b) φ). Sources and uses must balance, and the cash taken must leave the acquirer at or above its minimum.
5. **Purchase price allocation.** Net identifiable assets = book equity − the target's existing goodwill + write-ups − the deferred tax liability on them (a share purchase gets no tax step-up). Goodwill = purchase equity − net identifiable assets. Goodwill isn't amortized, so it never touches EPS. The write-ups do, through incremental D&A over their lives.
6. **Synergies.** Cost synergies, plus the **EBITDA** on revenue synergies (revenue × a margin, never the revenue itself), each × a phase-in % per year. Integration costs are one-time. Show them, and switch them in or out of pro forma EPS, because adjusted EPS excludes them and reported EPS doesn't.
7. **New debt** as a corkscrew (see [core/balances.md](../core/balances.md)), with interest on the opening balance and financing fees amortized, so nothing is circular.
8. **Pro forma net income** = acquirer NI + target NI + (1 − t) × (synergies − integration costs when switched in − incremental D&A − new interest − fee amortization − interest forgone on cash used). If the target's debt is refinanced, add back its interest after tax. Use one marginal tax rate `t` on every adjustment and label it. Pro forma shares = acquirer diluted + new shares. Report accretion in $ and % per year against the acquirer's standalone EPS for the same year.
9. **Breakeven**, per year (formulas in [merger-model-mechanics.md](merger-model-mechanics.md)):
   - Synergies needed = (acquirer EPS × pro forma shares − pro forma NI) / (1 − t), pre-tax. A negative number is a cushion.
   - Maximum price: every financing cost scales with the cash uses, and both cash uses and new shares are linear in purchase equity. The breakeven equity therefore solves one linear equation. Invert the TSM for the offer price with a few Newton steps (equity is piecewise linear in price), then premium = price / unaffected − 1.
10. **Contribution and credit.** Each side's share of revenue, EBITDA and net income, and of market value, against the target holders' pro forma ownership. Pro forma net debt / EBITDA at close and by year, against the acquirer's standalone.
11. **Sensitivities**: stock % × premium and synergies × premium on year-1 accretion. Each cell recomputes purchase equity from the TSM closed form, then cash uses, new debt and new shares at that mix, then pro forma EPS. Live formulas, no data tables.

## Checks

- Sources = uses; goodwill ≥ 0; the TSM's two routes agree; new shares = exchange ratio × target diluted shares; pro forma shares = acquirer + new shares; ownership sums to 100%.
- Balance-sheet cash used ≤ cash above the minimum; new debt never negative.
- The breakeven, tested by substitution: at the breakeven equity, rebuild debt, cash and shares and confirm pro forma EPS = acquirer EPS. The price found must reproduce that equity through the TSM.
- Contribution shares sum to 100%; each grid's centre = the model's year-1 accretion; switches take only the values they implement.
- Warnings: dilutive in year 1 or 2; goodwill a large share of the price; pro forma leverage above a threshold; the target's P/E at the offer above the acquirer's while paying in stock (the stock portion dilutes before synergies); acquirer holders below 50%.

## Common mistakes

- Diluting the target at its unaffected price, which misses the options the premium puts in the money.
- Measuring the premium from a price that already reflects deal rumours.
- Revenue synergies counted in full as EBITDA, or synergies at full run-rate in year 1.
- Pre-tax adjustments added to after-tax net income, or a different tax rate on each adjustment with no label.
- Leaving out forgone interest on cash, fee amortization, or the D&A on the write-ups, which is often the biggest drag.
- Refinancing the target's debt while leaving its interest in target NI, which counts interest twice.
- Amortizing goodwill through EPS, or leaving out the deferred tax liability, which understates goodwill.
- A breakeven found by goal seek and pasted as a value, which goes stale.
- Reading accretion as value creation. Buying a lower-P/E company with stock is accretive even when it overpays. Show the premium and the contribution against ownership beside the EPS.

## References

- [merger-model-mechanics.md](merger-model-mechanics.md) — TSM and its closed form, the funding solve, sources and uses, purchase price allocation, the pro forma NI bridge, the breakeven derivation and price inversion, contribution, and sensitivity cells
