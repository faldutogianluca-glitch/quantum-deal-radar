# Add three funnel pages and lead tracking to the existing milanoretailtour.com site

Prompt for Claude Code (VS Code), to run with the existing website project open. Replace the one path in the first line.

---

The package with the already-made funnel content is at `<PATH>/pacchetto-sito-mirt.zip`. Unzip it into a temporary folder and read `ISTRUZIONI-PUBBLICAZIONE.md` first. It contains 20 HTML page fragments (`content/*.html`, Italian, plus English with the `en__` prefix: the Radar landing page, the guides hub `/guide/`, 8 articles), a `download/` folder (Radar PDF, preview image, 6 guide PDFs) and `pages-json-aggiunte.json` (slug, SEO title, meta description, language, file and publication date for each page).

## Step 1: learn how this site works, change nothing yet
Find out: where the list of pages lives (the JSON that `pages-json-aggiunte.json` extends), how a fragment is wrapped in the site template (header, footer, `gdlr-page-title-wrapper`), how `/en/` pages are produced, the Content Security Policy (no inline scripts or styles allowed; note which external hosts `connect-src`, `form-action` and `frame-src` allow), how the existing contact form posts to FormSubmit for info@milanoretailtour.com (AJAX endpoint, `data-submit` / `data-success` / `data-fail` hooks) and in which JS file that code lives, and how the site is deployed. Write the findings in `FUNNEL-NOTES.md`. Use `content/radar.html` from the package as the model for every new page: same markup, only the CSS classes already in the site stylesheet (`fmt`, `fmt-card`, `fmt-lead`, `fmt-cols`, `fmt-list`, `fmt-tags`, `fmt-checks`, `fmt-cta`, `fmt-info`, `fmt-form`, `fmt-row`, `fmt-btn`, `fmt-status`, `fmt-honey`, `ai-kicker`, `ai-rules`, `ai-small`, `icon-ok`). If a class is missing, add it to the site stylesheet, never inline.

## Step 2: install the package
Add the 20 fragments as pages with the exact slugs, titles, descriptions and dates from `pages-json-aggiunte.json` (Italian at `/<slug>/`, English at `/en/<slug>/`). Put the files at exactly `/download/MiRT-Radar-2027.pdf`, `/download/mirt-radar-2027-anteprima.jpg` and `/download/guide/<name>.pdf`. Pages with a future date must already answer 200. Add everything to the sitemap.

## Step 3: create the three missing pages, Italian and English, same fragment format

**A. `/diagnosi/` (EN `/en/diagnosi/`)**, the conversion page.
- Kicker "Gratis · 30 minuti in videochiamata". Title "Diagnosi MiRT: da dove partire con l'AI nel tuo negozio". Lead: before the call we look at the store from outside (Google Business Profile, reviews, website, what ChatGPT, Gemini and Google AI Mode say about it); during the call we show the three places where AI saves time or wins customers, and what to fix before buying any tool.
- "Come funziona", three steps: you book; we look at the store from outside; 30 minutes together, written summary afterwards.
- "Chi la fa": Andrea Bertagnolio and Gianluca Falduto. Use the roles exactly as the site's Team page (/team/) states them: Andrea is Marketing Director and co-founder of Creattiva (founded in 2004 with Maria Roberta Castelli); Gianluca is Business Development. Do not call Gianluca a co-founder. Take bios and photos from that page. Do not invent facts.
- Booking: if a config value `BOOKING_URL` exists, embed it in an iframe that loads only after the visitor clicks "Scegli un orario"; otherwise show only the form.
- Form, same FormSubmit pattern as `content/radar.html`: nome, email, telefono, tipo di negozio (same datalist as the Radar form), città, "Cosa vorresti guardare per primo?" (optional textarea), privacy consent (required, link to the privacy page), honeypot `_honey`, `_subject` "Richiesta Diagnosi MiRT", `_template` table, hidden `language` and `source=diagnosi`, `_next` to the thank-you page. Do NOT rely on `_autoresponse`: FormSubmit's documentation states the auto-reply does not work for AJAX submissions, and this site submits every `form[data-ajax]` via fetch. The confirmation the visitor sees is the thank-you page / success block itself ("Ti scriviamo entro due giorni lavorativi"). Plus the tracking fields of Step 4.
- Four FAQ in `<details>`: is it really free; do I need to prepare anything; is it for a single store; what happens afterwards.
- No prices, no guarantees, no percentages.

**B. `/grazie/` (EN `/en/thank-you/`)**, the confirmation page for both forms.
- Title "Fatto". Variant chosen by query parameter `?da=radar` or `?da=diagnosi`, without inline scripts (use the site's existing script file or a CSS-only approach; default to the Radar variant).
- Radar variant: direct button to the PDF, one line "Un consiglio: parti dal trend 01, la prima mossa richiede dieci minuti", then a Diagnosi box with button to `/diagnosi/`.
- Diagnosi variant: "Ti scriviamo entro due giorni lavorativi", and the Radar PDF as something to read meanwhile.
- `noindex`.

**C. `/servizi/` (EN `/en/services/`)**, one page, four sections with anchors `#explore`, `#check`, `#watch`, `#act`, each 4 to 6 lines plus one line "Per chi è":
- MiRT Explore: AI Retail Tour and Academy, a day in Milan stores for a team (outdoor observation, indoor wrap-up with our researchers, research-based learning), with an AI track and the basic AI training the AI Act requires for staff using AI. Reuse the tour description already on this site. Button "Richiedi il programma" → `/contatti/?topic=explore`.
- MiRT Check: AI readiness check, where AI pays off in the store, with which tools, in what order.
- MiRT Watch: the observatory working for the store every day, monthly report, what AI assistants say about the store and its competitors.
- MiRT Act: AI agents for clienteling, content, review replies and sales data, always with a person checking the output.
- Closing block: Diagnosi box with button to `/diagnosi/`.

## Step 4: lead tracking, so no request is ever only an email

Today every form sends one email through FormSubmit. If that email is lost, the lead is lost, and nobody knows who owns it or what the next step is. Build a ledger with what the site already has. Do not add a database, a CRM or a framework.

**4a. Tracking fields on every form** (Radar, Diagnosi, and the existing contact form if it uses the same script):
- Hidden inputs `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `page` (the path of the page the form is on), `referrer`, `language`, `source` (radar / diagnosi / contatti). Fill them from the URL and `document.referrer` in the site's existing JS file, on page load. Never inline.
- Hidden `_webhook` with the Apps Script web app URL from config value `LEAD_WEBHOOK_URL` (FormSubmit posts a JSON copy of every submission there). If the value is empty, omit the field: the email path keeps working alone.
- Keep the honeypot, the privacy consent and the existing AJAX success/fail handling. The success message stays conditional on FormSubmit's accepted response; never show success on an error or a timeout, and disable the submit button while a request is in flight so a double click sends once.

**4b. The ledger: a Google Sheet filled by a Google Apps Script web app.** Write the script in `lead-tracking/Code.gs` with a `lead-tracking/README.md` that explains, click by click, how to create the sheet, paste the script, deploy it as a web app ("Anyone" can POST, runs as the sheet owner) and put its URL in `LEAD_WEBHOOK_URL`. The script:
- Accepts POST JSON from FormSubmit's webhook and, in the same `doPost`, a Calendly webhook payload (`invitee.created`, `invitee.canceled`) when present. Detect the shape, do not require both.
- Sheet `Richieste` (one row per request), columns in this order: `id_richiesta` (format `MIRT-YYYY-NNNN`, sequential, generated by the script), `id_contatto` (same value for the same lowercased email, looked up in sheet `Contatti`), `data_ora` (Europe/Rome), `source`, `page`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `referrer`, `language`, `nome`, `email`, `telefono`, `azienda_o_negozio`, `citta`, `messaggio`, `consenso_privacy` (true/false and timestamp), `stato`, `responsabile`, `prossima_azione`, `scadenza`, `note`.
- Sheet `Contatti`: `id_contatto`, `email`, `nome`, `prima_richiesta`, `ultima_richiesta`, `n_richieste`. A repeated email never blocks a new request: it gets a new `id_richiesta` and the same `id_contatto`. The one exception: an identical payload within 60 seconds (same email, same source, same message) is a double submit and is dropped.
- Defaults on insert: `stato` = `NUOVO`, `responsabile` = value of config `LEAD_OWNER` (default "Gianluca"), `prossima_azione` = "Rispondere con proposta di orari" for diagnosi, "Verificare che il PDF sia arrivato" for radar, `scadenza` = `data_ora` + 2 working days (Mon to Fri, Europe/Rome).
- Sheet `Stati` lists the allowed values of `stato` as a dropdown on the column: `NUOVO`, `DA_QUALIFICARE`, `QUALIFICATO`, `INCONTRO`, `ANALISI`, `PROPOSTA`, `PILOTA`, `CLIENTE`, and separately `NON_QUALIFICATO`, `IN_ATTESA_CLIENTE`, `PERSO`.
- Sheet `Prenotazioni`: one row per Calendly event (`id_evento`, `data_ora_prenotazione`, `data_ora_incontro`, `email`, `nome`, `stato` = PRENOTATO / CANCELLATO / SVOLTO, `id_contatto` if the email matches). A booking is not a request: it is linked to the contact, never merged into `Richieste`.
- Validation: email syntax, required fields per source, payload size limit, the honeypot field must be empty. Reject with 400 and log one line without personal data. No personal data in `Logger`.
- Return 200 only after the row is appended.
- A daily trigger (`controlloGiornaliero`) that emails `LEAD_OWNER` the list of rows with `scadenza` in the past and `stato` still `NUOVO` or `DA_QUALIFICARE`. The script never emails leads.

**4c. Bookings.** Document in the README both routes and mark which is available:
- Calendly: webhooks need a Calendly plan that includes the API (verify the current plan at calendly.com/pricing and write down what you find, with the date). If available, subscribe `invitee.created` and `invitee.canceled` to the web app URL.
- Google Calendar appointment schedule (Google Workspace): no webhook, but an Apps Script calendar trigger on the booking calendar can write the same `Prenotazioni` row. Provide that function too (`sincronizzaCalendario`), reading the next 60 days of events.
- Until one of the two is connected, the README states plainly that bookings are tracked by hand and gives the one-line manual procedure.

**4d. Tests, with synthetic data only** (`lead-tracking/test/`): a Node script that POSTs to a local stub of `doPost` (export the handler so it can run outside Apps Script with an in-memory sheet) and checks: valid Radar request appended with id and defaults; valid Diagnosi request; missing email rejected; invalid email rejected; honeypot filled rejected; repeated email gets a new request id and the same contact id; identical payload twice within 60 seconds appended once; UTM present kept; UTM absent leaves empty cells, not errors; Calendly `invitee.created` lands in `Prenotazioni` and links the contact; `scadenza` skips the weekend. In the browser (Playwright, Chromium is available): the Diagnosi form shows no success message when the endpoint returns 500, and sends once on a double click. Never use real names or emails in tests.

## Step 5: rewire the links
- Every link to `/contatti/?diagnosi` or `/en/contact-us/?diagnosi`, in the 20 fragments and anywhere else, becomes `/diagnosi/` or `/en/diagnosi/`. Keep `utm_*` parameters.
- Radar form: add hidden `_next` to the absolute URL of `/grazie/?da=radar` (EN `/en/thank-you/?da=radar`) and redirect there on AJAX success too. Keep the inline success message as fallback. The page must never promise an email with the PDF: the AJAX path gets no FormSubmit auto-reply (documented limit), so the PDF button on the success block and on /grazie/ is the delivery. `_autoresponse` may stay only as a courtesy for the no-JavaScript path.
- Add "Diagnosi" and "Servizi" to the main menu in both languages, "Guide gratuite" to the footer. Keep the rest of the menu as it is. If a tour page already exists, link it from the Explore section, do not delete it.
- CSP: if `form-action` or `connect-src` does not include `https://formsubmit.co`, add it; if `frame-src` does not include the booking host, add it. Say in the report exactly which directives you changed.

## Step 6: verify and report
1. Serve the site locally and check with a script that every URL answers 200 inside the site template: the 10 Italian slugs, their `/en/` versions, `/diagnosi/`, `/grazie/`, `/servizi/`, the 8 files in `/download/`.
2. Confirm no inline `<script>` or `style=` in the new pages, every form has the honeypot, the privacy link and the tracking fields, every page has title, meta description and `hreflang`.
3. Run the lead-tracking tests and paste the result in the report. State plainly which parts are verified (local tests), which are implemented but not verified (the live webhook, the real booking tool) and which are blocked (Calendly plan, `LEAD_WEBHOOK_URL` not yet deployed).
4. Screenshots of `/radar/`, `/diagnosi/`, `/servizi/` and one article, desktop and mobile, into `anteprime-funnel/`.
5. Report in English: what was added, every file changed, what still needs a human (`BOOKING_URL`, `LEAD_WEBHOOK_URL`, the sheet creation, FormSubmit confirmation if the new form subject asks for it on first send, deploy), and the exact deploy steps for this host.

Rules: Italian first, English translated by you with the same structure; no prices, no guarantees, no invented data; write "AI" never "IA"; keep the existing design, classes and scripts, no new frameworks, no databases, no inline code; secrets and URLs only in config values, never in the repo; commit per step with plain messages.
