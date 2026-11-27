/* vanishing: "The vanishing trial". 100 dots, each a federal defendant (or civil case) in fiscal year 2022.
   They start seated in a jury box; "Follow the cases" sorts them into how the cases ended; a second step
   picks out the few that reached a jury. A chip switches to federal civil cases. No seal. */
(function () {
  'use strict';

  /* =====================================================================
     FACTS. Every number and factual sentence in this exhibit lives here.
     Federal fiscal year 2022 = the 12 months ending September 30, 2022.
     ===================================================================== */
  var FACTS = {
    criminal: {
      chip: 'Criminal cases',
      caption: '100 federal criminal defendants, fiscal year 2022. Each dot stands for about 720 real people.',
      restNote: 'Almost all of them had a right to a trial by jury. Follow the cases to see how many used it.',
      total: 71954,
      unit: 'defendants',
      bins: [
        { id: 'plea', name: 'Pleaded guilty', n: 64384, look: 'plea' },
        { id: 'dismissed', name: 'Dismissed', n: 5901, look: 'gone' },
        { id: 'trial', name: 'Went to trial', juryName: 'Reached a jury', n: 1669, look: 'trial', sub: ['Jury 2.0%', 'Judge 0.3%'] }
      ],
      jury: { n: 1475, convicted: 1245, acquitted: 230, bench: 194, benchAcquitted: 60 },
      juryRows: [
        { key: 'dot', label: 'Tried by a jury', n: 1475 },
        { key: 'slice', label: 'Acquitted by that jury', n: 230 },
        { key: 'ghost', label: 'Tried by a judge alone', n: 194 }
      ],
      big: 'The jury decides a sliver. Plea bargaining decides most of the rest.',
      lesson: 'Of every 100 federal defendants, about 2 faced a jury, and juries acquitted about a third of one. Counting judges, 0.4% were acquitted: fewer than 1 in 100. Guilty pleas ended nearly 9 cases in 10. Most come through plea bargaining: the defendant pleads guilty, usually for a lighter charge or sentence, a judge approves the deal, and no jury ever hears the case.',
      quote: '“[C]riminal justice today is for the most part a system of pleas, not a system of trials.”',
      quoteBy: 'Justice Anthony Kennedy, <i>Lafler v. Cooper</i> (2012)'
    },
    civil: {
      chip: 'Civil cases',
      caption: '100 federal civil cases that ended in fiscal year 2022. Each dot stands for about 3,100 real cases.',
      restNote: 'The Seventh Amendment preserves the jury in federal suits at common law. Follow the cases to see how many reached one.',
      total: 307923,
      unit: 'cases',
      bins: [
        { id: 'before', name: 'Ended before trial', n: 305802, look: 'plea' },
        { id: 'trial', name: 'Reached trial', juryName: 'Reached a jury', n: 2121, look: 'trial', sub: ['Jury 0.5%', 'Judge 0.2%'] }
      ],
      jury: { n: 1486, bench: 635 },
      juryRows: [
        { key: 'dot', label: 'Reached a trial of any kind', n: 2121 },
        { key: 'none', label: 'Tried by a jury', n: 1486 },
        { key: 'none', label: 'Tried by a judge alone', n: 635 }
      ],
      big: 'The jury decides a sliver. Settlements and judges decide the rest.',
      lesson: 'Fewer than 1 in 100 federal civil cases reached a trial, and about half of 1 in 100 reached a jury. The rest ended without one: they settled, were dropped, were dismissed or were decided by a judge on written motions.',
      quote: '',
      quoteBy: ''
    },
    sourceLine: 'Sources: Administrative Office of the U.S. Courts, Judicial Business 2022, Tables D-4 (criminal defendants disposed of) and C-4 (civil cases terminated), 12 months ending Sept. 30, 2022; Pew Research Center, June 14, 2023. Trials include bench trials, decided by a judge alone. Civil trials count cases ended during or after trial. Dots are rounded; percentages are exact.'
  };
  /* ===================================================================== */

  var NS = 'http://www.w3.org/2000/svg';
  var DUR = 480;

  function pctOf(n, total) { return (n / total) * 100; }
  function fmtPct(n, total) { return pctOf(n, total).toFixed(1) + '%'; }
  function fmtN(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function svgEl(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  /* Whole dots per bin by the largest-remainder method, so the bins always add to 100. */
  function dotCounts(bins, total) {
    var raw = bins.map(function (b) { return pctOf(b.n, total); });
    var base = raw.map(Math.floor);
    var left = 100 - base.reduce(function (a, b) { return a + b; }, 0);
    raw.map(function (v, i) { return { i: i, r: v - Math.floor(v) }; })
      .sort(function (a, b) { return b.r - a.r; })
      .slice(0, left).forEach(function (o) { base[o.i]++; });
    return base;
  }
  function wedgePath(cx, cy, r, frac) {
    var a0 = -Math.PI / 2, a1 = a0 + frac * Math.PI * 2;
    var x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    return 'M' + cx.toFixed(2) + ' ' + cy.toFixed(2) + 'L' + cx.toFixed(2) + ' ' + (cy - r).toFixed(2) +
      'A' + r.toFixed(2) + ' ' + r.toFixed(2) + ' 0 ' + (frac > 0.5 ? 1 : 0) + ' 1 ' + x1.toFixed(2) + ' ' + y1.toFixed(2) + 'Z';
  }

  TS.register('vanishing', function (el, ctx) {
    var dataKey = 'criminal';
    var mode = 'rest';   // rest | sorted | jury

    el.innerHTML =
      '<div class="w-van">' +
        '<div class="chips w-van-chips" role="group" aria-label="Which cases">' +
          '<button type="button" class="chip" data-k="criminal" aria-pressed="true">' + FACTS.criminal.chip + '</button>' +
          '<button type="button" class="chip" data-k="civil" aria-pressed="false">' + FACTS.civil.chip + '</button>' +
        '</div>' +
        '<p class="w-van-caption"></p>' +
        '<div class="w-van-stage"><svg class="w-van-svg" role="img" focusable="false"></svg></div>' +
        '<div class="btn-row w-van-actions">' +
          '<button type="button" class="btn w-van-go">Follow the cases</button>' +
        '</div>' +
        '<div class="w-van-panel"></div>' +
        '<p class="w-van-source">' + FACTS.sourceLine + '</p>' +
        '<p class="sr-only" aria-live="polite"></p>' +
      '</div>';

    var stage = el.querySelector('.w-van-stage');
    var svg = el.querySelector('.w-van-svg');
    var caption = el.querySelector('.w-van-caption');
    var goBtn = el.querySelector('.w-van-go');
    var panel = el.querySelector('.w-van-panel');
    var live = el.querySelector('[aria-live]');
    var chips = Array.prototype.slice.call(el.querySelectorAll('.w-van-chips .chip'));

    var gBox = svgEl('g', { 'class': 'w-van-box' }, svg);
    var gLabels = svgEl('g', { 'class': 'w-van-labels' }, svg);
    var gHalo = svgEl('g', { 'class': 'w-van-halo' }, svg);
    var gDots = svgEl('g', { 'class': 'w-van-dots' }, svg);
    var ghost = svgEl('g', { 'class': 'w-van-ghost' }, svg);
    var ghostRing = svgEl('circle', { 'class': 'w-van-ghost-ring' }, ghost);
    var ghostFill = svgEl('path', { 'class': 'w-van-ghost-fill' }, ghost);
    var slice = svgEl('path', { 'class': 'w-van-slice' }, svg);
    var gRings = svgEl('g', { 'class': 'w-van-rings' }, svg);

    var dots = [], cur = [];
    for (var i = 0; i < 100; i++) {
      dots.push(svgEl('circle', { 'class': 'w-van-dot is-rest', r: 6 }, gDots));
      cur.push({ x: 0, y: 0, r: 6 });
    }
    /* A fixed random order decides which seat in the box goes to which outcome. */
    var order = [];
    for (i = 0; i < 100; i++) order.push(i);
    for (i = 99; i > 0; i--) { var j = Math.floor(ctx.rand() * (i + 1)); var tmp = order[i]; order[i] = order[j]; order[j] = tmp; }
    var lag = order.map(function () { return Math.floor(ctx.rand() * 200); });

    var L = null, anim = 0, W = 0;

    /* ---------- layout ---------- */
    function compute(w) {
      var narrow = w < 500;
      var out = { rest: [], sorted: {}, H: 0, box: null, benches: [] };
      /* rest: a jury box of 100 seats */
      var cols = narrow ? 10 : 20, rows = 100 / cols;
      var pr = Math.min(narrow ? 27 : 31, (w - 16) / cols);
      var rr = pr * 0.3;
      var gw = pr * cols, x0 = (w - gw) / 2, y0 = 8;
      for (var k = 0; k < 100; k++) {
        out.rest.push({ x: x0 + pr / 2 + (k % cols) * pr, y: y0 + pr / 2 + Math.floor(k / cols) * pr, r: rr });
      }
      for (var row = 0; row < rows; row++) out.benches.push({ x1: x0 + 4, x2: x0 + gw - 4, y: y0 + (row + 1) * pr - pr * 0.12 });
      out.box = { x: x0 - 6, y: y0 - 6, w: gw + 12, h: rows * pr + 12 };
      var restH = y0 + rows * pr + 14;

      /* sorted: bins flow left to right and wrap */
      var ps = narrow ? Math.min(19, (w - 4) / 15) : 22;
      var rs = ps * 0.36, LABEL = 40, SUBH = 26, gapX = narrow ? 18 : 30, gapY = 16;
      var CH = 6.95; // Courier label width per character at 10.5px with tracking
      var maxH = 0;
      ['criminal', 'civil'].forEach(function (key) {
        var D = FACTS[key];
        var counts = dotCounts(D.bins, D.total);
        var juryDots = Math.round(pctOf(D.jury.n, D.total));
        var x = 2, y = 0, rowH = 0;
        var bins = D.bins.map(function (b, bi) {
          var n = counts[bi];
          var hasGhost = key === 'criminal' && b.id === 'trial';
          var slots = n + (hasGhost ? 1 : 0);
          var bc = slots >= 30 ? 15 : Math.min(slots, 8);
          var brows = Math.ceil(slots / bc);
          var names = [b.name, b.juryName || b.name];
          var labelW = Math.max.apply(null, names.map(function (s) { return s.length * CH; }));
          var bw = Math.max(bc * ps, labelW, b.sub ? 10 * 6 : 0);
          var bh = LABEL + brows * ps + (b.sub ? SUBH : 4);
          if (x > 2 && x + bw > w) { x = 2; y += rowH + gapY; rowH = 0; }
          var bin = { id: b.id, x: x, y: y, w: bw, cols: bc, n: n, ghost: hasGhost, sub: b.sub, dotsTop: y + LABEL, rows: brows };
          x += bw + gapX;
          rowH = Math.max(rowH, bh);
          return bin;
        });
        var H = y + rowH + 6;
        /* place dots: rank in the shuffled order decides the bin */
        var targets = new Array(100), binOf = new Array(100), slotOf = new Array(100);
        var rank = 0;
        bins.forEach(function (bin, bi) {
          for (var s = 0; s < bin.n; s++, rank++) {
            var d = order[rank];
            binOf[d] = bi; slotOf[d] = s;
            targets[d] = { x: bin.x + ps / 2 + (s % bin.cols) * ps, y: bin.dotsTop + ps / 2 + Math.floor(s / bin.cols) * ps, r: rs };
          }
          if (bin.ghost) {
            bin.ghostAt = { x: bin.x + ps / 2 + (bin.n % bin.cols) * ps, y: bin.dotsTop + ps / 2 + Math.floor(bin.n / bin.cols) * ps, r: rs };
          }
        });
        var trialIdx = bins.length - 1;
        var juryList = [];
        for (var dd = 0; dd < 100; dd++) if (binOf[dd] === trialIdx && slotOf[dd] < Math.max(1, juryDots)) juryList.push(dd);
        juryList.sort(function (a, b) { return slotOf[a] - slotOf[b]; });
        out.sorted[key] = { bins: bins, targets: targets, binOf: binOf, jury: juryList, H: H, ps: ps };
        maxH = Math.max(maxH, H);
      });
      out.H = Math.ceil(Math.max(restH, maxH));
      out.narrow = narrow;
      return out;
    }

    /* ---------- drawing ---------- */
    function drawBox() {
      gBox.textContent = '';
      var b = L.box;
      svgEl('rect', { 'class': 'w-van-boxbg', x: b.x, y: b.y, width: b.w, height: b.h, rx: 4 }, gBox);
      L.benches.forEach(function (bn) { svgEl('line', { 'class': 'w-van-bench', x1: bn.x1, x2: bn.x2, y1: bn.y, y2: bn.y }, gBox); });
      svgEl('line', { 'class': 'w-van-rail', x1: b.x + 2, x2: b.x + b.w - 2, y1: b.y + b.h, y2: b.y + b.h }, gBox);
    }
    function drawLabels() {
      gLabels.textContent = '';
      var D = FACTS[dataKey], S = L.sorted[dataKey];
      S.bins.forEach(function (bin, bi) {
        var b = D.bins[bi];
        var g = svgEl('g', { 'class': 'w-van-bin' + (b.id === 'trial' ? ' is-trial' : '') }, gLabels);
        var name = svgEl('text', { 'class': 'w-van-name', x: bin.x, y: bin.y + 12 }, g);
        name.textContent = (mode === 'jury' && b.juryName) ? b.juryName : b.name;
        var pct = svgEl('text', { 'class': 'w-van-pct', x: bin.x, y: bin.y + 32 }, g);
        pct.textContent = (mode === 'jury' && b.id === 'trial') ? fmtPct(D.jury.n, D.total) : fmtPct(b.n, D.total);
        if (b.sub && mode !== 'jury') {
          var sy = bin.dotsTop + bin.rows * S.ps + 11;
          b.sub.forEach(function (line, li) {
            var t = svgEl('text', { 'class': 'w-van-sub', x: bin.x, y: sy + li * 12 }, g);
            t.textContent = line;
          });
        }
      });
    }
    function setDot(k, p) {
      dots[k].setAttribute('cx', p.x.toFixed(2));
      dots[k].setAttribute('cy', p.y.toFixed(2));
      dots[k].setAttribute('r', p.r.toFixed(2));
    }
    function targetsFor() { return mode === 'rest' ? L.rest : L.sorted[dataKey].targets; }

    function placeExtras() {
      var S = L.sorted[dataKey];
      var trial = S.bins[S.bins.length - 1];
      var showGhost = mode !== 'rest' && !!trial.ghostAt;
      ghost.classList.toggle('is-on', showGhost);
      if (trial.ghostAt) {
        var gp = trial.ghostAt, D = FACTS[dataKey];
        ghostRing.setAttribute('cx', gp.x); ghostRing.setAttribute('cy', gp.y); ghostRing.setAttribute('r', gp.r);
        ghostFill.setAttribute('d', wedgePath(gp.x, gp.y, gp.r, pctOf(D.jury.bench, D.total) / 1));
      }
      var showSlice = mode === 'jury' && dataKey === 'criminal';
      slice.classList.toggle('is-on', showSlice);
      if (dataKey === 'criminal' && S.jury.length) {
        var host = S.targets[S.jury[S.jury.length - 1]];
        var D2 = FACTS.criminal;
        slice.setAttribute('d', wedgePath(host.x, host.y, host.r, pctOf(D2.jury.acquitted, D2.total)));
      }
      gRings.textContent = '';
      gHalo.textContent = '';
      if (mode === 'jury' && S.jury.length) {
        /* the few that reached a jury get a jury box of their own */
        var x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity, pad = 0;
        S.jury.forEach(function (d) {
          var t = S.targets[d];
          pad = t.r + 4;
          x1 = Math.min(x1, t.x - pad); y1 = Math.min(y1, t.y - pad);
          x2 = Math.max(x2, t.x + pad); y2 = Math.max(y2, t.y + pad);
        });
        var box = { x: x1, y: y1, width: x2 - x1, height: y2 - y1, rx: 5 };
        svgEl('rect', Object.assign({ 'class': 'w-van-jbox' }, box), gHalo);
        svgEl('line', { 'class': 'w-van-jrail', x1: x1 + 2, x2: x2 - 2, y1: y2 + 2, y2: y2 + 2 }, gHalo);
        if (!ctx.reduced) svgEl('rect', Object.assign({ 'class': 'w-van-ping' }, box), gRings);
      }
    }

    function paint() {
      var S = L.sorted[dataKey];
      var D = FACTS[dataKey];
      for (var k = 0; k < 100; k++) {
        var cls = 'w-van-dot';
        if (mode === 'rest') cls += ' is-rest';
        else {
          var b = D.bins[S.binOf[k]];
          cls += ' is-' + b.look;
          if (mode === 'jury') cls += S.jury.indexOf(k) >= 0 ? ' is-hot' : ' is-dim';
        }
        dots[k].setAttribute('class', cls);
      }
      svg.classList.toggle('is-rest', mode === 'rest');
      svg.classList.toggle('is-jury', mode === 'jury');
    }

    function moveDots(instant, done) {
      cancelAnimationFrame(anim);
      var to = targetsFor();
      if (instant || ctx.reduced) {
        for (var k = 0; k < 100; k++) { cur[k] = { x: to[k].x, y: to[k].y, r: to[k].r }; setDot(k, cur[k]); }
        if (done) done();
        return;
      }
      var from = cur.map(function (p) { return { x: p.x, y: p.y, r: p.r }; });
      var t0 = performance.now();
      function tick(now) {
        var all = true;
        for (var k = 0; k < 100; k++) {
          var t = Math.max(0, Math.min(1, (now - t0 - lag[k]) / DUR));
          if (t < 1) all = false;
          var e = ease(t);
          cur[k] = { x: from[k].x + (to[k].x - from[k].x) * e, y: from[k].y + (to[k].y - from[k].y) * e, r: from[k].r + (to[k].r - from[k].r) * e };
          setDot(k, cur[k]);
        }
        if (!all) anim = requestAnimationFrame(tick);
        else if (done) done();
      }
      anim = requestAnimationFrame(tick);
    }

    /* ---------- text ---------- */
    function ledgerRow(label, n, total, icon) {
      return '<li><span class="w-van-key ' + icon + '" aria-hidden="true"></span><span class="w-van-lname">' + label +
        '</span><span class="w-van-leader" aria-hidden="true"></span><span class="w-van-num">' + fmtN(n) +
        '</span><span class="w-van-share">' + fmtPct(n, total) + '</span></li>';
    }
    function renderPanel() {
      var D = FACTS[dataKey];
      var html = '';
      if (mode === 'rest') {
        html = '<p class="w-van-note">' + D.restNote + '</p>';
      } else if (mode === 'sorted') {
        html = '<ul class="w-van-ledger">' + D.bins.map(function (b) { return ledgerRow(b.name, b.n, D.total, 'is-' + b.look); }).join('') +
          '<li class="is-total"><span class="w-van-key" aria-hidden="true"></span><span class="w-van-lname">Total ' + D.unit + '</span><span class="w-van-leader" aria-hidden="true"></span><span class="w-van-num">' +
          fmtN(D.total) + '</span><span class="w-van-share">100%</span></li></ul>';
      } else {
        html = '<ul class="w-van-ledger">' + D.juryRows.map(function (r) {
          return ledgerRow(r.label, r.n, D.total, r.key === 'dot' ? 'is-trial is-hot' : r.key === 'slice' ? 'is-slice' : r.key === 'ghost' ? 'is-ghost' : 'is-none');
        }).join('') + '</ul>' +
          '<div class="w-van-payoff"><p class="w-van-big">' + D.big + '</p>' +
          '<p>' + D.lesson + '</p>' +
          (D.quote ? '<blockquote class="w-van-quote"><p>' + D.quote + '</p><footer>' + D.quoteBy + '</footer></blockquote>' : '') + '</div>';
      }
      panel.innerHTML = html;
      if (!ctx.reduced && mode !== 'rest') { panel.classList.remove('is-in'); void panel.offsetWidth; panel.classList.add('is-in'); }
    }
    function describe() {
      var D = FACTS[dataKey];
      if (mode === 'rest') return D.caption;
      if (mode === 'sorted') {
        return D.bins.map(function (b) { return b.name + ': ' + fmtPct(b.n, D.total); }).join('. ') + '.';
      }
      if (dataKey === 'criminal') return 'Reached a jury: ' + fmtPct(D.jury.n, D.total) + '. Acquitted by a jury: ' + fmtPct(D.jury.acquitted, D.total) + '. Plea bargains decided ' + fmtPct(D.bins[0].n, D.total) + '.';
      return 'Reached trial: ' + fmtPct(D.bins[1].n, D.total) + '. Tried by a jury: ' + fmtPct(D.jury.n, D.total) + '.';
    }
    function renderText(announce) {
      var D = FACTS[dataKey];
      caption.textContent = D.caption;
      goBtn.textContent = mode === 'rest' ? 'Follow the cases' : mode === 'sorted' ? 'Who reached a jury?' : 'Start over';
      goBtn.classList.toggle('btn-ghost', mode === 'jury');
      svg.setAttribute('aria-label', D.caption + ' ' + (mode === 'rest' ? 'The dots sit in a jury box.' : describe()));
      chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c.getAttribute('data-k') === dataKey)); });
      renderPanel();
      if (announce) live.textContent = describe();
    }

    function render(instant, announce) {
      paint();
      drawLabels();
      placeExtras();
      var extras = [gRings, gHalo, slice];
      if (!instant) extras.forEach(function (x) { x.style.visibility = 'hidden'; });
      moveDots(instant, function () { extras.forEach(function (x) { x.style.visibility = ''; }); });
      svg.classList.toggle('is-sorted', mode !== 'rest');
      renderText(announce);
    }

    function relayout() {
      var w = Math.floor(stage.clientWidth);
      if (!w || w === W) return;
      W = w;
      L = compute(W);
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + L.H);
      svg.setAttribute('width', W);
      svg.setAttribute('height', L.H);
      drawBox();
      render(true, false);
    }

    goBtn.addEventListener('click', function () {
      mode = mode === 'rest' ? 'sorted' : mode === 'sorted' ? 'jury' : 'rest';
      render(false, true);
    });
    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        var k = c.getAttribute('data-k');
        if (k === dataKey) return;
        dataKey = k;
        render(false, true);
      });
    });

    if ('ResizeObserver' in window) new ResizeObserver(function () { relayout(); }).observe(stage);
    else window.addEventListener('resize', relayout);
    relayout();
  });
})();
