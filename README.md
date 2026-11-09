# PageCheck

**A free 30-point audit for landing pages — no sign-up, no tracking, no dependencies.**

[**Try it → pagecheck-946f.onrender.com**](https://pagecheck-946f.onrender.com)

![PageCheck home page](docs/home.png)

Paste a URL. Get a score out of 100, the three fixes that matter most, and a
plain-English explanation of each. Thirty checks across reachability, search,
link previews, mobile, content, speed, security and conversion — the same things
an agency looks at before spending money on ads.

![Audit report](docs/report.png)

## Why it exists

Small businesses get told their site is "bad for SEO" with no explanation. Most
audit tools are aimed at developers and drown people in jargon. PageCheck gives
one number, a grade, and a prioritised list of fixes written for the person who
owns the site — not the person who built it.

## What it checks

| Group | Examples |
|---|---|
| Reachability | HTTPS, HTTP status, redirects, response time |
| Search basics | title length, meta description, single H1, canonical, lang, `noindex` |
| Link previews | `og:title`, `og:description`, `og:image`, `twitter:card` |
| Mobile | viewport meta |
| Content | word count, image alt coverage, structured data |
| Speed | HTML size, compression, external and blocking scripts |
| Security | HSTS, CSP, `nosniff`, referrer policy, frame protection, mixed content |
| Conversion | contact route (form / tel / mailto), visible buttons |

Each check returns **pass / warn / fail**, a detail line, and a fix. Checks are
weighted inside their group; the overall score is the mean of the eight groups.
The report shows the top three failing checks first, with the full thirty behind
a toggle.

## Built with zero runtime dependencies

`server.js` uses only Node's standard library; the front end is plain HTML, CSS
and JavaScript. That means:

- no supply-chain surface and nothing to patch weekly
- a cold start measured in milliseconds
- the whole app fits in one small repo a reviewer can read in an afternoon

## Safety, because it fetches arbitrary URLs

Accepting a URL from a stranger and requesting it is a server-side request
forgery problem if you get it wrong. PageCheck:

- allows only `http` / `https` on ports 80 and 443
- resolves DNS and **rejects private, loopback, link-local and cloud-metadata
  addresses before every request, including each redirect hop**
- caps redirects at 5, the request at 12 s, and the HTML at 2 MB
- serves the page with security headers and a CORS policy that allows only its
  own origin
- rate-limits to 12 checks per IP per minute

Nothing is stored: no accounts, no database, no record of which URLs were checked.

## Four languages

English, French, Spanish and Hindi. The picker follows the browser language,
remembers the choice, and keeps it in shareable URLs (`?lang=es`). All copy is
hand-written per language in `public/i18n.js` and `public/report-i18n.js` — no
translation API is called at runtime.

## Mobile

![PageCheck on a phone](docs/mobile.png)

## Run locally

```bash
node server.js          # http://localhost:4455
PORT=4460 node server.js
```

## Deploy

Any Node host works. On Render: Web Service → Runtime Node → Build
`npm install --omit=dev` → Start `node server.js` → health check `/health`.
`render.yaml` is included for Blueprint deploys.

## Limitations (v1)

- Reads the HTML only — it does not execute JavaScript, so client-rendered
  content is invisible to it.
- No broken-link crawl, screenshot or Core Web Vitals (those need a browser and
  a queue).
- Checks are written for English-language pages.

## Roadmap

1. Email the full report (turns it into a lead magnet for agencies).
2. Crawl the first 50 links and report 404s.
3. Browser screenshot in the report.
4. Compare two URLs — before and after an edit.
5. Shareable score card image.

## Licence

MIT — see [LICENSE](LICENSE). You can use, modify and self-host it; keep the
copyright notice. The hosted instance at pagecheck-946f.onrender.com is provided
as-is, with no warranty and no guarantee of uptime.

## Project structure

```
server.js              audit engine, SSRF guards, static server, rate limit
public/index.html      page shell
public/app.js          rendering, i18n switching, report UI
public/i18n.js         interface strings (EN/FR/ES/HI)
public/report-i18n.js  report labels and fixes (EN/FR/ES/HI)
public/style.css       single stylesheet, responsive at 720 px
launch/                outreach, tracker, demo video, launch notes
```
