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

assert.deepEqual(intake.requiredFieldsMissing(intake.normalizeIntake(valid)), []);
assert.equal(intake.validate(valid).ok, true);

const summary = intake.buildSummary(valid);
assert.match(summary, /Checkout Rescue/);
assert.match(summary, /Order should be marked paid exactly once/);
assert.match(summary, /Please do not send passwords/);

const mailto = intake.buildMailto(valid);
assert.ok(mailto.startsWith('mailto:kickbsibz@gmail.com?subject='));
assert.match(decodeURIComponent(mailto), /Checkout Rescue/);
assert.match(decodeURIComponent(mailto), /Stripe checkout succeeds/);

const missing = intake.validate({ ...valid, reproduce: '   ' });
assert.equal(missing.ok, false);
assert.match(missing.message, /How to reproduce it/);

const fakeGithubToken = ['gh', 'p_', '1234567890abcdefghijklmnop'].join('');
const githubToken = intake.validate({ ...valid, broken: `The token is ${fakeGithubToken}` });
assert.equal(githubToken.ok, false);
assert.match(githubToken.message, /GitHub token/);

const fakeStripeKey = ['sk', '_live_', '12345678901234567890'].join('');
const stripeKey = intake.validate({ ...valid, broken: `Using ${fakeStripeKey} here` });
assert.equal(stripeKey.ok, false);
assert.match(stripeKey.message, /Stripe-style key/);

const fakePrivateKey = ['-----BEGIN ', 'PRIVATE KEY-----\nabc'].join('');
const privateKey = intake.validate({ ...valid, broken: fakePrivateKey });
assert.equal(privateKey.ok, false);
assert.match(privateKey.message, /private key/);

const assignment = intake.validate({ ...valid, broken: 'password=supersecretvalue' });
assert.equal(assignment.ok, false);
assert.match(assignment.message, /credential assignment/);

const normalized = intake.normalizeIntake({ ...valid, project: `  ${'x'.repeat(150)}  ` });
assert.equal(normalized.project.length, 120);

console.log('AI App Rescue intake tests: PASS');
