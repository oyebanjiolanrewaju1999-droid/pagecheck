/**
 * Find local businesses with a website, audit them with PageCheck, and keep
 * the ones that publish an email address.
 *
 * Usage:
 *   node find-prospects.mjs
 *
 * Edit the CONFIG block below to change city, category, or how many to collect.
 * Requires Node 18+ (uses fetch). No dependencies.
 */

import { writeFileSync } from 'node:fs';

// ---------------------------------------------------------------- config
const CONFIG = {
  // Brampton + Mississauga edge. Find yours: https://overpass-turbo.eu
  bbox: '43.63,-79.90,43.84,-79.60',
  categories: [
    'dentist', 'doctors', 'clinic', 'restaurant', 'cafe', 'gym',
    'hairdresser', 'beauty', 'car_repair', 'veterinary', 'pharmacy',
    'lawyer', 'accountant', 'driving_school',
  ],
  want: 10,             // stop after this many prospects with an email
  maxAudits: 40,        // hard cap on API calls
  auditSpacingMs: 5200, // PageCheck allows 12 checks/minute per IP
  outFile: 'prospects.json',
  siteBase: 'https://pagecheck-946f.onrender.com',
};

// Chains: a store-locator page is not a decision-maker.
const CHAINS = [
  'shoppersdrugmart', 'loblaws', 'metro.ca', 'walmart', 'costco', 'timhortons',
  'starbucks', 'mcdonalds', 'pizzapizza', 'dominos', 'subway', 'popeyes', 'kfc',
  'burgerking', 'wendys', 'dollarama', 'canadiantire', 'bestbuy', 'rexall',
  'pharmaplus', 'lcbo', 'thebeerstore', 'petrocanada', 'esso', 'circlek',
  '7-eleven', 'harveys', 'swisschalet', 'montanas', 'bostonpizza', 'ikea',
  'homesense', 'winners', 'sportchek', 'rbc', 'td.com', 'scotiabank', 'bmo',
  'cibc', 'freshii', 'boosterjuice', 'chatime', 'secondcup', 'pizzahut',
  'dairyqueen', 'tacobell', 'fiveguys', 'marybrowns', 'kelseys',
];

const ALREADY_CONTACTED = new Set([
  // domains you have emailed or decided to skip
  'cathospitalofbrampton.com', 'punjabichaapcorner.ca', 'ismiledentalcentre.com',
  'toothcorner.com', 'primadental.ca', 'heritagefishnchips.com', 'kesars.ca',
  'tadkaking.ca', 'urgentcarecentre.ca', 'snelgrovevet.com', 'drsoniasharma.com',
  'heartlakemed.com', 'henrysfishnchips.com', 'mismiledental.com',
  'paramountfinefoods.com', 'hakkahousebrampton.ca', 'cocofreshtea.ca',
  'drpkahlon.com', 'momo2go.com', 'roycrestdental.ca', 'scottybonsgrill.com',
  'brars.ca', 'eggsmart.ca', 'karahiboys.com', 'khazanacanada.com',
  'avivadental.com', 'westwoodbridgepethospital.com', 'zen-garden.ca',
  'sweetmahal.ca', 'redonioncaledon.com', 'milanidentistry.ca',
  'sunnyridgedental.com', 'voddenpharmacy.com', 'bucatinirestaurant.com',
]);

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const BAD_EMAIL = /(example|sentry|wixpress|domain\.|yourdomain|placeholder|@2x|\.png|\.jpg|\.webp|\.svg|noreply|no-reply|godaddy|squarespace|shopify|wix\.com)/i;
const PAGES = ['', '/contact', '/contact-us', '/about'];

// ---------------------------------------------------------------- helpers
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

async function overpassSites() {
  const query = `[out:json][timeout:90];
(
  nwr["amenity"~"${CONFIG.categories.join('|')}"](${CONFIG.bbox});
);
out tags center 700;`;

  for (const endpoint of [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ]) {
    console.log(`Asking OpenStreetMap (${new URL(endpoint).host})... this can take up to a minute`);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          accept: '*/*',
          'user-agent': 'PageCheck-outreach/1.0',
        },
        body: 'data=' + encodeURIComponent(query),
        signal: AbortSignal.timeout(120000),
      });
      if (res.status !== 200) {
        console.log(`${endpoint} -> HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();
      const rows = (data.elements || [])
        .filter((e) => e.tags && (e.tags.website || e.tags['contact:website']))
        .map((e) => ({
          name: e.tags.name || '',
          type: e.tags.amenity || '',
          website: e.tags.website || e.tags['contact:website'] || '',
        }))
        .filter((r) => r.name && r.website);
      return rows;
    } catch (error) {
      console.log(`${endpoint} failed: ${error.message}`);
    }
  }
  return [];
}

async function findEmails(base) {
  const found = new Map();
  for (const path of PAGES) {
    let url;
    try { url = new URL(path, base).toString(); } catch { continue; }
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 Safari/537.36' },
        redirect: 'follow',
        signal: AbortSignal.timeout(10000),
      });
      const html = await res.text();
      for (const m of html.matchAll(/mailto:([^"'?<>\s]+)/gi)) {
        const email = decodeURIComponent(m[1]).toLowerCase();
        if (!BAD_EMAIL.test(email)) found.set(email, url);
      }
      for (const m of html.matchAll(EMAIL_RE)) {
        const email = m[0].toLowerCase();
        if (!BAD_EMAIL.test(email)) found.set(email, url);
      }
    } catch { /* next page */ }
    await sleep(120);
  }
  return [...found.keys()];
}

async function audit(url) {
  const res = await fetch(`${CONFIG.siteBase}/api/audit?url=${encodeURIComponent(url)}`);
  return res.json();
}

// ---------------------------------------------------------------- main
const raw = await overpassSites();
console.log(`Overpass returned ${raw.length} businesses with a website`);

const seen = new Set();
const queue = [];
for (const row of raw) {
  const host = domainOf(row.website);
  if (!host || seen.has(host)) continue;
  if (ALREADY_CONTACTED.has(host) || CHAINS.some((c) => host.includes(c))) continue;
  seen.add(host);
  queue.push({ ...row, host });
}
console.log(`${queue.length} unique local domains to check\n`);

const results = [];
let audits = 0;
for (const row of queue) {
  if (results.filter((r) => r.emails.length).length >= CONFIG.want) break;
  if (audits >= CONFIG.maxAudits) break;

  let report;
  try {
    report = await audit(row.website);
  } catch (error) {
    console.log(`skip ${row.name}: ${error.message}`);
    continue;
  }
  audits += 1;
  await sleep(CONFIG.auditSpacingMs);

  if (!report.ok) {
    console.log(`skip ${row.name}: ${report.error}`);
    continue;
  }

  const emails = await findEmails(row.website);
  const record = {
    name: row.name,
    type: row.type,
    site: row.website,
    score: report.score,
    grade: report.grade,
    top: report.groups.flatMap((g) => g.items)
      .filter((i) => i.status !== 'pass')
      .sort((a, b) => (b.weight || 1) - (a.weight || 1))
      .slice(0, 3)
      .map((i) => `${i.status}: ${i.label} — ${i.detail}`),
    emails,
    auditLink: `${CONFIG.siteBase}/?url=${encodeURIComponent(row.website)}&utm_source=outreach`,
  };
  results.push(record);
  console.log(`${record.score} ${record.grade}  ${record.name}  ${emails[0] || '(no email)'}`);
}

const withEmail = results.filter((r) => r.emails.length);
writeFileSync(CONFIG.outFile, JSON.stringify(withEmail, null, 2));
console.log(`\n${withEmail.length} prospects with an email -> ${CONFIG.outFile}`);
