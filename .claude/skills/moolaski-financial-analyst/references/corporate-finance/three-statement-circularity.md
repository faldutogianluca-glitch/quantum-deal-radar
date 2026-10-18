# Circularity in an integrated model

## Where it comes from

Interest expense depends on the debt balance. The debt balance depends on how much cash the business generated. Cash generated depends on net income. Net income depends on interest expense. That loop closes as soon as interest is charged on a balance the same period's cash flow can change — an average balance, or a closing balance, or a revolver sized after interest.

A second loop appears with a cash sweep: cash available for the sweep depends on interest, which depends on the debt the sweep is about to repay.

## Three ways to handle it

**1. Interest on opening balances (default).** The opening balance is last period's closing, already known. Interest is computed before this period's cash flow, so nothing loops. The model calculates in one pass, gives identical results every time, survives being copied, and never shows a circular-reference warning.

The cost is a small understatement or overstatement of interest when balances move a lot within a period. For most forecasting that is well inside the error of the forecast itself.

**2. Average balances with iterative calculation.** More precise when balances change sharply. Requires Excel's iterative calculation to be on (Preferences → Calculation, or via automation). Consequences to accept and to write on the cover sheet:

- Results depend on the iteration limit and can differ in the last decimals between machines.
- A single error anywhere in the loop (a `#REF!`, a division by zero) propagates and **freezes** as a stale number rather than resolving.
- Opening the file with iteration off gives a circular-reference warning and zeros.

Always pair it with a **circuit breaker**: a 1/0 input that forces interest to zero. Flip it on to clear a stuck loop, then off again.

**3. A macro that iterates manually.** Copy-paste a computed interest figure into a hardcoded cell until it converges. Avoid it: the model then holds a number no formula can reproduce, and it goes stale the moment an input changes. If a model you inherit does this, say so in the review.

## Testing that it actually resolved

- With opening balances: check interest equals opening balance × rate exactly, period by period.
- With average balances: check interest equals (opening + closing) / 2 × rate. If it doesn't, iteration didn't converge — raise the iteration limit or lower the maximum change, then recalculate.
- Flip the circuit breaker on and off; the model must return to the same numbers.
- Recalculate twice. If the numbers move on the second pass, the loop has not converged.

## Sizing a revolver without a loop

1. Compute cash flow before the revolver, using interest on opening balances.
2. Cash available = opening cash + that cash flow.
3. Draw = `MAX(0, minimum cash − cash available)`.
4. Repayment = `−MIN(opening revolver, MAX(0, cash available − minimum cash))`.
5. Closing cash = cash available + draw + repayment.

Each step uses only values already computed, so there is no loop. The revolver's own interest is charged on its opening balance next period, which is when the cash it funded is actually outstanding.
