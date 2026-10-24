# MiRT funnel: what is done and what is next (as of 24 October 2026, 09:30 Rome)

## Where we are

The content side is finished. What is missing is on the website: nothing is online yet, and the first scheduled post points to it on 26 October.

| Area | Done | Where |
|---|---|---|
| Editorial plan | 8 weekly themes 26/10 to 14/12, plus a proposal for Jan to Mar 2027 | `ricerca/2026-10-23-ricerca-settimanale.md` |
| Social posts | All posts scheduled in Metricool on Instagram, Facebook, LinkedIn, TikTok, YouTube. One CTA per caption | `social/` |
| Videos | 17 HeyGen videos with Andrea's avatar and voice, two versions each (comment end card / link-in-bio end card), subtitled | scripts in `social/heygen/copioni-andrea.md` |
| Free PDFs | MiRT Radar 2027 + 3 guides IT + 3 EN (keywords AI, COMMESSO, FLAGSHIP, RADAR) | `sito/download/` |
| Comment-to-DM playbook | Keywords, DM texts IT/EN, who answers per network, 24-hour rule | `guide/COMMENTA-E-RICEVI.md` |
| Website pages, built | Radar landing, guides hub `/guide/`, 8 articles, IT + EN, in the site's fragment format | `sito/content/` |
| Publication package | Zip for the host manager with instructions | `sito/ISTRUZIONI-PUBBLICAZIONE.md` |
| Pronunciation fix, prepared | Respelled scripts for 9 videos, one command regenerates | pending HeyGen credits |
| Automation | Weekly research every Thursday; site check Saturday 24/10; poll reminder 28/11 | scheduled tasks |

## This week, before the first post on 26 October

Step 1. Get the package online (host manager), by 24/10
1. Send `pacchetto-sito-mirt.zip` with `Istruzioni-pubblicazione-MiRT.pdf` to whoever manages milanoretailtour.com. Publish everything at once.
2. Minimum for 26/10: `/radar/`, `/en/radar/`, `/guide/`, `/en/guide/`, `/cliente-chiede-ai-dove-comprare/`, the Radar PDF and the 6 guide PDFs in `/download/`.
3. Check `/radar/` and `/download/MiRT-Radar-2027.pdf` load with the site template. Today both are 404.
4. Test the Radar form: auto-reply with PDF link + notification to info@milanoretailtour.com.

Step 2. Build the three missing funnel pages (VS Code + Claude Code), by 25/10
- `/diagnosi/` (EN `/en/diagnosi/`): conversion page. Kicker "Gratis, 30 minuti in videochiamata"; what we look at before the call (Google Business Profile, reviews, website, what ChatGPT, Gemini and Google AI Mode say about the store); 3 steps "Come funziona"; who runs it (Andrea and Gianluca); booking embed via BOOKING_URL or a FormSubmit request form; 4 FAQ. No prices or guarantees.
- `/grazie/` (EN `/en/thank-you/`): confirmation after the Radar form and the Diagnosi request; direct PDF link; Diagnosi button; noindex.
- `/servizi/` (EN `/en/services/`): one page, four anchors: MiRT Explore (AI Retail Tour + Academy), MiRT Check (AI readiness check), MiRT Watch (monthly observatory report), MiRT Act (AI agents with human review). Closing Diagnosi box.
- Repoint every `/contatti/?diagnosi` link to `/diagnosi/`; add Diagnosi and Servizi to the menu, Guide gratuite to the footer.

Step 3. Choose the booking tool for the Diagnosi (Calendly or Google appointment schedule), create the 30-minute event, set BOOKING_URL. By 25/10.

Step 3b. Lead tracking (built by the same prompt, `PROMPT-FUNNEL.md` step 4), by 25/10
- Hidden tracking fields on every form (source page, UTM, referrer, language) + FormSubmit webhook to a Google Apps Script.
- Google Sheet ledger: one row per request (id MIRT-2026-NNNN, contact id, timestamp, source, UTM, data, consent, status NUOVO, owner, next action, deadline +2 working days); repeated email = new request, same contact; double click within 60 s dropped.
- Statuses: NUOVO, DA_QUALIFICARE, QUALIFICATO, INCONTRO, ANALISI, PROPOSTA, PILOTA, CLIENTE; NON_QUALIFICATO, IN_ATTESA_CLIENTE, PERSO.
- Bookings in a separate sheet (Calendly webhook if the plan allows, else Google Calendar appointment schedule); a booking is never confused with a click.
- Daily script emails the owner the overdue NUOVO requests. Tests with synthetic data only.
- Human steps after the prompt: create the sheet, deploy the script, set LEAD_WEBHOOK_URL, check the Calendly plan.

Step 4. Decide who answers the comments, by 26/10
- Instagram and Facebook: ManyChat Pro with the four keywords, or a named person replying from the Metricool inbox within 24 hours.
- LinkedIn: manual public reply with the link (company pages cannot DM).
- TikTok and YouTube: nothing to answer; pin "Le guide gratuite sono nel link in bio".

Step 5. Update the bios (Instagram, TikTok, YouTube, LinkedIn) with https://www.milanoretailtour.com/guide/ once live.

Step 6. Saturday 24/10 10:00, automatic: site check; schedule opening post V0 if live, otherwise apply fallback captions.

## Next two weeks

Step 7. Pronunciation redo, by 1/11: top up HeyGen API wallet (~1,000 credits for 9 videos; balance 63); regenerate; replace videos in 18 Metricool posts.

Step 8. Approve the January to March 2027 cycle, by 30/11: 11/1 Saldi 2027; 18/1 NRF 2027 (dates to verify); 25/1 Vicenzaoro / jewellery; 1/2 460k empty shops; 8/2 MIDO; 15/2 Reviews (new keyword RECENSIONI); 22/2 EuroCIS; 1/3 independent bookshops.

## Weekly routine, 26 October to 14 December

| Day | What happens | Who |
|---|---|---|
| Sunday | Article of the week goes live. Check the URL. | Host manager, client checks |
| Mon to Fri | Posts and videos go out from Metricool. | Automatic |
| Every day | Reply to keyword comments within 24 h; reply to Diagnosi requests within 2 working days. | Client or named person |
| Thursday 8:58 | Weekly research delivered. | Automatic |
| Friday | Note comments, PDFs sent, Diagnosi requests. | Client |
| 28 November | Poll reminder; post 21 (11/12) is written from the results. | Automatic, then Claude |

## ClickUp structure (space Creattiva)

List "MilanoRetailTour website", parent task "MiRT funnel go-live":
1 CLIENT Send the package to the host manager (24/10) · 2 BROWSER Check the site answers (24/10) · 3 BROWSER Test the Radar form (24/10) · 4 LAPTOP Build Diagnosi, Grazie, Servizi + lead tracking with PROMPT-FUNNEL.md (25/10) · 5 BROWSER Create the lead sheet, deploy the Apps Script, set LEAD_WEBHOOK_URL (25/10) · 6 BROWSER Create the Diagnosi booking event, set BOOKING_URL, check Calendly webhooks (25/10) · 7 PHONE Update the bios (26/10). Each subtask waits on the previous one.

List "Marketing MilanoRetailTour", parent task "MiRT Radar 2027 campaign":
1 DECISION Who answers the comments (26/10) · 2 BROWSER Top up HeyGen wallet (1/11) · 3 CLAUDE Regenerate 9 videos, update 18 posts (2/11) · 4 DECISION Approve Jan-Mar 2027 cycle (30/11) · 5 recurring Weekly routine (every Friday to 14/12) · 6 CLAUDE Poll results and post 21 (28/11).
