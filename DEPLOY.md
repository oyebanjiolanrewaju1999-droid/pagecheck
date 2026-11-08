# Deploy PageCheck

## 1. GitHub

The local repo is ready (`git log` shows the commits). Create an empty repository
named `pagecheck` on GitHub, then:

```powershell
cd "C:\Users\oyeba\OneDrive\Desktop\R-E-A\pagecheck"
git remote add origin https://github.com/<username>/pagecheck.git
git push -u origin main
```

## 2. Render (free plan is enough)

**Dashboard → New → Web Service → connect the repo**

| Field | Value |
|---|---|
| Name | `pagecheck` |
| Runtime | Node |
| Build command | `npm install --omit=dev` |
| Start command | `node server.js` |
| Health check path | `/health` |
| Instance type | Free |

Or use **New → Blueprint** and let `render.yaml` configure it.

No disk, no database, no environment variables required. Render injects `PORT`
and the server reads it.

## 3. After the first deploy

1. Open `https://<service>.onrender.com/health` — should return
   `{"ok":true,"name":"pagecheck"}`.
2. Audit `https://<service>.onrender.com` itself. It should score well.
3. Update the share image tag in `public/index.html` from `/og.png` to the full
   absolute URL, then push:
   ```html
   <meta property="og:image" content="https://<service>.onrender.com/og.png" />
   ```
4. Test the preview at `https://www.opengraph.xyz/url/`.
5. Check each language: `?lang=fr`, `?lang=es`, `?lang=hi`.

## 4. Custom domain (optional)

Render → Settings → Custom Domains. A `pagecheck.ca` or similar reads better in
marketing than an `onrender.com` URL. Update `og:image` again if you add one.

## Known operational notes

- The translator uses Google's public `clients5` endpoint, with an in-memory
  cache. If it is rate-limited, reports fall back to English.
- Translation cache is per process and clears on deploys/restarts.
- Free Render services sleep after inactivity; the first request wakes them.
