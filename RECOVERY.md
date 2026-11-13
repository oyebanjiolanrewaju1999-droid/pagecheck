# Recovery plan

What to do if GitHub, Render, or this laptop is lost. Written 13 Nov 2026.

PageCheck is **stateless**: no database, no user accounts, no stored URLs. The
only things that would actually be lost are the code and a handful of settings,
and both are replaceable in under an hour.

## What exists where

| Asset | Where it lives | Replaceable? |
|---|---|---|
| Source code | GitHub `oyebanjiolanrewaju1999-droid/pagecheck` (public) | Re-clone anywhere |
| Second copy | `Desktop\R-E-A\pagecheck` on this laptop | Re-clone from GitHub |
| Third copy | `Desktop\PageCheck-Backup-YYYY-MM-DD.zip` (code + launch docs) | Copy to external drive occasionally |
| Live service | Render, Starter plan, Oregon | Recreate in ~10 min |
| Deploy hook | GitHub repo secret `RENDER_DEPLOY_HOOK` | Regenerate in Render |
| Analytics | GoatCounter `pagecheck.goatcounter.com` | New account; history is lost |
| Domain | `pagecheck-946f.onrender.com` (Render subdomain) | Changes if the service is recreated |

Nothing critical is stored only on the laptop.

## If the Render service disappears

1. Render → **New → Web Service** → connect the GitHub repo
2. Runtime **Node**, build `npm install --omit=dev`, start `node server.js`
3. Health check path `/health`
4. Instance type **Starter** (free tier sleeps and shows the "waking up" splash)
5. No environment variables are required. `PORT` is provided by Render.
6. Render → Settings → **Deploy Hook** → copy the URL
7. GitHub repo → Settings → Secrets → Actions → update `RENDER_DEPLOY_HOOK`
8. Push anything, or run the **Deploy to Render** workflow manually

Expected new URL: `https://<new-name>.onrender.com`. If the name changes, update
it in `public/og.png` (the share card) and the README, and re-point the
GoatCounter script in `public/index.html` only if you also move accounts.

## If GitHub is compromised or the repo disappears

1. The laptop copy still has full history: `git remote -v` shows where it came from
2. Create a new repo, `git remote set-url origin <new>`, `git push -u origin main`
3. Re-add the `RENDER_DEPLOY_HOOK` secret
4. Update the Render service's connected repo

## If the laptop dies

1. Clone from GitHub — that is the whole restore
2. Reinstall Node 20+, nothing else is needed
3. `node server.js` to run locally

## Account checklist (keep this current, never store passwords here)

- [ ] GitHub account has 2FA enabled
- [ ] Render account has 2FA enabled
- [ ] GoatCounter account email is one you will keep
- [ ] Recovery codes for GitHub stored offline (printed or password manager)
- [ ] Card on Render is current, or the service stops on billing failure

## Backup routine

- **Monthly:** download a zip of the repo (or run the archive command) and copy it
  to a second drive, not just OneDrive
- **After any launch change:** commit and push — GitHub *is* the backup
- **Never** commit `RENDER_DEPLOY_HOOK`, admin keys, or passwords

## What cannot be recovered

- GoatCounter visit history (export a CSV monthly if the numbers matter)
- Render logs older than the retention window
- The exact `pagecheck-946f` hostname, if the service is deleted and recreated
  under a different name

## The 10-minute test

Once a quarter: clone the repo into a fresh folder, run `node server.js`, open
`http://localhost:4455`, run one audit. If that works, the backup is real. A
backup you have never restored is a hope, not a backup.
