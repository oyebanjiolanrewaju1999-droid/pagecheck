# Fix service — what to do when someone replies

The audit is the lead magnet. This is the delivery playbook.

## 1. First reply: triage in one message

Ask exactly three things. Nothing else.

> Thanks for getting back to me. Three quick questions so I can be precise:
>
> 1. What platform is the site on — WordPress, Shopify, Wix, Squarespace, or something custom?
> 2. Do you have admin login to it?
> 3. Would you rather I send you the steps to do it yourself, or do it for you?

**Decision rule**

| Answer | Offer |
|---|---|
| WordPress / Shopify / Wix / Squarespace + has login | Paid micro-fix ($99) |
| Has login but "my web guy handles it" | Send the fix kit; offer to talk to the web person |
| Custom site, no login, or no idea | Free instructions only — do **not** quote |
| Wants a redesign / new site | Decline or quote separately; not a $99 job |

## 2. Offers and prices

| Offer | Price | Includes | Time |
|---|---|---|---|
| Free fix list | $0 | Exact text + click path for their platform | 20 min |
| Single fix | $99 | One issue fixed by you, before/after proof | 30–45 min |
| Fix pack | $299 | Top 5 issues, before/after report | 2–3 h |

Rules:
- Fixed price, never hourly. Say the number before starting.
- 50% up front for the $299 pack; $99 can be paid on completion.
- Interac e-Transfer. Invoice with your name and Brampton address.
- Under $30k/year you are a small supplier — do **not** charge HST.
- One revision included. After that, "that's a separate fix."
- Never promise rankings, traffic, or sales. Only the technical change.

## 3. The fix kit (what you actually deliver)

For every client, produce these four files:

1. **`meta.txt`** — title (≤60 chars) + meta description (150–160 chars).
2. **`alts.txt`** — one line per image: filename → alt text.
3. **`og.png`** — 1200×630 social preview with their logo/name.
4. **`steps.md`** — the click path for their platform, numbered.

Put them in a folder named after the business. Send the text inline in email and
attach the image.

## 4. Platform click paths

### WordPress (with Yoast SEO — most common)

- **Meta description:** edit the page → scroll to *Yoast SEO* → *Meta description* → paste → Update.
- **Title:** same panel → *SEO title* field (keep under 60 characters).
- **H1:** in the editor, click the extra heading → change block type from *Heading 1* to *Heading 2*. Only one H1 per page.
- **Alt text:** *Media → Library* → click image → *Alternative Text* → paste → Update.
- **Social image:** Yoast → *Social* tab → *Facebook image* → upload the 1200×630 file.
- **No Yoast?** Install Yoast or Rank Math free first — 2 minutes, and everything above appears.

### Shopify

- **Homepage title/description:** *Online Store → Preferences → Homepage title and meta description*.
- **Product/collection pages:** open the item → scroll to *Search engine listing* → *Edit* → paste title + description.
- **Alt text:** *Products → [product] → image → Add alt text*; or *Content → Files* for theme images.
- **Social image:** *Online Store → Preferences → Social sharing image*.
- **H1:** set by the theme. If it's missing, that's theme code — quote it as a separate job, or skip.

### Wix

- **Title/description:** *Page settings (gear) → SEO Basics* → *Title tag* + *Meta description*.
- **Social image:** *Page settings → Social share* → upload image.
- **Alt text:** click the image → *Settings → Alt text* ("What's in this image?").
- **H1:** click the text → *Text settings → Heading → H1*. Wix allows one H1 per page.

### Squarespace 7.1

- **Title/description:** *Pages → [page] → gear → SEO* → *SEO title* + *Description*.
- **Social image:** same panel → *Social sharing* → image.
- **Alt text:** click image → *Edit → Content* → *Alt text*.
- **H1:** heading block → *Heading level → Heading 1*.

### No HSTS / no HTTPS

- **Cloudflare** (free): add the site, switch nameservers, then *SSL/TLS → Edge Certificates → HSTS* → Enable. Also fixes plain HTTP.
- **Managed hosts** (Render, Vercel, Netlify, Kinsta): HTTPS is automatic; HSTS is a host setting or not exposed.
- **Cheap shared host charging for SSL:** do not migrate their site for $99. Decline: "Your host should give you a free certificate — that's worth raising with them."

## 5. Before you touch anything

- Take a screenshot of the page as it is now (proof of before).
- Confirm they can restore a backup, or export the page.
- Work on one page only. Do not "tidy up" anything they didn't ask about.
- If it's a live shop, avoid changes during their peak hours.

## 6. After the fix — the proof step

1. Re-run the same URL through PageCheck.
2. Screenshot the score before and after.
3. Send: "78 → 91. The remaining items are [x] and [y], happy to do those too."

That one email is what turns a $99 job into a $299 job, and the screenshot is what
you show the next prospect.

## 7. Email templates

**Quote:**

> Hi [Name],
>
> Yes — [issue] is a quick fix. Two options:
>
> 1. **Free:** I send you the exact text and the clicks. About 10 minutes of your time.
> 2. **Done-for-you:** $99, I make the change and send you the before/after.
>
> For either one I need to know your platform and whether you have admin access. Which suits you?

**Delivering the free kit:**

> Hi [Name],
>
> Here's everything you need — three minutes of work:
>
> 1. [step]
> 2. [step]
>
> Paste this as your meta description:
> "[text]"
>
> And the social preview image is attached (1200×630). If you'd rather I just did it, say the word — $99 flat.
>
> Philip

**After delivery:**

> Done — your score went from [x] to [y]. The two things left are [a] and [b]; both are quick. Want me to take those too?
>
> If the report was useful, a one-line review I can quote would help me a lot.

**Declining a bad-fit job:**

> That's a bigger job than the audit covers — it needs theme or platform work I'd quote separately. If you want, I can send the exact list to your web person so they can handle it.

## 8. Paper trail

- One folder per client under `clients/<business>/`.
- Keep the invoice, the before/after screenshots, and what you changed.
- Log the reply in `OUTREACH-LOG.csv` → `Replied = Yes`, `Outcome = Quoted / Fixed / Declined`.
- Anyone who says "stop" goes in `OPTOUTS.md` and is never contacted again.
- If you're receiving EI, self-employment income must be reported. Keep the invoices.
