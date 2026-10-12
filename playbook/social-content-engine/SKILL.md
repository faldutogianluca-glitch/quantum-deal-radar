---
name: social-content-engine
description: End-to-end social content system for a company and its founder. It covers brand capture, AI promo videos, an interview that builds a story bank, a multi-week editorial plan, posts, carousels and images, an approval page, cross-posting to LinkedIn, Instagram, Facebook, TikTok and YouTube, and scheduling in Metricool. Use it when someone asks to "do our social media", "make a promo video and the posts", "plan and schedule LinkedIn", or to repeat this setup for another company.
---

# Social Content Engine

This playbook takes a company website and turns it into a few weeks of approved, scheduled
content on five channels. It was built on a real engagement and reuses everything that
worked there. It also records the mistakes made there, so they are not repeated.

Work through the phases in order. Every phase ends with something the owner approves.
**Nothing goes live without an explicit approval.**

---

## 0. Config: fill this in before anything else

Ask for anything missing in one short round of questions. Never guess compliance rules.

```yaml
company:        # legal/brand name
website:        # main URL (if the sandbox proxy blocks it, ask for screenshots)
owner:          # the person who signs and approves, and the face of the content
language:       # language of all published content
audiences:      # e.g. "partners who refer properties", "B2B buyers", "homeowners"
offer_cta_url:  # the single page every post points to (form, booking, valuation…)
channels:       # subset of: linkedin, instagram, facebook, tiktok, youtube
cadence:        # default 3 LinkedIn posts/week (Tue/Wed/Thu), cross-posts at 18:15
timezone:       # IANA, e.g. Europe/Rome
brand:          # colors (hex), fonts, logo file, tone of voice
ai_disclosure:  # exact sentence, e.g. "Content generated with AI under the supervision of <owner>."
compliance:     # sector rules, e.g. finance: no invitation to invest, no returns,
                # no "capital/co-investment"; health: no claims; legal: disclaimers…
off_limits:     # people, clients, numbers, places that must never appear
scheduler:      # Metricool blogId (getBrandSettings) and the connected networks
media_host:     # where the scheduler fetches media from: a public URL per file
                # (public GitHub raw, CDN, Drive). See rule 9.
```

---

## 1. Golden rules (each one comes from a real mistake)

1. **Approve before anything is published.** Create scheduler items as `draft: true`. Switch them to
   `draft: false` only after the owner says yes. Show new images and videos **before**
   attaching them to scheduled posts.
2. **Never invent facts.** No made-up numbers, clients or stories. If something is missing, ask, or
   leave a `{{placeholder}}` that blocks scheduling. Flag in the draft anything you inferred
   (for example "you never said this is your #1 priority").
3. **Compliance before style.** Re-read every text against `compliance`. In regulated sectors a
   promo aimed at "investors" can count as public solicitation: rewrite it as a "method" piece,
   and add a disclaimer line to every post on that theme.
4. **The AI disclosure goes everywhere.** Put the `ai_disclosure` sentence in every text and on the
   end card of every video. Also set the platform labels: Instagram `isAiGenerated`,
   TikTok `isAigc`, YouTube `isAiGeneratedContent`.
5. **One CTA per post, adapted to the channel.** LinkedIn: a CTA sentence plus the link in the
   **first comment**, because links in the text cut reach. Instagram and TikTok: "link in bio"
   plus the bare domain (make sure the owner has set the bio link). Facebook and YouTube: the URL
   in the text.
6. **Privacy.** No street addresses. Nothing that identifies third parties (former owners,
   tenants, clients). Name a person only with their permission. Personal stories stay in a
   private story bank.
7. **Stay in the owner's voice.** Keep their vivid phrases verbatim. If a phrase clashes with
   compliance or tone (for example "I win big" in a story about someone who lost their home),
   soften it, say so, and offer the original.
8. **One question at a time** in interviews. Press a vague answer once, never twice.
9. **Hosting conflict.** Schedulers need public media URLs, but the story bank must stay private.
   Keep media in a public bucket or repo, and keep the story bank and drafts in a private
   repo or gitignored.
10. **Commit and push after every step.** The calendar JSON is the single source of truth.

---

## 2. Phases

### A. Brand and brief
- Capture the site: colors, fonts, logo (as SVG if possible) and tone. If the domain is blocked,
  work from screenshots the owner sends.
- Write a `BRIEF.md`: audiences, the one promise, proof points (only real ones), CTA, compliance.
- Choose a palette and check its contrast. For example, an accent orange needs a darker shade on
  white than on navy.

### B. Promo videos (HyperFrames skills: `/hyperframes` → `product-launch-video`)
- Formats: **4:5, ~45s** for LinkedIn and **9:16, ~25s** for TikTok, Reels and Shorts.
  No voiceover, so pace the reveals for reading time.
- Flow: storyboard (`STORYBOARD.md`) → owner approves → animate → `npx hyperframes check` →
  render. Reuse the 4:5 storyboard to make the 9:16 version.
- If the sandbox blocks CDNs, vendor the fonts (`@fontsource` woff2) and GSAP from npm.
  Composition ids must not start with a digit.
- The end card carries the logo, the URL, the `ai_disclosure` and, if regulated, a line such as
  "Informational communication, not an offer of financial products."
- Make one video per audience. If one audience is regulated (investors), turn it into a neutral
  "our method" video.

### C. Interview and story bank (`linkedin-interviewer`)
- Ask one question at a time. Each answer needs a moment (scene and date), a number, a reversal
  or mistake, and a position someone would disagree with.
- Ask for 4 to 6 real stories: origin, a deal you are proud of, a deal you turned down, a mistake
  and its lesson, someone to thank (with their permission), a family or craft background.
- Record every story in `story-bank.md`: verbatim quotes, what is free to name, what is off
  limits. Never re-ask something already answered.
- Each story is used **once**. If two planned posts would tell the same story, swap the topic or
  make the second one "part 2".

### D. Editorial plan (4 weeks, then repeat)
| Pillar | Share | Examples |
|---|---|---|
| Authority (method, market, explainers) | ~40% | carousels, "N red flags in…", how we evaluate |
| Personal story | ~25% | interview stories |
| Community | ~15-20% | polls, thank-you posts with a tag |
| Offer / CTA-led | ≤1 per week | video, "what happens after you contact us" |

- Post at 08:15 on Tuesday and Thursday and 12:45 on Wednesday. Cross-posts go out at 18:15 the
  same day.
- No hook formula twice in the same week. Vary the goal: comments, saves, shares.
- Check every week that each week has authority and a personal post, that offers stay at one or
  fewer, that no pillar goes above 60%, and that every placeholder is filled.

### E. Production
**Text posts.** Short paragraphs. Open with a hook, then the scene, a number, the lesson, a
question to readers, the CTA, the AI disclosure and 3 hashtags (5 to 7 on Instagram). No em
dashes and no AI-sounding filler words. Aim for about 900-1,700 characters.

**Carousels.** Use `scripts/carousel-template.html`: 1080×1350 slides with a cover, an explainer,
one slide per point (each with a "where to look" box), a method or summary slide, and a CTA slide
with the disclaimers. Render them with `scripts/render-carousel.cjs`, which outputs a PDF, one PNG
per slide and an overlap report. Fix every OVERLAP line, then look at a contact sheet before
showing it to the owner.

**Images for text posts.** Use `scripts/image-template.html`, 1080×1350: an eyebrow, a two-line
headline with an accent, and 3-4 cards. Position the cards after `document.fonts.ready` so a
wrapped headline cannot overlap them. Render with `scripts/render-images.cjs`.

**Polls** (LinkedIn only). The question can be up to 140 characters, with 2-4 options of up to 30
characters each. They run for 7 days.

**Social versions.** Run `scripts/to_social_jpg.py` to produce JPG files at exactly 1080×1350.
Instagram rejects anything taller than 4:5, and Instagram and TikTok photo posts need JPEG.

### F. Approval page
Publish one preview page (an Artifact with a `db` collection `approvazioni`, with each doc holding
`{stato, nota, quando}`). It shows each post the way the feed will show it: text with "…more",
image or carousel or video, first comment, channel badges, and filters per channel plus a
"new to approve" filter. Each post has two buttons: **Approve** and **Request a change** (with a
note). The status labels are: to review, approved, change requested, change made and awaiting
re-approval. Read the db before scheduling. Mark placeholders "waiting for interview", with no
buttons.

### G. Cross-posting matrix
| Source | Instagram | Facebook | TikTok | YouTube |
|---|---|---|---|---|
| 9:16 video | Reel | Reel | video | Short (title, madeForKids=false) |
| 4:5 video | stays on LinkedIn | stays on LinkedIn | no | no |
| Carousel | carousel (JPG) | multi-photo post | photo carousel (JPG, title ≤90) | no |
| Image post | post (JPG) | post | no | no |
| Poll | no | no | no | no |

Each channel gets its own caption: a shorter text, the CTA from rule 5, and its own hashtags.

### H. Scheduling with Metricool (MCP)
- Run `getBrandSettings` to get the blogId, timezone and connected networks, then
  `getScheduledPosts` to audit what is already there.
- `createScheduledPost(blogId, date, info)`. `info` always includes `providers`, `publicationDate`
  `{dateTime, timezone}`, `text`, `media` (public URLs), `draft`, `autoPublish: true`, and the data
  block for each network:
  - LinkedIn: `linkedinData {type:"post"}`. For a document (carousel), send the slide PNGs as media
    with `documentTitle` and `publishImagesAsPDF: true`. For a poll, use
    `type:"poll", poll:{question, options:[{text}], settings:{duration:"SEVEN_DAYS"}}`.
    The link goes in `firstCommentText`.
  - Instagram: `instagramData {type:"POST"|"REEL", isAiGenerated:true}`.
  - Facebook: `facebookData {type:"POST"|"REEL"}`.
  - TikTok: `tiktokData {privacyOption:"PUBLIC_TO_EVERYONE", commercialContentOwnBrand:true, title, isAigc:true}`.
  - YouTube: `youtubeData {title, type:"short", privacy:"public", madeForKids:false, category, isAiGeneratedContent:true}`.
- One post can carry several providers when they share the same media and text, for example
  Instagram, Facebook and TikTok for a carousel.
- `updateScheduledPost(id, uuid, info)` needs the **full** payload every time. It returns a
  **new id**, while the uuid stays the same. Write the new id back to the calendar.
- Media is re-hosted by Metricool when you create or update a post. Make sure the public URLs
  return 200 first.
- Write the payloads to files with a script and send them in small batches. Then record every
  id and uuid.

### I. After launch
- Reply to every comment within the first hour.
- Each week, collect new stories, then plan and approve the next 4 weeks.
- Re-run the audit: anything scheduled but not approved, missing CTA, missing disclosure,
  compliance words.

---

## 3. Kickoff prompt (paste into a new chat)

> You are my social content team for **<company>** (<website>). Follow the "Social Content
> Engine" playbook (pasted below / installed as a skill). Start with the Config: ask me for
> anything missing, in one short list. Then go phase by phase, and wait for my approval at the
> end of each phase. Rules: nothing gets published without my approval, never invent facts,
> respect compliance <rules>, put this AI disclosure in every piece: "<sentence>", and point
> every post to <cta_url>. Publish through Metricool (brand <name>).

---

## 4. Files in this folder
- `scripts/render-carousel.cjs`: carousel HTML to PDF, slide PNGs and an overlap report.
- `scripts/render-images.cjs`: image post HTML to PNG.
- `scripts/to_social_jpg.py`: PNG to JPG at 1080×1350 for Instagram, Facebook and TikTok.
- `scripts/carousel-template.html`, `scripts/image-template.html`: branded templates. Change the
  `:root` colors, the `@font-face` files and the logo.
- `scripts/calendar-example.json`: schema of the calendar, the single source of truth.
