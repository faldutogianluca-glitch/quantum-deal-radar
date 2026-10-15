# Roast Room (versione italiana)

> **Questo è un fork di [nateherkai/roast-room](https://github.com/nateherkai/roast-room)** con tre aggiunte:
>
> 1. **Tutto in italiano**: il Presidente, i verdetti, la sala e il PDF (formato A4). Le schede degli advisor sono in italiano; le citazioni testuali restano nella lingua originale con la traduzione accanto.
> 2. **Un ottavo advisor, Il Veterano** (immobili, aste e distressed in Italia). È un archetipo, non una persona reale: il suo "cervello" è costruito da fonti pubbliche italiane verificabili (codice di procedura civile, codice civile, Testo unico edilizia, OMI dell'Agenzia delle Entrate, Banca d'Italia, linee guida dei tribunali), con ogni citazione legata alla fonte. Su ogni decisione che riguarda un immobile o un'asta pesa 3.
> 3. **Il contesto del business** in `business.md`: il Presidente lo legge prima di ogni consiglio e chiede solo quello che manca. I numeri riservati vanno in `business.private.md` (modello in `business.private.example.md`), che è in `.gitignore`: **questo repository è pubblico, non mettere mai cassa, fatturato o nomi di investitori in un file versionato.**
>
> Uso: `npm start`, apri http://localhost:4730, poi in Claude Code `/roast-room <la tua decisione>`. Un consiglio completo sono 24 esecuzioni di sub-agent; per le decisioni piccole usa `--quick`. Per prendere gli aggiornamenti dell'originale usa **Sync fork** su GitHub: i file toccati da questo fork sono elencati in fondo.
>
> Il ritratto del Veterano è un'illustrazione semplice fatta qui, non nello stile 3D degli altri: per sostituirlo servono quattro immagini WebP 560×560 con sfondo trasparente in `app/public/portraits/veterano-{base,open,mid,blink}.webp` (bocca chiusa, aperta, a "o", occhi chiusi).

---

![The Roast Room](docs/room.jpg)

Bring a hard business decision and seven AI advisors argue it out, then hand you a scored verdict and a one-click PDF. The seats are Jeff Bezos, Paul Graham, Alex Hormozi, Gary Vaynerchuk, Dan Martell, Gino Wickman, and Warren Buffett, each built from that person's public work: their letters, essays, talks, and videos. The council runs in Claude Code, and a small local web app shows them around a table talking it through.

| Seat | Pillar | The question they own |
|---|---|---|
| Jeff Bezos | Strategy and decisions | Is this the right bet, and how reversible is it? |
| Paul Graham | Product and startups | Do people actually want this, and is it growing? |
| Alex Hormozi | Offers, pricing, and sales | Will people pay, how much, and how do we close? |
| Gary Vaynerchuk | Marketing and attention | Where does the attention come from? |
| Dan Martell | People, hiring, and founder time | Who does this, and what does it cost your calendar? |
| Gino Wickman | Operations and scaling | Can the business run this without you holding it together? |
| Warren Buffett | Money and capital | What does it do to cash, risk, and long-term value? |

## What you need

- [Claude Code](https://claude.com/claude-code). Your Claude plan covers it; no API key needed.
- [Node.js](https://nodejs.org) 20 or newer, for the room. There's nothing to install beyond that.

## Setup

```bash
git clone https://github.com/nateherkai/roast-room.git
cd roast-room
```

Or open Claude Code anywhere and say: "Clone github.com/nateherkai/roast-room and start the room for me."

## Run a roast

1. Start the room: `npm start`, then open http://localhost:4730. Leave it open.
2. Open Claude Code in the same folder: `claude`
3. Type `/roast-room` and your decision.
4. Answer the Chair's questions, then watch the council argue it out in the room.
5. When the verdict lands, click **Download PDF**.

You also get a short verdict in Claude Code, and the full report lands in `sessions/<date>-<decision>/verdict.md`.

## What to put in your question

The council is only as good as what you give it. Include:

- **The decision** in one line.
- **Your options.** Two or three. "Keep doing what I do now" counts.
- **Your numbers.** Revenue, cash, and team size.
- **Your limits.** Deadline, hours, and budget.
- **What success looks like**, and by when.
- **Which way you're leaning**, and why. The council tests your lean instead of agreeing with it.

Left something out? The Chair asks before the council starts. Example:

```
/roast-room I run a coaching business at $30k a month with 15 clients at $2,000 each.
Should I raise to $3,500 for everyone, raise for new clients only, or keep $2,000?
Close rate is about 50% and I have $40k in the bank. Success is $45k a month by March.
I'm leaning toward raising for everyone because I'm underpaid.
```

More ways to run it:

- `/roast-room --quick ...` seats four advisors for two rounds. Use it for smaller, reversible calls. It uses far less of your plan.
- `/roast-room --seats hormozi,buffett ...` seats only the advisors you name.
- `/roast-room ask hormozi ...` gets one answer from one seat.

The room is optional. The council runs the same in Claude Code without it.

## Watch an example first

Run `npm start`, open http://localhost:4730, and click **Past sessions**. Three finished councils ship with the repo, so you can see how it works (and download their PDFs) before you run your own.

## How it works

- **The council runs in Claude Code.** Each seat is a sub-agent (`.claude/agents/council-*.md`) that reads its own brain (`.claude/skills/roast-room/brains/<name>/`): frameworks, principles, positions, stories, and voice notes compiled from public sources, with every quote tied to a source. Claude Code acts as the Chair. It runs the rounds, keeps score, and writes the verdict (`.claude/skills/roast-room/SKILL.md`).
- **Each seat scores every option**, weighted by how much that seat's pillar matters to your decision. The Chair caps the verdict when a seat flags ruin risk, and it forces a real argument when everyone agrees too fast.
- **The room only watches.** As the Chair works, it writes each step to `sessions/`, and the app plays those files back. Between rounds it shows which round is running, how long it has been, and what each advisor is weighing. The room makes no AI calls of its own.
- **Every council is saved** in `sessions/`. Past sessions replays any of them and downloads its PDF.
- **Usage:** a full council is 21 sub-agent runs, so it takes a real bite out of your plan's usage. Use `--quick` for small calls.

## Optional: let the room run councils itself

If you'd rather type a decision straight into the room, copy `.env.example` to `.env`, add an `ANTHROPIC_API_KEY`, set `COUNCIL_RUNNER=api`, and restart `npm start`. That mode bills your Anthropic API account (about 25 calls per full council).

## What's inside

| Path | What |
|---|---|
| `.claude/skills/roast-room/` | The skill: protocol, prompts, scoring, report template, and the seven brains |
| `.claude/agents/` | The seven seat agents |
| `app/` | The room: a zero-dependency Node server, the web page, and the PDF builder |
| `sessions/` | Your councils (kept out of git) and the three examples |

## About the advisors

These are simulations built from each person's public work. They are not the people, they don't speak for them, and none of them is affiliated with or endorses this project. A seat only quotes a person verbatim when the line is in its brain with a source, and `python .claude/skills/roast-room/scripts/check_quotes.py sessions/<session>` checks every quote in a council against the brains. Each brain's `sources.md` lists what it was built from.

Built by AI Automation Society. The code is MIT licensed; see `LICENSE`. The PDF builder bundles [jsPDF](https://github.com/parallax/jsPDF) (MIT) and [Montserrat](https://github.com/JulietaUla/Montserrat) (SIL Open Font License); their licenses sit next to them in `app/public/`.

## File modificati da questo fork

Per risolvere eventuali conflitti dopo un Sync fork: `app/lib/{seats,council,watch}.mjs`, `app/public/{app.js,index.html,pdf.js}`, `app/public/portraits/veterano-*.webp`, `.claude/agents/council-veterano.md`, `.claude/skills/roast-room/{SKILL.md,references/*,scripts/check_quotes.py,brains/il-veterano/}`, `CLAUDE.md`, `README.md`, `package.json`, `.gitignore`, `business.md`, `business.private.example.md`.
