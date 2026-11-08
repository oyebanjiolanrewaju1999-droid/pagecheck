import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import dns from 'node:dns/promises';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)));
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT) || 4455;
const HOST = process.env.HOST || '0.0.0.0';

const MAX_HTML_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 12000;
const MAX_REDIRECTS = 5;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

/* ---------- rate limit ---------- */

const hits = new Map();
const WINDOW = 60 * 1000;
const LIMIT = 12;

function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < WINDOW);
  if (list.length >= LIMIT) {
    hits.set(ip, list);
    return true;
  }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 2000) {
    for (const [key, value] of hits) {
      if (!value.some((t) => now - t < WINDOW)) hits.delete(key);
    }
  }
  return false;
}

/* ---------- SSRF guards ---------- */

function isPrivateAddress(address) {
  if (!net.isIP(address)) return true;
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 192 && b === 0) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a >= 224) return true;
    return false;
  }
  const lower = address.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true;
  if (lower.startsWith('::ffff:')) return isPrivateAddress(lower.slice(7));
  return false;
}

async function assertPublicUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('That does not look like a valid URL.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http and https addresses can be checked.');
  }
  const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
  if (port !== 80 && port !== 443) {
    throw new Error('Only standard web ports (80 and 443) are supported.');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('Private addresses cannot be checked.');
  }
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) throw new Error('Private addresses cannot be checked.');
    return url;
  }
  let addresses;
  try {
    addresses = await dns.lookup(host, { all: true });
  } catch {
    throw new Error('That domain could not be resolved.');
  }
  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error('Private or unresolvable addresses cannot be checked.');
  }
  return url;
}

/* ---------- fetch with manual redirects ---------- */

async function fetchPage(startUrl) {
  let url = startUrl;
  let redirects = 0;
  const started = Date.now();

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    url = await assertPublicUrl(url.toString());
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(url, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'user-agent': 'PageCheck/1.0 (+https://sixside.onrender.com)',
          accept: 'text/html,application/xhtml+xml',
          'accept-language': 'en-CA,en;q=0.9',
        },
      });
    } finally {
      clearTimeout(timer);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('The server redirected without a location.');
      redirects += 1;
      if (redirects > MAX_REDIRECTS) throw new Error('Too many redirects.');
      url = new URL(location, url);
      continue;
    }

    const timingMs = Date.now() - started;
    const type = String(response.headers.get('content-type') || '');
    if (!type.includes('text/html') && !type.includes('application/xhtml')) {
      throw new Error('That address does not return an HTML page.');
    }
    const html = await readCapped(response, MAX_HTML_BYTES);
    return {
      finalUrl: url.toString(),
      status: response.status,
      headers: response.headers,
      html,
      timingMs,
      redirects,
    };
  }
  throw new Error('Too many redirects.');
}

async function readCapped(response, limit) {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      try { await reader.cancel(); } catch { /* ignore */ }
      throw new Error('That page is larger than 2 MB, which is unusual for HTML.');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
}

/* ---------- HTML parsing ---------- */

function textOf(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function metaContent(html, key, attr = 'name') {
  const patterns = [
    new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]*content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*${attr}=["']${key}["']`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1].trim();
  }
  return '';
}

function parseHtml(html) {
  const title = textOf((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
  const h1 = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => textOf(m[1])).filter(Boolean);
  const images = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const imagesMissingAlt = images.filter((tag) => !/\balt\s*=\s*["'][^"']+["']/i.test(tag)).length;
  const scripts = [...html.matchAll(/<script\b[^>]*>/gi)].map((m) => m[0]);
  const externalScripts = scripts.filter((tag) => /\bsrc\s*=/.test(tag) && /^https?:/i.test((tag.match(/\bsrc\s*=\s*["']([^"']+)/i) || [])[1] || ''));
  const blockingScripts = scripts.filter((tag) => /\bsrc\s*=/.test(tag) && !/\b(async|defer)\b/i.test(tag));
  const stylesheets = [...html.matchAll(/<link\b[^>]*rel=["'][^"']*stylesheet[^"']*["'][^>]*>/gi)].map((m) => m[0]);
  const forms = (html.match(/<form\b/gi) || []).length;
  const buttons = (html.match(/<button\b/gi) || []).length;
  const telLinks = (html.match(/href=["']tel:/gi) || []).length;
  const mailLinks = (html.match(/href=["']mailto:/gi) || []).length;
  const jsonLd = (html.match(/application\/ld\+json/gi) || []).length;
  const canonical = (html.match(/<link[^>]+rel=["']canonical["'][^>]*>/i) || [])[0] || '';
  const canonicalUrl = (canonical.match(/href=["']([^"']+)["']/i) || [])[1] || '';
  const lang = (html.match(/<html[^>]*\blang=["']([^"']+)["']/i) || [])[1] || '';
  const viewport = metaContent(html, 'viewport');
  const robots = metaContent(html, 'robots').toLowerCase();
  const description = metaContent(html, 'description');
  const ogTitle = metaContent(html, 'og:title', 'property');
  const ogDescription = metaContent(html, 'og:description', 'property');
  const ogImage = metaContent(html, 'og:image', 'property');
  const twitterCard = metaContent(html, 'twitter:card');
  const mixed = [...html.matchAll(/(?:src|href)=["'](http:\/\/[^"']+)["']/gi)].map((m) => m[1]);
  const plain = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  const words = textOf(plain).split(/\s+/).filter(Boolean).length;
  return {
    title, h1, description, viewport, robots, lang, canonicalUrl,
    ogTitle, ogDescription, ogImage, twitterCard,
    imageCount: images.length, imagesMissingAlt,
    scriptCount: scripts.length, externalScripts: externalScripts.length,
    blockingScripts: blockingScripts.length, stylesheets: stylesheets.length,
    forms, buttons, telLinks, mailLinks, jsonLd, mixed, words,
  };
}

/* ---------- scoring ---------- */

function item(label, status, detail, fix, weight = 1) {
  return { label, status, detail, fix, weight };
}

function scoreItems(items) {
  let earned = 0;
  let total = 0;
  for (const entry of items) {
    total += entry.weight;
    if (entry.status === 'pass') earned += entry.weight;
    else if (entry.status === 'warn') earned += entry.weight * 0.5;
  }
  return total ? Math.round((earned / total) * 100) : 0;
}

function grade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/* ---------- translation (cached) ---------- */

const translationCache = new Map();
const TRANSLATE_LANGS = new Set(['fr', 'es', 'hi']);

async function translateChunk(texts, lang) {
  const base = 'https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=' + encodeURIComponent(lang);
  const url = base + texts.map((text) => '&q=' + encodeURIComponent(text)).join('');
  const response = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; PageCheck/1.0)' },
  });
  if (!response.ok) throw new Error('translation failed');
  const data = await response.json();
  if (!Array.isArray(data) || data.length !== texts.length) throw new Error('translation shape mismatch');
  return data.map((part) => String(part).trim());
}

async function translateTexts(texts, lang) {
  const unique = [...new Set(texts.filter(Boolean))];
  const missing = unique.filter((text) => !translationCache.has(lang + '|' + text));

  const chunks = [];
  let chunk = [];
  let size = 0;
  for (const text of missing) {
    if (chunk.length && (chunk.length >= 25 || size + text.length > 2200)) {
      chunks.push(chunk);
      chunk = [];
      size = 0;
    }
    chunk.push(text);
    size += text.length + 8;
  }
  if (chunk.length) chunks.push(chunk);

  const results = await Promise.all(chunks.map(async (batch) => {
    try {
      return await translateChunk(batch, lang);
    } catch {
      return batch;
    }
  }));
  results.forEach((translated, index) => {
    chunks[index].forEach((text, offset) => translationCache.set(lang + '|' + text, translated[offset] || text));
  });

  if (translationCache.size > 5000) {
    const keys = [...translationCache.keys()].slice(0, 2000);
    for (const key of keys) translationCache.delete(key);
  }
  return texts.map((text) => translationCache.get(lang + '|' + text) || text);
}

async function localise(result, lang) {
  const texts = [];
  for (const group of result.groups) {
    texts.push(group.name);
    for (const entry of group.items) {
      texts.push(entry.label);
      if (entry.detail) texts.push(entry.detail);
      if (entry.fix) texts.push(entry.fix);
    }
  }
  const translated = await translateTexts(texts, lang);
  let cursor = 0;
  for (const group of result.groups) {
    group.name = translated[cursor++];
    for (const entry of group.items) {
      entry.label = translated[cursor++];
      if (entry.detail) entry.detail = translated[cursor++];
      if (entry.fix) entry.fix = translated[cursor++];
    }
  }
  return result;
}

/* ---------- audit ---------- */

async function audit(rawUrl) {
  const page = await fetchPage(rawUrl);
  const p = parseHtml(page.html);
  const headers = page.headers;
  const isHttps = page.finalUrl.startsWith('https://');
  const bytes = Buffer.byteLength(page.html, 'utf8');

  const reach = [
    item('HTTPS', isHttps ? 'pass' : 'fail', isHttps ? 'The page loads over a secure connection.' : 'The page is served over plain HTTP.', 'Move the site to HTTPS; most hosts offer a free certificate.', 3),
    item('Responds successfully', page.status === 200 ? 'pass' : page.status < 400 ? 'warn' : 'fail', `Server returned HTTP ${page.status}.`, 'A 200 is the normal response for a public page.', 3),
    item('Redirects', page.redirects <= 2 ? 'pass' : 'warn', `${page.redirects} redirect${page.redirects === 1 ? '' : 's'} before the final page.`, 'Link directly to the final URL to avoid slowing visitors down.', 1),
    item('Response speed', page.timingMs < 1500 ? 'pass' : page.timingMs < 3000 ? 'warn' : 'fail', `First response took ${page.timingMs} ms.`, 'Aim under 1.5 s; check hosting, caching and image sizes.', 1),
  ];

  const seo = [
    item('Page title', p.title.length >= 10 && p.title.length <= 60 ? 'pass' : p.title ? 'warn' : 'fail',
      p.title ? `"${p.title}" (${p.title.length} characters).` : 'No title tag found.',
      'Write a 10–60 character title that says what the page offers.', 3),
    item('Meta description', p.description.length >= 50 && p.description.length <= 160 ? 'pass' : p.description ? 'warn' : 'fail',
      p.description ? `${p.description.length} characters.` : 'No meta description found.',
      'Write a 50–160 character description; it is the text under the link in search results.', 3),
    item('One main heading', p.h1.length === 1 ? 'pass' : p.h1.length === 0 ? 'fail' : 'warn',
      p.h1.length ? `${p.h1.length} H1 heading${p.h1.length === 1 ? '' : 's'} found.` : 'No H1 heading found.',
      'Use exactly one H1 that states the main promise of the page.', 2),
    item('Canonical link', p.canonicalUrl ? 'pass' : 'warn',
      p.canonicalUrl || 'No canonical URL declared.',
      'Add a canonical link so search engines know the preferred address.', 1),
    item('Page language', p.lang ? 'pass' : 'warn', p.lang ? `Language set to "${p.lang}".` : 'No lang attribute on the html tag.', 'Add lang="en-CA" or your main language.', 1),
    item('Indexable', p.robots.includes('noindex') ? 'fail' : 'pass', p.robots.includes('noindex') ? 'The page tells search engines not to index it.' : 'No noindex directive found.', 'Remove the noindex tag if this page should appear in search.', 2),
  ];

  const social = [
    item('Social title', p.ogTitle ? 'pass' : 'warn', p.ogTitle || 'No og:title.', 'Add og:title so shared links show a proper headline.', 1),
    item('Social description', p.ogDescription ? 'pass' : 'warn', p.ogDescription || 'No og:description.', 'Add og:description for link previews.', 1),
    item('Social image', p.ogImage ? 'pass' : 'fail', p.ogImage || 'No og:image.', 'Add a 1200x630 image; links without one look broken when shared.', 2),
    item('Twitter card', p.twitterCard ? 'pass' : 'warn', p.twitterCard || 'No twitter:card.', 'Add twitter:card="summary_large_image".', 1),
  ];

  const mobile = [
    item('Mobile viewport', p.viewport ? 'pass' : 'fail', p.viewport || 'No viewport meta tag.', 'Add a viewport meta tag, otherwise phones zoom out and the page looks tiny.', 3),
  ];

  const content = [
    item('Useful amount of text', p.words >= 300 ? 'pass' : p.words >= 120 ? 'warn' : 'fail', `${p.words} words on the page.`, 'Aim for at least 300 words of real content; thin pages rarely convert.', 2),
    item('Images have alt text', p.imageCount === 0 ? 'pass' : p.imagesMissingAlt === 0 ? 'pass' : p.imagesMissingAlt / p.imageCount <= 0.1 ? 'warn' : 'fail',
      p.imageCount ? `${p.imagesMissingAlt} of ${p.imageCount} images are missing alt text.` : 'No images found.',
      'Describe each meaningful image in its alt attribute; it helps accessibility and search.', 2),
    item('Structured data', p.jsonLd > 0 ? 'pass' : 'warn', p.jsonLd ? `${p.jsonLd} JSON-LD block(s).` : 'No structured data.', 'Add schema.org JSON-LD for the business, product or article.', 1),
  ];

  const speed = [
    item('HTML size', bytes < 150 * 1024 ? 'pass' : bytes < 300 * 1024 ? 'warn' : 'fail', `${Math.round(bytes / 1024)} KB of HTML.`, 'Keep HTML lean; move styles and scripts to files and compress responses.', 2),
    item('Compression', headers.get('content-encoding') ? 'pass' : 'warn', headers.get('content-encoding') || 'No compression header.', 'Enable gzip or brotli on the server.', 1),
    item('External scripts', p.externalScripts <= 8 ? 'pass' : 'warn', `${p.externalScripts} external script file(s).`, 'Every extra script slows the page; remove what you do not need.', 1),
    item('Blocking scripts', p.blockingScripts <= 3 ? 'pass' : 'warn', `${p.blockingScripts} script(s) without async or defer.`, 'Add async or defer to scripts that are not needed immediately.', 1),
  ];

  const security = [
    item('Strict transport security', headers.get('strict-transport-security') ? 'pass' : 'warn', headers.get('strict-transport-security') || 'No HSTS header.', 'Send Strict-Transport-Security to force HTTPS.', 2),
    item('Content security policy', headers.get('content-security-policy') ? 'pass' : 'warn', headers.get('content-security-policy') ? 'CSP present.' : 'No CSP header.', 'Add a Content-Security-Policy to limit what scripts can run.', 2),
    item('MIME sniffing blocked', headers.get('x-content-type-options') ? 'pass' : 'warn', headers.get('x-content-type-options') || 'No X-Content-Type-Options.', 'Send X-Content-Type-Options: nosniff.', 1),
    item('Referrer policy', headers.get('referrer-policy') ? 'pass' : 'warn', headers.get('referrer-policy') || 'No Referrer-Policy.', 'Send Referrer-Policy: strict-origin-when-cross-origin.', 1),
    item('Clickjacking protection', headers.get('x-frame-options') || /frame-ancestors/i.test(headers.get('content-security-policy') || '') ? 'pass' : 'warn', headers.get('x-frame-options') || 'No frame protection header.', 'Send X-Frame-Options: SAMEORIGIN or a CSP frame-ancestors rule.', 1),
    item('No mixed content', isHttps ? (p.mixed.length === 0 ? 'pass' : 'fail') : 'warn', p.mixed.length ? `${p.mixed.length} insecure resource(s) on an HTTPS page.` : 'No insecure resources found.', 'Load every image, script and stylesheet over HTTPS.', 2),
  ];

  const conversion = [
    item('Contact route', p.forms > 0 || p.telLinks > 0 || p.mailLinks > 0 ? 'pass' : 'warn', p.forms ? `${p.forms} form(s) found.` : p.telLinks || p.mailLinks ? 'Phone or email link found.' : 'No form, phone or email link.', 'Give visitors an obvious way to get in touch.', 2),
    item('Visible buttons', p.buttons > 0 ? 'pass' : 'warn', `${p.buttons} button element(s).`, 'Add a clear primary action such as "Get started" or "Book a call".', 2),
  ];

  const groups = [
    { id: 'reachability', name: 'Reachability', items: reach },
    { id: 'search', name: 'Search basics', items: seo },
    { id: 'previews', name: 'Link previews', items: social },
    { id: 'mobile', name: 'Mobile', items: mobile },
    { id: 'content', name: 'Content', items: content },
    { id: 'speed', name: 'Speed', items: speed },
    { id: 'security', name: 'Security', items: security },
    { id: 'conversion', name: 'Conversion', items: conversion },
  ];

  for (const group of groups) group.score = scoreItems(group.items);
  const overall = Math.round(groups.reduce((sum, g) => sum + g.score, 0) / groups.length);

  return {
    ok: true,
    target: rawUrl,
    finalUrl: page.finalUrl,
    status: page.status,
    timingMs: page.timingMs,
    redirects: page.redirects,
    bytes,
    score: overall,
    grade: grade(overall),
    groups,
  };
}

/* ---------- HTTP ---------- */

function json(res, code, payload) {
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  });
  res.end(JSON.stringify(payload));
}

async function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const target = path.resolve(PUBLIC, rel);
  if (target !== PUBLIC && !target.startsWith(PUBLIC + path.sep)) {
    res.writeHead(403); res.end('Forbidden');
    return;
  }
  try {
    const data = await fs.readFile(target);
    const ext = path.extname(target).toLowerCase();
    res.writeHead(200, {
      'content-type': MIME[ext] || 'application/octet-stream',
      'cache-control': ext === '.html' ? 'no-store' : 'no-cache',
      'x-content-type-options': 'nosniff',
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/audit') {
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
    if (limited(ip)) {
      json(res, 429, { ok: false, error: 'Too many checks. Wait a minute and try again.' });
      return;
    }
    const target = url.searchParams.get('url') || '';
    if (!target) {
      json(res, 400, { ok: false, error: 'Add a URL to check.' });
      return;
    }
    try {
      const result = await audit(target);
      const lang = String(url.searchParams.get('lang') || 'en').toLowerCase().slice(0, 2);
      if (TRANSLATE_LANGS.has(lang)) await localise(result, lang);
      json(res, 200, result);
    } catch (error) {
      json(res, 400, { ok: false, error: error.message || 'The page could not be checked.' });
    }
    return;
  }
  if (url.pathname === '/health') {
    json(res, 200, { ok: true, name: 'pagecheck' });
    return;
  }
  await serveStatic(req, res, url.pathname);
});

server.listen(PORT, HOST, () => {
  console.log(`PageCheck on http://localhost:${PORT}`);
});
