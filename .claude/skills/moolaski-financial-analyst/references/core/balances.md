# Corkscrews

Any quantity that carries from period to period is a corkscrew: opening balance, the flows in, the flows out, and a closing balance that becomes the next opening. Debt, construction draws, reserves, partner capital and unpaid pref all use the same four rows. Writing them the same way everywhere makes timing errors easy to see.

## The block

| Row | Formula |
|---|---|
| Opening | `prior closing` (the blank spacer column makes period 0 read 0) |
| Additions | e.g. drawdown = `amount × [draw flag]`, or contribution |
| Scheduled reductions | e.g. principal = `IF(opening > 0, payment − interest, 0)`; 0 if IO |
| Repayment / payoff | `−(opening + additions + scheduled) × [payoff flag]` |
| Closing | `opening + additions + scheduled + repayment` |
| Interest / accrual (memo) | `−opening × rate / periods per year` |

Keep the balance rows positive and the cash-flow rows signed. Sum only the cash-flow rows into cash flow; never the balance.

## Timing conventions (choose once and state it)

- **Draw at period end; interest from the next period.** A draw doesn't earn interest in the period it lands.
- **Interest and scheduled payments** apply while the opening balance > 0, so the payoff period still pays its interest.
- **Payoff** is the balance left after that period's scheduled principal and draws. It comes from the closing math, not from a separately computed `PV`.
- **Payment in the model's own period**: `PMT(rate / P, years × P, −amount)`, where P = periods per year. Converting a monthly payment into weekly periods makes principal paid ≠ principal credited.

## Variants

- **Draws against a commitment**: add a cumulative-drawn row. Draw = `MAX(0, MIN(commitment − prior cumulative, share × this period's cost))`, so the draw follows the spend.
- **Refinance**: the new loan's draw and the old loan's payoff fall in the same period. Net to equity = new loan − costs − payoff. It can be negative, so show it rather than clipping it with `MAX(0, …)`.
- **Partner capital**: opening + contributions − capital returned = closing.
- **Accrued pref / unpaid interest**: opening + accrual − paid = closing, where accrual = (opening capital + compound switch × opening accrued) × rate / P. Keep it separate from capital, so returning capital stops the accrual.
- **Reserves**: opening + funding − releases = closing; releases capped at the opening balance + funding.

## Checks

- Every balance ≥ 0 in every period (`MIN(closing row) ≥ −tolerance`).
- Balances are zero at payoff or exit (`INDEX(closing row, 1, exit + 1) = 0`).
- Draws within the commitment.
- Σ additions − Σ reductions = final closing balance.

## Common mistakes

- Zeroing the balance in the payoff period, which silently skips that period's interest.
- Interest on the closing balance (or on a balance that includes the same period's draw).
- Payoff computed by a separate formula (`PV` after rounded months) that doesn't match the principal actually paid.
- Accruing a return on cumulative contributions instead of the unreturned balance, so it keeps accruing after capital is repaid.
- Folding unpaid accruals into the principal or capital account, which blurs what was paid as return and what as capital.
