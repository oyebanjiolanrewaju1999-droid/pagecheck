const form = document.getElementById('check-form');
const input = document.getElementById('url');
const go = document.getElementById('go');
const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');
const langSelect = document.getElementById('lang');

const RING_RADIUS = 56;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
const SUPPORTED = ['en', 'fr', 'es', 'hi'];
const SVG_NS = 'http://www.w3.org/2000/svg';

const GROUP_ICON = {
  reachability: 'globe',
  search: 'search',
  previews: 'share',
  mobile: 'phone',
  content: 'doc',
  speed: 'gauge',
  security: 'shield',
  conversion: 'cursor',
};

const STATUS_ICON = { pass: 'check', warn: 'alert', fail: 'x' };

let LANG = 'en';
let LAST_URL = '';

function dict() {
  return (window.I18N && window.I18N[LANG]) || window.I18N.en;
}

function reportDict() {
  return (window.REPORT_I18N && window.REPORT_I18N[LANG]) || null;
}

function t(key, params) {
  let text = dict()[key] || window.I18N.en[key] || key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replace(new RegExp('\\{' + name + '\\}', 'g'), String(value));
    }
  }
  return text;
}

function applyStatic() {
  document.documentElement.lang = LANG;
  for (const node of document.querySelectorAll('[data-i18n]')) {
    node.textContent = t(node.dataset.i18n);
  }
  for (const node of document.querySelectorAll('[data-i18n-placeholder]')) {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  }
  if (langSelect) langSelect.value = LANG;
}

function colourFor(score) {
  if (score >= 80) return '#15803d';
  if (score >= 55) return '#b45309';
  return '#b91c1c';
}

function setStatus(text, bad) {
  statusEl.textContent = text || '';
  statusEl.classList.toggle('bad', Boolean(bad));
}

function normalise(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : 'https://' + trimmed;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function icon(symbol, className) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'icon' + (className ? ' ' + className : ''));
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', '#i-' + symbol);
  svg.append(use);
  return svg;
}

function headlineKey(score) {
  if (score >= 90) return 'headline90';
  if (score >= 80) return 'headline80';
  if (score >= 70) return 'headline70';
  if (score >= 60) return 'headline60';
  return 'headline0';
}

function renderSummary(data) {
  const summary = el('div', 'summary');
  const colour = colourFor(data.score);

  const ring = el('div', 'ring');
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 132 132');
  svg.setAttribute('aria-hidden', 'true');
  const track = document.createElementNS(SVG_NS, 'circle');
  track.setAttribute('class', 'track');
  track.setAttribute('cx', '66');
  track.setAttribute('cy', '66');
  track.setAttribute('r', String(RING_RADIUS));
  const value = document.createElementNS(SVG_NS, 'circle');
  value.setAttribute('class', 'value');
  value.setAttribute('cx', '66');
  value.setAttribute('cy', '66');
  value.setAttribute('r', String(RING_RADIUS));
  value.setAttribute('stroke', colour);
  value.setAttribute('stroke-dasharray', String(RING_LENGTH));
  value.setAttribute('stroke-dashoffset', String(RING_LENGTH * (1 - data.score / 100)));
  svg.append(track, value);

  const centre = el('div', 'centre');
  const score = el('div', 'score', String(data.score));
  score.style.color = colour;
  centre.append(score, el('div', 'grade', t('grade', { g: data.grade })));
  ring.append(svg, centre);

  const info = el('div');
  info.append(el('h2', null, t(headlineKey(data.score))));
  info.append(el('p', 'url', data.finalUrl));

  const chips = el('div', 'chips');
  chips.append(
    el('span', 'chip', t('http', { code: data.status })),
    el('span', 'chip', t('response', { s: (data.timingMs / 1000).toFixed(1) })),
    el('span', 'chip', t('html', { kb: Math.round(data.bytes / 1024) })),
    el('span', 'chip', data.redirects === 0 ? t('noRedirects') : data.redirects === 1 ? t('redirectOne') : t('redirects', { n: data.redirects })),
  );
  info.append(chips);

  if (LANG !== 'en') {
    const rd = reportDict();
    if (rd && rd.note) info.append(el('p', 'translated-note', rd.note));
  }

  const actions = el('div', 'actions');
  const copy = el('button', null, t('copy'));
  copy.type = 'button';
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      copy.textContent = t('copied');
      setTimeout(() => { copy.textContent = t('copy'); }, 1600);
    } catch {
      copy.textContent = t('copyFailed');
    }
  });
  const again = el('button', null, t('another'));
  again.type = 'button';
  again.addEventListener('click', () => {
    resultEl.hidden = true;
    input.value = '';
    setStatus('');
    input.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  actions.append(copy, again);
  info.append(actions);

  summary.append(ring, info);
  return summary;
}

function renderGroup(group) {
  const issues = group.items.filter((entry) => entry.status !== 'pass').length;
  const details = document.createElement('details');
  details.className = 'group';
  if (group.score < 80) details.open = true;

  const summary = document.createElement('summary');
  const top = el('div', 'group-top');
  const score = el('span', 'group-score', group.score + '/100');
  score.style.color = colourFor(group.score);
  const heading = el('h3');
  const groupName = dict()['check_' + group.id + '_name'] || group.name;
  heading.append(icon(GROUP_ICON[group.id] || 'globe'), document.createTextNode(groupName));
  top.append(heading, score);

  const bar = el('div', 'group-bar');
  const fill = el('span');
  fill.style.width = group.score + '%';
  fill.style.background = colourFor(group.score);
  bar.append(fill);

  const note = el('div', 'group-note', issues === 0 ? t('allClear') : issues === 1 ? t('fixOne') : t('fixes', { n: issues }));
  summary.append(top, bar, note);

  const body = el('div', 'group-items');
  const rd = reportDict();
  for (const entry of group.items) {
    const row = el('div', 'item ' + entry.status);
    row.append(icon(STATUS_ICON[entry.status] || 'alert', 'status-icon'));
    const text = el('div');
    const label = (rd && rd.labels[entry.label]) || entry.label;
    text.append(el('b', null, label));
    if (entry.detail && LANG === 'en') text.append(el('p', 'detail', entry.detail));
    if (entry.status !== 'pass' && entry.fix) {
      const fixText = (rd && rd.fixes[entry.fix]) || entry.fix;
      const fix = el('p', 'fix', fixText);
      fix.dataset.label = t('doThis');
      text.append(fix);
    }
    row.append(text);
    body.append(row);
  }

  details.append(summary, body);
  return details;
}

function render(data) {
  resultEl.replaceChildren();
  resultEl.append(renderSummary(data));
  const groups = el('div', 'groups');
  for (const group of data.groups) groups.append(renderGroup(group));
  resultEl.append(groups);
  resultEl.hidden = false;
  resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function syncUrl(url) {
  const params = new URLSearchParams();
  if (url) params.set('url', url);
  if (LANG !== 'en') params.set('lang', LANG);
  const query = params.toString();
  history.replaceState(null, '', query ? '/?' + query : '/');
}

async function run(rawUrl) {
  const url = normalise(rawUrl);
  if (!url) return;
  LAST_URL = url;
  input.value = url;
  go.disabled = true;
  setStatus(t('reading'));
  resultEl.hidden = true;
  const started = Date.now();
  try {
    const response = await fetch('/api/audit?url=' + encodeURIComponent(url) + '&lang=' + LANG);
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || 'The page could not be checked.');
    syncUrl(url);
    render(data);
    setStatus(t('audited', { s: ((Date.now() - started) / 1000).toFixed(1) }));
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    go.disabled = false;
  }
}

function pickLang() {
  const query = new URLSearchParams(location.search).get('lang');
  if (query && SUPPORTED.includes(query)) return query;
  try {
    const saved = localStorage.getItem('pagecheck:lang');
    if (saved && SUPPORTED.includes(saved)) return saved;
  } catch { /* ignore */ }
  const nav = String(navigator.language || 'en').slice(0, 2).toLowerCase();
  return SUPPORTED.includes(nav) ? nav : 'en';
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  run(input.value);
});

for (const button of document.querySelectorAll('[data-url]')) {
  button.addEventListener('click', () => run(button.dataset.url));
}

if (langSelect) {
  langSelect.addEventListener('change', () => {
    const next = langSelect.value;
    if (!SUPPORTED.includes(next)) return;
    LANG = next;
    try { localStorage.setItem('pagecheck:lang', LANG); } catch { /* ignore */ }
    applyStatic();
    syncUrl(LAST_URL);
    if (LAST_URL) run(LAST_URL);
  });
}

LANG = pickLang();
try { localStorage.setItem('pagecheck:lang', LANG); } catch { /* ignore */ }
applyStatic();

const params = new URLSearchParams(location.search);
if (params.get('url')) run(params.get('url'));
