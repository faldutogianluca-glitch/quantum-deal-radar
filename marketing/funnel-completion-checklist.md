# Finishing the Quantum RE funnel: step by step

Status on 23/10/2026. The landing pages are built. This document covers everything between "a visitor clicks" and "a deal is closed or a lead is lost". Do the steps in order: each one depends on the one before it.

Legend: **You** = needs your hands in HubSpot, DNS, HeyGen or the social apps. **Me** = Claude does it once the input arrives. **Check** = how you know the step is done.

Placeholders to fill in once, then reuse everywhere:

- `{{URL_OWNER}}` owner valuation page
- `{{URL_AGENT}}` agent and referrer page
- `{{URL_NUDA}}` nuda proprietà page
- `{{URL_CHECKLIST}}` buyer checklist page
- `{{URL_NEWSLETTER}}` newsletter signup page

---

## Phase 1. Measure (do this first, nothing else works without it)

### Step 1. Send me the five page addresses (You, 2 min)
Paste the five URLs above in the chat.
**Check:** I repeat them back and update `marketing/link-tracciati.md`.

### Step 2. Make every HubSpot form record where the visitor came from (You, 30 min)
For each of the five forms:
1. Go to Settings > Properties > Contact properties. Create three single-line text properties if they do not exist: `utm_source`, `utm_medium`, `utm_campaign`.
2. Open Marketing > Lead Capture > Forms, open the form, and add those three properties as **hidden fields**. HubSpot fills a hidden field automatically when the page address carries a query parameter with the same name.
3. Save and publish the form.

**Check:** open `{{URL_OWNER}}?utm_source=test&utm_medium=test&utm_campaign=test`, submit a fake lead with your own email, then open the contact in HubSpot. The three fields must read "test".
Repeat the check once per page.

### Step 3. Create one thank-you page per form (You, 45 min)
1. Create five short pages (HubSpot Content > Landing pages or Website pages), each saying what happens next and when. Owner and agent pages repeat the 48-hour promise.
2. In each form, open Options > "What should happen after a visitor submits this form" and choose **Redirect to another page**, pointing to its thank-you page.

**Check:** submitting a test form lands on the thank-you page. This also lets HubSpot count conversions per page.

### Step 4. Paste the tracked links in the bios (You, 5 min)
- TikTok bio: `{{URL_OWNER}}?utm_source=tiktok&utm_medium=bio`
- Instagram bio: `{{URL_OWNER}}?utm_source=instagram&utm_medium=bio`
- Linktree, if used: `{{URL_OWNER}}?utm_source=linktree&utm_medium=bio`
- Add the other links as extra Linktree entries: `{{URL_CHECKLIST}}` and `{{URL_NEWSLETTER}}` with `utm_source=linktree&utm_medium=bio`.

**Check:** tap each link from your phone and confirm the page opens.

### Step 5. Repoint the scheduled posts to the right page (Me, 30 min, needs Step 1)
Each series gets its own destination:

| Series | Goes to |
|---|---|
| Book videos and posts | `{{URL_NUDA}}` with `utm_campaign=libro` |
| Impegni scritti | `{{URL_AGENT}}` with `utm_campaign=impegni-scritti` |
| La casa in pillole | `{{URL_CHECKLIST}}` with `utm_campaign=pillole` |
| Plan content and market posts | `{{URL_OWNER}}` with `utm_campaign=piano` |
| Newsletter teasers | `{{URL_NEWSLETTER}}` with `utm_campaign=newsletter` |

I update Metricool, the calendar file and the link document, then reread Metricool to confirm.
**Check:** a sample of 10 posts read back with the right address.

---

## Phase 2. Answer (every request must get a reply inside 48 hours)

### Step 6. Build the deal pipeline in HubSpot (You, 20 min)
1. Go to Sales > Deals > Settings > Pipelines and create a pipeline named "Quantum RE sourcing".
2. Stages, in order: **Received, Verdict sent, Documents requested, Offer sent, Closed won, Closed lost**.
3. Add a contact property "Lead type" (dropdown): Owner, Agent, Nuda proprietà, Buyer, Subscriber.

**Check:** you can create a test deal and drag it across the stages.

### Step 7. Automate the first reaction (You, 1 hour)
In Automation > Workflows, create three workflows:
1. **Owner or agent form submitted:** set Lead type, create a deal at "Received", send you an instant notification (email and mobile), send the visitor a confirmation email that restates the 48-hour promise.
2. **Nuda proprietà form submitted:** same, with Lead type = Nuda proprietà.
3. **Checklist or newsletter form submitted:** set Lead type, send the welcome email (Step 10), no deal.

**Check:** submit a test lead through each form. The notification reaches you in under two minutes and the deal appears in the right stage.

### Step 8. Approve the three reply templates (Me to draft, You to approve, 15 min)
Drafts are in Appendix A. Read them, change what you want, and tell me "approved". Then paste them into HubSpot as templates (Sales > Templates).
**Check:** each template exists in HubSpot and carries the AI note.

### Step 9. Fix who answers and by when (You, 10 min)
Write down one person who reads the notification, and the daily time when requests are screened. The 48 hours start at submission, so a request that arrives on Friday evening is answered by Sunday evening.
**Check:** the name and the time are written at the top of the pipeline description in HubSpot.

---

## Phase 3. Keep in touch (newsletter and checklist)

### Step 10. Write the welcome email and build the checklist PDF (Me to draft, You to approve, 1 hour)
- Welcome email: thanks, the PDF link, what Sunday's edition contains, and the unsubscribe link.
- Checklist PDF, "Before you sign": built from pills 1, 6, 10, 13, 14 and 15, with the AI note and no investment language.
- I produce both. You review them, then upload the PDF to HubSpot Files and attach it to the email.

**Check:** the welcome workflow from Step 7 sends the email with a working PDF link.

### Step 11. Authenticate your sending domain (You, 30 min, plus DNS wait)
1. In HubSpot go to Settings > Website > Domains & URLs > Connect a domain, then choose email sending.
2. HubSpot gives you DNS records (CNAME records for DKIM and SPF). Add them at your DNS provider.
3. Add a DMARC record at your DNS provider: a TXT record named `_dmarc` with the value `v=DMARC1; p=none; rua=mailto:YOUR_EMAIL`.

**Check:** HubSpot shows the domain as verified. Send a test email to a Gmail address and confirm it does not land in spam.

### Step 12. Legal minimum on every page and form (You, 30 min)
- A consent checkbox on every form, not pre-ticked, with a link to the privacy notice.
- The privacy notice names Quantum RE S.r.l. as data controller and says what you do with the data.
- A cookie banner, because HubSpot tracking sets cookies (Settings > Privacy & Consent).
- The AI note on each page: "Contenuto generato con AI sotto la supervisione di Gianluca Falduto."
- The brand is written "Quantum RE", and there is no language about investing, returns, capital, club deals or co-investment.

**Check:** read each page once on your phone against this list.

---

## Phase 4. Prove it works

### Step 13. Run the end-to-end test (You and Me, 30 min)
1. Open a tracked link from a post or bio on your phone.
2. Submit the form with a test email.
3. Confirm in HubSpot: the contact exists, `utm_source` is right, a deal exists, you were notified.
4. Confirm the visitor received the confirmation email and it did not go to spam.
5. Move the test deal through every stage.

**Check:** all five points pass for the owner, agent, nuda proprietà and checklist pages. Delete the test contacts afterwards.

### Step 14. Read the first Monday report (Me, automatic)
On Monday 26/10 at 07:50 the report runs. From then on it counts requests by network in HubSpot, once Steps 2 to 4 are done.
**Check:** the file `marketing/report-settimanale/2026-10-26.md` exists and lists requests by source.

---

## Phase 5. Content tasks that are still open

| Step | Task | Who | Needs |
|---|---|---|---|
| 15 | Top up the HeyGen wallet (now $1.05) with at least $5 at Settings > Billing. Tell me, and I generate, edit, check and schedule pills 1, 13 and 15 for 22/11, 29/11 and 6/12 at 18:00. | You, then Me | Wallet balance |
| 16 | Decide whether the promo videos of 23 and 24/10 stay public on all networks or go to draft on TikTok, Instagram and YouTube. | You | A yes or no |
| 17 | Watch the first book video in full before 18/11, the day it publishes automatically. | You | None |
| 18 | Correct the two LinkedIn posts (19/10 and 21/9), remove the investment hashtags, and clean up the TikTok and Instagram profiles. Text and links are in `marketing/compliance-post-pubblicati-2026-10.md`. | You | None |
| 19 | Check newsletter edition 37 for the same bond comparison. | You | None |
| 20 | Delete the three drafts marked "[CANCELLARE]" at 31/12 23:00 in the Metricool planner. | You | None |

---

## Appendix A. Reply templates (drafts, to approve in Step 8)

Replace the fields in double braces before sending. The numbers in a verdict always come from the screening, never from this template.

### GO
> Subject: Your property: GO, next step documents
>
> Hello {{first name}},
>
> We reviewed the property you sent. Our verdict is GO. The reasoning in short: {{two lines with the numbers behind it}}.
>
> To value it properly we need: {{document list}}. Within 7 to 10 days of receiving them we send a written binding offer.
>
> Contenuto generato con AI sotto la supervisione di Gianluca Falduto.
>
> Quantum RE

### WATCH
> Subject: Your property: WATCH, what would change our answer
>
> Hello {{first name}},
>
> We reviewed the property you sent. Our verdict is WATCH: it is not a yes yet. What holds it back: {{reason with the numbers}}. It would become a GO if {{condition, for example a price or a document}}.
>
> If that changes, write to us and we answer again within 48 hours.
>
> Contenuto generato con AI sotto la supervisione di Gianluca Falduto.
>
> Quantum RE

### SCARTA
> Subject: Your property: our answer
>
> Hello {{first name}},
>
> We reviewed the property you sent. Our answer is no, for this reason: {{reason with the numbers}}. At {{price}} it would become interesting for us.
>
> Thank you for sending it. If you have another one, we answer within 48 hours again.
>
> Contenuto generato con AI sotto la supervisione di Gianluca Falduto.
>
> Quantum RE

## Appendix B. What is already finished

- Book series: 23 posts scheduled from 18/11 to 18/12, 12 videos rendered with subtitles, carousel and image ready.
- TikTok pills 6, 10 and 14 scheduled. Pills 1, 13 and 15 have approved scripts and built editing.
- Strategy review and audit of all 125 Metricool posts against the calendar.
- Tracked links on 56 posts, tracked-link convention documented.
- Reminders set: weekly Monday report, 14/11 style test, 20/11 book video check, 22/12 book balance.
- Landing pages built by you.
