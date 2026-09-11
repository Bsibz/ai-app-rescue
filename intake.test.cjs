const assert = require('node:assert/strict');
const intake = require('./intake.js');

const valid = {
  project: 'Checkout Rescue',
  stack: 'Next.js, TypeScript, Node, Stripe',
  url: 'https://example.com/repo',
  broken: 'Stripe checkout succeeds but the app never records the paid state.',
  reproduce: 'Use test checkout, complete payment, return to the app, refresh the order page.',
  expected: 'Order should be marked paid exactly once.',
  urgency: 'Would like to ship this week.'
};

async function main() {
  assert.deepEqual(intake.requiredFieldsMissing(intake.normalizeIntake(valid)), []);
  assert.equal(intake.validate(valid).ok, true);
  assert.equal(intake.validate(valid).mailtoTooLong, false);
  assert.deepEqual(intake.normalizeIntake(null), {
    project: '',
    stack: '',
    url: '',
    broken: '',
    reproduce: '',
    expected: '',
    urgency: ''
  });

  const multiline = intake.normalizeIntake({
    ...valid,
    project: '  Checkout\n  Rescue  ',
    broken: '  line one\r\nline two  '
  });
  assert.equal(multiline.project, 'Checkout Rescue');
  assert.equal(multiline.broken, 'line one\nline two');

  const summary = intake.buildSummary(valid);
  assert.match(summary, /Checkout Rescue/);
  assert.match(summary, /Order should be marked paid exactly once/);
  assert.match(summary, /Please do not send passwords/);

  const mailto = intake.buildMailto({
    ...valid,
    project: 'Demo & #?',
    url: 'https://example.com/?a=1&b=2',
    broken: 'line 1\nline 2'
  });
  assert.ok(mailto.startsWith('mailto:kickbsibz@gmail.com?subject='));
  assert.equal((mailto.match(/&/g) || []).length, 1);
  assert.match(mailto, /%26/);
  const bodyStart = mailto.indexOf('&body=');
  assert.ok(bodyStart > 0);
  assert.match(decodeURIComponent(mailto.slice(0, bodyStart)), /Demo & #\?/);
  assert.match(decodeURIComponent(mailto.slice(bodyStart + '&body='.length)), /line 1\nline 2/);

  const missing = intake.validate({ ...valid, reproduce: '   ' });
  assert.equal(missing.ok, false);
  assert.equal(missing.field, 'reproduce');
  assert.match(missing.message, /How to reproduce it/);

  assert.equal(intake.publicUrlError(''), null);
  assert.equal(intake.validate({ ...valid, url: '   ' }).ok, true);
  const emptyOptional = intake.buildSummary({ ...valid, url: '   ', urgency: '\n\t' });
  assert.match(emptyOptional, /Public URL \/ repo:\nNot provided/);
  assert.match(emptyOptional, /Urgency \/ timing:\nFlexible/);
  for (const url of [
    'not a url',
    'example.com/repo',
    'javascript:alert(1)',
    'data:text/plain,hello',
    'https://',
    'https://example.com/a b'
  ]) {
    assert.equal(intake.validate({ ...valid, url }).ok, false, url);
  }
  const credentialUrl = intake.validate({ ...valid, url: 'https://user:pass@example.com/repo' });
  assert.equal(credentialUrl.ok, false);
  assert.match(credentialUrl.message, /username or password/);
  assert.equal(intake.validate({ ...valid, url: 'http://localhost:3000/repo' }).ok, true);

  const unicodeBoundary = { ...valid, project: 'x'.repeat(119) + '😀' };
  assert.equal(intake.normalizeIntake(unicodeBoundary).project.length, 119);
  assert.doesNotThrow(() => intake.buildMailto(unicodeBoundary));
  assert.doesNotThrow(() => intake.buildMailto({ ...valid, project: 'x'.repeat(118) + '\ud800' }));

  const longIntake = intake.validate({
    ...valid,
    url: '',
    broken: '😀'.repeat(700),
    reproduce: '😀'.repeat(900)
  });
  assert.equal(longIntake.ok, true);
  assert.equal(longIntake.mailtoTooLong, true);
  assert.ok(longIntake.mailtoLength > intake.MAX_MAILTO_LENGTH);
  assert.equal(longIntake.message, intake.MAILTO_TOO_LONG_MESSAGE);

  const fakeGithubToken = ['gh', 'p_', '1234567890abcdefghijklmnop'].join('');
  const githubToken = intake.validate({ ...valid, broken: 'The token is ' + fakeGithubToken });
  assert.equal(githubToken.ok, false);
  assert.match(githubToken.message, /GitHub token/);

  const fakeStripeKey = ['sk', '_live_', '12345678901234567890'].join('');
  const stripeKey = intake.validate({ ...valid, broken: 'Using ' + fakeStripeKey + ' here' });
  assert.equal(stripeKey.ok, false);
  assert.match(stripeKey.message, /Stripe-style key/);

  const fakePrivateKey = ['-----BEGIN ', 'PRIVATE KEY-----\nabc'].join('');
  const privateKey = intake.validate({ ...valid, broken: fakePrivateKey });
  assert.equal(privateKey.ok, false);
  assert.match(privateKey.message, /private key/);

  const assignment = intake.validate({ ...valid, broken: 'password=supersecretvalue' });
  assert.equal(assignment.ok, false);
  assert.match(assignment.message, /credential assignment/);

  const namespacedAssignment = intake.validate({ ...valid, broken: 'OPENAI_API_KEY=abcdefgh12345678' });
  assert.equal(namespacedAssignment.ok, false);
  assert.match(namespacedAssignment.message, /credential assignment/);

  const jwt = intake.validate({
    ...valid,
    broken: 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
  });
  assert.equal(jwt.ok, false);
  assert.match(jwt.message, /JSON Web Token/);

  assert.equal(intake.findPotentialSecret({ ...valid, broken: 'Use token: placeholder in this example.' }), null);
  assert.equal(intake.findPotentialSecret(null), null);

  const originalGlobals = {};
  for (const name of ['window', 'navigator', 'document']) {
    originalGlobals[name] = Object.getOwnPropertyDescriptor(globalThis, name);
  }

  let appended;
  let removed = false;
  let executed = false;
  let restoredFocus = false;
  const activeElement = { focus() { restoredFocus = true; } };
  const textarea = {
    value: '',
    style: {},
    setAttribute() {},
    focus() {},
    select() {},
    remove() { removed = true; }
  };

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { isSecureContext: true }
  });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { clipboard: { writeText() { return Promise.reject(new Error('permission')); } } }
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      activeElement,
      body: { appendChild(node) { appended = node; } },
      createElement() { return textarea; },
      execCommand(command) {
        executed = command === 'copy';
        return true;
      }
    }
  });

  await intake.copyText('fallback copy');
  assert.equal(appended, textarea);
  assert.equal(textarea.value, 'fallback copy');
  assert.equal(executed, true);
  assert.equal(removed, true);
  assert.equal(restoredFocus, true);

  for (const name of ['window', 'navigator', 'document']) {
    if (originalGlobals[name]) {
      Object.defineProperty(globalThis, name, originalGlobals[name]);
    } else {
      delete globalThis[name];
    }
  }

  const normalized = intake.normalizeIntake({ ...valid, project: '  ' + 'x'.repeat(150) + '  ' });
  assert.equal(normalized.project.length, 120);

  console.log('AI App Rescue intake tests: PASS');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
