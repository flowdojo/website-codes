(function () {
  'use strict';

  var CONFIG = {
    // WORKER_URL: 'https://pivot-wealth-booking-worker.sahilpandey.workers.dev/',
    WORKER_URL: 'https://meeting.pivotwealth.workers.dev/',
    DURATION_MS: 900000, // 15 min, the only length the worker allows (the confirmed screen always says 15)

    OTP_ENABLED: true,
    // OTP_WORKER_URL: 'https://pivot-wealth-otp-worker.sahilpandey.workers.dev/',
    OTP_WORKER_URL: 'https://pw-otp-worker.pivotwealth.workers.dev/',
    OTP_RESEND_SECONDS: 30,
    OTP_AUTO_VERIFY: true,
    OTP_MAX_ATTEMPTS: 3,
    OTP_MAX_SENDS: 3,
    OTP_ADVANCE_DELAY_MS: 700,

    // Lowest value of the selected profit band must be >= this. PLACEHOLDER — client has not confirmed
    // the real threshold for business owners; $2,500/mo (the 3rd band) is a guess, change freely.
    QUALIFY_PROFIT_MIN: 2500,
    QUALIFY_INDIVIDUAL_MIN: 1500,
    QUALIFY_COUPLE_MIN: 2000,
    KEY_ADVICE: 'seeking_advice_for',
    KEY_SAVINGS_INDIVIDUAL: 'monthly_savings___individual',
    KEY_SAVINGS_COUPLE: 'monthly_savings___couple',
    SAVINGS_TITLE_INDIVIDUAL: 'How much do you save each month?',
    SAVINGS_TITLE_COUPLE: 'How much do you two save together each month?',
    // Field keys (mapped to HubSpot — confirm the real property names with the client before go-live;
    // these are placeholders, unlike hinry's which came from the client directly).
    KEY_PROFIT: 'monthly_business_profit',
    KEY_COMPANY: 'company_name',

    MAX_DATES: 5,
    MAX_TIMES: 8,
    MAX_MONTH_OFFSET: 3,
    CHECKING_MS: 2600,
    INTL_UTILS_URL: 'https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/js/utils.js',
    SUBMIT_TIMEOUT_MS: 20000,
    TZ_NOTE: 'Times shown in {tz}',

    RESCHEDULE_URL: '',
    // Optional link added to the downloaded calendar event. Empty = none (the call has no join link).
    MEETING_LINK: '',
    // "Watch this before your call" video in the confirmed card: 'all' (default), 'mobile' (tablet and below) or '' (hidden)
    CONFIRMED_VIDEO: 'all',

    PAGES: {
      owners: { FORM_NAME: 'pivot_wealth_vsl_owners', EXPERIMENT_NAME: 'business-owner-vsl', HERO_VIDEO_URL: 'https://youtu.be/px76e8gB_cs' },
      savings: { FORM_NAME: 'pivot_wealth_vsl', EXPERIMENT_NAME: 'hinry-vsl', HERO_VIDEO_URL: 'https://youtu.be/N4sagXG1d1g' },
    },
    // Success video ("Watch this before your call" in the confirmed card), the same on both pages.
    SUCCESS_VIDEO_URL: 'https://youtu.be/bFIbRSU2GCY',
    POSTHOG_FLAG: '',

  };

  var TZ = (function () {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch (e) {
      return 'UTC';
    }
  })();

  function qs(root, sel) {
    return root.querySelector(sel);
  }
  function qsa(root, sel) {
    return Array.prototype.slice.call(root.querySelectorAll(sel));
  }

  var ATTRIBUTION = (function () {
    var params = new URLSearchParams(window.location.search);
    return {
      gclid: params.get('gclid'),
      gbraid: params.get('gbraid'),
      wbraid: params.get('wbraid'),
      fbclid: params.get('fbclid'),
      msclkid: params.get('msclkid'),
      utm_source: params.get('utm_source'),
      utm_medium: params.get('utm_medium'),
      utm_campaign: params.get('utm_campaign'),
      utm_term: params.get('utm_term'),
      utm_content: params.get('utm_content'),
    };
  })();

  function withAttribution(props) {
    var merged = {};
    Object.keys(ATTRIBUTION).forEach(function (k) {
      merged[k] = ATTRIBUTION[k];
    });
    Object.keys(props || {}).forEach(function (k) {
      merged[k] = props[k];
    });
    return merged;
  }

  function rsReady() {
    return typeof window.rudderanalytics !== 'undefined' && typeof window.rudderanalytics.track === 'function';
  }
  function makeUuid() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  function rsIdentify(traits) {
    if (!rsReady()) {
      console.warn('[pivot-vsl-owners] rudderanalytics not found — skipping identify');
      return null;
    }
    var existing = typeof rudderanalytics.getUserId === 'function' ? rudderanalytics.getUserId() : null;
    var userId = existing && existing.indexOf('@') === -1 ? existing : makeUuid();
    try {
      rudderanalytics.identify(userId, traits);
      return userId;
    } catch (e) {
      console.error('[pivot-vsl-owners] rudderstack identify failed', e);
      return null;
    }
  }
  function rsTrack(event, props) {
    if (!rsReady()) {
      console.warn('[pivot-vsl-owners] rudderanalytics not found — skipping track:', event);
      return;
    }
    try {
      rudderanalytics.track(event, props);
    } catch (e) {
      console.error('[pivot-vsl-owners] rudderstack track failed', e);
    }
  }

  function dayKey(ms) {
    return new Date(ms).toLocaleDateString('en-CA', { timeZone: TZ });
  }
  function fmtTime(ms) {
    return new Date(ms).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true });
  }
  function fmtChipTime(ms) {
    return fmtTime(ms).replace(/\s?(AM|PM)$/i, function (m) {
      return m.trim().toLowerCase();
    });
  }
  function fmtChipDate(ms) {
    var d = new Date(ms);
    return d.toLocaleDateString('en-AU', { timeZone: TZ, weekday: 'short' }) + ' ' + d.toLocaleDateString('en-AU', { timeZone: TZ, day: 'numeric' });
  }
  function fmtLongDate(ms) {
    var d = new Date(ms);
    return (
      d.toLocaleDateString('en-AU', { timeZone: TZ, weekday: 'long' }) +
      ', ' +
      d.toLocaleDateString('en-AU', { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric' })
    );
  }
  function tzLabel(ms) {
    try {
      var parts = new Intl.DateTimeFormat('en-AU', { timeZone: TZ, timeZoneName: 'short' }).formatToParts(new Date(ms || Date.now()));
      for (var i = 0; i < parts.length; i++) if (parts[i].type === 'timeZoneName') return parts[i].value;
    } catch (e) {}
    return TZ;
  }
  function isEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }
  function toE164(raw) {
    var str = String(raw || '').trim();
    var digits = str.replace(/\D/g, '');
    if (!digits) return '';
    if (str.charAt(0) === '+') return digits.indexOf('610') === 0 ? '+61' + digits.slice(3) : '+' + digits;
    if (digits.indexOf('00') === 0) return '+' + digits.slice(2);
    if (digits.indexOf('61') === 0 && digits.length === 11) return '+' + digits;
    if (digits.charAt(0) !== '0' && digits.length >= 11) return '+' + digits;
    return '+61' + digits.replace(/^0/, '');
  }
  function isValidPhone(raw) {
    var e = toE164(raw);
    if (!e) return false;
    if (e.indexOf('+61') === 0) return /^\+614\d{8}$/.test(e);
    if (window.intlTelInputUtils) return !!window.intlTelInputUtils.isValidNumber(e, null);
    return e.length - 1 >= 8 && e.length - 1 <= 15;
  }
  function fmtPhone(raw) {
    var e = toE164(raw);
    if (/^\+614\d{8}$/.test(e)) {
      var n = '0' + e.slice(3);
      return n.slice(0, 4) + ' ' + n.slice(4, 7) + ' ' + n.slice(7);
    }
    return e;
  }
  function parseBandMin(choice) {
    if (!choice) return null;
    var sources = [choice.text, choice.value];
    for (var i = 0; i < sources.length; i++) {
      var s = String(sources[i] || '');
      var m = s.match(/\d[\d,]*/);
      if (m) {
        var n = parseInt(m[0].replace(/,/g, ''), 10);
        if (/under|less than|below|</i.test(s)) return n - 1;
        return n;
      }
    }
    return null;
  }
  function isCoupleChoice(choice) {
    if (!choice) return false;
    return /someone|couple|partner|both/i.test(choice.value + ' ' + choice.text);
  }
  function youtubeId(url) {
    var m = String(url || '').match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
    return m ? m[1] : null;
  }
  function icsPad(n) {
    return (n < 10 ? '0' : '') + n;
  }
  function toIcsDate(ms) {
    var d = new Date(ms);
    return d.getUTCFullYear() + icsPad(d.getUTCMonth() + 1) + icsPad(d.getUTCDate()) + 'T' + icsPad(d.getUTCHours()) + icsPad(d.getUTCMinutes()) + icsPad(d.getUTCSeconds()) + 'Z';
  }
  function icsEscape(text) {
    return String(text).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  }
  function isShown(el) {
    if (!el) return false;
    if (el.style.display === 'none') return false;
    return window.getComputedStyle(el).display !== 'none';
  }

  function createVsl(wrap, label) {
    var form = qs(wrap, 'form');
    var done = qs(wrap, '.w-form-done');
    var fail = qs(wrap, '.w-form-fail');
    var headerEl = qs(wrap, '.vsl-qf-progress, .owners-form-step-wrap');
    if (!form) {
      console.error('[pivot-vsl-owners:' + label + '] no <form> inside the wrap');
      return;
    }

    function log() {
      var a = Array.prototype.slice.call(arguments);
      a.unshift('[pivot-vsl-owners:' + label + ']');
      console.log.apply(console, a);
    }
    function err() {
      var a = Array.prototype.slice.call(arguments);
      a.unshift('[pivot-vsl-owners:' + label + ']');
      console.error.apply(console, a);
    }
    function stepEl(name) {
      return qs(wrap, '[vsl-step="' + name + '"]');
    }
    function field(name) {
      return qs(wrap, '[vsl-field="' + name + '"]');
    }
    function val(name) {
      var el = field(name);
      return el ? el.value.trim() : '';
    }

    var otpOn = CONFIG.OTP_ENABLED && !!stepEl('otp');
    // owners page: profit > details > mobile > otp > email. savings (hinry) page: advice > savings > details(+mobile) > otp > email.
    var mode = stepEl('advice') ? 'savings' : 'profit';
    var PAGE = CONFIG.PAGES[mode === 'savings' ? 'savings' : 'owners'];
    var hasMobileStep = !!stepEl('mobile');
    var sendStep = hasMobileStep ? 'mobile' : 'details';
    var questionSteps = (mode === 'savings' ? ['advice', 'savings', 'details'] : hasMobileStep ? ['profit', 'details', 'mobile'] : ['profit', 'details'])
      .concat(otpOn ? ['otp'] : [])
      .concat(['email']);

    var state = {
      step: questionSteps[0],
      busy: false,
      allowSubmit: false,
      submitted: false,
      failShown: false,
      submitWatch: null,
      contact: null,
      qualification: null,
      otpVerified: false,
      verifiedToken: '',
      otpSendError: '',
      otpSends: 0,
      otpAttempts: 0,
      otpLocked: false,
      otpVerifying: false,
      phoneE164: '',
      resendLeft: 0,
      resendTimer: null,
      emailCheck: { value: null, valid: null, reason: null, timer: null },
      iti: null,
      slots: [],
      byDay: {},
      dayKeys: [],
      selDay: null,
      selSlot: null,
      slotsPromise: null,
      bookResult: null,
      rsUserId: null,
    };

    function flagProps() {
      if (CONFIG.POSTHOG_FLAG && window.posthog && typeof window.posthog.getFeatureFlag === 'function') {
        var v = window.posthog.getFeatureFlag(CONFIG.POSTHOG_FLAG);
        if (v !== undefined && v !== null) return { experiment_variant: v };
      }
      return {};
    }
    function track(event, extra) {
      rsTrack(event, withAttribution(Object.assign({ form_name: PAGE.FORM_NAME, widget: label, experiment: PAGE.EXPERIMENT_NAME }, flagProps(), extra || {})));
    }

    function choice(group) {
      var g = qs(wrap, '[vsl-options="' + group + '"]');
      if (!g) return null;
      var r = qs(g, 'input[type="radio"]:checked');
      if (!r) return null;
      var lbl = r.closest('label');
      var t = lbl ? qs(lbl, '.w-form-label') : null;
      return { value: r.value, text: String((t ? t.textContent : r.value) || '').trim() };
    }
    function getQualification() {
      if (mode === 'savings') {
        var advice = choice('advice');
        var savings = choice('savings');
        var couple = isCoupleChoice(advice);
        var threshold = couple ? CONFIG.QUALIFY_COUPLE_MIN : CONFIG.QUALIFY_INDIVIDUAL_MIN;
        var smin = parseBandMin(savings);
        var sbase = { adviceFor: couple ? 'couple' : 'myself', adviceLabel: advice ? advice.text : '', savingsLabel: savings ? savings.text : '' };
        if (smin === null) {
          console.warn('[pivot-vsl-owners] could not read savings band — treating as qualified');
          return Object.assign(sbase, { checked: false, qualified: true });
        }
        return Object.assign(sbase, { checked: true, qualified: smin >= threshold, savingsMin: smin, threshold: threshold });
      }
      var profit = choice('profit');
      var min = parseBandMin(profit);
      var base = { profitLabel: profit ? profit.text : '' };
      if (min === null) {
        console.warn('[pivot-vsl-owners] could not read profit band — treating as qualified');
        return Object.assign(base, { checked: false, qualified: true });
      }
      return Object.assign(base, { checked: true, qualified: min >= CONFIG.QUALIFY_PROFIT_MIN, profitMin: min, threshold: CONFIG.QUALIFY_PROFIT_MIN });
    }
    function qualificationFields() {
      var q = state.qualification || {};
      var out = {};
      if (mode === 'savings') {
        if (q.adviceLabel) out[CONFIG.KEY_ADVICE] = q.adviceLabel;
        if (q.savingsLabel) out[q.adviceFor === 'couple' ? CONFIG.KEY_SAVINGS_COUPLE : CONFIG.KEY_SAVINGS_INDIVIDUAL] = q.savingsLabel;
        return out;
      }
      if (q.profitLabel) out[CONFIG.KEY_PROFIT] = q.profitLabel;
      return out;
    }
    // Identify always sends BOTH savings keys; the unanswered one is "" so an old HubSpot value is cleared.
    function identifyFields() {
      var q = state.qualification || {};
      if (mode !== 'savings') return qualificationFields();
      var out = {};
      if (q.adviceLabel) out[CONFIG.KEY_ADVICE] = q.adviceLabel;
      if (q.savingsLabel) {
        var couple = q.adviceFor === 'couple';
        out[CONFIG.KEY_SAVINGS_COUPLE] = couple ? q.savingsLabel : '';
        out[CONFIG.KEY_SAVINGS_INDIVIDUAL] = couple ? '' : q.savingsLabel;
      }
      return out;
    }
    function qualificationProps() {
      var q = state.qualification || {};
      return Object.assign({}, qualificationFields(), { qualified: q.checked ? q.qualified : null });
    }

    // Webflow field names follow the client's keys (placeholders — confirm with client).
    function setGroupName(group, key) {
      var g = qs(wrap, '[vsl-options="' + group + '"]');
      if (!g) return;
      qsa(g, 'input[type="radio"]').forEach(function (r) {
        r.name = key;
        r.setAttribute('data-name', key);
      });
    }

    function syncAdvice() {
      if (mode !== 'savings') return;
      var couple = isCoupleChoice(choice('advice'));
      setGroupName('advice', CONFIG.KEY_ADVICE);
      setGroupName('savings', couple ? CONFIG.KEY_SAVINGS_COUPLE : CONFIG.KEY_SAVINGS_INDIVIDUAL);
      var title = qs(wrap, '[vsl-title-individual]');
      if (title) {
        var txt = title.getAttribute(couple ? 'vsl-title-couple' : 'vsl-title-individual');
        if (txt) title.textContent = txt;
        return;
      }
      // the heading is a component prop (no attributes): find it by its text
      var sv = stepEl('savings');
      if (!sv) return;
      var want = couple ? CONFIG.SAVINGS_TITLE_COUPLE : CONFIG.SAVINGS_TITLE_INDIVIDUAL;
      var known = [CONFIG.SAVINGS_TITLE_INDIVIDUAL, CONFIG.SAVINGS_TITLE_COUPLE];
      qsa(sv, '*').some(function (el) {
        if (el.children.length === 0 && known.indexOf(el.textContent.trim()) > -1) {
          el.textContent = want;
          return true;
        }
        return false;
      });
    }

    function labelOf(btn) {
      if (btn.tagName === 'INPUT') return btn.value;
      var d = qs(btn, 'div');
      return (d || btn).textContent;
    }
    function setLabel(btn, text) {
      if (btn.tagName === 'INPUT') btn.value = text;
      else (qs(btn, 'div') || btn).textContent = text;
    }
    function setBtnDisabled(btn, on) {
      if (!btn) return;
      btn.classList.toggle('is-disabled', on);
      btn.setAttribute('aria-disabled', on ? 'true' : 'false');
      if (btn.tagName === 'INPUT' || btn.tagName === 'BUTTON') btn.disabled = on;
    }
    function setBusy(btn, text) {
      state.busy = true;
      if (!btn) return;
      if (btn._pvLabel === undefined) btn._pvLabel = labelOf(btn);
      if (text) setLabel(btn, text);
      setBtnDisabled(btn, true);
    }
    function clearBusy(btn) {
      state.busy = false;
      if (btn && btn._pvLabel !== undefined) {
        setLabel(btn, btn._pvLabel);
        btn._pvLabel = undefined;
      }
      refreshGate();
    }
    function primaryBtn(name) {
      var s = stepEl(name);
      return s ? qs(s, '[vsl-form-button="next"]') || qs(s, '[vsl-form-button="final-submit"]') : null;
    }

    // .vsl-owner-notice is display:none and only shows with .is-error / .is-success; the OTP
    // .vsl-otp-notification uses .error / .success. Set both so either element type works.
    function paintNotice(box, kind) {
      box.classList.toggle('error', kind === 'error');
      box.classList.toggle('is-error', kind === 'error');
      box.classList.toggle('success', kind === 'success');
      box.classList.toggle('is-success', kind === 'success');
    }

    function errBox(name) {
      if (name === 'otp') {
        var otpBox = qs(wrap, '[vsl-otp-error]');
        if (otpBox) return otpBox;
      }
      var s = stepEl(state.step);
      return (s && qs(s, '[vsl-error-msg-for="' + name + '"]')) || qs(wrap, '[vsl-error-msg-for="' + name + '"]');
    }
    function setError(name, msg, inputEl) {
      var box = errBox(name);
      if (box) {
        box.textContent = msg || '';
        paintNotice(box, msg ? 'error' : '');
      }
      if (inputEl) inputEl.classList.toggle('is-invalid', !!msg);
    }
    function setNotice(name, msg, kind) {
      var box = errBox(name);
      if (!box) return;
      box.textContent = msg || '';
      paintNotice(box, msg ? (kind === 'success' ? 'success' : 'error') : '');
    }

    function otpCode() {
      var s = stepEl('otp');
      return s
        ? qsa(s, '[vsl-otp-digit]')
            .map(function (i) {
              return i.value;
            })
            .join('')
        : '';
    }
    function stepValid(name) {
      switch (name) {
        case 'profit':
          return !!choice('profit');
        case 'advice':
          return !!choice('advice');
        case 'savings':
          return !!choice('savings');
        case 'details':
          return !!val('firstname') && !!val('lastname') && (!field('company') || !!val('company')) && (sendStep !== 'details' || isValidPhone(val('mobile')));
        case 'mobile':
          return isValidPhone(val('mobile'));
        case 'otp':
          return otpCode().length === 6;
        case 'email':
          return isEmail(val('email')) && state.emailCheck.valid !== false;
      }
      return true;
    }
    function updateBookButtons() {
      qsa(wrap, '[vsl-form-button="book"]').forEach(function (b) {
        if (b._pvLabel !== undefined) return;
        setBtnDisabled(b, !state.selSlot);
      });
    }
    function refreshGate() {
      if (state.busy) return;
      var b = primaryBtn(state.step);
      if (b) setBtnDisabled(b, !stepValid(state.step));
      updateBookButtons();
    }
    function updateProgress() {
      var i = questionSteps.indexOf(state.step);
      if (i < 0) return;
      var n = questionSteps.length;
      var lbl = qs(wrap, '[vsl-progress-label]');
      if (lbl) lbl.textContent = 'Step ' + (i + 1) + ' of ' + n;
      var lines = qsa(wrap, '[vsl-progress-line]');
      var active = lines.length ? Math.ceil(((i + 1) * lines.length) / n) : 0;
      lines.forEach(function (l, k) {
        var on = k < active;
        l.classList.toggle('is-active', on);
        var f = qs(l, '.step-line-fill');
        if (f) f.style.width = on ? '100%' : '0%';
      });
    }
    function focusFirst(name) {
      var el = null;
      if (name === 'details') el = field('firstname');
      else if (name === 'mobile') el = field('mobile');
      else if (name === 'otp') {
        if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return;
        el = qs(stepEl('otp'), '[vsl-otp-digit]');
      } else if (name === 'email') el = field('email');
      if (el) {
        try {
          el.focus({ preventScroll: true });
        } catch (e) {}
      }
    }
    // "checking" isn't a [vsl-step]: it is Webflow's own .w-form-done content, hidden again once we move on.
    // After a booking the "WATCH THIS" sticker (.show-on-success) appears; the hero video itself is left alone.
    function heroToSuccess() {
      qsa(document, '.show-on-success').forEach(function (el) {
        el.style.opacity = '1';
      });
    }

    function showStep(name, silent) {
      state.step = name;
      var inQ = questionSteps.indexOf(name) > -1;
      qsa(wrap, '[vsl-step]').forEach(function (el) {
        var s = el.getAttribute('vsl-step');
        el.classList.toggle('is-active', s === name || (s === 'form' && (inQ || name === 'checking')));
      });
      if (name !== 'checking' && isShown(done)) done.style.display = 'none';
      if (name === 'confirmed') heroToSuccess();
      if (headerEl) headerEl.style.display = inQ ? '' : 'none';
      if (inQ) updateProgress();
      refreshGate();
      if (!silent) {
        var r = wrap.getBoundingClientRect();
        if (r.top < 0 && wrap.scrollIntoView && !wrap.closest('[vsl-form-modal]')) wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
        focusFirst(name);
      }
    }
    function completeStep(name) {
      track('VSL Step Completed', { step: name, step_index: questionSteps.indexOf(name) + 1 });
    }

    function validateMobile(show) {
      var el = field('mobile');
      var v = val('mobile');
      var ok = !v || isValidPhone(v);
      if (show || !ok) setError('mobile', ok ? '' : 'Enter a valid mobile number.', el);
      else setError('mobile', '', el);
    }
    function emailRejectedMsg() {
      return "This email isn't accepted (" + (state.emailCheck.reason || 'invalid') + ').';
    }
    function checkEmail(v) {
      var c = state.emailCheck;
      if (c.value === v && c.valid !== null) return Promise.resolve(c);
      return fetch(CONFIG.WORKER_URL + '?action=validate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: v }),
      })
        .then(function (r) {
          return r.json();
        })
        .then(function (b) {
          var bad = !!(b && b.success && b.isValidEmail === false);
          if (bad) log('email rejected by HubSpot:', v, b.invalidReason);
          c.value = v;
          c.valid = !bad;
          c.reason = b ? b.invalidReason : null;
          return c;
        })
        .catch(function (e) {
          err('email validation check failed', e);
          c.value = v;
          c.valid = true;
          c.reason = null;
          return c;
        });
    }
    function onEmailInput() {
      var el = field('email');
      var v = val('email');
      var c = state.emailCheck;
      if (c.value !== v) {
        c.value = null;
        c.valid = null;
      }
      clearTimeout(c.timer);
      if (!v) {
        setError('email', '', el);
        return;
      }
      if (!isEmail(v)) {
        setError('email', 'Enter a valid email address.', el);
        return;
      }
      setError('email', '', el);
      c.timer = setTimeout(function () {
        checkEmail(v).then(function (r) {
          if (val('email') !== v) return;
          setError('email', r.valid === false ? emailRejectedMsg() : '', el);
          refreshGate();
        });
      }, 500);
    }

    function otpPost(action, body) {
      return fetch(CONFIG.OTP_WORKER_URL + '?action=' + action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(function (r) {
        return r.json().then(
          function (j) {
            j._ok = r.ok;
            j._status = r.status;
            return j;
          },
          function () {
            return { _ok: false };
          },
        );
      });
    }
    function sendOtp() {
      return otpPost('send-otp', { phone: state.phoneE164 })
        .then(function (j) {
          var ok = j._ok && j.success !== false;
          state.otpSendError = !ok && j._status === 429 ? j.message : '';
          if (ok) state.otpSends += 1;
          track(ok ? 'Phone Code Sent' : 'Phone Code Failed', {});
          return ok;
        })
        .catch(function (e) {
          err('send-otp failed', e);
          return false;
        });
    }
    function otpDigits() {
      var s = stepEl('otp');
      return s ? qsa(s, '[vsl-otp-digit]') : [];
    }
    function clearDigits() {
      otpDigits().forEach(function (d) {
        d.value = '';
      });
    }
    function setDigitsLocked(on) {
      otpDigits().forEach(function (d) {
        d.readOnly = on;
        d.style.opacity = on ? '0.6' : '';
        d.style.cursor = on ? 'not-allowed' : '';
      });
    }
    function startResendTimer() {
      clearInterval(state.resendTimer);
      state.resendLeft = CONFIG.OTP_RESEND_SECONDS;
      var s = stepEl('otp');
      var resend = s && qs(s, '[vsl-otp-resend]');
      var timer = s && qs(s, '[vsl-otp-timer]');
      function paint() {
        var capped = state.otpSends >= CONFIG.OTP_MAX_SENDS;
        if (resend) resend.classList.toggle('is-disabled', state.resendLeft > 0 || capped);
        var text = state.resendLeft > 0 ? 'Resend code in ' + state.resendLeft + 's' : capped ? 'Too many requests' : '';
        if (timer) timer.textContent = text;
        else if (resend) (qs(resend, 'div') || resend).textContent = text || 'Resend code';
      }
      paint();
      state.resendTimer = setInterval(function () {
        state.resendLeft -= 1;
        if (state.resendLeft <= 0) {
          state.resendLeft = 0;
          clearInterval(state.resendTimer);
        }
        paint();
      }, 1000);
    }
    function prepareOtpStep() {
      var s = stepEl('otp');
      var shown = fmtPhone(val('mobile'));
      var phoneEls = qsa(s, '[vsl-otp-phone]');
      phoneEls.forEach(function (el) {
        el.textContent = shown;
      });
      if (!phoneEls.length) {
        if (!state.otpPhoneNode) {
          var tw = document.createTreeWalker(s, NodeFilter.SHOW_TEXT);
          var n;
          while ((n = tw.nextNode())) {
            if (n.nodeValue.indexOf('04XX XXX XXX') > -1) {
              n._tpl = n.nodeValue;
              state.otpPhoneNode = n;
              break;
            }
          }
        }
        if (state.otpPhoneNode) state.otpPhoneNode.nodeValue = state.otpPhoneNode._tpl.replace('04XX XXX XXX', shown);
      }
      qsa(s, '[vsl-otp-phone-input]').forEach(function (el) {
        el.value = shown;
      });
      clearDigits();
      setDigitsLocked(false);
      state.otpAttempts = 0;
      state.otpLocked = false;
      setError('otp', '');
      setNotice('otp', 'Code sent. Check your SMS.', 'success');
      startResendTimer();
    }
    function addTokenField(token) {
      var f = qs(form, 'input[name="OTP-Token"]');
      if (!f) {
        f = document.createElement('input');
        f.type = 'hidden';
        f.name = 'OTP-Token';
        form.appendChild(f);
      }
      f.value = token;
    }
    function onVerify() {
      if (state.busy || state.otpVerifying || state.otpLocked || state.otpVerified || otpCode().length !== 6) return;
      var btn = primaryBtn('otp');
      state.otpVerifying = true;
      setBusy(btn, 'Verifying…');
      setDigitsLocked(true);
      setNotice('otp', 'Verifying…', 'success');
      otpPost('verify-otp', { phone: state.phoneE164, code: otpCode() })
        .then(function (j) {
          state.otpVerifying = false;
          clearBusy(btn);
          if (j._ok && j.success !== false && j.verified === true && j.verifiedToken) {
            state.otpVerified = true;
            state.verifiedToken = j.verifiedToken;
            addTokenField(j.verifiedToken);
            clearInterval(state.resendTimer);
            var os = stepEl('otp');
            var rs = os && qs(os, '[vsl-otp-resend]');
            var rt = os && qs(os, '[vsl-otp-timer]');
            if (rs) rs.classList.add('is-disabled');
            if (rt) rt.textContent = '';
            setNotice('otp', 'Phone number verified.', 'success');
            track('Phone Verified', {});
            setTimeout(function () {
              if (state.step === 'otp' && state.otpVerified) {
                completeStep('otp');
                showStep('email');
              }
            }, CONFIG.OTP_ADVANCE_DELAY_MS);
            return;
          }
          track('Phone Code Rejected', {});
          state.otpAttempts += 1;
          clearDigits();
          if (j.locked || state.otpAttempts >= CONFIG.OTP_MAX_ATTEMPTS) {
            state.otpLocked = true;
            setDigitsLocked(true);
            setNotice('otp', (j.locked && j.message) || 'Too many incorrect attempts. Please request a new code.', 'error');
            refreshGate();
            return;
          }
          var left = CONFIG.OTP_MAX_ATTEMPTS - state.otpAttempts;
          setDigitsLocked(false);
          setNotice('otp', 'Incorrect code. ' + left + (left === 1 ? ' attempt' : ' attempts') + ' left.', 'error');
          focusFirst('otp');
          refreshGate();
        })
        .catch(function (e) {
          err('verify-otp failed', e);
          state.otpVerifying = false;
          clearBusy(btn);
          setDigitsLocked(false);
          setNotice('otp', "Couldn't verify the code. Please try again.", 'error');
        });
    }
    function onResend() {
      if (state.resendLeft > 0 || state.busy || state.otpVerified || state.otpSends >= CONFIG.OTP_MAX_SENDS) return;
      setNotice('otp', 'Sending…', 'success');
      sendOtp().then(function (ok) {
        if (ok) {
          state.otpAttempts = 0;
          state.otpLocked = false;
          clearDigits();
          setDigitsLocked(false);
          setNotice('otp', 'Code sent. Check your SMS.', 'success');
          startResendTimer();
          focusFirst('otp');
        } else {
          setNotice('otp', state.otpSendError || "We couldn't send a new code. Please try again.", 'error');
        }
      });
    }
    function fillOtp(text, start) {
      var digits = otpDigits();
      text
        .slice(0, digits.length - start)
        .split('')
        .forEach(function (ch, k) {
          digits[start + k].value = ch;
        });
      digits[Math.min(start + text.length, digits.length - 1)].focus();
    }
    function setupOtpInputs() {
      var s = stepEl('otp');
      if (!s) return;
      var boxes = qsa(s, '[vsl-otp-digit]');
      boxes.forEach(function (i, idx) {
        i.setAttribute('maxlength', idx === 0 ? String(boxes.length) : '1');
        i.setAttribute('inputmode', 'numeric');
        i.setAttribute('autocomplete', idx === 0 ? 'one-time-code' : 'off');
        i.removeAttribute('required');
        i.removeAttribute('name');
        i.removeAttribute('data-name');
        i.id = label + '-otp-' + (idx + 1);
        i.setAttribute('aria-label', 'Digit ' + (idx + 1) + ' of ' + boxes.length);
        i.addEventListener('focus', function () {
          i.select();
        });
        i.addEventListener('paste', function (e) {
          var text = ((e.clipboardData || window.clipboardData).getData('text') || '').replace(/\D/g, '');
          if (!text || state.otpLocked || state.otpVerifying || state.otpVerified) return;
          e.preventDefault();
          fillOtp(text.slice(0, boxes.length), 0);
          setError('otp', '');
          refreshGate();
          if (CONFIG.OTP_AUTO_VERIFY && otpCode().length === boxes.length) onVerify();
        });
      });
      qsa(s, '[vsl-otp-phone-input]').forEach(function (el) {
        el.disabled = true;
        el.removeAttribute('required');
        el.removeAttribute('name');
        el.removeAttribute('data-name');
      });
    }
    function onOtpInput(e) {
      var digits = otpDigits();
      var i = digits.indexOf(e.target);
      if (i < 0) return;
      if (state.otpLocked || state.otpVerifying || state.otpVerified) return;
      var v = e.target.value.replace(/\D/g, '');
      if (v.length > 1) {
        e.target.value = '';
        fillOtp(v, v.length >= digits.length ? 0 : i);
      } else {
        e.target.value = v;
        if (v && i < digits.length - 1) digits[i + 1].focus();
      }
      setError('otp', '');
      refreshGate();
      if (CONFIG.OTP_AUTO_VERIFY && otpCode().length === digits.length) onVerify();
    }
    function onOtpKeydown(e) {
      var digits = otpDigits();
      var i = digits.indexOf(e.target);
      if (i < 0) return;
      if (e.key === 'Backspace' && !e.target.value && i > 0) {
        digits[i - 1].value = '';
        digits[i - 1].focus();
        e.preventDefault();
        refreshGate();
      } else if (e.key === 'ArrowLeft' && i > 0) {
        digits[i - 1].focus();
        e.preventDefault();
      } else if (e.key === 'ArrowRight' && i < digits.length - 1) {
        digits[i + 1].focus();
        e.preventDefault();
      }
    }

    function onNext() {
      var name = state.step;
      if (!stepValid(name)) return;
      if (name === sendStep) {
        onMobileNext();
      } else if (name === 'otp') {
        onVerify();
      } else {
        completeStep(name);
        showStep(questionSteps[questionSteps.indexOf(name) + 1]);
      }
    }
    function onMobileNext() {
      if (state.busy) return;
      tidyPhone();
      var phone = val('mobile');
      if (!isValidPhone(phone)) {
        validateMobile(true);
        return;
      }
      var e164 = toE164(phone);
      if (e164 !== state.phoneE164) {
        state.otpVerified = false;
        state.verifiedToken = '';
      }
      state.phoneE164 = e164;
      if (!otpOn) {
        completeStep(sendStep);
        showStep('email');
        return;
      }
      if (state.otpVerified) {
        completeStep(sendStep);
        showStep('email');
        return;
      }
      if (state.otpSends >= CONFIG.OTP_MAX_SENDS) {
        setError('mobile', 'Too many code requests. Please try again later.', field('mobile'));
        return;
      }
      var btn = primaryBtn(sendStep);
      setBusy(btn, 'Sending code…');
      sendOtp().then(function (ok) {
        clearBusy(btn);
        if (ok) {
          prepareOtpStep();
          completeStep(sendStep);
          showStep('otp');
        } else {
          setError('mobile', state.otpSendError || "We couldn't send a code. Check the number and try again.", field('mobile'));
        }
      });
    }
    function doNativeSubmit() {
      var btn = primaryBtn('email');
      log('submitting the Webflow form…');
      var original = btn ? btn.value : '';
      clearTimeout(state.submitWatch);
      state.submitWatch = setTimeout(function () {
        if (state.submitted || state.failShown) return;
        err('Webflow form did not answer within ' + CONFIG.SUBMIT_TIMEOUT_MS + 'ms (check Turnstile errors and the /api/v1/form request)');
        if (btn) {
          btn.value = original;
          setBtnDisabled(btn, false);
        }
        showStep('email', true);
        setError('email', "We couldn't send your details. Please refresh the page and try again.", field('email'));
      }, CONFIG.SUBMIT_TIMEOUT_MS);
      var ts = form.querySelector('[name="cf-turnstile-response"]');
      log('submit: Turnstile token ' + (ts ? (ts.value ? 'present' : 'EMPTY') : 'field missing (widget not rendered)'));
      state.allowSubmit = true;
      try {
        if (typeof form.requestSubmit === 'function') form.requestSubmit(btn || undefined);
        else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      } finally {
        state.allowSubmit = false;
      }
    }
    function onEmailSubmit() {
      if (state.busy) return;
      var v = val('email');
      var el = field('email');
      if (!isEmail(v)) {
        setError('email', 'Enter a valid email address.', el);
        return;
      }
      var btn = primaryBtn('email');
      setBusy(btn);
      checkEmail(v).then(function (r) {
        clearBusy(btn);
        if (r.valid === false) {
          setError('email', emailRejectedMsg(), el);
          refreshGate();
          return;
        }
        if (otpOn && !(state.otpVerified && state.verifiedToken)) {
          showStep(sendStep);
          return;
        }
        completeStep('email');
        doNativeSubmit();
      });
    }
    function primary() {
      if (state.step === 'email') onEmailSubmit();
      else onNext();
    }

    function readContact() {
      return { firstName: val('firstname'), lastName: val('lastname'), company: field('company') ? val('company') : '', email: val('email'), phone: toE164(val('mobile')) };
    }
    function onSubmitSuccess() {
      clearTimeout(state.submitWatch);
      log('Webflow accepted the form');
      state.contact = readContact();
      state.qualification = getQualification();
      log('contact:', state.contact, 'qualification:', state.qualification);

      qsa(wrap, '[vsl-first-name]').forEach(function (el) {
        el.textContent = state.contact.firstName;
      });

      var traits = Object.assign(
        { email: state.contact.email, phone: state.contact.phone, firstName: state.contact.firstName, lastName: state.contact.lastName, company: state.contact.company || undefined },
        identifyFields(),
      );
      state.rsUserId = rsIdentify(traits);

      track('Booking Step 1 Completed', Object.assign({ phone_verified: state.otpVerified }, qualificationProps()));

      showStep('checking', true);
      var wait = runChecking();
      state.slotsPromise = loadSlots();
      Promise.all([wait, state.slotsPromise]).then(route);
    }
    function onSubmitFail() {
      clearTimeout(state.submitWatch);
      err('Webflow form submission failed');
      setBtnDisabled(primaryBtn('email'), false);
      showStep('email', true);
      setError('email', 'Something went wrong. Please try again.', field('email'));
    }
    function watchSubmit() {
      var mo = new MutationObserver(function () {
        if (!state.submitted && isShown(done)) {
          state.submitted = true;
          onSubmitSuccess();
        }
        var failNow = isShown(fail);
        if (failNow && !state.failShown && !state.submitted) onSubmitFail();
        state.failShown = failNow;
      });
      [done, fail].forEach(function (el) {
        if (el) mo.observe(el, { attributes: true, attributeFilter: ['style', 'class'] });
      });
    }

    function setCheckItem(item, isDone) {
      item.classList.remove('checking', 'check-done', 'checking-done');
      item.classList.add(isDone ? 'checking-done' : 'checking');
      var doneIcon = qs(item, 'img.check-done');
      var spinIcon = qs(item, 'img.checking');
      if (doneIcon) doneIcon.style.display = isDone ? 'block' : 'none';
      if (spinIcon) spinIcon.style.display = isDone ? 'none' : 'block';
    }
    function runChecking() {
      var items = done ? qsa(done, '[vsl-check-item]') : [];
      items.forEach(function (it) {
        setCheckItem(it, false);
      });
      var per = CONFIG.CHECKING_MS / Math.max(items.length, 1);
      items.forEach(function (it, i) {
        setTimeout(function () {
          setCheckItem(it, true);
        }, per * (i + 1));
      });
      return new Promise(function (resolve) {
        setTimeout(resolve, CONFIG.CHECKING_MS + 300);
      });
    }
    function route() {
      var q = state.qualification;
      var target = q.qualified ? 'qualified' : 'objection';
      track(q.qualified ? 'Lead Qualified' : 'Lead Not Qualified', qualificationProps());
      renderSlots();
      showStep(target);
    }

    function fetchMonth(offset) {
      var url = CONFIG.WORKER_URL + '?duration=' + CONFIG.DURATION_MS + '&timezone=' + encodeURIComponent(TZ) + '&monthOffset=' + offset;
      return fetch(url)
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .then(function (data) {
          var byDur = ((data || {}).linkAvailability || {}).linkAvailabilityByDuration || {};
          var entry = byDur[String(CONFIG.DURATION_MS)] || byDur[CONFIG.DURATION_MS];
          var slots = entry ? entry.availabilities || [] : [];
          slots.forEach(function (s) {
            var exists = state.slots.some(function (x) {
              return x.startMillisUtc === s.startMillisUtc;
            });
            if (exists) return;
            state.slots.push(s);
            var k = dayKey(s.startMillisUtc);
            (state.byDay[k] = state.byDay[k] || []).push(s);
          });
          state.dayKeys = Object.keys(state.byDay).sort();
        });
    }
    function loadSlots() {
      state.slots = [];
      state.byDay = {};
      state.dayKeys = [];
      var offset = 0;
      function next() {
        return fetchMonth(offset).then(function () {
          if (state.dayKeys.length >= CONFIG.MAX_DATES || offset >= CONFIG.MAX_MONTH_OFFSET) return;
          offset += 1;
          return next();
        });
      }
      return next()
        .catch(function (e) {
          err('availability failed', e);
        })
        .then(function () {
          state.selDay = state.dayKeys[0] || null;
          state.selSlot = state.selDay ? pickTimes(state.selDay)[0] || null : null;
        });
    }
    function pickTimes(key) {
      var all = (state.byDay[key] || []).slice().sort(function (a, b) {
        return a.startMillisUtc - b.startMillisUtc;
      });
      var max = CONFIG.MAX_TIMES;
      if (all.length <= max) return all;
      var out = [];
      for (var i = 0; i < max; i++) out.push(all[Math.round((i * (all.length - 1)) / (max - 1))]);
      return out;
    }

    function templateFor(list, attr) {
      if (!list._pvTpl) {
        var t = qs(list, '[vsl-slot="' + attr + '"]');
        if (t) list._pvTpl = t.cloneNode(true);
      }
      return list._pvTpl || null;
    }
    function chipText(chip, text) {
      (qs(chip, 'div') || chip).textContent = text;
    }
    function makeClickable(chip, fn) {
      chip.setAttribute('role', 'button');
      chip.setAttribute('tabindex', '0');
      chip.addEventListener('click', fn);
      chip.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          fn();
        }
      });
    }
    function renderPicker(stepNode) {
      var dList = qs(stepNode, '[vsl-slot="date-list"]');
      var tList = qs(stepNode, '[vsl-slot="time-list"]');
      if (!dList || !tList) return;
      var dTpl = templateFor(dList, 'date-template');
      var tTpl = templateFor(tList, 'time-template');
      if (!dTpl || !tTpl) return;
      dList.textContent = '';
      tList.textContent = '';

      state.dayKeys.slice(0, CONFIG.MAX_DATES).forEach(function (key) {
        var first = state.byDay[key][0].startMillisUtc;
        var chip = dTpl.cloneNode(true);
        chip.setAttribute('vsl-slot', 'date');
        chip.classList.toggle('is-selected', key === state.selDay);
        chipText(chip, fmtChipDate(first));
        makeClickable(chip, function () {
          state.selDay = key;
          state.selSlot = pickTimes(key)[0] || null;
          renderSlots();
        });
        dList.appendChild(chip);
      });
      if (state.selDay) {
        pickTimes(state.selDay).forEach(function (slot) {
          var chip = tTpl.cloneNode(true);
          chip.setAttribute('vsl-slot', 'time');
          chip.classList.toggle('is-selected', !!state.selSlot && state.selSlot.startMillisUtc === slot.startMillisUtc);
          chipText(chip, fmtChipTime(slot.startMillisUtc));
          makeClickable(chip, function () {
            state.selSlot = slot;
            renderSlots();
          });
          tList.appendChild(chip);
        });
      }
    }
    function renderSlots() {
      ['qualified', 'objection'].forEach(function (name) {
        var s = stepEl(name);
        if (s) renderPicker(s);
      });
      var note = state.dayKeys.length
        ? CONFIG.TZ_NOTE.replace('{tz}', tzLabel(state.selSlot ? state.selSlot.startMillisUtc : null))
        : 'No times are available right now. Please check back soon.';
      qsa(wrap, '[vsl-tz-note]').forEach(function (el) {
        el.textContent = note;
      });
      updateBookButtons();
    }

    function showBookError(msg) {
      var s = stepEl(state.step);
      var box = s && qs(s, '[vsl-error-msg-for="book"]');
      if (box) {
        box.textContent = msg;
        paintNotice(box, 'error');
      } else {
        window.alert(msg);
      }
    }
    function clearBookError() {
      qsa(wrap, '[vsl-error-msg-for="book"]').forEach(function (b) {
        b.textContent = '';
        paintNotice(b, '');
      });
    }
    function doBooking() {
      var payload = {
        duration: CONFIG.DURATION_MS,
        startTime: state.selSlot.startMillisUtc,
        email: state.contact.email,
        firstName: state.contact.firstName,
        lastName: state.contact.lastName,
        timezone: TZ,
        locale: 'en-us',
        pageUrl: window.location.href,
        formFields: { phone: state.contact.phone }, // the worker only whitelists "phone" here
      };
      return fetch(CONFIG.WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(function (r) {
        return r.json().then(function (body) {
          if (!r.ok || body.success === false) {
            var e = new Error(body.message || 'Booking failed (' + r.status + ')');
            e.status = r.status;
            throw e;
          }
          return body;
        });
      });
    }
    function onBook(btn) {
      if (state.busy || !state.selSlot || !state.contact) return;
      var fromObjection = state.step === 'objection';
      if (fromObjection) track('Booking Objection Book Anyway', qualificationProps());
      clearBookError();
      setBusy(btn, 'Booking…');
      doBooking().then(
        function (result) {
          state.bookResult = result;
          clearBusy(btn);
          showConfirmed(result, fromObjection);
        },
        function (e) {
          err('booking failed', e);
          clearBusy(btn);
          track('Booking Failed', Object.assign({ error: e.message, status: e.status || null }, qualificationProps()));
          showBookError(e.message || 'Something went wrong. Please try again.');
          if (e.status === 409) {
            loadSlots().then(renderSlots);
          }
        },
      );
    }

    function showConfirmed(result, fromObjection) {
      var start = state.selSlot.startMillisUtc;
      var end = start + CONFIG.DURATION_MS;
      var tz = tzLabel(start);
      var set = function (key, text) {
        qsa(wrap, '[vsl-meet-info="' + key + '"]').forEach(function (el) {
          el.textContent = text;
        });
      };
      set('date', fmtLongDate(start));
      set('time', fmtTime(start) + ' – ' + fmtTime(end) + ' (' + tz + ')');
      set('type', 'Phone call · ' + Math.round(CONFIG.DURATION_MS / 60000) + ' minutes');

      track(
        'Booking Confirmed',
        Object.assign(
          {
            duration_ms: CONFIG.DURATION_MS,
            slot_start_utc: start,
            slot_time: fmtTime(start),
            booked_from: fromObjection ? 'objection' : 'qualified',
          },
          qualificationProps(),
        ),
      );
      showStep('confirmed');
    }
    function downloadIcs() {
      if (!state.selSlot) return;
      var start = state.selSlot.startMillisUtc;
      var lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Pivot Wealth//Intro Chat//EN',
        'BEGIN:VEVENT',
        'UID:' + makeUuid() + '@pivotwealth.com.au',
        'DTSTAMP:' + toIcsDate(Date.now()),
        'DTSTART:' + toIcsDate(start),
        'DTEND:' + toIcsDate(start + CONFIG.DURATION_MS),
        'SUMMARY:' + icsEscape('Pivot Wealth intro chat'),
        'DESCRIPTION:' + icsEscape('Someone from the Pivot Wealth team will call you on ' + (state.contact ? state.contact.phone : 'your registered number') + '.' + (CONFIG.MEETING_LINK ? ' Meeting link: ' + CONFIG.MEETING_LINK : '')),
      ];
      if (CONFIG.MEETING_LINK) {
        lines.push('LOCATION:' + icsEscape(CONFIG.MEETING_LINK), 'URL:' + CONFIG.MEETING_LINK);
      }
      lines = lines.concat([
        'END:VEVENT',
        'END:VCALENDAR',
      ]);
      try {
        var blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'pivot-wealth-intro-chat.ics';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        track('Calendar File Downloaded', {});
      } catch (e) {
        err('ics download failed', e);
      }
    }

    function playVideo(box) {
      if (box.getAttribute('data-vsl-playing')) return;
      var id = youtubeId(box.getAttribute('vsl-video-url'));
      if (!id) {
        console.warn('[pivot-vsl-owners] vsl-video has no valid YouTube vsl-video-url');
        return;
      }
      box.setAttribute('data-vsl-playing', '1');
      var iframe = document.createElement('iframe');
      iframe.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0';
      iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
      iframe.setAttribute('allowfullscreen', '');
      iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0';
      box.appendChild(iframe);
      track('Before Call Video Played', {});
    }

    function onClick(e) {
      var t = e.target;
      var btn = t.closest ? t.closest('[vsl-form-button]') : null;
      if (btn && wrap.contains(btn)) {
        var kind = btn.getAttribute('vsl-form-button');
        if (kind === 'next') {
          e.preventDefault();
          if (!btn.classList.contains('is-disabled')) onNext();
        } else if (kind === 'book') {
          e.preventDefault();
          if (!btn.classList.contains('is-disabled')) onBook(btn);
        }
        return;
      }
      var resend = t.closest('[vsl-otp-resend]');
      if (resend) {
        e.preventDefault();
        onResend();
        return;
      }
      var cal = t.closest('[vsl-button-name]');
      if (cal) {
        var name = cal.getAttribute('vsl-button-name');
        if (name === 'add-to-calendar') {
          e.preventDefault();
          downloadIcs();
        } else if (name === 'reschedule') {
          e.preventDefault();
          track('Reschedule Clicked', {});
          if (CONFIG.RESCHEDULE_URL) window.open(CONFIG.RESCHEDULE_URL, '_blank', 'noopener');
        }
        return;
      }
      var video = t.closest('[vsl-video]');
      if (video) {
        playVideo(video);
        return;
      }
      var link = t.closest('a[href]');
      var obj = stepEl('objection');
      if (link && obj && obj.contains(link) && !link.hasAttribute('vsl-form-button')) {
        var text = link.textContent || '';
        var resource = /challenge/i.test(text) ? 'challenge' : /book/i.test(text) ? 'pivot_book' : 'other';
        track(resource === 'challenge' ? 'Booking Objection Join Challenge' : 'Booking Objection Open Resource', Object.assign({ resource: resource }, qualificationProps()));
        var href = link.getAttribute('href');
        var newTab = link.getAttribute('target') === '_blank' || e.metaKey || e.ctrlKey;
        if (href && href !== '#' && !newTab) {
          e.preventDefault();
          setTimeout(function () {
            window.location.href = href;
          }, 250);
        }
      }
    }
    function onInput(e) {
      var t = e.target;
      if (t.hasAttribute && t.hasAttribute('vsl-otp-digit')) {
        onOtpInput(e);
        return;
      }
      var f = t.getAttribute && t.getAttribute('vsl-field');
      if (f === 'email') onEmailInput();
      else if (f === 'mobile') {
        if (t.classList.contains('is-invalid')) validateMobile(false);
      }
      refreshGate();
    }
    function onChange(e) {
      var t = e.target;
      if (t.type !== 'radio') return;
      var g = t.closest('[vsl-options]');
      if (!g) return;
      qsa(g, 'label').forEach(function (l) {
        var r = qs(l, 'input[type="radio"]');
        l.classList.toggle('is-selected', !!r && r.checked);
      });
      if (g.getAttribute('vsl-options') === 'advice') syncAdvice();
      refreshGate();
    }
    function onFocusOut(e) {
      var f = e.target.getAttribute && e.target.getAttribute('vsl-field');
      if (f === 'mobile') validateMobile(true);
    }
    function onKeydown(e) {
      if (e.target.hasAttribute && e.target.hasAttribute('vsl-otp-digit')) {
        onOtpKeydown(e);
        if (e.key !== 'Enter') return;
      }
      if (e.key !== 'Enter' || state.step === 'checking') return;
      if (!e.target.matches || !e.target.matches('input')) return;
      e.preventDefault();
      if (stepValid(state.step)) primary();
    }

    function setupPhoneInput(input) {
      var iti = null;
      if (typeof window.intlTelInput === 'function') {
        var existing = window.intlTelInputGlobals && window.intlTelInputGlobals.getInstance(input);
        if (!existing) {
          var opts = { initialCountry: 'au', allowDropdown: false, nationalMode: false, autoHideDialCode: false };
          if (!window.intlTelInputUtils) opts.utilsScript = CONFIG.INTL_UTILS_URL;
          iti = window.intlTelInput(input, opts);
        }
      } else {
        console.warn('[pivot-vsl-owners] intl-tel-input not found — mobile field works without the flag');
      }
      state.iti = iti;
      function caretAfterPrefix() {
        setTimeout(function () {
          if (input.value.replace(/\D/g, '') === '61') input.value = '+61 ';
          if (input.selectionStart === 0 && input.selectionEnd === 0) input.setSelectionRange(input.value.length, input.value.length);
        }, 0);
      }
      input.addEventListener('focus', caretAfterPrefix);
      input.addEventListener('click', caretAfterPrefix);
      input.addEventListener('blur', tidyPhone);
      input.addEventListener('input', function () {
        var fixed = input.value.replace(/^(\+61\s*)0/, '$1');
        if (fixed !== input.value) {
          var pos = Math.max((input.selectionStart || 1) - 1, 0);
          input.value = fixed;
          input.setSelectionRange(pos, pos);
        }
      });
    }
    function tidyPhone() {
      var e = toE164(val('mobile'));
      if (e && isValidPhone(e) && state.iti) state.iti.setNumber(e);
    }

    function init() {
      form.noValidate = true;
      // the Designer can't clear the default "Example Text" placeholder, so strip it here
      qsa(wrap, 'input').forEach(function (el) {
        if (el.getAttribute('placeholder') === 'Example Text') el.removeAttribute('placeholder');
      });
      var f;
      if ((f = field('firstname'))) f.setAttribute('autocomplete', 'given-name');
      if ((f = field('lastname'))) f.setAttribute('autocomplete', 'family-name');
      if ((f = field('company'))) {
        f.name = CONFIG.KEY_COMPANY;
        f.setAttribute('data-name', CONFIG.KEY_COMPANY);
        f.setAttribute('autocomplete', 'organization');
      }
      if ((f = field('mobile'))) {
        f.type = 'tel';
        f.setAttribute('inputmode', 'tel');
        f.setAttribute('autocomplete', 'tel');
        setupPhoneInput(f);
      }
      if ((f = field('email'))) {
        f.type = 'email';
        f.setAttribute('inputmode', 'email');
        f.setAttribute('autocomplete', 'email');
      }
      if (mode === 'savings') syncAdvice();
      else setGroupName('profit', CONFIG.KEY_PROFIT);
      setupOtpInputs();
      if (!otpOn) {
        var s = stepEl('otp');
        if (s) s.classList.remove('is-active');
      }
      // the Designer leaves both .error and .success on the OTP notice as a preview; start clean
      qsa(wrap, '[vsl-otp-error]').forEach(function (el) {
        el.textContent = '';
        el.classList.remove('error', 'success', 'is-error', 'is-success');
      });
      // "Wrong number?" would allow unlimited code requests, so it stays hidden
      qsa(wrap, '[vsl-otp-edit]').forEach(function (el) {
        el.style.display = 'none';
      });
      var rs = qs(wrap, '[vsl-button-name="reschedule"]');
      if (rs && !CONFIG.RESCHEDULE_URL) {
        // no reschedule link exists, so the button stays visible but disabled
        rs.classList.add('is-disabled');
        rs.setAttribute('aria-disabled', 'true');
        rs.setAttribute('tabindex', '-1');
        rs.style.opacity = '0.45';
        rs.style.cursor = 'not-allowed';
        rs.style.pointerEvents = 'none';
      }

      var heroId = youtubeId(PAGE.HERO_VIDEO_URL);
      if (heroId) {
        qsa(document, '.yt-facade[data-id]').forEach(function (f) {
          f.setAttribute('data-id', heroId);
        });
      }
      qsa(wrap, '[vsl-video="before-call"]').forEach(function (v) {
        if (!v.getAttribute('vsl-video-url') && CONFIG.SUCCESS_VIDEO_URL) v.setAttribute('vsl-video-url', CONFIG.SUCCESS_VIDEO_URL);
        var group = v.closest('.vsl-qf-flex-col') || v.parentElement;
        if (!group || CONFIG.CONFIRMED_VIDEO === 'all') return;
        if (CONFIG.CONFIRMED_VIDEO === 'mobile') group.classList.add('vsl-mobile-only');
        else group.style.display = 'none';
      });

      wrap.addEventListener('click', onClick);
      wrap.addEventListener('input', onInput);
      wrap.addEventListener('change', onChange);
      wrap.addEventListener('focusout', onFocusOut);
      wrap.addEventListener('keydown', onKeydown);
      form.addEventListener(
        'submit',
        function (e) {
          if (state.allowSubmit) return;
          e.preventDefault();
          e.stopImmediatePropagation();
          primary();
        },
        true,
      );
      watchSubmit();
      showStep(questionSteps[0], true);
      log('ready (' + questionSteps.join(' > ') + ')');
    }

    init();
  }

  // console-only: log Webflow's answer to the form POST (status and message, no form data)
  (function watchWebflowFormResponse() {
    if (!window.XMLHttpRequest || window.XMLHttpRequest.__pvVslWatched) return;
    var open = XMLHttpRequest.prototype.open;
    var send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url) {
      this.__pvUrl = String(url || '');
      return open.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function () {
      var xhr = this;
      if (/\/api\/v1\/form\//.test(xhr.__pvUrl)) {
        xhr.addEventListener('loadend', function () {
          var msg = '';
          try {
            msg = (JSON.parse(xhr.responseText) || {}).msg || '';
          } catch (e) {
            msg = String(xhr.responseText || '').slice(0, 120);
          }
          (xhr.status >= 200 && xhr.status < 300 ? console.log : console.error)('[pivot-vsl-owners] Webflow form POST answered ' + xhr.status + (msg ? ': ' + msg : ''));
        });
      }
      return send.apply(this, arguments);
    };
    XMLHttpRequest.__pvVslWatched = true;
  })();

  function boot() {
    var wrap = document.querySelector('.vsl-qf-wrap, .vsl-form-owners-wrap');
    if (!wrap || wrap._pvVsl) return;
    wrap._pvVsl = true;
    createVsl(wrap, wrap.getAttribute('vsl-owners-form') || 'vsl-owners-1');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
