/* Twelve Strangers: page core.
   Widgets register with TS.register(name, mount) and mount into [data-widget="name"].
   mount(el, ctx) gets a ctx with: el, name, reduced, stamp(id), hasSeal(id), on(evt, cb), emit(evt, data),
   store.get(key, fallback) / store.set(key, value), onVisible(cb), loadScript(url), juror, rand(). */
(function () {
  'use strict';
  var TS = (window.TS = window.TS || {});
  var widgets = {};
  var bus = document.createElement('span');
  var reduced = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var SEALS = [
    { id: 'circle', label: 'The Circle', num: 'I', ch: 'ch-circle' },
    { id: 'lot', label: 'Drawn by Lot', num: 'II', ch: 'ch-athens' },
    { id: 'socrates', label: 'Juror of Socrates', num: 'II', ch: 'ch-athens' },
    { id: 'ordeal', label: 'Survived 1200', num: 'III', ch: 'ch-ordeal' },
    { id: 'carta', label: 'Clause 39', num: 'IV', ch: 'ch-kings' },
    { id: 'twelve', label: 'Why Twelve?', num: 'V', ch: 'ch-twelve' },
    { id: 'bushel', label: 'Juror of 1670', num: 'VI', ch: 'ch-talks' },
    { id: 'seated', label: 'Who Got to Sit', num: 'VII', ch: 'ch-sit' },
    { id: 'inversion', label: 'The Inversion', num: 'VIII', ch: 'ch-inversion' },
    { id: 'strangers', label: 'Drew a Jury', num: 'IX', ch: 'ch-strangers' },
    { id: 'scale', label: 'Weighed It', num: 'X', ch: 'ch-debate' },
    { id: 'verdict', label: 'Final Verdict', num: 'XI', ch: 'ch-verdict' }
  ];
  TS.SEALS = SEALS;

  var store = {
    get: function (k, d) {
      try { var v = window.localStorage.getItem('ts:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
    },
    set: function (k, v) {
      try { window.localStorage.setItem('ts:' + k, JSON.stringify(v)); } catch (e) {}
    }
  };
  TS.store = store;

  var earned = {};
  (store.get('seals', []) || []).forEach(function (id) { earned[id] = true; });
  function earnedCount() { return SEALS.filter(function (s) { return earned[s.id]; }).length; }

  TS.on = function (evt, cb) { bus.addEventListener(evt, function (e) { cb(e.detail); }); };
  TS.emit = function (evt, detail) { bus.dispatchEvent(new CustomEvent(evt, { detail: detail })); };
  TS.register = function (name, fn) { widgets[name] = fn; };
  TS.hasSeal = function (id) { return !!earned[id]; };

  var jurorNo = store.get('juror', null);
  if (!jurorNo) { jurorNo = String(1000 + Math.floor(Math.random() * 9000)); store.set('juror', jurorNo); }
  TS.juror = jurorNo;

  /* ---------- toast ---------- */
  var toastEl, toastTimer;
  TS.toast = function (msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 2800);
  };

  /* ---------- seals ---------- */
  TS.stamp = function (id) {
    var seal = SEALS.filter(function (s) { return s.id === id; })[0];
    if (!seal || earned[id]) return false;
    earned[id] = true;
    store.set('seals', Object.keys(earned));
    renderSeals(true);
    var n = earnedCount();
    TS.toast(n === 12 ? 'Seal earned: ' + seal.label + '. Your jury box is full.' : 'Seal earned: ' + seal.label + ' (' + n + ' of 12)');
    TS.emit('seal', { id: id, count: n });
    return true;
  };

  var sealBox, sealPanel;
  function buildSeals() {
    sealBox = document.createElement('button');
    sealBox.className = 'seal-box';
    sealBox.type = 'button';
    sealBox.setAttribute('aria-expanded', 'false');
    sealBox.setAttribute('aria-controls', 'sealPanel');
    sealBox.innerHTML = '<span class="seal-grid" aria-hidden="true">' +
      SEALS.map(function () { return '<span class="seal-dot"></span>'; }).join('') +
      '</span><span class="seal-count"><b class="tnum">0</b>/12 seals</span>';
    sealPanel = document.createElement('div');
    sealPanel.className = 'seal-panel';
    sealPanel.id = 'sealPanel';
    sealPanel.hidden = true;
    sealPanel.innerHTML = '<h2>Your jury box</h2><p>Juror No. <b class="typed">' + jurorNo + '</b>. Earn a seal in each exhibit. Twelve seals fill the box.</p>' +
      '<ul class="seal-list">' + SEALS.map(function (s) {
        return '<li class="seal-item" data-seal="' + s.id + '"><a href="#' + s.ch + '"><span class="seal-medal">' + s.num + '</span><span>' + s.label + '</span></a></li>';
      }).join('') + '</ul>';
    document.body.appendChild(sealPanel);
    document.body.appendChild(sealBox);
    sealBox.addEventListener('click', function () {
      var open = sealPanel.hidden;
      sealPanel.hidden = !open;
      sealBox.setAttribute('aria-expanded', String(open));
    });
    sealPanel.addEventListener('click', function (e) {
      if (e.target.closest('a')) { sealPanel.hidden = true; sealBox.setAttribute('aria-expanded', 'false'); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !sealPanel.hidden) { sealPanel.hidden = true; sealBox.setAttribute('aria-expanded', 'false'); sealBox.focus(); }
    });
    document.addEventListener('click', function (e) {
      if (!sealPanel.hidden && !sealPanel.contains(e.target) && !sealBox.contains(e.target)) {
        sealPanel.hidden = true; sealBox.setAttribute('aria-expanded', 'false');
      }
    });
    renderSeals(false);
    // Tuck the badge away while the reader scrolls down, bring it back on any scroll up.
    var lastY = window.scrollY, tuckTimer;
    window.addEventListener('scroll', function () {
      var y = window.scrollY, dy = y - lastY;
      if (Math.abs(dy) < 6) return;
      lastY = y;
      if (!sealPanel.hidden) return;
      sealBox.classList.toggle('is-tucked', dy > 0);
      clearTimeout(tuckTimer);
      tuckTimer = setTimeout(function () { sealBox.classList.remove('is-tucked'); }, 1800);
    }, { passive: true });
    // Keep the jury box out of the way while the summons is on screen.
    var hero = document.querySelector('.hero');
    if (hero && 'IntersectionObserver' in window) {
      sealBox.hidden = true;
      new IntersectionObserver(function (entries) {
        var heroVisible = entries[0].isIntersecting;
        sealBox.hidden = heroVisible;
        if (heroVisible) { sealPanel.hidden = true; sealBox.setAttribute('aria-expanded', 'false'); }
      }, { threshold: 0.02 }).observe(hero);
    }
  }
  function renderSeals(bump) {
    if (!sealBox) return;
    var dots = sealBox.querySelectorAll('.seal-dot');
    SEALS.forEach(function (s, i) { dots[i].classList.toggle('is-on', !!earned[s.id]); });
    sealBox.querySelector('.seal-count b').textContent = earnedCount();
    sealBox.setAttribute('aria-label', earnedCount() + ' of 12 seals earned. Open your jury box.');
    sealPanel.querySelectorAll('.seal-item').forEach(function (li) { li.classList.toggle('is-on', !!earned[li.dataset.seal]); });
    if (bump) sealBox.classList.remove('is-tucked');
    if (bump && !reduced) {
      sealBox.classList.remove('is-bump');
      void sealBox.offsetWidth;
      sealBox.classList.add('is-bump');
    }
  }

  /* ---------- the summons ---------- */
  function initSummons() {
    var el = document.getElementById('summons');
    if (!el) return;
    var no = document.getElementById('jurorNo');
    if (no) no.textContent = jurorNo;
    var btn = document.getElementById('answerSummons');
    var status = document.getElementById('summonsStatus');
    function mark() {
      el.classList.add('is-answered');
      if (status) status.textContent = 'Status: reporting for service';
      if (btn) btn.textContent = 'Begin at chapter I';
    }
    if (store.get('answered', false)) mark();
    if (btn) btn.addEventListener('click', function () {
      var first = !el.classList.contains('is-answered');
      mark();
      store.set('answered', true);
      var target = document.querySelector('.chapter');
      setTimeout(function () {
        if (target) target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      }, first && !reduced ? 650 : 0);
    });
  }

  /* ---------- chapters: rails, ticker, exhibit stickers ---------- */
  function initChapters() {
    var chapters = Array.prototype.slice.call(document.querySelectorAll('.chapter[data-tick]'));
    chapters.forEach(function (ch) {
      var rail = document.createElement('div');
      rail.className = 'rail';
      rail.setAttribute('aria-hidden', 'true');
      rail.innerHTML = '<div class="rail-inner"><span class="rail-num">' + (ch.dataset.num || '') + '</span><span class="rail-date">' + (ch.dataset.date || '') + '</span></div>';
      ch.insertBefore(rail, ch.firstChild);
    });

    var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    document.querySelectorAll('.exhibit').forEach(function (ex, i) {
      var st = ex.querySelector('.exhibit-sticker');
      if (st) st.innerHTML = 'Exhibit <b>' + (letters[i] || i + 1) + '</b>';
    });

    var track = document.getElementById('tickerTrack');
    var bar = document.getElementById('tickerBar');
    if (!track) return;
    track.innerHTML = chapters.map(function (ch) {
      return '<a class="tick" href="#' + ch.id + '" data-for="' + ch.id + '"><span class="tick-date">' + (ch.dataset.tickDate || ch.dataset.date || '') +
        '</span><span class="tick-name">' + ch.dataset.tick + '</span></a>';
    }).join('');
    var ticks = {};
    track.querySelectorAll('.tick').forEach(function (t) { ticks[t.dataset.for] = t; });

    var current = null;
    function setActive(id) {
      if (id === current) return;
      current = id;
      Object.keys(ticks).forEach(function (k) {
        ticks[k].classList.toggle('is-active', k === id);
        if (k === id) ticks[k].setAttribute('aria-current', 'true'); else ticks[k].removeAttribute('aria-current');
      });
      var t = ticks[id];
      if (t) {
        var left = t.offsetLeft - (track.clientWidth - t.offsetWidth) / 2;
        track.scrollTo({ left: Math.max(0, left), behavior: reduced ? 'auto' : 'smooth' });
      }
    }
    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        var mid = window.innerHeight * 0.35;
        var active = null;
        for (var i = 0; i < chapters.length; i++) {
          if (chapters[i].getBoundingClientRect().top <= mid) active = chapters[i].id;
        }
        if (active) setActive(active);
        else { current = null; Object.keys(ticks).forEach(function (k) { ticks[k].classList.remove('is-active'); }); }
        if (bar && chapters.length) {
          var start = chapters[0].offsetTop;
          var last = chapters[chapters.length - 1];
          var end = last.offsetTop + last.offsetHeight - window.innerHeight;
          var p = (window.scrollY - start) / Math.max(1, end - start);
          bar.style.width = (Math.max(0, Math.min(1, p)) * 100).toFixed(2) + '%';
        }
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
  }

  /* ---------- objections ---------- */
  function initObjections() {
    document.querySelectorAll('.objection').forEach(function (ob) {
      var btn = ob.querySelector('.obj-btn');
      var ruling = ob.querySelector('.obj-ruling');
      if (!btn || !ruling) return;
      btn.addEventListener('click', function () {
        ruling.hidden = false;
        btn.hidden = true;
        var focusable = ruling.querySelector('.obj-stamp');
        if (focusable) { focusable.setAttribute('tabindex', '-1'); focusable.focus({ preventScroll: true }); }
      });
    });
  }

  /* ---------- widget context ---------- */
  var scriptCache = {};
  TS.loadScript = function (url) {
    if (scriptCache[url]) return scriptCache[url];
    scriptCache[url] = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.crossOrigin = 'anonymous';
      s.onload = function () { resolve(); };
      s.onerror = function () { delete scriptCache[url]; reject(new Error('Could not load ' + url)); };
      document.head.appendChild(s);
    });
    return scriptCache[url];
  };

  function ctxFor(el, name) {
    return {
      el: el,
      name: name,
      reduced: reduced,
      juror: jurorNo,
      stamp: TS.stamp,
      hasSeal: TS.hasSeal,
      on: TS.on,
      emit: TS.emit,
      toast: TS.toast,
      loadScript: TS.loadScript,
      rand: Math.random,
      store: {
        get: function (k, d) { return store.get(name + ':' + k, d); },
        set: function (k, v) { store.set(name + ':' + k, v); }
      },
      onVisible: function (cb, opts) {
        if (!('IntersectionObserver' in window)) { cb(true); return function () {}; }
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) { cb(en.isIntersecting, en); });
        }, opts || { rootMargin: '200px 0px' });
        io.observe(el);
        return function () { io.disconnect(); };
      }
    };
  }

  function mountAll() {
    document.querySelectorAll('[data-widget]').forEach(function (el) {
      var name = el.getAttribute('data-widget');
      var fn = widgets[name];
      if (!fn) {
        el.innerHTML = '<p class="widget-missing">Exhibit "' + name + '" is missing.</p>';
        return;
      }
      try { fn(el, ctxFor(el, name)); }
      catch (err) {
        if (window.console) console.error('[widget ' + name + ']', err);
        el.innerHTML = '<p class="widget-error">This exhibit could not load. The rest of the page still works.</p>';
      }
    });
  }

  TS.init = function () {
    initChapters();
    initSummons();
    initObjections();
    buildSeals();
    mountAll();
    var q = /[?&]theme=(dark|light)/.exec(location.search);
    if (q) document.documentElement.setAttribute('data-theme', q[1]);
  };
})();
