# Model review checklist

Work through each group, and note cell addresses for anything found.

## Workbook

- [ ] External links: where do they point, and is anything still using them? Dead links and names that refer to them should be deleted.
- [ ] Defined names: `#REF!` names, names pointing at other workbooks, names that nothing uses, and names Excel reads as cell addresses (`NOI2`, `FY25`).
- [ ] Macros: what each one does, whether any runs on open, and whether any writes values into input cells (goal seek, copy-paste loops).
- [ ] Hidden sheets, rows or columns holding logic; merged cells in calculation areas.
- [ ] Sheets that are broken (`#REF!` columns), mislabelled, or unused.

## Inputs

- [ ] Every rate, fee, percentage and term is in its own input cell. Flag `=Price*0.75`, `=Rate+4%` and `*0.01` inside a formula.
- [ ] Each number has one source. Check for a detailed budget next to a hardcoded total that ignores it, and backup tables that feed nothing.
- [ ] Inputs that are really solved outputs: fractional prices, or values that exactly hit a target.
- [ ] One driver per event. Rent start and opex start should not be separate inputs that can disagree.
- [ ] Switches accept only the values they implement. Look for a "method" column where only one option computes.
- [ ] A driver's historical back-solve uses the same base as its forecast formula (opening vs closing vs average balance, revenue vs COGS).
- [ ] Blank templates: fill in a test case before reviewing; zero inputs hide almost every error.

## Formulas

- [ ] Row consistency in R1C1 across periods. The first period is the usual offender.
- [ ] Totals sum the full range. Look for a `SUM` that stops one row short, or ranges that end at a hardcoded column.
- [ ] Mixed periodicity: monthly amounts converted to weekly with ×12/52, or payoff from `PV` after rounded months.
- [ ] Growth exponents on rounded years (`ROUND(months/12)`).
- [ ] `MAX(0, …)` or `IFERROR(…, 0)` hiding a case that should be visible, such as a refi shortfall or a missing lookup.
- [ ] `IF(x="","",…)` blanking that will break sums, instead of multiplying by flags.
- [ ] Circular references. Are they intentional, how are they broken, and are they documented?

## Timing

- [ ] Balances: interest on the opening balance; the payoff period still pays its interest; no balance is zeroed early.
- [ ] Draws: timed with the costs they fund, not straight-line; no interest charged on a draw in the same period.
- [ ] Event timing: fees at the right event (a leasing fee at each lease start, not each model year); first and last periods included.
- [ ] Grid length vs. the longest supported timeline, and whether anything checks it.

## Reconciliation

- [ ] Profit is the same on every sheet.
- [ ] Sources = uses = funded costs.
- [ ] Equity (and the multiple) defined once, from the levered cash-flow row.
- [ ] Partner cash flows sum to deal cash flow less third-party fees.
- [ ] Annual roll-up = periodic total.
- [ ] Only one IRR definition, and it's labelled (see [core/returns.md](returns.md)).

## Checks and labels

- [ ] Each check compares like with like ($ to $), and tests the item it names, on the sheet it names.
- [ ] No check turns an error into a pass (`IFERROR(…,"OK")`).
- [ ] Historical statements are linked, not typed: historical cash flow lines and corkscrew openings point at their sources, or the checks pass by construction.
- [ ] Labels match the math. "Margin" that is really ROE, "annualized" that is really simple ÷ years, a sheet titled monthly that shows annual.
