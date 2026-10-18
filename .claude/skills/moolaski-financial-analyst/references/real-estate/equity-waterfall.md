# Equity waterfall (LP / GP)

Splits a deal's levered cash between the capital partner (LP) and the sponsor (GP): a preferred return, return of capital, an optional GP catch-up, then promote tiers at IRR or multiple hurdles. It works on any levered cash-flow row: a development, an acquisition, a portfolio, in monthly, quarterly or annual periods. For a small rental deal with a flat pref and one promote split, [rental-property-waterfall](rental-property-waterfall.md) is enough. This guide adds the tiers above it. Two things decide whether a waterfall can be trusted. First, **hurdles are IRRs, so track each one as a capital account compounding at its hurdle rate**, and never find them by goal seek or a circular IRR-to-date. Second, **every period's cash is conserved**: the tiers sum to the cash distributed, and the partners' flows sum to the deal's.

For preferred stock's liquidation preferences and conversion at a company exit, see [cap-table](../corporate-finance/cap-table.md).

## Before you build

- One levered cash-flow row and its dates ([core/returns.md](../core/returns.md)). Contributions = `MAX(0, −levered CF)`, distributions = `MAX(0, levered CF)`.
- The terms, from the agreement's wording. Gather each partner's share of contributions (GP co-invest), and the pref rate with its compounding (simple, or compounded monthly, quarterly or yearly). Gather the catch-up % and its target, and each hurdle: IRR, multiple, or the greater of both. Also gather the split above each hurdle and whether the GP's share of it includes its co-invest share; whether the hurdles are measured on the LP or on all equity; American or European; clawback terms; and fees paid to the GP.
- A convention nobody wrote down is an assumption. List it next to the answer, since these choices move the GP's IRR by points.

## Build steps

1. **Tier 1: pref, then capital.** Keep the LP's unreturned capital and unpaid pref as separate balances, as in [rental-property-waterfall](rental-property-waterfall.md). Accrue on opening balances: compounding `(capital + unpaid pref) × periodic rate`, or simple `capital × rate / periods`, by a switch. Pay the pref, then capital, to all equity pro rata.
2. **Periodic rates.** An IRR hurdle accrues at `(1 + h)^(1/P) − 1`, so a cleared account means the LP's periodic IRR annualises to exactly h. A pref written as "8% compounded monthly" is 8% / 12 instead. Follow the document and label the choice.
3. **Catch-up (optional).** The GP takes the catch-up % `c` of cash until it holds the target share `s` of profit distributed, where profit is all distributions less capital returned, including this period's pref. The tier is `(s × P − G) / (c − s)`, with P and G the cumulative profit to all partners and to the GP. `c` must exceed `s`. At 100%, the GP takes everything until it has caught up.
4. **IRR hurdle tiers.** Each hurdle gets one LP account: opening × `(1 + h)^(1/P)` + LP contributions − LP distributions from the tiers below. The tier pays `MIN(cash left, account / LP split)`. When the account reaches zero, the LP has earned exactly h. Prove it: the NPV at h of the LP's flows up to that period is zero.
5. **Multiple hurdle (optional).** LP shortfall = `M × LP contributions − LP distributions to date`. A tier that ends at "the greater of an IRR and a multiple" pays `MAX(IRR account, multiple shortfall) / LP split`.
6. **Top tier**: the remainder, at the top split.
7. **American vs European.** In a fund, European means all contributed capital and the pref come back before any carry. American (deal by deal) pays carry as each deal is realised, subject to a clawback. For a single deal, the analogue is the capital tier. European returns capital and pref before any promote. American pays the pref current, lets operating cash flow into the promote while capital is still out, returns capital only from capital events (refinance, sale), and settles with a clawback. Build it as a switch on tier 1b. When the pref accruing on outstanding capital absorbs all the operating cash, the two come out the same, so say so rather than implying the switch matters.
8. **Clawback** at the final distribution: the GP returns promote received, up to the LP's unpaid capital and pref (or the shortfall to the pref IRR, if that is what the agreement says).
9. **Outputs** per partner: contributed, distributed, profit, XIRR, multiple. Promote = GP distributions − GP share × all distributions, net of clawback. Also show the GP's share of total profit. Show GP fees in a separate GP-with-fees IRR, outside the waterfall.

Formulas row by row: [development-mechanics.md](development-mechanics.md).

## Checks

- Every period: LP + GP distributions = cash distributed, tiers sum to it, and no tier is negative. LP + GP cash flow = deal levered cash flow (less any third-party fees).
- Hurdle and pref accounts never go negative, including before each tier pays. Once a hurdle is cleared, cash above it bypasses the account, so the account stays at zero. If capital is called later, the account restarts without credit for the LP's earlier surplus. That is the usual drafting; state it.
- The hurdle identity holds whenever the tier above a hurdle pays. With a catch-up that completes, the final split no longer depends on the pref rate. Show that, so nobody negotiates the wrong term.
- Switches take only the values they implement; the catch-up % is above its target; splits and shares lie within 0–100%.

## Common mistakes

- Hurdles found by goal seek, or by a running `IRR()` on cash to date. That breaks with interim distributions, capital calls and sign changes, and it can't be audited.
- Pref accrued on cumulative contributions, or unpaid pref folded into capital (see [core/balances.md](../core/balances.md)).
- Hurdles measured on all-equity IRR while the tiers split LP and GP unequally, so the LP never actually earns the stated hurdle.
- A split quoted as "70/30" without saying whether the 30 includes the GP's co-invest share. Promote is only the excess over pro rata.
- Catch-up measured against all distributions instead of profit, which overpays the GP.
- An "American" switch that only moves the promote in time, without changing which cash returns capital.
- An IRR hurdle accrued at h / 12 a month, then reported against XIRR. The account clears at `(1 + h/12)^12 − 1`, above the stated hurdle, so the promote starts later than agreed.
