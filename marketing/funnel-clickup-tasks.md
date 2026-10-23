# ClickUp tasks for finishing the funnel (ready to create)

Where: space **Quantum RE**, list **Marketing** (id 901223021056). This is the list that already holds "Remake website + Connect landing page", so the funnel work sits next to it.

Format copied from the P5 website list: one parent task with a code and an em dash ("WEB-BUILD — ..."), subtasks named "CODE-N · what". Funnel code: **FUN**. Statuses seen in the workspace: backlog, scoping, in development, in review, shipped. New tasks start in **backlog**. Dates are proposals: everything must be live before the book series starts on 18/11.

Not created yet: the ClickUp connector reached its daily limit of 100 calls while I was reading the existing tasks. It resets in about 18 hours. Until then, create the tasks by hand from this file, or tell me to create them tomorrow.

---

## PARENT

**Name:** FUNNEL — Finish the Quantum RE lead funnel: tracking, 48-hour answer, newsletter, test
**Priority:** High. **Due:** 2026-11-09. **Tags:** funnel, marketing, hubspot.

**Description:**
Goal: every request from a landing page is measured by network, answered within 48 hours and moved through a pipeline, and every subscriber receives a useful Sunday edition.

Landing pages (built): owner valuation, agent and referrer, nuda proprietà, buyer checklist, newsletter.

Done already: book series scheduled (23 posts), tracked links on 56 posts, strategy audit, pills 6, 10 and 14 scheduled.

Full reference with menu paths and checks: repository file `marketing/funnel-completion-checklist.md`, branch `claude/heygen-hyperframes-skill-x0xljg`.

Definition of done: the end-to-end test (FUN-13) passes on all four lead pages and the first Monday report lists requests by network.

---

## SUBTASKS

### FUN-1 · Send the five landing page addresses
**Owner:** Gianluca. **Due:** 2026-10-26. **Priority:** Urgent.
Paste the URLs of the owner, agent, nuda proprietà, checklist and newsletter pages into the chat with Claude.
**Done when:** Claude repeats them back and updates the link document.

### FUN-2 · Make every HubSpot form record the traffic source
**Owner:** Gianluca. **Due:** 2026-10-27. **Priority:** Urgent. **Depends on:** FUN-1.
1. Settings > Properties > Contact properties: create single-line text properties `utm_source`, `utm_medium`, `utm_campaign` if missing.
2. Marketing > Lead Capture > Forms: open each of the five forms.
3. Add the three properties as hidden fields (HubSpot fills a hidden field from the page address query parameter of the same name).
4. Save and publish.
**Done when:** a test submission on `PAGE?utm_source=test&utm_medium=test&utm_campaign=test` shows "test" in all three fields on the contact. Repeat for each page.

### FUN-3 · Thank-you page for each form
**Owner:** Gianluca. **Due:** 2026-10-28. **Depends on:** FUN-2.
1. Create five short pages saying what happens next. Owner and agent pages repeat the 48-hour promise.
2. In each form, Options > after submission > Redirect to another page.
**Done when:** each test submission lands on its own thank-you page.

### FUN-4 · Tracked links in the bios
**Owner:** Gianluca. **Due:** 2026-10-26. **Priority:** High.
TikTok: `OWNER_URL?utm_source=tiktok&utm_medium=bio`. Instagram: `OWNER_URL?utm_source=instagram&utm_medium=bio`. Linktree, if used: `utm_source=linktree&utm_medium=bio`, plus entries for the checklist and the newsletter page.
**Done when:** each link opens the right page from a phone.

### FUN-5 · Repoint the scheduled posts to the right page
**Owner:** Claude. **Due:** 2026-10-28. **Depends on:** FUN-1.
Book posts to the nuda proprietà page (`utm_campaign=libro`), Impegni scritti to the agent page (`impegni-scritti`), pills to the checklist (`pillole`), plan content to the owner page (`piano`), newsletter teasers to the newsletter page (`newsletter`).
**Done when:** Metricool and the calendar file agree, and a sample of ten posts reads back correctly.

### FUN-6 · Deal pipeline in HubSpot
**Owner:** Gianluca. **Due:** 2026-10-30.
Sales > Deals > Settings > Pipelines: create "Quantum RE sourcing" with stages Received, Verdict sent, Documents requested, Offer sent, Closed won, Closed lost. Add the contact property "Lead type": Owner, Agent, Nuda proprietà, Buyer, Subscriber.
**Done when:** a test deal moves across all stages.

### FUN-7 · Automatic first reaction (three workflows)
**Owner:** Gianluca. **Due:** 2026-10-30. **Depends on:** FUN-6.
1. Owner or agent form: set Lead type, create a deal at Received, notify Gianluca instantly, send a confirmation email that restates the 48-hour promise.
2. Nuda proprietà form: same, Lead type = Nuda proprietà.
3. Checklist or newsletter form: set Lead type, send the welcome email (FUN-10), no deal.
**Done when:** each test lead triggers the notification within two minutes and the deal appears in the right stage.

### FUN-8 · Approve and load the GO, WATCH and SCARTA reply templates
**Status: APPROVED on 23/10/2026 by Gianluca. Final text in `marketing/modelli-risposta-go-watch-scarta.md` (Italian). Remaining: paste into HubSpot Sales > Templates.**
**Owner:** Claude drafts, Gianluca approves. **Due:** 2026-10-30.
Drafts are in Appendix A of `marketing/funnel-completion-checklist.md`. After approval, paste them in HubSpot Sales > Templates.
**Done when:** three templates exist and each carries the AI note.

### FUN-9 · Name who answers and the daily screening time
**Owner:** Gianluca. **Due:** 2026-10-30.
Write one name and one time of day at the top of the pipeline description. The 48 hours start at submission.
**Done when:** the pipeline description shows both.

### FUN-10 · Welcome email and checklist PDF
**Owner:** Claude drafts, Gianluca approves. **Due:** 2026-11-04.
Welcome email: thanks, PDF link, what the Sunday edition contains, unsubscribe link. PDF "Before you sign" from pills 1, 6, 10, 13, 14 and 15, with the AI note and no investment language. Upload the PDF to HubSpot Files and attach it.
**Done when:** the welcome workflow sends an email with a working PDF link.

### FUN-11 · Authenticate the sending domain
**Owner:** Gianluca. **Due:** 2026-11-04.
Settings > Website > Domains & URLs > Connect a domain, choose email sending, add the CNAME records for DKIM and SPF at the DNS provider, add a DMARC TXT record on `_dmarc` with `v=DMARC1; p=none; rua=mailto:YOUR_EMAIL`.
**Done when:** HubSpot shows the domain verified and a test email to Gmail does not land in spam.

### FUN-12 · Legal minimum on every page and form
**Owner:** Gianluca. **Due:** 2026-11-06.
Unticked consent checkbox with a privacy link on each form. Privacy notice naming Quantum RE S.r.l. as controller. Cookie banner (Settings > Privacy & Consent). AI note on each page. Brand written "Quantum RE". No investment, return, capital, club deal or co-investment language.
**Done when:** each page passes a read-through on a phone against this list.

### FUN-13 · End-to-end test
**Owner:** Gianluca and Claude. **Due:** 2026-11-09. **Depends on:** FUN-2 to FUN-12.
Open a tracked link on a phone, submit the form, check the contact and `utm_source` in HubSpot, check the deal, the notification and the confirmation email, then move the deal through every stage. Delete the test contacts.
**Done when:** the owner, agent, nuda proprietà and checklist pages all pass.

### FUN-14 · First Monday report
**Owner:** Claude (scheduled). **Due:** 2026-10-26.
The weekly report runs Mondays at 07:50 and writes `marketing/report-settimanale/YYYY-MM-DD.md`. Requests by network appear once FUN-2 and FUN-4 are done.
**Done when:** the first report lists requests by source.

### FUN-15 · Top up HeyGen and produce pills 1, 13 and 15
**Owner:** Gianluca tops up, Claude produces. **Due:** 2026-11-06.
Wallet is at $1.05. Add at least $5 at HeyGen Settings > Billing. Claude then generates, edits, checks and schedules the pills for 22/11, 29/11 and 6/12 at 18:00.
**Done when:** the three pills are scheduled in Metricool.

### FUN-16 · Manual clean-up in the social apps
**Owner:** Gianluca. **Due:** 2026-11-13.
Correct the LinkedIn posts of 19/10 and 21/9, remove investment hashtags, clean the TikTok and Instagram profiles, check newsletter edition 37 for the bond comparison, delete the three "[CANCELLARE]" drafts in Metricool at 31/12 23:00. Details: `marketing/compliance-post-pubblicati-2026-10.md` and `marketing/da-fare-a-mano-2026-10.md`.
**Done when:** every item in those two files is ticked.

### FUN-17 · Decide on the promo videos of 23 and 24/10
**Status: DECIDED on 23/10/2026 by Gianluca: keep them public on all networks. Nothing to change in Metricool. Compare their results with the TikTok median (270 views) in the first weekly report.**
**Owner:** Gianluca. **Due:** 2026-10-23. **Priority:** Urgent.
Keep them on all networks, or move TikTok, Instagram and YouTube to draft. Data: brand promos have a TikTok median of 264 views and zero shares.
**Done when:** Gianluca answers yes or no in the task comments.

### FUN-18 · Watch the first book video in full
**Owner:** Gianluca. **Due:** 2026-11-16.
It publishes automatically on 18/11 at 10:00. File: `videos/libro-nuda-proprieta-9x16/renders/libro-1-A-9x16.mp4`.
**Done when:** Gianluca confirms in a comment.
