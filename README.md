# PageCheck

Paste a landing page URL, get a plain-English audit of the things that quietly
cost sign-ups. Built with Node.js and vanilla JavaScript — no runtime dependencies.

## What it checks (30 items, 8 groups)

| Group | Examples |
|---|---|
| Reachability | HTTPS, HTTP status, redirects, response time |
| Search basics | title length, meta description, single H1, canonical, lang, noindex |
| Link previews | og:title, og:description, og:image, twitter:card |
| Mobile | viewport meta |
| Content | word count, image alt coverage, structured data |
| Speed | HTML size, compression, external scripts, blocking scripts |
| Security | HSTS, CSP, nosniff, referrer policy, frame protection, mixed content |
| Conversion | contact route (form/tel/mailto), visible buttons |

Each item returns pass / warn / fail, a plain detail line, and a fix. Scores are
weighted within each group; the overall score is the mean of the eight groups.

## Languages

English, French, Spanish and Hindi. The selector auto-detects the browser
language, remembers the choice, and keeps it in shareable URLs (`?lang=es`).

- Interface text is hand-written per language in `public/i18n.js`.
- Report text (labels, details, fixes) is machine-translated on the server with a
  cache, so repeat checks are fast. Group names use the hand-written ones.
- If the translator is unavailable, report text falls back to English.

The translator uses Google's public `clients5` endpoint. It is free and works
well at low volume, but it is not a contracted API — for production scale,
replace `translateChunk()` with DeepL/Google Cloud Translate or move the strings
into the locale file.

## Share image

`public/og.png` is a 1200×630 card used for link previews. Regenerate it from
`og-card.html` (kept outside the repo) if the wording changes.

## Run locally

```powershell
cd pagecheck
node server.js
```

Open http://localhost:4455.

Or with a different port:

```powershell
$env:PORT = 4460; node server.js
```

## Deploy on Render

1. Create a GitHub repo and push this folder.
2. Render → New → Web Service → connect the repo.
3. Runtime: Node. Build: `npm install --omit=dev`. Start: `node server.js`.
4. Health check path: `/health`.
5. Free plan is enough — no disk, no database.

`render.yaml` is included if you prefer a Blueprint.

## Safety and privacy

- Only `http` and `https` on ports 80/443.
- DNS is resolved and **private, loopback, link-local and metadata addresses are
  rejected** before any request, including on every redirect hop.
- Maximum 5 redirects, 12-second timeout, 2 MB HTML cap.
- Nothing is stored: no accounts, no database, no logs of checked URLs.
- Rate limit: 12 checks per IP per minute.

## Known limitations (v1)

- Checks the HTML only — it does not execute JavaScript, so client-rendered
  content is invisible to it.
- No broken-link crawl (that needs a queue and many requests).
- No screenshot or Core Web Vitals (those need a real browser).
- English-language checks and copy.

## Roadmap

1. **Email the full report** — turns it into a lead magnet for agency work.
2. **Broken-link check** — crawl the first 50 links, report 404s.
3. **Screenshot** — one image of the page in the report.
4. **Compare two URLs** — before/after an edit.
5. **Share cards** — generate an image with the score for social.

## Why this is a good portfolio piece

It is a real tool with a real user (agencies and store owners), and it
demonstrates HTTP, HTML parsing, security headers, SSRF defence, scoring design
and plain-English technical writing — all without a framework or dependencies.
