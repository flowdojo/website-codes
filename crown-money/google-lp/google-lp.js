

 window.CrownForm = Object.assign(window.CrownForm || { forms: [], type: null }, {
  show: function (type) {
    type = String(type).replace('-form', '');
    document.querySelectorAll('[data-form-wrapper] [data-form="long-form"], [data-form-wrapper] [data-form="short-form"]').forEach(function (el) {
      el.classList.toggle('is-active', el.getAttribute('data-form') === type + '-form');
    });
    this.type = type;
    document.dispatchEvent(new CustomEvent('crownform:shown', { detail: { type: type } }));
  },
  hide: function () {
    document.querySelectorAll('[data-form-wrapper] [data-form="long-form"], [data-form-wrapper] [data-form="short-form"]').forEach(function (el) { el.classList.remove('is-active'); });
    this.type = null;
    document.dispatchEvent(new CustomEvent('crownform:shown', { detail: { type: null } }));
  }
});

if (!window.CrownForm.heroBound) {
  window.CrownForm.heroBound = true;
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href="#open-form"]');
    if (!a) return;
    e.preventDefault();
    var wrap = document.querySelector('[data-form-wrapper="hero"]');
    if (!wrap) return;
    var media = document.querySelector('[data-hero="media"]');
    var cta = document.querySelector('[data-hero="cta"]');
    var after = document.querySelector('[data-hero="after"]');
    if (media) media.classList.add('hide');
    if (cta) cta.classList.add('hide');
    if (after) after.classList.remove('hide');
    wrap.classList.add('is-active');
    wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

(function () {
  window.CrownForm = window.CrownForm || { forms: [], type: null };
  if (window.CrownForm.suburb) return;
  var PC_URL = 'https://flowdojo.github.io/au-postcodes/au-postcodes.json';
  var cf = window.CrownForm;

  function load() {
    if (!cf.pcPromise) {
      cf.pcPromise = fetch(PC_URL).then(function (r) { return r.json(); }).then(function (d) {
        var rows = [];
        Object.keys(d).forEach(function (pc) { d[pc].forEach(function (e) { rows.push({ suburb: e[0], state: e[1], pc: pc, lower: e[0].toLowerCase() }); }); });
        return rows;
      }).catch(function () { cf.pcPromise = null; return null; });
    }
    return cf.pcPromise;
  }

  function search(rows, text) {
    var t = text.trim().toLowerCase(), stF = null, pcF = null, m;
    if (t.length < 2) return [];
    if (/^\d{1,4}$/.test(t)) {
      return rows.filter(function (r) { return r.pc.indexOf(t) === 0; }).slice(0, 8);
    }
    m = t.match(/^(.*?)\s+(nsw|vic|qld|sa|wa|tas|nt|act|\d{4})$/);
    if (m) { t = m[1]; if (/^\d{4}$/.test(m[2])) pcF = m[2]; else stF = m[2].toUpperCase(); }
    var starts = [], inside = [];
    rows.forEach(function (r) {
      if (stF && r.state !== stF) return;
      if (pcF && r.pc !== pcF) return;
      var i = r.lower.indexOf(t);
      if (i === 0) starts.push(r); else if (i > 0) inside.push(r);
    });
    function by(a, b) { return a.lower < b.lower ? -1 : a.lower > b.lower ? 1 : (a.state + a.pc) < (b.state + b.pc) ? -1 : 1; }
    starts.sort(by); inside.sort(by);
    return starts.concat(inside).slice(0, 8);
  }

  function attach(cfg) {
    var input = cfg.input, list = cfg.list, tpl = cfg.tpl, chip = cfg.chip, chipText = cfg.chipText;
    var hits = [], active = -1;
    function qa(sel, root) { return [].slice.call(root.querySelectorAll(sel)); }
    function setChip(h) {
      if (!chip) return;
      if (h) { if (chipText) chipText.textContent = h.state + ' ' + h.pc; chip.style.display = ''; }
      else chip.style.display = 'none';
    }
    function closeList() { hits = []; active = -1; if (list) list.style.display = 'none'; }
    function paintActive() {
      qa('[data-suggest="row"]', list).forEach(function (el, i) { el.style.backgroundColor = i === active ? '#f7f1fc' : ''; });
    }
    function choose(h) {
      if (input) input.value = h ? h.suburb : '';
      cfg.hidden('Suburb-State').value = h ? h.state : '';
      cfg.hidden('Suburb-Postcode').value = h ? h.pc : '';
      setChip(h); closeList(); cfg.pick(h);
    }
    function openList(rows) {
      if (!list || !tpl) return;
      qa('[data-suggest="row"]', list).forEach(function (el) { el.parentNode.removeChild(el); });
      hits = rows; active = -1;
      if (!rows.length) { list.style.display = 'none'; return; }
      tpl.style.display = 'none';
      rows.forEach(function (h, i) {
        var el = tpl.cloneNode(true);
        el.setAttribute('data-suggest', 'row'); el.style.display = '';
        el.children[0].textContent = h.suburb; el.children[1].textContent = h.state + ' ' + h.pc;
        el.addEventListener('mousedown', function (e) { e.preventDefault(); choose(h); });
        el.addEventListener('mouseenter', function () { active = i; paintActive(); });
        list.appendChild(el);
      });
      list.style.display = 'block';
    }
    function restore(data) {
      if (!input || !data || !data['Suburb-State']) return;
      var h = { suburb: input.value, state: data['Suburb-State'], pc: data['Suburb-Postcode'] };
      cfg.pick(h, true); setChip(h);
    }
    if (input && list) {
      if (tpl) tpl.style.display = 'none';
      setChip(null); closeList();
      input.addEventListener('focus', function () { load(); });
      input.addEventListener('input', function () {
        cfg.pick(null, true); setChip(null); cfg.clear();
        cfg.hidden('Suburb-State').value = ''; cfg.hidden('Suburb-Postcode').value = '';
        var text = input.value;
        load().then(function (rows) {
          if (!rows || input.value !== text) return;
          var found = search(rows, text);
          if (found.length === 1 && found[0].lower === text.trim().toLowerCase()) choose(found[0]); else openList(found);
        });
      });
      input.addEventListener('keydown', function (e) {
        if (!hits.length) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % hits.length; paintActive(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + hits.length) % hits.length; paintActive(); }
        else if (e.key === 'Enter' && active > -1) { e.preventDefault(); choose(hits[active]); }
        else if (e.key === 'Escape') closeList();
      });
      input.addEventListener('blur', function () { setTimeout(closeList, 150); });
    }
    return { choose: choose, restore: restore };
  }

  cf.suburb = { load: load, search: search, attach: attach };
})();

(function () {
  window.CrownForm = window.CrownForm || { forms: [], type: null };
  if (window.CrownForm.build) return;
  var CHECK_SVG = '<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.2 3L13 4.5"></path></svg>';
  var DOT_SVG = '<svg viewBox="0 0 16 16" width="1em" height="1em"><circle cx="8" cy="8" r="1.5" fill="currentColor"></circle></svg>';

  function create(cfg) {
    var checks = cfg.checks, rows = checks ? [].slice.call(checks.children) : [];
    var timer = null, paintKey = '', chipProto = null;
    rows.forEach(function (r) { if (!chipProto && r.children[2]) chipProto = r.children[2]; });

    function chipFor(row) {
      var c = row.children[2];
      if (!c && chipProto) { c = chipProto.cloneNode(true); c.removeAttribute('data-bind'); row.appendChild(c); }
      return c;
    }
    function paint(pct) {
      var done = Math.floor(pct / 20), d = cfg.data();
      var key = done + '|' + (pct >= 100) + '|' + d.key;
      if (key !== paintKey) {
        paintKey = key;
        rows.forEach(function (row, i) {
          var state = i < done ? 'done' : (i === done && pct < 100) ? 'active' : 'pending';
          var tick = row.children[0], text = row.children[1], chip = chipFor(row);
          tick.className = 'google-lp-form-tick' + (state === 'done' ? ' is-done' : state === 'active' ? ' is-active' : ' is-pending');
          tick.innerHTML = state === 'done' ? CHECK_SVG : state === 'pending' ? DOT_SVG : '';
          text.className = 'google-lp-form-check-text' + (state === 'pending' ? ' is-pending' : '');
          if (chip) { chip.style.display = state === 'done' ? '' : 'none'; if (state === 'done') chip.textContent = d.chips[i]; }
        });
        if (cfg.title) cfg.title.textContent = pct >= 100 ? 'Your payoff plan is ready' : 'Building your payoff plan…';
        if (cfg.ready) cfg.ready.style.display = pct >= 100 ? 'flex' : 'none';
      }
      cfg.pct(pct);
      if (cfg.meter) cfg.meter.style.paddingLeft = pct + '%';
    }
    function stop() { if (timer) cancelAnimationFrame(timer); timer = null; }
    function start() {
      if (!checks) { cfg.state(true); return; }
      stop(); cfg.state(false); paintKey = ''; paint(0);
      var t0 = performance.now(), dur = 4200;
      function ease(t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
      function frame(now) {
        var t = Math.min(1, (now - t0) / dur), p = t >= 1 ? 100 : ease(t) * 100;
        paint(p);
        if (t >= 1) { timer = null; cfg.state(true); return; }
        timer = requestAnimationFrame(frame);
      }
      timer = requestAnimationFrame(frame);
    }
    return { start: start, stop: stop };
  }

  window.CrownForm.build = { create: create };
})();

(function () {
  if (window.CrownEvidenceInline2) return; window.CrownEvidenceInline2 = true;

  function secs(t) {
    var m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(String(t || '').trim());
    return m ? (parseInt(m[1], 10) || 0) * 3600 + (parseInt(m[2], 10) || 0) * 60 + (parseInt(m[3], 10) || 0) : 0;
  }
  function parseVideo(src) {
    try {
      var u = new URL(src, location.href), id = '';
      if (/youtu\.be$/.test(u.hostname)) id = u.pathname.slice(1);
      else if (/\/embed\//.test(u.pathname)) id = u.pathname.split('/embed/')[1];
      else id = u.searchParams.get('v') || '';
      return { id: id.split(/[/?&]/)[0], start: secs(u.searchParams.get('t') || u.searchParams.get('start')) };
    } catch (e) { return { id: '', start: 0 }; }
  }
  function tuck(host, on) {
    var m = host.closest && host.closest('[data-hero="media"]'), st = m && m.querySelector('.google-lp-hero-stats');
    if (st) st.style.marginTop = on ? '1.5rem' : '';
  }
  function stopInline(el) {
    var host = el.parentNode;
    try { if (el.tagName === 'VIDEO') { el.pause(); el.removeAttribute('src'); el.load(); } } catch (err) {}
    if (host) { host.removeChild(el); tuck(host, false); }
  }
  function playInline(trig) {
    var src = trig.getAttribute('data-video-src'); if (!src) return;
    var host = trig.querySelector('[data-video-media]') || trig;
    if (host.querySelector('[data-video-player]')) return;
    [].slice.call(document.querySelectorAll('[data-video-player]')).forEach(stopInline);
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    var el, fill = 'position:absolute;top:0;right:0;bottom:0;left:0;width:100%;height:100%;background:#000;border-radius:inherit;z-index:20;';
    if (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(src)) {
      el = document.createElement('video');
      el.src = src; el.controls = true; el.autoplay = true; el.playsInline = true; el.preload = 'auto';
      el.style.cssText = fill + 'object-fit:contain;';
      el.addEventListener('ended', function () { stopInline(el); });
    } else {
      var v = parseVideo(src); if (!v.id) return;
      el = document.createElement('iframe');
      el.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(v.id) + '?autoplay=1&rel=0&modestbranding=1&iv_load_policy=3&playsinline=1&cc_load_policy=0&enablejsapi=1&origin=' + encodeURIComponent(location.origin) + (v.start ? '&start=' + v.start : '');
      el.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
      el.setAttribute('allowfullscreen', '');
      el.title = 'Video';
      el.style.cssText = fill + 'border:0;';
      el.addEventListener('load', function () { try { el.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*'); } catch (e) {} });
    }
    el.setAttribute('data-video-player', '');
    host.appendChild(el);
    tuck(host, true);
    if (el.play) { var p = el.play(); if (p && p.catch) p.catch(function () {}); }
  }

  window.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    if (t.closest('[data-video-player]')) return;
    var trig = t.closest('[data-video-src][data-video-mode="inline"]');
    if (trig) { e.preventDefault(); e.stopImmediatePropagation(); playInline(trig); }
  }, true);
  window.addEventListener('message', function (e) {
    if (!e.origin || e.origin.indexOf('youtube') < 0) return;
    var d = e.data; if (typeof d === 'string') { try { d = JSON.parse(d); } catch (err) { return; } }
    if (d && d.event === 'onStateChange' && d.info === 0) [].slice.call(document.querySelectorAll('iframe[data-video-player]')).forEach(stopInline);
  });
})();

(function () {
  if (document.getElementById('google-lp-extra-css')) return;
  var s = document.createElement('style');
  s.id = 'google-lp-extra-css';
  s.textContent = '@keyframes google-lp-reviews-scroll{from{transform:translate3d(0,0,0)}to{transform:translate3d(-50%,0,0)}}.google-lp-reviews-track{animation:google-lp-reviews-scroll 60s linear infinite;will-change:transform}.google-lp-reviews-viewport:hover .google-lp-reviews-track{animation-play-state:paused}@media (prefers-reduced-motion:reduce){.google-lp-reviews-track{animation:none}}';
  document.head.appendChild(s);
})();

window.CrownForm = window.CrownForm || { forms: [], type: null };

document.querySelectorAll('[data-form="root"]').forEach(function (form, index) {

  var RULES = {
    minBalance: 100000,
    maxRepaymentShare: 0.5,
    minScore: 50,
    almostPaidOffMonths: 60,
    incomeTypoAbove: 5000000,
    defaultRate: 6,
    shortTermYears: 25,
    state: 'NSW'
  };

  var TOTAL = parseInt(form.getAttribute('data-total'), 10) || 6;
  var SHORT = TOTAL === 3;
  var TYPE = SHORT ? 'short' : 'long';
  window.CrownForm.forms.push({ type: TYPE, root: form });

  var comp = form.closest('[data-form="long-form"],[data-form="short-form"]') || (form.parentElement && form.parentElement.parentElement);
  var gform = comp ? comp.querySelector('[data-form="guide-root"]') : null;
  var gwrap = gform ? gform.parentElement : null;

  var mdone = form.parentElement ? form.parentElement.querySelector('[data-form="done"]') : null;
  var gdone = gwrap ? gwrap.querySelector('[data-form="done"]') : null;
  var planInDone = !!(mdone && mdone.querySelector('[data-step="' + (TOTAL + 1) + '"]'));
  function all(sel) {
    if (comp) return [].slice.call(comp.querySelectorAll(sel));
    var out = [].slice.call(form.querySelectorAll(sel));
    [mdone, gform, gdone].forEach(function (r) { if (r) out = out.concat([].slice.call(r.querySelectorAll(sel))); });
    return out;
  }

  if (index > 0) {
    [form, gform].forEach(function (root) {
      if (!root) return;
      [].slice.call(root.querySelectorAll('[id]')).forEach(function (el) {
        var old = el.id, fresh = old + '-f' + index;
        el.id = fresh;
        [].slice.call(root.querySelectorAll('[for]')).forEach(function (l) { if (l.getAttribute('for') === old) l.setAttribute('for', fresh); });
      });
    });
  }
  var ORDER = [];
  for (var s = 1; s <= TOTAL + 1; s++) ORDER.push(String(s));
  var PLAN = String(TOTAL + 1);
  var BALANCE_STEP = SHORT ? '1' : '2';
  var KEY = 'crownPayoffForm:' + index;
  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  var chosen = null;
  function stateName() { return chosen ? chosen.state : RULES.state; }
  function qa(sel, root) { return [].slice.call((root || form).querySelectorAll(sel)); }
  function q(sel, root) { return (root || form).querySelector(sel); }
  function field(n) { var sel = '[name="' + n + '"]'; return q(sel) || (gform ? q(sel, gform) : null); }
  function num(n) { var f = field(n); return f ? parseFloat(f.value) || 0 : 0; }
  function val(n) { var f = field(n); return f ? String(f.value || '').trim() : ''; }
  function money(v) { return '$' + Math.round(v).toLocaleString('en-AU'); }
  function kay(v) { return v >= 1000000 ? '$' + (v / 1000000).toFixed(2) + 'M' : '$' + Math.round(v / 1000) + 'k'; }
  function mil(v) { return '$' + (v / 1000000).toFixed(2) + 'M'; }
  function rate2(v) { return (Math.round(v * 100) / 100).toFixed(2); }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function mark(t) { return '<span class="google-lp-form-mark">' + t + '</span>'; }
  function strong(t) { return '<span class="google-lp-form-strong">' + t + '</span>'; }
  function red(t) { return '<span class="google-lp-form-red">' + t + '</span>'; }
  function setHTML(key, html) { all('[data-bind="' + key + '"]').forEach(function (el) { el.innerHTML = html; }); }
  function show(el, on) {
    if (!el) return;
    el.classList.toggle('google-lp-form-hidden', !on);
    el.style.display = on ? '' : 'none';
  }

  var now = new Date();
  var start = new Date(now.getFullYear(), now.getMonth(), 1);
  function addMonths(d, k) { return new Date(d.getFullYear(), d.getMonth() + k, 1); }
  function monthYear(d) { return MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }

  function simulate(P, ratePct, pay) {
    var r = ratePct / 1200, bal = P, paid = 0, n = 0, rows = [];
    if (pay <= P * r) return null;
    while (bal > 0.005 && n < 600) {
      var i = bal * r; bal += i;
      var p = Math.min(pay, bal); bal -= p; paid += p; n++;
      rows.push([i, p - i]);
    }
    return { n: n, paid: paid, interest: paid - P, rows: rows };
  }
  function marginal(income) {
    var m = income > 190000 ? 45 : income > 135000 ? 37 : income > 45000 ? 30 : income > 18200 ? 16 : 0;
    return m + 2;
  }
  function pmt(P, ratePct, months) { var r = ratePct / 1200; return P * r / (1 - Math.pow(1 + r, -months)); }
  function dayOfYearText(day) { var d = new Date(2023, 0, Math.max(1, Math.min(365, day))); return d.getDate() + ' ' + MONTHS_LONG[d.getMonth()]; }
  function yrsMths(n) { return Math.floor(n / 12) + ' yrs ' + (n % 12) + ' mths'; }

  var YEARS = [
    { hi: 5,  label: '1–5',   eyebrow: 'The home stretch…',  tail: '. Let’s make each one count.' },
    { hi: 10, label: '5–10',  eyebrow: 'Up to 10 years to go…', tail: '.' },
    { hi: 15, label: '10–15', eyebrow: 'Up to 15 years to go…', tail: '. That’s a lot of pay days.' },
    { hi: 20, label: '15–20', eyebrow: 'Up to 20 years to go…', tail: '.' },
    { hi: 25, label: '20–25', eyebrow: '25 years to go…',        tail: '.' },
    { hi: 30, label: '25–30', eyebrow: 'Up to 30 years to go…', tail: ', and the early ones are mostly interest.' }
  ];
  function yearsIndex() {
    var r = qa('[name="Years-Left"]'), i;
    for (i = 0; i < r.length; i++) if (r[i].checked) return i;
    return 4;
  }

  function setPlanYears(y) {
    all('[data-plan-years]').forEach(function (a) {
      var on = parseInt(a.getAttribute('data-plan-years'), 10) === y;
      a.classList.toggle('is-active', on);
      var t = a.firstElementChild; if (t) t.classList.toggle('is-active', on);
    });
    hidden('Plan-Years').value = y;
  }
  all('[data-plan-years]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      setPlanYears(parseInt(a.getAttribute('data-plan-years'), 10) || RULES.shortTermYears);
      paintValues(); render(); save();
    });
  });
  function monthlyRepayment() {
    var r = qa('[name="Frequency"]'), k = 1, i;
    for (i = 0; i < r.length; i++) if (r[i].checked) k = [52 / 12, 26 / 12, 1][i] || 1;
    return num('Repayment') * k;
  }
  function planYears() {
    var tab = all('[data-plan-years].is-active')[0];
    if (tab) return parseInt(tab.getAttribute('data-plan-years'), 10) || RULES.shortTermYears;
    var r = qa('[name="Plan-Years"]'), i;
    for (i = 0; i < r.length; i++) if (r[i].checked) return parseInt(r[i].value, 10) || [10, 15, 20, 25, 30][i];
    return RULES.shortTermYears;
  }

  function parseAmount(text) {
    var t = String(text || '').toLowerCase().replace(/[\s$,]/g, ''), mult = 1;
    if (/k$/.test(t)) { mult = 1000; t = t.slice(0, -1); } else if (/m$/.test(t)) { mult = 1000000; t = t.slice(0, -1); }
    t = t.replace(/[^0-9.]/g, '');
    var n = parseFloat(t);
    return isFinite(n) ? Math.round(n * mult) : 0;
  }
  function income() { return parseAmount(val('Income')); }

  function mobileDigits(text) {
    var d = String(text || '').replace(/\D/g, '');
    if (d.indexOf('61') === 0 && d.length === 11) d = d.slice(2);
    if (d.charAt(0) === '0') d = d.slice(1);
    return /^4\d{8}$/.test(d) ? d : null;
  }
  function mobileDisplay(text) {
    var d = mobileDigits(text);
    return d ? '0' + d.slice(0, 3) + ' ' + d.slice(3, 6) + ' ' + d.slice(6) : String(text || '');
  }
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

  function drawChart(sim) {
    var box = all('[data-plan="chart"]')[0];
    if (!box || !sim) return;
    while (box.firstChild) box.removeChild(box.firstChild);
    var years = Math.ceil(sim.n / 12);
    for (var y = 0; y < years; y++) {
      var it = 0, pr = 0;
      sim.rows.slice(y * 12, y * 12 + 12).forEach(function (r) { it += r[0]; pr += r[1]; });
      var share = it / (it + pr || 1) * 100;
      var bar = document.createElement('div'); bar.className = 'google-lp-plan-bar';
      var top = document.createElement('div'); top.className = 'google-lp-plan-bar-top'; top.style.flexGrow = share.toFixed(3);
      var bottom = document.createElement('div'); bottom.className = 'google-lp-plan-bar-bottom'; bottom.style.flexGrow = (100 - share).toFixed(3);
      bar.appendChild(top); bar.appendChild(bottom); box.appendChild(bar);
    }
    setHTML('plan-chart-end', 'YR ' + years);
  }

  var last = {};
  function render() {
    var P = num('Balance'), inc = income(), marg = marginal(inc || 180000);
    var dRate = RULES.defaultRate, rate = field('Interest-Rate') ? num('Interest-Rate') : dRate;
    var yi = yearsIndex(), yr = YEARS[yi];
    var M = SHORT ? Math.floor(pmt(P, dRate, planYears() * 12)) : monthlyRepayment();
    var useRate = SHORT ? dRate : rate;
    var sim = simulate(P, useRate, M);
    last = { P: P, income: inc, M: M, rate: useRate, sim: sim, marg: marg };

    var tooLow = !SHORT && !sim;
    qa('[data-state="repayment-too-low"]').forEach(function (el) { show(el, tooLow); });
    var splitHead = q('[data-bind="split-title"]');
    if (splitHead && splitHead.parentElement) show(splitHead.parentElement, !tooLow);
    if (!SHORT) {
      setHTML('low-text', 'At ' + rate2(rate) + '%, ' + money(M) + ' a month doesn’t cover the ' + money(P * rate / 1200) + ' of interest charged.');
      setHTML('rate-hint', 'Most variable home loans sit around ' + rate2(dRate) + '% right now. Not sure? Leave it there.');
    }

    var typo = inc > RULES.incomeTypoAbove;
    qa('[data-state="income-typo"]').forEach(function (el) { show(el, typo); });
    if (typo) setHTML('income-typo-text', 'That’s ' + money(inc) + ' a year. Did you mean ' + money(inc / 10) + '?');

    if (!sim) return;

    var perDay = P * useRate / 100 / 365, perHour = perDay / 24;
    var dayNum = Math.ceil(P * useRate / 100 / (1 - marg / 100) / (inc || 180000) * 365);
    var dayText = dayOfYearText(dayNum);

    if (!SHORT) {

      setHTML('years-eyebrow', yr.eyebrow);
      setHTML('years-title', 'Up to ' + (yr.hi * 12) + ' more repayments');
      setHTML('years-text', 'The last one could land as late as ' + (now.getFullYear() + yr.hi) + yr.tail);

      var sim3 = simulate(P, dRate, M) || sim;
      setHTML('interest-eyebrow', 'Wow. Over ' + yr.label + ' years, that’s');
      setHTML('interest-title', '~' + kay(sim3.interest) + ' in interest');
      setHTML('interest-text', 'On top of the ' + money(P) + ' you owe, at today’s average rate of ' + rate2(dRate) + '%. Your repayment makes it exact.');

      var mi = P * rate / 1200, mp = Math.max(0, M - mi);
      setHTML('split-title', red(money(mi)) + ' of your ' + money(M));
      setHTML('split-text', 'goes to interest. Only ' + mark(money(mp)) + ' comes off what you owe.');
      all('[data-bind="bar-interest"]').forEach(function (el) { el.style.flexGrow = (mi / (mi + mp || 1) * 100).toFixed(2); el.style.flexBasis = '0'; });
      all('[data-bind="bar-loan"]').forEach(function (el) { el.style.flexGrow = (mp / (mi + mp || 1) * 100).toFixed(2); el.style.flexBasis = '0'; });

      setHTML('ouch-title', money(sim.interest) + ' in interest');
      setHTML('ouch-text', 'still to come. ' + mark(money(perDay) + ' of it today') + '. That’s ' + mark('$' + perHour.toFixed(2) + ' an hour') + ', even while you sleep.');
      var lo = yr.hi - 5, yrs = sim.n / 12, fits = yrs >= lo && yrs <= yr.hi;
      var finish = monthYear(addMonths(start, sim.n - 1));
      setHTML('years-match', 'That matches the ' + yr.label + ' years you said: ' + strong(yrsMths(sim.n)) + ', finishing ' + strong(finish) + '.');
      setHTML('years-mismatch', 'You said ' + yr.label + ' years. On these numbers it’s ' + yrsMths(sim.n) + ', finishing ' + finish + '.');
      all('[data-bind="years-match"]').forEach(function (el) { show(el, fits); });
      all('[data-bind="years-mismatch"]').forEach(function (el) { show(el, !fits); });

      setHTML('build-schedule', 'Building your ' + sim.n + '-repayment schedule');
      setHTML('build-tax-chip', marg + '% marginal');
      setHTML('welcome-summary', money(P) + ' · ' + money(M) + '/month · ' + rate2(rate) + '%');
    } else {
      setHTML('daily-title', money(perDay) + ' a day in interest');
      setHTML('daily-text', 'On ' + money(P) + ' at ' + rate2(dRate) + '%. That’s ' + mark('$' + perHour.toFixed(2) + ' an hour') + ', even while you sleep.');
      setHTML('days-title', 'Until ' + dayText);
      setHTML('build-schedule', 'Estimating your schedule at ' + rate2(dRate) + '%');
      setHTML('plan-intro', 'Estimated at today’s average rate of ' + rate2(dRate) + '% over ' + planYears() + ' years. How long is left on yours?');
      setHTML('welcome-summary', money(P) + ' · estimated at ' + rate2(dRate) + '% over ' + planYears() + ' yrs');
    }
    setHTML('build-schedule-chip', sim.n + ' repayments');
    setHTML('build-split-chip', kay(sim.interest) + ' interest');
    setHTML('build-tax', 'Applying 2025–26 tax rates to ' + money(inc || 180000));
    setHTML('build-state', 'Checking what’s possible for ' + stateName() + ' homeowners');

    var ratio = inc ? (M * 12) / inc : 0.2433;
    var score = Math.max(0, Math.min(99, Math.round(133.6 - 175 * ratio)));
    last.score = score; last.ratio = ratio;
    var cross = 0;
    for (var k = 0; k < sim.rows.length; k++) { if (sim.rows[k][1] > sim.rows[k][0]) { cross = k; break; } }
    setHTML('plan-who', 'For ' + esc(val('First-Name')) + ' ' + esc(val('Last-Name')) + ' · ' + esc(mobileDisplay(val('Mobile'))) +' · ' + esc(val('Email')));
    setHTML('plan-score', String(score));
    setHTML('plan-interest', money(sim.interest));
    setHTML('plan-earn', mil(sim.paid / (1 - marg / 100)));
    setHTML('plan-day', dayText);
    setHTML('plan-final', monthYear(addMonths(start, sim.n - 1)));
    setHTML('plan-crossover', '<span class="google-lp-plan-crossover-strong">' + monthYear(addMonths(start, cross)) + '</span> is your crossover. From then, more of each repayment comes off the loan than goes to interest.');
    var f = simulate(P, useRate, M * 13 / 12), w = simulate(P, useRate, M + 50 * 52 / 12);
    setHTML('chg1-text', 'Switch to fortnightly, half your monthly amount');
    setHTML('chg2-text', 'Add $50 a week');
    if (f) { setHTML('chg1-big', ((sim.n - f.n) / 12).toFixed(1) + ' yrs sooner'); setHTML('chg1-small', money(sim.interest - f.interest) + ' less interest'); }
    if (w) { setHTML('chg2-big', ((sim.n - w.n) / 12).toFixed(1) + ' yrs sooner'); setHTML('chg2-small', money(sim.interest - w.interest) + ' less interest'); }
    drawChart(sim);
  }

  var EDGE = {
    'welcome-back': { label: 'Welcome back', link: 'Start again', arrow: false },
    'not-a-fit': { label: 'Result', link: 'Check my answers', arrow: true },
    'sent': { label: 'Sent', link: null, arrow: false }
  };
  var steps = all('[data-step]');
  var tops = all('[data-form="top"]');
  var history = [];
  var current = '1';

  function fill(r) { var p = (r.value - r.min) / (r.max - r.min) * 100; r.style.setProperty('--fill', p + '%'); }

  function save() {
    if (ORDER.slice(1, TOTAL).indexOf(current) < 0) return;
    try { var o = {}; new FormData(form).forEach(function (v, k) { o[k] = v; }); localStorage.setItem(KEY, JSON.stringify({ step: current, data: o })); } catch (e) {}
  }
  function clearSaved() { try { localStorage.removeItem(KEY); } catch (e) {} }
  function load() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }

  function syncScreens() {

    var notInGuide = !!(gform && gform.querySelector('[data-step="not-a-fit"]'));

    var hideMain = (planInDone && current === PLAN) || (notInGuide && (current === 'not-a-fit' || current === 'sent'));

    form.style.display = hideMain ? 'none' : '';

    if (planInDone) mdone.style.display = current === PLAN ? 'block' : 'none';

  }

  function syncGuideForm() {
    if (!gwrap) return;
    var on = current === 'not-a-fit' || current === 'sent';
    show(gwrap, on);
    if (on) return;
    ['done', 'fail'].forEach(function (n) { var el = gwrap.querySelector('[data-form="' + n + '"]'); if (el) el.style.display = 'none'; });
    gform.style.display = '';
  }
  function goTo(name, push, noScroll) {
    if (push !== false && current !== name) history.push(current);
    current = name;
    steps.forEach(function (st) { st.classList.toggle('is-active', st.getAttribute('data-step') === name); });
    var n = ORDER.indexOf(name) + 1;
    var edge = EDGE[name];
    var plan = name === PLAN;
    tops.forEach(function (t) {
      var lab = q('[data-form="label"]', t), sgs = qa('[data-form="seg"]', t);
      t.style.display = (n || edge) ? '' : 'none';
      if (edge) {
        if (lab) lab.textContent = edge.label;
        sgs.forEach(function (sg) { sg.classList.add('is-complete'); sg.classList.remove('is-done', 'is-current'); });
      }
      if (n) {
        if (lab) {
          var sfx = (n === TOTAL - 1) ? 'Nearly there' : (n === TOTAL) ? 'Last one' : '';
          lab.innerHTML = plan ? 'Your plan' : 'Step ' + n + ' of ' + TOTAL + (sfx ? ' · <span style="color:#16a34a">' + sfx + '</span>' : '');
        }
        sgs.forEach(function (sg, i) {
          sg.classList.toggle('is-complete', plan);
          sg.classList.toggle('is-done', !plan && i < n - 1);
          sg.classList.toggle('is-current', !plan && i === n - 1);
        });
      }
    });
    all('[data-action="back"]').forEach(function (b) {
      var txt = b.querySelector('div'), arrow = b.querySelector('svg');
      if (edge) {
        b.style.visibility = edge.link ? '' : 'hidden';
        if (txt && edge.link) txt.textContent = edge.link;
        if (arrow) arrow.style.display = edge.arrow ? '' : 'none';
      } else {
        b.style.visibility = history.length ? '' : 'hidden';
        if (txt) txt.textContent = 'Back';
        if (arrow) arrow.style.display = '';
      }
    });
    render();
    if (name === String(TOTAL)) startBuild(); else stopBuild();
    syncButton();
    syncGuideForm();
    syncScreens();
    save();
    if (!noScroll) ((form.style.display === 'none' && comp) ? comp : form).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function fillReason(reason) {
    var s = last.sim, P = num('Balance');
    var text = {
      'almost-paid-off': 'On your numbers you’ll own your home by ' + monthYear(addMonths(start, (s && s.n <= RULES.almostPaidOffMonths ? s.n : YEARS[yearsIndex()].hi * 12) - 1)) + '. With under 5 years to go, there’s little left for our program to save you.',
      'small-balance': 'With ' + money(P) + ' left on the loan, the interest our program could save you is small.',
      'low-score': 'On your numbers, the difference our program could make is small.',
      'high-repayments': 'Your repayments take about ' + Math.round((last.ratio || 0) * 100) + '% of your household income. Our program works by putting spare cash flow to work, so it isn’t the right fit right now.'
    }[reason];
    if (text) all('p[data-reason="' + reason + '"]').forEach(function (el) { el.textContent = text; });
  }

  var notFitReason = null;
  function notFit(reason) {
    notFitReason = reason;
    render(); fillReason(reason);
    all('[data-reason]').forEach(function (el) { show(el, el.getAttribute('data-reason') === reason); });

    qa('input').forEach(function (el) { if (el.name !== 'Guide-Email') el.setCustomValidity(''); });
    var g = field('Guide-Email'); if (g && !g.value) g.value = val('Email');
    goTo('not-a-fit');
    if (g && typeof verifyGuide === 'function') verifyGuide(g);
  }

  function advance() {
    var i = ORDER.indexOf(current);
    if (i > -1 && i < ORDER.length - 1) goTo(ORDER[i + 1]);
  }

  function needsIncomeStep() {
    var st = q('[data-step="' + current + '"]'), inc = field('Income');
    return !!(st && inc && st.contains(inc));
  }
  function next() {
    if (current === BALANCE_STEP && RULES.minBalance && num('Balance') < RULES.minBalance) return notFit('small-balance');
    var freq = qa('[name="Frequency"]');
    if (freq.length && q('[data-step="' + current + '"]').contains(freq[0]) && !freq.some(function (r) { return r.checked; })) {
      showErr(freq[0], 'Please choose how often you pay.');
      return;
    }
    if (!needsIncomeStep()) return advance();
    var inc = field('Income'), sub = field('Suburb'), good = true, step = current;
    if (income() > 0) clearErr(inc); else { showErr(inc, 'Please enter your household’s yearly income.'); good = false; }
    if (!sub) return good && advance();
    if (chosen) clearErr(sub);
    else if (!sub.value.trim()) { showErr(sub, 'Please enter your suburb.'); good = false; }
    else if (sub.value.trim().length < 2) { showErr(sub, 'Please enter your suburb.'); good = false; }
    else {
      var text = sub.value;
      Promise.race([loadPostcodes(), new Promise(function (r) { setTimeout(function () { r(null); }, 3000); })]).then(function (rows) {
        if (sub.value !== text) return;
        var found = rows ? search(rows, text) : [];
        var exact = found.filter(function (h) { return h.lower === text.trim().toLowerCase(); });
        if (exact.length === 1) choose(exact[0]);
        if (!chosen && found.length) { showErr(sub, 'Please pick your suburb from the list.'); return; }

        if (good && current === step) { clearErr(sub); advance(); }
      });
      return;
    }
    if (good) advance(); else (!income() ? inc : sub).focus();
  }

  function outcomeReason() {
    render();
    return (last.sim && last.sim.n <= RULES.almostPaidOffMonths) ? 'almost-paid-off'
         : last.ratio > RULES.maxRepaymentShare ? 'high-repayments'
         : last.score < RULES.minScore ? 'low-score' : null;
  }

  function finishSubmit() {
    var reason = outcomeReason();
    trackOnce(!reason, reason);
    var data = {}; new FormData(form).forEach(function (v, k) { data[k] = v; });
    form.dispatchEvent(new CustomEvent('payoff:submit', { detail: { type: TYPE, qualified: !reason, reason: reason, answers: data, result: last }, bubbles: true }));
    clearSaved();
    broadcast(reason ? 'notfit' : 'plan', reason);
    if (reason) return notFit(reason);
    goTo(PLAN);
  }

  var leadSent = false;
  var mirrored = false, mirroredKind = null;

  var mirrors = (window.CrownForm.mirrors = window.CrownForm.mirrors || []);
  function broadcast(kind, reason) {
    var snap = {}; new FormData(form).forEach(function (v, k) { snap[k] = v; });
    if (gform) snap['Guide-Email'] = val('Guide-Email');
    mirrors.forEach(function (m) { if (m.form !== form && m.type === TYPE) m.apply({ kind: kind, reason: reason, data: snap }); });
  }
  mirrors.push({ form: form, type: TYPE, apply: function (src) {
    if (mirrored && mirroredKind === src.kind) return;
    mirrored = true; mirroredKind = src.kind; leadSent = true;
    Object.keys(src.data).forEach(function (k) {
      var v = src.data[k];
      if (k === 'Mobile' && mobileDigits(v)) { var d = mobileDigits(v); v = d.slice(0, 3) + ' ' + d.slice(3, 6) + ' ' + d.slice(6); }
      qa('[name="' + k + '"]').forEach(function (f) { if (f.type === 'radio') f.checked = f.value === v; else if (f.type !== 'submit') f.value = v; });
    });
    var ge = field('Guide-Email'); if (ge && src.data['Guide-Email']) ge.value = src.data['Guide-Email'];
    qa('[type="range"]').forEach(fill);
    restoreChosen(src.data);
    if (all('[data-plan-years]').length) setPlanYears(parseInt(src.data['Plan-Years'], 10) || RULES.shortTermYears);
    clearSaved();
    history = []; paintValues(); render();
    if (src.kind === 'plan') return goTo(PLAN, false, true);
    notFit(src.reason || 'small-balance');
    if (src.kind === 'sent') {
      var el = gwrap ? gwrap.querySelector('[data-form="done"]') : wrap('[data-form="done"]');
      setSent('Sent. Check your inbox, ' + esc(val('First-Name') || 'there') + '.', 'The free guide and mini series are on their way to ' + esc(val('Guide-Email')) + '.');
      if (el) { (gwrap ? gform : form).style.display = 'none'; el.style.display = 'block'; }
    if (gwrap) goTo('sent', false, true);
    }
  } });
  var ATTRIB = ['gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'channel', 'lead_source'];
  function ls(k) { try { return localStorage.getItem(k) || undefined; } catch (e) { return undefined; } }
  function rsUserId() {
    var ra = window.rudderanalytics, ex = ra && typeof ra.getUserId === 'function' ? ra.getUserId() : null;
    if (ex && ex.indexOf('@') === -1) return ex;
    return window.crypto && typeof window.crypto.randomUUID === 'function' ? window.crypto.randomUUID() : 'u-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }
  function rsSafe(name, fn) {
    if (typeof window.__rsSafeCall === 'function') return window.__rsSafeCall(name, fn);
    try { fn(); } catch (e) { console.error(name, e); }
  }
  function freqName() {
    var r = qa('[name="Frequency"]'), i;
    for (i = 0; i < r.length; i++) if (r[i].checked) return ['Weekly', 'Fortnightly', 'Monthly'][i] || 'Monthly';
    return 'Monthly';
  }
  function trackLead(qualified, reason) {
    var ra = window.rudderanalytics;
    rsSafe('rudderanalytics.identify', function () {
      if (ra && typeof ra.identify === 'function') {
        ra.identify(rsUserId(), { email: val('Email'), phone: mobileDisplay(val('Mobile')), firstName: val('First-Name'), lastName: val('Last-Name'), loanBalance: last.P, interestRate: last.rate, repaymentAmount: last.M, repaymentFrequency: freqName() });
      }
    });
    rsSafe('rudderanalytics.track', function () {
      if (ra && typeof ra.track === 'function') {
        var p = {
          form_name: 'payoff_form_' + TYPE, form_type: TYPE, qualified: qualified, not_a_fit_reason: reason || undefined,
          suburb: val('Suburb') || undefined, state: chosen ? chosen.state : undefined, postcode: chosen ? chosen.pc : undefined,
          loan_balance: last.P, interest_rate: last.rate, repayment_amount: Math.round(last.M), repayment_frequency: freqName(),
          payoff_months: last.sim ? last.sim.n : undefined, total_interest: last.sim ? Math.round(last.sim.interest) : undefined,
          debt_ratio_score: last.score
        };
        ATTRIB.forEach(function (k) { p[k] = ls(k); });
        ra.track(TYPE === 'short' ? 'Payoff Short Form Submitted' : 'Payoff Form Submitted', p);
      }
    });
    if (typeof window.captureEvent === 'function') rsSafe('posthog', function () { window.captureEvent('form_submitted', { form_name: 'payoff_form_' + TYPE }); });
  }
  function stampHidden(qualified, reason) {
    var urlParams = new URLSearchParams(window.location.search);
    function set(n, v) { if (v !== undefined && v !== null && v !== '') hidden(n).value = v; }
    ATTRIB.forEach(function (k) { set(k, urlParams.get(k) || ls(k)); });
    set('Form-Type', TYPE); set('Qualified', qualified ? 'yes' : 'no'); set('Not-A-Fit-Reason', reason);
    set('Landing-Page', window.location.pathname.replace(/\/+$/, '').split('/').pop());
    set('Repayment-Frequency', freqName()); set('Repayment-Monthly', Math.round(last.M));
    set('Payoff-Months', last.sim ? last.sim.n : ''); set('Total-Interest', last.sim ? Math.round(last.sim.interest) : '');
    set('Debt-Ratio-Score', last.score);
  }
  function trackOnce(qualified, reason) {
    if (leadSent) return;
    leadSent = true;
    trackLead(qualified, reason);
  }

  form.addEventListener('submit', function () {
    var reason = current === 'not-a-fit' ? notFitReason : outcomeReason();
    stampHidden(!reason, reason);

    if (mobileEl && mobileDigits(mobileEl.value)) {
      var shown = mobileEl.value, d = mobileDigits(shown);
      mobileEl.value = '+61 ' + d.slice(0, 3) + ' ' + d.slice(3, 6) + ' ' + d.slice(6);
      setTimeout(function () { mobileEl.value = shown; }, 500);
    }
  }, true);

  function wrap(sel) { return form.parentElement && form.parentElement.querySelector(sel); }
  function setSent(title, text) {
    [form.parentElement || document, gwrap].forEach(function (scope) {
      if (!scope) return;
      [].slice.call(scope.querySelectorAll('[data-bind="sent-title"]')).forEach(function (el) { el.innerHTML = title; });
      [].slice.call(scope.querySelectorAll('[data-bind="sent-text"]')).forEach(function (el) { el.innerHTML = text; });
    });
  }

  if (gform) {
    gform.addEventListener('submit', function () {
      stampHidden(false, notFitReason);
      var snap = {}; new FormData(form).forEach(function (v, k) { snap[k] = v; });
      Object.keys(snap).forEach(function (k) {
        if (k === 'Guide-Email') return;
        var v = snap[k];
        if (k === 'Mobile' && mobileDigits(v)) { var d = mobileDigits(v); v = '+61 ' + d.slice(0, 3) + ' ' + d.slice(3, 6) + ' ' + d.slice(6); }
        var h = gform.querySelector('[name="' + k + '"]');
        if (!h) { h = document.createElement('input'); h.type = 'hidden'; h.name = k; gform.appendChild(h); }
        h.value = v;
      });
    }, true);
    if (window.MutationObserver) ['done', 'fail'].forEach(function (n) {
      var gel = gwrap.querySelector('[data-form="' + n + '"]'); if (!gel) return;
      new MutationObserver(function () {
        if (getComputedStyle(gel).display === 'none') return;
        if (n === 'done') {
          setSent('Sent. Check your inbox, ' + esc(val('First-Name') || 'there') + '.',
                  'The free guide and mini series are on their way to ' + esc(val('Guide-Email')) + '.');
          trackOnce(false, notFitReason);
          goTo('sent', false, true);
          if (!mirrored) broadcast('sent', notFitReason);
          if (!mirrored) form.dispatchEvent(new CustomEvent('payoff:guide', { detail: { type: TYPE, reason: notFitReason, email: val('Guide-Email') }, bubbles: true }));
        } else {
          gel.style.display = 'none'; gform.style.display = '';
          if (guideEl) showErr(guideEl, 'Something went wrong. Please try again.');
        }
      }).observe(gel, { attributes: true, attributeFilter: ['style', 'class'] });
    });
  }
  ['done', 'fail'].forEach(function (n) {
    var el = wrap('[data-form="' + n + '"]');
    if (!el || !window.MutationObserver) return;
    new MutationObserver(function () {
      if (getComputedStyle(el).display === 'none') return;
      if (current === 'not-a-fit') {
        if (n === 'done') {
          setSent('Sent. Check your inbox, ' + esc(val('First-Name') || 'there') + '.',
                  'The free guide and mini series are on their way to ' + esc(val('Guide-Email')) + '.');
          trackOnce(false, notFitReason);
          if (!mirrored) broadcast('sent', notFitReason);
          if (!mirrored) form.dispatchEvent(new CustomEvent('payoff:guide', { detail: { type: TYPE, reason: notFitReason, email: val('Guide-Email') }, bubbles: true }));
        } else {
          el.style.display = 'none'; form.style.display = '';
          if (guideEl) showErr(guideEl, 'Something went wrong. Please try again.');
        }
        return;
      }
      if (planInDone) {
        if (current === PLAN || current === 'not-a-fit') return;
        if (n === 'fail') { el.style.display = 'none'; console.warn('Webflow form submit failed; showing the plan anyway'); }
        finishSubmit();
        return;
      }
      el.style.display = 'none'; form.style.display = '';
      if (n === 'fail') console.warn('Webflow form submit failed; showing the plan anyway');
      finishSubmit();
    }).observe(el, { attributes: true, attributeFilter: ['style', 'class'] });
  });

  function resume() {
    var sv = load(); if (!sv) return goTo('1', false);
    Object.keys(sv.data).forEach(function (k) {
      qa('[name="' + k + '"]').forEach(function (f) { if (f.type === 'radio') f.checked = f.value === sv.data[k]; else f.value = sv.data[k]; });
    });
    qa('[type="range"]').forEach(fill);
    restoreChosen(sv.data);
    if (all('[data-plan-years]').length) setPlanYears(parseInt(sv.data['Plan-Years'], 10) || RULES.shortTermYears);
    history = []; goTo(sv.step, false);
  }
  function restart() {
    clearSaved();
    form.reset(); qa('[type="range"]').forEach(fill); if (all('[data-plan-years]').length) setPlanYears(RULES.shortTermYears); history = []; goTo('1', false);
  }

  qa('[data-actions]').forEach(function (box) {
    var type = box.getAttribute('data-actions');
    qa('a', box).forEach(function (a, idx) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        if (type === 'next') next();
        else if (type === 'welcome') { idx === 0 ? resume() : restart(); }
      });
    });
  });
  all('[data-action="back"]').forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.preventDefault();
      if (current === 'welcome-back') return restart();
      if (current === 'not-a-fit') { history = []; return goTo('1', false); }
      if (history.length) goTo(history.pop(), false);
    });
  });

  qa('[data-action="fix-repayment"]').forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.preventDefault();
      var r = field('Repayment'), st = r && r.closest('[data-step]');
      if (st) goTo(st.getAttribute('data-step'), false);
    });
  });
  qa('[data-action="fix-income"]').forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.preventDefault();
      var f = field('Income'); if (f) f.value = Math.round(income() / 10).toLocaleString('en-AU');
      render();
    });
  });
  qa('[name="Frequency"]').forEach(function (r) { r.addEventListener('change', function () { clearErr(r); }); });
  qa('[name="Years-Left"]').forEach(function (r) {
    r.addEventListener('change', function () {
      var reason = r.getAttribute('data-disqualify');
      setTimeout(function () { reason ? notFit(reason) : goTo('2'); }, 250);
    });
  });
  qa('[data-stepper]').forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.preventDefault();
      var f = field(b.getAttribute('data-stepper')); if (!f) return;
      var st = parseFloat(f.step) || 1, d = parseFloat(b.getAttribute('data-dir')) || 1;
      var v = Math.min(parseFloat(f.max), Math.max(parseFloat(f.min), (parseFloat(f.value) || 0) + d * st));
      f.value = Math.round(v * 10000) / 10000;
      f.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });
  qa('[data-value-for]').forEach(function (el) {
    el.setAttribute('data-bound', '1');
  });
  function paintValues() {
    qa('[data-value-for]').forEach(function (el) {
      var v = num(el.getAttribute('data-value-for'));
      el.textContent = el.getAttribute('data-format') === 'percent' ? rate2(v) + '%' : money(v);
    });
  }
  form.addEventListener('input', function (e) {
    if (e.target.type === 'range') fill(e.target);
    paintValues(); render(); save();
    if (current === String(TOTAL)) syncButton();
  });
  form.addEventListener('change', function () { paintValues(); render(); save(); });

  var emailEl = field('Email'), mobileEl = field('Mobile'), incomeEl = field('Income'), guideEl = field('Guide-Email');
  qa('[required]').forEach(function (el) { el.removeAttribute('required'); });

  function errEl(el, make) {
    var name = el.getAttribute('name'), e = all('[data-error-for="' + name + '"]')[0];
    if (e || !make) return e;
    var p = el.parentElement, host = (p && !p.querySelector(':scope > label') && p.children.length > 1) ? p : el;
    e = document.createElement('div');
    e.setAttribute('data-error-for', name); e.setAttribute('role', 'alert');
    e.style.cssText = 'color:#dc2626;font-size:13px;line-height:1.4;margin-top:6px;';
    host.insertAdjacentElement('afterend', e);
    return e;
  }
  function showErr(el, msg) {
    var e = errEl(el, true); e.textContent = msg; e.style.display = 'block';
    el.setAttribute('aria-invalid', 'true'); el.style.borderColor = '#dc2626';
  }
  function clearErr(el) {
    var e = errEl(el, false); if (e) { e.textContent = ''; e.style.display = 'none'; }
    el.removeAttribute('aria-invalid'); el.style.borderColor = '';
  }
  function flag(el, ok, msg, report) {
    if (ok) { clearErr(el); return; }
    if (!report) return;
    showErr(el, msg);
    if (report === true) { el.reportValidity(); el.focus(); }
  }
  function checkEmail(el, report) {
    if (!el) return true;
    var v = el.value.trim().toLowerCase();
    el.value = v;
    var ok = EMAIL_RE.test(v), msg = 'Please enter a valid email address (e.g. name@example.com)';
    el.setCustomValidity(ok ? '' : msg);
    flag(el, ok, msg, report);
    return ok;
  }
  function checkMobile(el, report) {
    if (!el) return true;
    var d = mobileDigits(el.value), ok = !!d, msg = 'Please enter a valid Australian mobile (e.g. 4xx xxx xxx)';
    if (ok) el.value = d.slice(0, 3) + ' ' + d.slice(3, 6) + ' ' + d.slice(6);
    el.setCustomValidity(ok ? '' : msg);
    flag(el, ok, msg, report);
    return ok;
  }

  var NAME_RE = /^\p{L}[\p{L}\p{M}\s'\u2019-]{1,49}$/u;
  var EMAIL_ERROR = 'Please enter a real email address you can receive mail at.';
  var emailChecks = (window.CrownForm.emailChecks = window.CrownForm.emailChecks || {});
  function realEmailOk(email) {
    email = String(email || '').trim().toLowerCase();
    if (typeof window.validateEmail !== 'function') return Promise.resolve(true);
    if (!emailChecks[email]) {
      emailChecks[email] = Promise.resolve(window.validateEmail(email))
        .then(function (r) { return !!(r && r.isValid); })
        .catch(function () { return true; });
    }
    return emailChecks[email];
  }
  function checkName(el, message, report) {
    if (!el) return true;
    var ok = NAME_RE.test(el.value.trim());
    el.setCustomValidity(ok ? '' : message);
    flag(el, ok, message, report);
    return ok;
  }
  function validateContact(report) {
    if (!checkName(field('First-Name'), 'Enter a valid first name.', report)) return false;
    if (!checkName(field('Last-Name'), 'Enter a valid last name.', report)) return false;
    if (!checkMobile(mobileEl, report)) return false;
    if (!checkEmail(emailEl, report)) return false;
    return true;
  }
  [emailEl, mobileEl, guideEl, field('First-Name'), field('Last-Name')].forEach(function (el) {
    if (!el) return;
    el.addEventListener('input', function () { el.setCustomValidity(''); clearErr(el); });
  });
  function blurEmail(el) {
    if (!el || !el.value.trim()) return;
    if (!checkEmail(el, 'inline')) return;
    var email = el.value;
    realEmailOk(email).then(function (ok) {
      if (el.value !== email) return;
      el.setCustomValidity(ok ? '' : EMAIL_ERROR);
      if (!ok) showErr(el, EMAIL_ERROR);
    });
  }
  if (emailEl) {
    emailEl.addEventListener('blur', function () { blurEmail(emailEl); });
    var emailTimer = null;
    emailEl.addEventListener('input', function () {
      emailState = { value: '', ok: null }; syncButton();
      clearTimeout(emailTimer); emailTimer = setTimeout(function () { verifyEmail(emailEl, false); }, 500);
    });
  }
  if (guideEl) guideEl.addEventListener('blur', function () { blurEmail(guideEl); });
  var lastNameEl = field('Last-Name'), firstNameEl = field('First-Name');
  if (firstNameEl) firstNameEl.addEventListener('blur', function () { if (firstNameEl.value.trim()) checkName(firstNameEl, 'Enter a valid first name.', 'inline'); });
  if (lastNameEl) lastNameEl.addEventListener('blur', function () { if (lastNameEl.value.trim()) checkName(lastNameEl, 'Enter a valid last name.', 'inline'); });
  if (mobileEl) {
    mobileEl.setAttribute('inputmode', 'tel');
    mobileEl.setAttribute('placeholder', '4xx xxx xxx');
    mobileEl.addEventListener('input', function () { mobileEl.value = mobileEl.value.replace(/[^0-9+\s]/g, ''); });
    mobileEl.addEventListener('blur', function () { if (mobileEl.value.trim()) checkMobile(mobileEl, 'inline'); });
  }

  if (incomeEl) {
    incomeEl.setAttribute('inputmode', 'decimal');
    var formatIncome = function () {
      var n = income();
      incomeEl.value = n ? n.toLocaleString('en-AU') : '';
      render();
    };

    incomeEl.addEventListener('input', function () { clearErr(incomeEl); });
    incomeEl.addEventListener('blur', formatIncome);
    incomeEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); formatIncome(); } });
  }

  var guideState = { value: '', ok: null };
  function verifyGuide(el) {
    if (!el) return;
    var v = el.value.trim().toLowerCase();
    if (!v || !EMAIL_RE.test(v)) { guideState = { value: v, ok: null }; syncGuide(); return; }
    if (typeof window.validateEmail !== 'function') { guideState = { value: v, ok: true }; syncGuide(); return; }
    realEmailOk(v).then(function (ok) {
      if (el.value.trim().toLowerCase() !== v) return;
      guideState = { value: v, ok: ok };
      el.setCustomValidity(ok ? '' : EMAIL_ERROR);
      if (!ok) showErr(el, EMAIL_ERROR);
      syncGuide();
    });
  }
  function guideReady() {
    var v = val('Guide-Email').trim().toLowerCase();
    return current === 'not-a-fit' && EMAIL_RE.test(v) && (typeof window.validateEmail !== 'function' || (guideState.value === v && guideState.ok === true));
  }
  function syncGuide() {
    var b = q('[data-actions="guide"] input[type="submit"], [data-actions="guide"] button', gform || form);
    if (!b) return;
    var ready = guideReady();
    b.disabled = !ready; b.setAttribute('aria-disabled', ready ? 'false' : 'true');
    if (ready) { b.style.backgroundColor = ''; b.style.color = ''; b.style.boxShadow = ''; b.style.pointerEvents = ''; b.style.cursor = ''; }
    else { b.style.backgroundColor = '#e7e3ec'; b.style.color = '#9c96a8'; b.style.boxShadow = 'none'; b.style.pointerEvents = 'none'; b.style.cursor = 'not-allowed'; }
    if (b.tagName === 'INPUT') b.value = 'Send me the free guide →';
  }
  if (guideEl) {
    var guideTimer = null;
    guideEl.addEventListener('input', function () {
      guideState = { value: '', ok: null }; syncGuide();
      clearTimeout(guideTimer); guideTimer = setTimeout(function () { verifyGuide(guideEl); }, 500);
    });
  }

  [].slice.call((form.parentElement || document).querySelectorAll('[data-action="change-email"]')).concat(gwrap ? [].slice.call(gwrap.querySelectorAll('[data-action="change-email"]')) : []).forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      var inG = !!(gwrap && gwrap.contains(a));
      var done = inG ? gwrap.querySelector('[data-form="done"]') : wrap('[data-form="done"]'); if (done) done.style.display = 'none';
      (inG ? gform : form).style.display = ''; leadSent = false;
      goTo('not-a-fit', false);
      if (guideEl) { guideEl.focus(); guideEl.select(); }
    });
  });

  var buildDone = false;
  var builder = window.CrownForm.build ? window.CrownForm.build.create({
    checks: q('[data-panel="checks"]'), title: q('[data-panel="title"]'), meter: q('[data-panel="meter"]'), ready: q('[data-panel="ready"]'),
    data: function () {
      var s = last.sim;
      return { key: s ? s.n : '', chips: s ? [s.n + ' repayments', kay(s.interest) + ' interest', last.marg + '% marginal', 'Score ready', stateName() + ' checked'] : ['', '', '', '', ''] };
    },
    pct: function (p) { setHTML('build-pct', String(Math.round(p))); },
    state: function (done) { buildDone = done; syncButton(); }
  }) : null;
  function stopBuild() { if (builder) builder.stop(); }
  function startBuild() { if (builder) builder.start(); else { buildDone = true; syncButton(); } }

  var emailState = { value: '', ok: null };
  function verifyEmail(el, report) {
    if (!el) return;
    var v = el.value.trim().toLowerCase();
    if (!v || !EMAIL_RE.test(v)) { emailState = { value: v, ok: null }; return; }
    if (typeof window.validateEmail !== 'function') { emailState = { value: v, ok: true }; return; }
    realEmailOk(v).then(function (ok) {
      if (el.value.trim().toLowerCase() !== v) return;
      emailState = { value: v, ok: ok };
      el.setCustomValidity(ok ? '' : EMAIL_ERROR);
      if (!ok && report) showErr(el, EMAIL_ERROR);
      syncButton();
    });
  }
  function contactValid() {
    var e = val('Email').trim().toLowerCase();
    return NAME_RE.test(val('First-Name')) && NAME_RE.test(val('Last-Name')) && !!mobileDigits(val('Mobile')) && EMAIL_RE.test(e)
        && (typeof window.validateEmail !== 'function' || (emailState.value === e && emailState.ok === true));
  }
  function submitReady() {
    try { return current === String(TOTAL) && buildDone && contactValid(); } catch (e) { return false; }
  }

  function syncButton() {
    if (typeof syncGuide === 'function') syncGuide();
    var a = q('[data-actions="submit"] button, [data-actions="submit"] input[type="submit"], [data-actions="submit"] a');
    if (!a) return;
    var ready = submitReady();
    var isInput = a.tagName === 'INPUT', txt = isInput ? null : (a.querySelector('div') || a), arrow = a.querySelector('svg');
    if ('disabled' in a) a.disabled = !ready;
    a.setAttribute('aria-disabled', ready ? 'false' : 'true');
    if (ready) {
      a.style.backgroundColor = ''; a.style.color = ''; a.style.boxShadow = ''; a.style.pointerEvents = ''; a.style.cursor = '';
      if (arrow) arrow.style.display = '';
    } else {
      a.style.backgroundColor = '#e7e3ec'; a.style.color = '#9c96a8'; a.style.boxShadow = 'none'; a.style.pointerEvents = 'none'; a.style.cursor = 'not-allowed';
      if (arrow) arrow.style.display = 'none';
    }
    var label = buildDone ? 'Show my payoff plan' : 'Building your plan…';
    if (isInput) a.value = label; else if (txt) txt.textContent = label;
  }
  syncButton();

  (function () {
    var btn = q('[data-actions="submit"] button, [data-actions="submit"] input[type="submit"]');
    if (btn && window.MutationObserver) {
      new MutationObserver(function () { if (!btn.disabled && !submitReady()) syncButton(); }).observe(btn, { attributes: true, attributeFilter: ['disabled'] });
    }
    window.addEventListener('load', syncButton);
    setTimeout(syncButton, 500);
  })();

  function hidden(name) {
    var h = field(name);
    if (!h) { h = document.createElement('input'); h.type = 'hidden'; h.name = name; form.appendChild(h); }
    return h;
  }
  var sInput = q('[data-suggest="input"]');
  var sub$ = null;
  function loadPostcodes() { var s = window.CrownForm.suburb; return s ? s.load() : Promise.resolve(null); }
  function search(rows, text) { var s = window.CrownForm.suburb; return s ? s.search(rows, text) : []; }
  function choose(h) { if (sub$) sub$.choose(h); }
  function restoreChosen(data) { if (sub$) sub$.restore(data); }
  if (window.CrownForm.suburb && sInput) {
    sub$ = window.CrownForm.suburb.attach({
      input: sInput, list: q('[data-suggest="list"]'), tpl: q('[data-suggest="template"]'),
      chip: q('[data-suggest="chip"]'), chipText: q('[data-suggest="chip-text"]'),
      hidden: hidden,
      pick: function (h, quiet) { chosen = h; if (!quiet) { render(); save(); } },
      clear: function () { clearErr(sInput); }
    });
  }

  var saved = load();
  qa('[type="range"]').forEach(fill);
  if (all('[data-plan-years]').length) setPlanYears(RULES.shortTermYears);
  paintValues(); render();
  if (saved && ORDER.slice(1, TOTAL).indexOf(saved.step) > -1 && q('[data-step="welcome-back"]')) goTo('welcome-back', false, true);
  else goTo('1', false, true);
});

if (!window.CrownForm.type && window.CrownForm.show) window.CrownForm.show('long');
