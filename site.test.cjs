const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const htmlPath = path.join(root, 'index.html');
const scriptPath = path.join(root, 'intake.js');
const html = fs.readFileSync(htmlPath, 'utf8');

assert.match(html, /^<!doctype html>/i);
assert.match(html, /<html\s+lang="en">/i);
assert.match(html, /<title>AI App Rescue — \$250 Fixed-Scope Engineering Repair<\/title>/);
assert.match(html, /\$250 USD/);
assert.match(html, /TypeScript\s*\/\s*Node\.js/);
assert.match(html, /<link rel="icon" href="\.\/favicon\.svg" type="image\/svg\+xml" \/>/);
assert.match(html, /<link rel="apple-touch-icon" href="\.\/favicon\.svg" \/>/);
assert.match(html, /<noscript>/i);
assert.match(html, /nothing is submitted to a server/i);
assert.doesNotMatch(html, /90%\s*done/i);
assert.match(html, /hour 2/i);
assert.match(html, /48-hour delivery clock/i);
assert.match(html, /\$125 USD booking payment/i);
assert.match(html, /No production credentials/i);
assert.match(html, /AI-assisted source processing requires explicit written permission/i);
assert.match(html, /Example CLI output — not a customer incident/i);
assert.match(html, /PreviewFence/);
assert.doesNotMatch(html, /customer(?:s)?\s+(?:use|trust|rely)/i);

const allIds = Array.from(html.matchAll(/\bid="([^"]+)"/g), (match) => match[1]);
const ids = new Set(allIds);
assert.equal(allIds.length, ids.size, 'duplicate HTML id');
for (const id of [
  'scope',
  'booking',
  'proof',
  'intake',
  'intake-form',
  'intake-privacy',
  'project',
  'stack',
  'url',
  'url-hint',
  'broken',
  'reproduce',
  'reproduce-hint',
  'expected',
  'urgency',
  'copy-intake',
  'intake-status',
  'intake-preview'
]) {
  assert.equal(ids.has(id), true, 'missing required id: ' + id);
}

const requiredFields = ['project', 'stack', 'broken', 'reproduce', 'expected'];
for (const id of requiredFields) {
  assert.match(html, new RegExp('<(?:input|textarea)[^>]+id="' + id + '"[^>]+required'));
  assert.match(html, new RegExp('<label[^>]+for="' + id + '"'));
}
assert.match(html, /<input[^>]+id="url"[^>]+type="url"/);
assert.match(html, /<form[^>]+id="intake-form"[^>]+action="mailto:kickbsibz@gmail\.com"[^>]+method="post"[^>]+enctype="text\/plain"/);
assert.doesNotMatch(html, /<form[^>]+novalidate/i);
assert.match(html, /aria-describedby="intake-privacy"/);
assert.match(html, /id="url"[^>]+aria-describedby="url-hint"/);
assert.match(html, /id="reproduce"[^>]+aria-describedby="reproduce-hint"/);
assert.match(html, /id="intake-status"[^>]+role="status"[^>]+aria-live="polite"[^>]+tabindex="-1"/);
assert.match(html, /<nav[^>]+aria-label="Primary"/);
assert.match(html, /@media \(max-width: 820px\)/);
assert.match(html, /\.preview-card \{ position: static; \}/);
assert.match(html, /prefers-reduced-motion: reduce/);

for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
  const reference = match[1];
  if (reference.startsWith('#')) {
    assert.equal(ids.has(reference.slice(1)), true, 'broken fragment: ' + reference);
  } else if (reference.startsWith('./')) {
    assert.equal(fs.existsSync(path.join(root, reference.slice(2))), true, 'missing local asset: ' + reference);
  } else {
    assert.equal(reference.startsWith('/'), false, 'root-relative asset is not GitHub Pages-safe: ' + reference);
  }
}

assert.equal(fs.existsSync(scriptPath), true);
assert.equal(fs.existsSync(path.join(root, 'favicon.svg')), true);
assert.doesNotMatch(html, /<script[^>]+src=["']https?:/i);
assert.doesNotMatch(html, /<iframe\b/i);
assert.doesNotMatch(html, /\b(?:fetch|XMLHttpRequest|localStorage|sessionStorage|document\.cookie)\b/);
assert.equal(fs.existsSync(path.join(root, 'package.json')), false);

console.log('AI App Rescue site tests: PASS');
