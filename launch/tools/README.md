# Finding prospects yourself

One script, no dependencies, no API keys. It asks OpenStreetMap for local
businesses with websites, audits each one with PageCheck, keeps the ones that
publish an email, and writes a JSON file with tested links.

## Run it

```bash
cd pagecheck/launch/tools
node find-prospects.mjs
```

Output: `prospects.json` — name, type, site, score, grade, top three fixes,
emails, and a ready-to-send audit link.

Takes about 5 minutes for 10 prospects, because PageCheck allows 12 checks per
minute and the script waits 5.2 s between audits.

## Change the area

Edit `CONFIG.bbox` at the top of the file. Format is
`south,west,north,east`. To get yours:

1. Open <https://overpass-turbo.eu>
2. Pan/zoom the map to your city
3. Paste this, then press **Run**:

```overpass
[out:json][timeout:90];
(
  nwr["amenity"~"dentist|restaurant|cafe|gym|veterinary"]({{bbox}});
);
out tags center 200;
```

4. The map shows every match. Copy the coordinates from the exported query, or
   right-click the map → *Show address* for a rough bbox.

## Change the categories

`CONFIG.categories` accepts any OpenStreetMap `amenity` value:
`dentist`, `doctors`, `clinic`, `restaurant`, `cafe`, `fast_food`, `gym`,
`hairdresser`, `beauty`, `car_repair`, `veterinary`, `pharmacy`, `lawyer`,
`accountant`, `driving_school`, `childcare`, `bank`, `post_office`.

`shop` values work too, but the script queries `amenity` — change the key if you
want retail.

## Keep it honest

- **Check the site before you send.** The script already dropped blocked and
  unreachable sites, but a site can start blocking later. Open the audit link
  once; if it errors, don't send.
- **Only use published addresses.** The script only reads `mailto:` links and
  text on the business's own pages. Never guess `firstname@domain`.
- **Update `ALREADY_CONTACTED`** after you send, so you don't email the same
  business twice.
- **Respect the chain filter.** Store-locator pages belong to head office, not a
  local decision-maker.

## Why OpenStreetMap and not Google Maps

OSM is free, open, and queryable in one request. Google has better local coverage
but no free API. If a business isn't in OSM, this script won't find it — that's
the trade-off.

## When to stop scanning

More names is the wrong lever after about 20–30 emails with no replies. At that
point the message is the problem, not the list. Change the subject line and lead
with one concrete fix, then send another ten.
