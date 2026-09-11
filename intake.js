(function (global) {
  'use strict';

  const DESTINATION_EMAIL = 'kickbsibz@gmail.com';
  const DEFAULT_SUBJECT = 'AI App Rescue — $250 fixed-scope repair';
  const MAX_MAILTO_LENGTH = 8000;
  const MAILTO_TOO_LONG_MESSAGE =
    'This intake is too long for a reliable prefilled email link. Shorten the description or use Copy summary instead.';

  const SECRET_PATTERNS = [
    { label: 'private key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH |)?PRIVATE KEY-----/i },
    { label: 'GitHub token', pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/ },
    { label: 'Stripe-style key', pattern: /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{12,}\b/ },
    { label: 'AWS access key', pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
    { label: 'Google API key', pattern: /\bAIza[0-9A-Za-z_-]{30,}\b/ },
    { label: 'Slack token', pattern: /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/ },
    { label: 'JSON Web Token', pattern: /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/ },
    { label: 'OpenAI-style key', pattern: /\bsk-(?:proj-|org-)?[A-Za-z0-9_-]{20,}\b/ },
    { label: 'bearer token', pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}\b/i }
  ];

  const CREDENTIAL_ASSIGNMENT_PATTERN =
    /\b(?:[A-Za-z][A-Za-z0-9]*[_-])*?(?:api[_-]?key|secret|token|password|passwd|auth[_-]?token|access[_-]?token)\b\s*(?:=|:)\s*(?:"([^"\r\n]{8,})"|'([^'\r\n]{8,})'|([^\s,;]{8,}))/i;

  function toWellFormed(value) {
    if (typeof value.toWellFormed === 'function') return value.toWellFormed();

    let result = '';
    for (let index = 0; index < value.length; index += 1) {
      const code = value.charCodeAt(index);
      const nextCode = value.charCodeAt(index + 1);

      if (code >= 0xd800 && code <= 0xdbff) {
        if (nextCode >= 0xdc00 && nextCode <= 0xdfff) {
          result += value.slice(index, index + 2);
          index += 1;
        } else {
          result += '\ufffd';
        }
      } else if (code >= 0xdc00 && code <= 0xdfff) {
        result += '\ufffd';
      } else {
        result += value[index];
      }
    }
    return result;
  }

  function normalize(value, maxLength) {
    const text = toWellFormed(value == null ? '' : String(value))
      .replace(/\r\n?/g, '\n')
      .trim();
    const limited = text.slice(0, maxLength);
    const lastCode = limited.charCodeAt(limited.length - 1);
    return lastCode >= 0xd800 && lastCode <= 0xdbff ? limited.slice(0, -1) : limited;
  }

  function normalizeSingleLine(value, maxLength) {
    return normalize(value, maxLength).replace(/\s+/g, ' ');
  }

  function normalizeIntake(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    return {
      project: normalizeSingleLine(source.project, 120),
      stack: normalizeSingleLine(source.stack, 180),
      url: normalizeSingleLine(source.url, 260),
      broken: normalize(source.broken, 700),
      reproduce: normalize(source.reproduce, 900),
      expected: normalize(source.expected, 600),
      urgency: normalizeSingleLine(source.urgency, 180)
    };
  }

  function requiredFieldEntries(data) {
    return [
      ['project', 'Project / app name'],
      ['stack', 'Stack'],
      ['broken', 'What is broken'],
      ['reproduce', 'How to reproduce it'],
      ['expected', 'Expected behavior']
    ].filter(([key]) => !data[key]);
  }

  function requiredFieldsMissing(raw) {
    return requiredFieldEntries(normalizeIntake(raw)).map(([, label]) => label);
  }

  function publicUrlError(value) {
    if (!value) return null;
    if (/[\u0000-\u0020\u007f]/.test(value)) {
      return 'Enter a valid public http(s) URL or leave the URL blank.';
    }

    try {
      const parsed = new URL(value);
      if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
        return 'Enter a valid public http(s) URL or leave the URL blank.';
      }
      if (parsed.username || parsed.password) {
        return 'Remove username or password information from the public URL.';
      }
    } catch (_error) {
      return 'Enter a valid public http(s) URL or leave the URL blank.';
    }

    return null;
  }

  function isLikelyPlaceholderValue(value) {
    const candidate = value.trim().replace(/[.,!?;:]+$/g, '');
    return /^(?:<[^>\r\n]+>|redacted|removed|placeholder|example|sample|dummy|fake|test|todo|null|undefined|(?:change|replace)[-_ ]?me|(?:example|sample|dummy|fake|test)[-_ ]?(?:key|token|secret|value|password|credential)(?:[-_ ]here)?|your[-_ ]?(?:api[-_ ]?)?(?:key|token|secret|password)(?:[-_ ]here)?|x{3,}|\*{3,})$/i.test(candidate);
  }

  function findPotentialSecret(raw) {
    const combined = Object.values(normalizeIntake(raw)).join('\n');
    for (const entry of SECRET_PATTERNS) {
      if (entry.pattern.test(combined)) return entry.label;
    }

    const assignment = combined.match(CREDENTIAL_ASSIGNMENT_PATTERN);
    if (assignment) {
      const value = assignment.slice(1).find(Boolean) || '';
      if (!isLikelyPlaceholderValue(value)) return 'credential assignment';
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

    return rows.map(([label, value]) => label + ':\n' + value).join('\n\n') +
      '\n\n---\nPlease do not send passwords, API keys, tokens, private customer data, or other credentials.';
  }

  function encodeMailtoComponent(value) {
    return encodeURIComponent(toWellFormed(String(value)));
  }

  function buildMailto(raw) {
    const data = normalizeIntake(raw);
    const suffix = data.project ? ' — ' + data.project : '';
    const subject = DEFAULT_SUBJECT + suffix;
    const body = buildSummary(data);
    return 'mailto:' + DESTINATION_EMAIL +
      '?subject=' + encodeMailtoComponent(subject) +
      '&body=' + encodeMailtoComponent(body);
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
    const browserNavigator = typeof navigator !== 'undefined' ? navigator : null;
    const browserWindow = typeof window !== 'undefined' ? window : null;
    const clipboard = browserNavigator && browserNavigator.clipboard;

    if (clipboard && typeof clipboard.writeText === 'function' && browserWindow && browserWindow.isSecureContext) {
      try {
        await clipboard.writeText(text);
        return;
      } catch (_error) {
        // Try the legacy path before asking the visitor to copy manually.
      }
    }

    if (typeof document === 'undefined' || !document.createElement || !document.body) {
      throw new Error('copy_unavailable');
    }

    const textarea = document.createElement('textarea');
    const activeElement = document.activeElement;
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.setAttribute('aria-hidden', 'true');
    textarea.style.position = 'fixed';
    textarea.style.top = '-1000px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);

    let copied = false;
    try {
      textarea.focus();
      textarea.select();
      copied = typeof document.execCommand === 'function' && document.execCommand('copy');
    } finally {
      textarea.remove();
      if (activeElement && activeElement !== document.body && typeof activeElement.focus === 'function') {
        activeElement.focus();
      }
    }

    if (!copied) throw new Error('copy_failed');
  }

  function validate(raw) {
    const data = normalizeIntake(raw);
    const missing = requiredFieldEntries(data);
    if (missing.length) {
      return {
        ok: false,
        field: missing[0][0],
        message: 'Please fill in: ' + missing.map(([, label]) => label).join(', ') + '.'
      };
    }

    const urlError = publicUrlError(data.url);
    if (urlError) return { ok: false, field: 'url', message: urlError };

    const secret = findPotentialSecret(data);
    if (secret) {
      return {
        ok: false,
        message: 'Potential ' + secret + ' detected. Remove credentials or secret values before creating the email draft.'
      };
    }

    const mailtoLength = buildMailto(data).length;
    return {
      ok: true,
      data,
      mailtoLength,
      mailtoTooLong: mailtoLength > MAX_MAILTO_LENGTH,
      message: mailtoLength > MAX_MAILTO_LENGTH ? MAILTO_TOO_LONG_MESSAGE : ''
    };
  }

  function clearInvalidFields(form) {
    for (const id of ['project', 'stack', 'url', 'broken', 'reproduce', 'expected', 'urgency']) {
      const field = document.getElementById(id);
      if (field && field.form === form) field.removeAttribute('aria-invalid');
    }
  }

  function showValidationError(form, status, result) {
    clearInvalidFields(form);
    if (result.field) {
      const field = document.getElementById(result.field);
      if (field && field.form === form) field.setAttribute('aria-invalid', 'true');
    }
    setStatus(status, result.message, 'error');
    if (typeof status.focus === 'function') {
      try {
        status.focus({ preventScroll: true });
      } catch (_error) {
        status.focus();
      }
    }
  }

  function initBrowser() {
    const form = document.getElementById('intake-form');
    if (!form) return;

    const status = document.getElementById('intake-status');
    const preview = document.getElementById('intake-preview');
    const copyButton = document.getElementById('copy-intake');
    if (!status || !preview || !copyButton) return;

    // Native required/type checks remain the no-JS fallback. JS uses one
    // deterministic message path for secrets and the optional URL as well.
    form.noValidate = true;

    function refreshPreview() {
      const data = extractFormData(form);
      preview.textContent = buildSummary(data);
      clearInvalidFields(form);
      setStatus(status, '', 'info');
    }

    form.addEventListener('input', refreshPreview);

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      const data = extractFormData(form);
      const result = validate(data);
      preview.textContent = buildSummary(data);

      if (!result.ok) {
        showValidationError(form, status, result);
        return;
      }

      clearInvalidFields(form);
      if (result.mailtoTooLong) {
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
        showValidationError(form, status, result);
        return;
      }

      clearInvalidFields(form);
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
    MAX_MAILTO_LENGTH,
    MAILTO_TOO_LONG_MESSAGE,
    normalizeIntake,
    requiredFieldsMissing,
    publicUrlError,
    findPotentialSecret,
    buildSummary,
    buildMailto,
    copyText,
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
