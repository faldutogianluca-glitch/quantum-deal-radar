# Prompt per Claude Code (VS Code): costruire il nuovo sito Milano Retail Tour

Copia tutto il blocco qui sotto in Claude Code con il repo `quantum-deal-radar` aperto sul branch `claude/milano-retail-tour-editorial-3m3toj`.

---

# Build the new Milano Retail Tour website (MiRT)

Build a complete, production-ready static website for **Milano Retail Tour** (brand "MiRT"), in a new folder `milano-retail-tour/sito-nuovo/` of this repo. Work in phases, commit at the end of each phase, and at the end give me a build that I can upload to any static host (plain HTML/CSS/JS in a `dist/` folder, no server code: the current host is IIS, and I may move to Cloudflare Pages or Netlify).

Read these before writing anything:
- `milano-retail-tour/PASSAGGIO-SESSIONE.md` (project state, decisions, IDs)
- `milano-retail-tour/brand-kit/README.md` and `brand-kit/brand-tokens.json` (colors, fonts, voice)
- `milano-retail-tour/sito/content/*.html` (20 existing page fragments, IT + EN: the Radar landing, the guides hub, 8 articles; the EN files start with `en__`)
- `milano-retail-tour/sito/pages-json-aggiunte.json` (slug, SEO title, meta description, language, date of each existing page)
- `milano-retail-tour/radar/contenuto.json` (the 10 trends of the Radar, with sources)
- `milano-retail-tour/guide/contenuto.mjs` (content of the 3 free guides)
- `milano-retail-tour/guide/COMMENTA-E-RICEVI.md` (how the lead-magnet funnel works on social)
- `milano-retail-tour/ricerca/2026-10-23-ricerca-settimanale.md` (latest research, proposed 2027 cycle)
- the current public site https://www.milanoretailtour.com (fetch the home, /contatti/, the tour pages and the clients page: reuse the real company facts, client logos list, tour description and contacts; do not invent anything about the company)

## 1. Who we are, what the site must do

Milano Retail Tour is an observatory on specialist retail, co-owned by **Gianluca Falduto** and **Andrea Bertagnolio** (co-founders of Creattiva S.r.l., Milan). For 10+ years it has run retail tours in Milan for brands and retailers (Leroy Merlin, IKEA, Rolex dealers, Timberland, Philips, L'Oréal Luxe, Gobbi 1842, Sanofi, and more: take the real list and stories from the current site, page /clienti/). Since 2026 the positioning is: **"L'osservatorio che implementa. Prima il retail, poi l'AI."** We help specialist stores (ottici, profumerie, gioiellerie, librerie, ferramenta, arredo, sport, food) use AI only where it pays, always with a person in control.

Audience: Italian owners and managers of specialist stores, one or more points of sale, plus retail managers of brands. Italian is the main language; English is a secondary full version.

The site is the landing point of a social funnel that is already running (posts on LinkedIn, Instagram, Facebook, TikTok, YouTube from 26/10/2026):

```
social post / video
  → free PDF (MiRT Radar 2027, or one of 3 guides)      [pages: /radar/, /guide/]
  → Diagnosi MiRT: free 30-minute video call           [page: /diagnosi/]
  → four services: Explore, Check, Watch, Act          [pages: /servizi/, /servizi/<name>/]
```

Every page must push one step down this funnel, never two steps at once. One primary call to action per page.

## 2. Pages (all in IT at `/…/` and EN at `/en/…/`)

| Route (IT) | Purpose | Primary CTA |
|---|---|---|
| `/` | Home: who we are in one sentence, the four services, latest 3 articles, client logos, the Radar box, "Prenota la Diagnosi" | Diagnosi |
| `/radar/` | Lead magnet landing: reuse `sito/content/radar.html` content as-is (copy, form, FAQ, 10 trends). Form → FormSubmit (see §5) → `/grazie/` | Get the Radar |
| `/grazie/` | Thank-you after the Radar form: direct PDF link, "one thing to do this week", Diagnosi button. Separate URL so conversions can be measured | Diagnosi |
| `/guide/` | Hub of the 4 free PDFs (reuse `sito/content/guide.html`). This is the "link in bio" for TikTok, YouTube, Instagram | Download |
| `/diagnosi/` | **The conversion page.** What the 30 minutes are; what we check before the call (Google profile, reviews, website, what ChatGPT/Gemini/Google AI say about the store); the 3 outputs; who runs it (Andrea + Gianluca, short bios, photos from the current site); a booking embed (see §5) plus a short fallback form; 4 FAQ; no price, it's free | Book |
| `/servizi/` | The four services on one page, each with a 3-line summary and a link | Diagnosi |
| `/servizi/explore/` | **MiRT Explore**: AI Retail Tour + Academy. A day in Milan stores for a team (outdoor: observe stores like an ethnographer; indoor: wrap-up with our researchers; method: research-based learning), now with an AI track and the AI Act training obligation for staff. Reuse the tour description and photos from the current site | Request the programme |
| `/servizi/check/` | **MiRT Check**: AI Readiness Check: where AI pays off in the store, with which tools, in what order | Diagnosi |
| `/servizi/watch/` | **MiRT Watch**: the observatory working for the store every day (monthly report, what AI assistants say about the store, competitors) | Diagnosi |
| `/servizi/act/` | **MiRT Act**: AI agents for clienteling, content, review replies and sales data, always with a person checking the output | Diagnosi |
| `/blog/` | List of articles, newest first | – |
| `/blog/<slug>/` | The 8 articles from `sito/content/`, with their dates from `pages-json-aggiunte.json`, sources list kept, the Radar box at the end | Get the Radar |
| `/clienti/` | Client logos and the short case stories from the current site | Diagnosi |
| `/chi-siamo/` | Andrea and Gianluca, the method "prima il retail, poi l'AI", Creattiva link | Diagnosi |
| `/contatti/` | Address, phone, email, map, generic form (FormSubmit) | Send |
| `/privacy/`, `/cookie/` | Take the current site's policies (iubenda links) | – |
| `/404/` | Italian + one English line | Home |

Keep the existing slugs exactly (the social posts already link to them): `/radar/`, `/guide/`, `/contatti/`, `/cliente-chiede-ai-dove-comprare/`, `/chi-chiude-chi-resiste/`, `/commesso-aumentato/`, `/commercio-agentico-2026/`, `/regole-2026-negozi/`, `/flagship-milano-2026/`, `/recommerce-negozio/`, `/trend-2027-agenda/`. Articles live at the root slug (redirect `/blog/<slug>/` → `/<slug>/` or the other way, but the root slug must answer 200). PDFs at `/download/MiRT-Radar-2027.pdf` and `/download/guide/<file>.pdf` (copy from `sito/download/`).

## 3. Design

- Brand kit: graphite `#3D3C3F` for text and primary buttons, `#707173` secondary text, `#F6F6F7` light surfaces, `#E6E6E8` lines, white background. Fonts: **Merriweather 700** for headings, **Arvo 400/700** for text (self-host the WOFF2 files from `brand-kit/font/`, no Google Fonts requests). Logo files in `brand-kit/logo/` (SVG + PNG, dark and white). Rounded corners 6px on cards, pill buttons. One accent only: graphite. No gradients, no stock photos; use the tour photos in `brand-kit/immagini/` and the photos from the current site.
- Editorial, calm, lots of white space, big headings, short paragraphs. Mobile first; 16px side gutters; tap targets ≥ 44px. Lighthouse ≥ 95 on performance, accessibility, SEO.
- Reusable components: page hero, service card, article card, Radar box (used at the end of every article and on the home), FAQ accordion (native `<details>`), client logo strip, contact block, footer with address/phone/email, P.IVA and legal links.

## 4. Stack

- **Astro 5** (static output), TypeScript, no UI framework, no Tailwind, no CMS. Content in Markdown or JSON under `src/content/`. i18n with `it` as default (no prefix) and `en` under `/en/`; a language switcher that links to the same page in the other language; `hreflang` tags.
- Convert the existing HTML fragments into content files without changing the copy (they are final and already proofread). Keep every source link.
- SEO: `site` = `https://www.milanoretailtour.com`, canonical, Open Graph (`brand-kit/immagini/og-milano-retail-tour-it.png` and `-en.png`), sitemap, robots.txt, schema.org `Organization` on the home and `Article` on articles. Each page gets the meta description from `pages-json-aggiunte.json` where it exists, otherwise write one of ~155 characters.
- No inline scripts or styles (the current host has a strict Content Security Policy). All JS in external files, minimal: the forms, the FAQ needs none, the language switcher needs none.
- Analytics: add a single placeholder in the layout for GA4 and Meta Pixel IDs (read from `.env`, not committed), loaded only after cookie consent; use the iubenda cookie banner snippet from the current site.

## 5. Forms and booking

- **FormSubmit** (already activated for `info@milanoretailtour.com`): copy the exact pattern of `sito/content/radar.html`: `_subject`, `_template=table`, `_autoresponse` (the Radar one sends the PDF link), hidden `language` and `source` fields, honeypot `_honey`, AJAX endpoint with a non-JS fallback (`_next` → `/grazie/`). The Radar form keeps its fields (name, email, store type with datalist, number of stores optional, newsletter checkbox, privacy consent). The Diagnosi form: name, email, phone, store type, city, "what would you like to look at first" (free text), privacy consent; subject "Richiesta Diagnosi MiRT".
- **Booking embed on /diagnosi/**: read `BOOKING_URL` from `.env`. If set, embed it (Calendly or Google appointment schedule, in an iframe loaded only after a click on "Scegli un orario", to keep the page fast and the cookies opt-in). If not set, show only the form. Document in the README where to put the URL.
- The `/grazie/` page must work both as the AJAX success target and as the `_next` redirect.

## 6. Content rules (hard)

- Italian first, English as a full translation. All UI strings in a translation file, never hard-coded.
- No prices, no percentages of savings, no guarantees, no invented clients or results. Every figure must carry its source (the articles already do). "AI", never "IA".
- Signature line at the end of every article: "Contenuto scritto con l'ausilio dell'AI con la supervisione di Gianluca Falduto."
- Contacts (from the Radar PDF and the current site): info@milanoretailtour.com · +39 02 97376045 · Corso S. Gottardo 18, Milano. Take P.IVA and legal name from the current site's footer.
- Everything you take from the current site, note it in `CREDITS.md` (what, from which URL).

## 7. Deliverables and checks

1. `npm run build` with zero errors and zero warnings; `npm run check` (astro check) at 0 errors.
2. A `README.md` in `sito-nuovo/` with: how to run, how to add an article (one file + one JSON entry), how to set `BOOKING_URL`, GA4 and Pixel IDs, how to deploy the `dist/` folder to IIS (web.config with the 404 page and the redirects) and to Cloudflare Pages.
3. A link check over the built site: no internal 404, every PDF reachable, every page has a canonical, an `hreflang` pair and a meta description.
4. Screenshots (Playwright, Chromium is pre-installed) of home, /radar/, /diagnosi/, /servizi/explore/ and one article, desktop and mobile, saved in `sito-nuovo/anteprime/`.
5. Update `milano-retail-tour/sito/ISTRUZIONI-PUBBLICAZIONE.md` with a short section "Sito nuovo" pointing to the README, so whoever manages the host knows there are two options: upload the old fragments, or deploy the new site.

Work phase by phase, commit after each with a clear message (no model names in commit messages), and at the end give me a summary in English: what's built, what you reused from where, the Lighthouse scores, and what still needs a human (booking URL, analytics IDs, DNS/hosting).
