(function (global) {
  'use strict';

  const DESTINATION_EMAIL = 'kickbsibz@gmail.com';
  const DEFAULT_SUBJECT = 'AI App Rescue — $250 fixed-scope repair';

  const SECRET_PATTERNS = [
    { label: 'private key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH |)?PRIVATE KEY-----/i },
    { label: 'GitHub token', pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
    { label: 'Stripe-style key', pattern: /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{12,}\b/ },
    { label: 'AWS access key', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
    { label: 'credential assignment', pattern: /\b(?:api[_-]?key|secret|token|password|passwd)\s*[:=]\s*[^\s]{8,}/i }
  ];

  function normalize(value, maxLength) {
    return String(value || '')
      .replace(/\r\n?/g, '\n')
      .trim()
      .slice(0, maxLength);
  }

  function normalizeIntake(raw) {
    return {
      project: normalize(raw.project, 120),
      stack: normalize(raw.stack, 180),
      url: normalize(raw.url, 260),
      broken: normalize(raw.broken, 700),
      reproduce: normalize(raw.reproduce, 900),
      expected: normalize(raw.expected, 600),
      urgency: normalize(raw.urgency, 180)
    };
  }

  function requiredFieldsMissing(data) {
    return [
      ['project', 'Project / app name'],
      ['stack', 'Stack'],
      ['broken', 'What is broken'],
      ['reproduce', 'How to reproduce it'],
      ['expected', 'Expected behavior']
    ].filter(([key]) => !data[key]).map(([, label]) => label);
  }

  function findPotentialSecret(data) {
    const combined = Object.values(data).join('\n');
    for (const entry of SECRET_PATTERNS) {
      if (entry.pattern.test(combined)) return entry.label;
    }
    return null;
  }

  function buildSummary(raw) {
    const data = normalizeIntake(raw);
    const rows = [
      ['Project / app', data.project],
      ['Stack', data.stack],
      ['Public URL / repo', data.url || 'Not provided'],
      ['Broken workflow', data.broken],
      ['How to reproduce', data.reproduce],
      ['Expected behavior', data.expected],
      ['Urgency / timing', data.urgency || 'Flexible']
    ];

    return rows.map(([label, value]) => `${label}:\n${value}`).join('\n\n') +
      '\n\n---\nPlease do not send passwords, API keys, tokens, private customer data, or other credentials.';
  }

  function buildMailto(raw) {
    const data = normalizeIntake(raw);
    const suffix = data.project ? ` — ${data.project}` : '';
    const subject = `${DEFAULT_SUBJECT}${suffix}`;
    const body = buildSummary(data);
    return `mailto:${DESTINATION_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function extractFormData(form) {
    const formData = new FormData(form);
    return normalizeIntake(Object.fromEntries(formData.entries()));
  }

  function setStatus(element, message, kind) {
    element.textContent = message;
    element.dataset.kind = kind || 'info';
    element.hidden = !message;
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error('copy_failed');
  }

  function validate(raw) {
    const data = normalizeIntake(raw);
    const missing = requiredFieldsMissing(data);
    if (missing.length) {
      return { ok: false, message: `Please fill in: ${missing.join(', ')}.` };
    }

    const secret = findPotentialSecret(data);
    if (secret) {
      return {
        ok: false,
        message: `Potential ${secret} detected. Remove credentials or secret values before creating the email draft.`
      };
    }

    return { ok: true };
  }

  function initBrowser() {
    const form = document.getElementById('intake-form');
    if (!form) return;

    const status = document.getElementById('intake-status');
    const preview = document.getElementById('intake-preview');
    const copyButton = document.getElementById('copy-intake');

    function refreshPreview() {
      const data = extractFormData(form);
      preview.textContent = buildSummary(data);
      setStatus(status, '', 'info');
    }

    form.addEventListener('input', refreshPreview);

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      const data = extractFormData(form);
      const result = validate(data);
      preview.textContent = buildSummary(data);

      if (!result.ok) {
        setStatus(status, result.message, 'error');
        return;
      }

      setStatus(status, 'Opening a prefilled email draft. Nothing from this form was sent to a server.', 'success');
      window.location.href = buildMailto(data);
    });

    copyButton.addEventListener('click', async function () {
      const data = extractFormData(form);
      const result = validate(data);
      preview.textContent = buildSummary(data);

      if (!result.ok) {
        setStatus(status, result.message, 'error');
        return;
      }

      try {
        await copyText(buildSummary(data));
        setStatus(status, 'Intake summary copied. Paste it into your email or message app.', 'success');
      } catch (_error) {
        setStatus(status, 'Could not copy automatically. Select the preview text and copy it manually.', 'error');
      }
    });

    refreshPreview();
  }

  const api = {
    normalizeIntake,
    requiredFieldsMissing,
    findPotentialSecret,
    buildSummary,
    buildMailto,
    validate
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AIAppRescueIntake = api;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initBrowser);
    } else {
      initBrowser();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
