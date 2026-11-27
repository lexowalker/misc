/* Exhibit: "You are juror 501" (Chapter II). The trial of Socrates, Athens, 399 BCE.
   The reader casts one ballot, watches 500 others land on a counting board, then votes on the penalty.
   Seal: 'socrates', awarded when the first count is revealed. */
(function () {
  'use strict';

  /* =====================================================================
     COPY AND FACTS. Everything the reader sees is here, so it is easy to correct.
     Sources: Plato, Apology 24b, 36a, 36b to 38b; Diogenes Laertius 2.40 to 2.42;
     [Aristotle], Constitution of the Athenians 62.2, 68 to 69; Xenophon, Memorabilia 4.8.2.
     The exact vote counts are the traditional modern reconstruction, labeled as such.
     ===================================================================== */
  var DATA = {
    era: 'Athens, 399 BCE',
    caseTitle: 'The charge against Socrates',
    caseKind: 'Graphe asebeias: a public suit for impiety',
    fields: [
      ['Accused', 'Socrates, son of Sophroniscus, of the deme Alopeke. He is about seventy.'],
      ['Prosecutors', 'Meletus, who brought the charge, backed by Anytus and Lycon.'],
      ['Penalty sought', 'Death.'],
      ['Jury', '500 or 501 sworn citizens.']
    ],
    chargesLabel: 'Charges',
    charges: [
      'He does not recognize the gods the city recognizes.',
      'He brings in other, new divine beings.',
      'He corrupts the young.'
    ],
    caseSource: 'Wording after Plato, Apology 24b, and Diogenes Laertius 2.40.',
    caseMore: 'Read the charge sheet',

    voteLabel: 'Ballot one: guilty or not guilty',
    voteIntro: 'Both sides have spoken, timed by a water clock. No judge explains the law. Nobody talks it over. You vote now, in secret, and the majority wins.',
    ballots: {
      c: { axle: 'Hollow axle', verb: 'Condemn', aria: 'Hollow axle ballot: condemn Socrates' },
      a: { axle: 'Solid axle', verb: 'Acquit', aria: 'Solid axle ballot: acquit Socrates' }
    },
    inscription: 'ΨΗΦΟΣ ΔΗΜΟΣΙΑ',
    pinch: 'Every juror got one of each. Pinch the axle ends between finger and thumb and nobody can tell which one you drop into the bronze urn. The other goes into a wooden urn for discards.',
    pebble: 'Bronze ballots like these, stamped ΨΗΦΟΣ ΔΗΜΟΣΙΑ (public ballot), are described for the later 4th century. In 399, jurors may have voted with pebbles.',
    urnBronze: ['Bronze urn', 'this one counts'],
    urnWood: ['Wooden urn', 'for the discard'],
    cast: {
      c: 'Your hollow ballot drops into the bronze urn. The solid one goes into the wooden urn.',
      a: 'Your solid ballot drops into the bronze urn. The hollow one goes into the wooden urn.'
    },
    countBtn: 'Tip out the urn and count',

    boardLabel: 'The counting board',
    boardNote: 'Officials tipped the bronze urn onto a board with one hole per ballot, so both sides could watch the count.',
    boardAria: function (c, a, r2) {
      return r2 ? 'Counting board for the penalty: ' + c + ' for death, ' + a + ' for the fine.'
                : 'Counting board: ' + c + ' hollow ballots to condemn, ' + a + ' solid ballots to acquit.';
    },
    boardEmpty: 'Counting board with 500 empty holes, one for each of the other jurors.',
    yoursCap: 'Juror 501: you',
    yoursEmpty: 'Not cast yet',
    tally1: { c: 'Hollow: condemn', a: 'Solid: acquit' },
    tally2: { c: 'Death', a: 'Fine' },
    majority: 'Majority',
    counting: 'Counting...',

    verdict1: 'Guilty, 280 to 221.',
    you1: {
      c: 'You voted with the 280.',
      a: 'You voted with the 221. It was not enough.'
    },
    swing: 'It was close. Socrates said that if thirty votes had gone the other way, he would have been acquitted (Plato, Apology 36a). Flip the 30 brass rings and it is 250 to 251.',
    doubt: 'Traditional reconstruction. Plato gives only the margin, Diogenes Laertius wrote some six centuries later, and the jury may have been 500 or 501.',
    stamp1: 'Guilty',

    penLabel: 'Ballot two: the penalty',
    penIntro: 'The law fixed no penalty for this charge. Each side proposed one, and the jury had to pick one of the two. Nothing in between.',
    props: [
      ['Prosecution', 'Death.'],
      ['Socrates', 'Says what he deserves is free meals in the Prytaneum, an honor Athens gave to Olympic victors.'],
      ['Socrates', 'Offers a fine of 1 mina, which he says he can afford.'],
      ['Socrates', 'Raises it to 30 minae. Plato, Crito, Critobulus and Apollodorus will guarantee it.']
    ],
    mina: '30 minae is 3,000 drachmas: about 6,000 days of jury pay at 3 obols a day.',
    penSource: 'After Plato, Apology 36b to 38b.',
    penAsk: 'Choose one penalty.',
    toPen: 'Next: vote on the penalty',
    penBtn: { d: 'Death', f: 'Fine of 30 minae' },

    verdict2: 'Death, 360 to 141.',
    round1Recap: 'Ballot one: guilty, 280 to 221.',
    combo: {
      cd: 'You voted guilty, then death. Most of the jury did the same.',
      cf: 'You voted guilty, then for the fine. You were outvoted.',
      ad: 'You voted to acquit, then for death. On the traditional numbers, at least 80 jurors did the same.',
      af: 'You voted to acquit, then for the fine. You lost both times.'
    },
    eighty: 'Diogenes Laertius says the death vote won 80 more votes than the guilty vote, and he tells it right after the free meals. If so, at least 80 jurors who had voted to acquit now voted for death. The brass rings mark that swing.',
    stamp2: 'Death',
    end: 'About a month later, Socrates drank the poison in prison.',
    replay: 'Sit on the jury again'
  };

  var NS = 'http://www.w3.org/2000/svg';
  var N = 500, COLS = 25, CELL = 10;
  var C1 = 280, A1 = 221, D2 = 360, F2 = 141;   // traditional counts, 501 jurors
  var SWING = 30;
  var uid = 0;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* A bronze ballot seen from above: disc, inscription, axle end. kind 'c' = hollow, 'a' = solid. */
  function discSVG(kind) {
    var id = 'w-socrates-rim-' + (++uid);
    return '<svg class="w-socrates-disc is-' + kind + '" viewBox="0 0 100 100" aria-hidden="true" focusable="false">' +
      '<defs><path id="' + id + '" d="M50 83a33 33 0 1 1 0 -66a33 33 0 1 1 0 66"/></defs>' +
      '<circle class="d-rim" cx="50" cy="50" r="46"/>' +
      '<circle class="d-ring" cx="50" cy="50" r="25"/>' +
      '<text class="d-txt"><textPath href="#' + id + '" startOffset="50%" text-anchor="middle">' + DATA.inscription + '</textPath></text>' +
      '<circle class="d-hub" cx="50" cy="50" r="14"/>' +
      (kind === 'c'
        ? '<circle class="d-hole" cx="50" cy="50" r="7.5"/>'
        : '<circle class="d-knob" cx="50" cy="50" r="7.5"/><circle class="d-shine" cx="47.5" cy="47.5" r="2.6"/>') +
    '</svg>';
  }

  /* An edge-on ballot for the urn scene. */
  function edgeBallot(kind, x) {
    return '<g class="w-socrates-fall is-' + kind + '" transform="translate(' + x + ' 0)">' +
      '<g class="w-socrates-fall-in"><ellipse class="e-disc" cx="0" cy="0" rx="11" ry="3.4"/>' +
      '<rect class="e-axle" x="-2.2" y="-7" width="4.4" height="14" rx="1"/>' +
      (kind === 'c' ? '<ellipse class="e-hole" cx="0" cy="-7" rx="1.4" ry=".7"/>' : '') + '</g></g>';
  }

  TS.register('socrates', function (el, ctx) {
    var R = ctx.reduced;
    var state = 'vote1';
    var v1 = null, v2 = null;
    var run = 0;
    var visible = true;

    /* ---------- markup ---------- */
    function fieldRow(f) { return '<div class="w-socrates-row"><dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd></div>'; }
    var chargesHtml = '<div class="w-socrates-row"><dt>' + esc(DATA.chargesLabel) + '</dt><dd><ol class="w-socrates-charges">' +
      DATA.charges.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ol></dd></div>';
    var rows = fieldRow(DATA.fields[0]) + chargesHtml + DATA.fields.slice(1).map(fieldRow).join('');

    function ballotBtn(kind) {
      var b = DATA.ballots[kind];
      return '<button type="button" class="w-socrates-ballot" data-v="' + kind + '" aria-pressed="false" aria-label="' + esc(b.aria) + '">' +
        discSVG(kind) +
        '<span class="w-socrates-axle">' + esc(b.axle) + '</span>' +
        '<span class="w-socrates-verb">' + esc(b.verb) + '</span>' +
      '</button>';
    }

    var boardCells = '';
    for (var i = 0; i < N; i++) {
      boardCells += '<circle class="w-socrates-h" cx="' + ((i % COLS) * CELL + 5) + '" cy="' + (Math.floor(i / COLS) * CELL + 5) + '" r="3.4"/>';
    }

    el.innerHTML =
      '<div class="w-socrates">' +
        '<div class="w-socrates-top">' +
          '<article class="w-socrates-case" aria-label="' + esc(DATA.caseTitle) + '">' +
            '<svg class="w-socrates-key" aria-hidden="true" focusable="false"><defs><pattern id="w-socrates-key-p" width="16" height="10" patternUnits="userSpaceOnUse">' +
              '<path class="w-socrates-keypath" d="M0 9H16M10.5 9V1.2H3.5V6.2H7.2V3.8"/></pattern></defs><rect width="100%" height="10" fill="url(#w-socrates-key-p)"/></svg>' +
            '<p class="w-socrates-era">' + esc(DATA.era) + '</p>' +
            '<h4 class="w-socrates-ctitle">' + esc(DATA.caseTitle) + '</h4>' +
            '<p class="w-socrates-kind">' + esc(DATA.caseKind) + '</p>' +
            '<details class="w-socrates-more">' +
              '<summary class="w-socrates-moresum">' + esc(DATA.caseMore) + '</summary>' +
              '<dl class="w-socrates-fields">' + rows + '</dl>' +
              '<p class="w-socrates-src">' + esc(DATA.caseSource) + '</p>' +
            '</details>' +
          '</article>' +
          '<section class="w-socrates-vote" aria-label="' + esc(DATA.voteLabel) + '">' +
            '<p class="label">' + esc(DATA.voteLabel) + '</p>' +
            '<p class="w-socrates-intro">' + esc(DATA.voteIntro) + '</p>' +
            '<div class="w-socrates-ballots">' + ballotBtn('c') + ballotBtn('a') + '</div>' +
            '<p class="w-socrates-note">' + esc(DATA.pinch) + '</p>' +
            '<div class="w-socrates-urns">' +
              '<svg class="w-socrates-urnsvg" viewBox="0 0 300 156" aria-hidden="true" focusable="false">' +
                '<g class="w-socrates-falls"></g>' +
                '<g class="w-socrates-bronze">' +
                  '<path class="u-body" d="M78 42C57 50 53 102 72 118H108C127 102 123 50 102 42Z"/>' +
                  '<path class="u-handle" d="M74 47c-22-2-25 22-12 31M106 47c22-2 25 22 12 31"/>' +
                  '<path class="u-neck" d="M78 31h24l-2 12H80z"/>' +
                  '<ellipse class="u-lid" cx="90" cy="30" rx="18" ry="4.2"/>' +
                  '<rect class="u-slot" x="83" y="28.8" width="14" height="2.4" rx="1"/>' +
                  '<rect class="u-foot" x="76" y="117" width="28" height="6" rx="1.5"/>' +
                  '<path class="u-band" d="M62 76c17 5 39 5 56 0M64 96c16 4 36 4 52 0"/>' +
                '</g>' +
                '<g class="w-socrates-wood">' +
                  '<path class="w-body" d="M193 40c-8 24-8 54 2 82h40c10-28 10-58 2-82z"/>' +
                  '<path class="w-grain" d="M205 41c-4 26-4 54 1 80M215 41v80M225 41c4 26 4 54-1 80"/>' +
                  '<path class="w-hoop" d="M190 58c16 3 34 3 50 0M190 104c16 3 34 3 50 0"/>' +
                  '<ellipse class="w-mouth" cx="215" cy="40" rx="22" ry="4"/>' +
                '</g>' +
                '<text class="u-label" x="90" y="137" text-anchor="middle">' + esc(DATA.urnBronze[0]) + '</text>' +
                '<text class="u-sub" x="90" y="152" text-anchor="middle">' + esc(DATA.urnBronze[1]) + '</text>' +
                '<text class="u-label" x="215" y="137" text-anchor="middle">' + esc(DATA.urnWood[0]) + '</text>' +
                '<text class="u-sub" x="215" y="152" text-anchor="middle">' + esc(DATA.urnWood[1]) + '</text>' +
              '</svg>' +
            '</div>' +
            '<p class="w-socrates-note w-socrates-pebble">' + esc(DATA.pebble) + '</p>' +
            '<div class="w-socrates-castrow" hidden>' +
              '<p class="w-socrates-cast"></p>' +
              '<button type="button" class="btn w-socrates-count">' + esc(DATA.countBtn) + '</button>' +
            '</div>' +
          '</section>' +
        '</div>' +
        '<section class="w-socrates-boardwrap" aria-label="' + esc(DATA.boardLabel) + '">' +
          '<div class="w-socrates-boardhead"><p class="label">' + esc(DATA.boardLabel) + '</p><p class="w-socrates-bnote">' + esc(DATA.boardNote) + '</p></div>' +
          '<div class="w-socrates-boardgrid">' +
            '<div class="w-socrates-boardbox">' +
              '<svg class="w-socrates-board" viewBox="-7 -7 264 214" role="img" aria-label="' + esc(DATA.boardEmpty) + '">' +
                '<rect class="w-socrates-frame" x="-6" y="-6" width="262" height="212" rx="4"/>' +
                '<line class="w-socrates-mid" x1="-6" y1="100" x2="256" y2="100"/>' +
                '<g class="w-socrates-cells">' + boardCells + '</g>' +
              '</svg>' +
              '<span class="w-socrates-stamp" aria-hidden="true"></span>' +
            '</div>' +
            '<div class="w-socrates-side">' +
              '<div class="w-socrates-yours">' +
                '<span class="w-socrates-ymark is-empty" aria-hidden="true"></span>' +
                '<span class="w-socrates-ycap"><b>' + esc(DATA.yoursCap) + '</b><span class="w-socrates-yval">' + esc(DATA.yoursEmpty) + '</span></span>' +
              '</div>' +
              '<div class="w-socrates-tally" aria-hidden="true">' +
                '<div class="w-socrates-t" data-k="c"><span class="w-socrates-tmark"></span><span class="w-socrates-tlab">' + esc(DATA.tally1.c) + '</span><b class="w-socrates-tn tnum">0</b></div>' +
                '<div class="w-socrates-t" data-k="a"><span class="w-socrates-tmark"></span><span class="w-socrates-tlab">' + esc(DATA.tally1.a) + '</span><b class="w-socrates-tn tnum">0</b></div>' +
                '<div class="w-socrates-bar"><span class="w-socrates-bar-c"></span><span class="w-socrates-bar-a"></span><i class="w-socrates-bar-mid"></i></div>' +
                '<p class="w-socrates-barlab"><span>0</span><span>' + esc(DATA.majority) + ': 251</span><span>501</span></p>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</section>' +
        '<div class="w-socrates-result" aria-live="polite"></div>' +
        '<section class="w-socrates-pen" hidden tabindex="-1" aria-label="' + esc(DATA.penLabel) + '">' +
          '<p class="label">' + esc(DATA.penLabel) + '</p>' +
          '<p class="w-socrates-intro">' + esc(DATA.penIntro) + '</p>' +
          '<ol class="w-socrates-props">' + DATA.props.map(function (p, k) {
            return '<li data-side="' + (k === 0 ? 'p' : 'd') + '"><span class="w-socrates-who">' + esc(p[0]) + '</span><span>' + esc(p[1]) + '</span></li>';
          }).join('') + '</ol>' +
          '<p class="w-socrates-mina">' + esc(DATA.mina) + '</p>' +
          '<p class="w-socrates-ask">' + esc(DATA.penAsk) + '</p>' +
          '<div class="btn-row w-socrates-penbtns">' +
            '<button type="button" class="btn btn-seal w-socrates-pb" data-v="d" aria-pressed="false">' + esc(DATA.penBtn.d) + '</button>' +
            '<button type="button" class="btn w-socrates-pb" data-v="f" aria-pressed="false">' + esc(DATA.penBtn.f) + '</button>' +
          '</div>' +
          '<p class="w-socrates-src">' + esc(DATA.penSource) + '</p>' +
        '</section>' +
      '</div>';

    var root = el.querySelector('.w-socrates');
    var ballotBtns = Array.prototype.slice.call(el.querySelectorAll('.w-socrates-ballot'));
    var urnsEl = el.querySelector('.w-socrates-urns');
    var fallsG = el.querySelector('.w-socrates-falls');
    var castRow = el.querySelector('.w-socrates-castrow');
    var castP = el.querySelector('.w-socrates-cast');
    var countBtn = el.querySelector('.w-socrates-count');
    var boardWrap = el.querySelector('.w-socrates-boardwrap');
    var boardBox = el.querySelector('.w-socrates-boardbox');
    var moreEl = el.querySelector('.w-socrates-more');
    var board = el.querySelector('.w-socrates-board');
    var cells = Array.prototype.slice.call(el.querySelectorAll('.w-socrates-cells circle'));
    var stampEl = el.querySelector('.w-socrates-stamp');
    var ymark = el.querySelector('.w-socrates-ymark');
    var yval = el.querySelector('.w-socrates-yval');
    var tC = el.querySelector('.w-socrates-t[data-k="c"]');
    var tA = el.querySelector('.w-socrates-t[data-k="a"]');
    var nC = tC.querySelector('.w-socrates-tn');
    var nA = tA.querySelector('.w-socrates-tn');
    var barC = el.querySelector('.w-socrates-bar-c');
    var barA = el.querySelector('.w-socrates-bar-a');
    var result = el.querySelector('.w-socrates-result');
    var pen = el.querySelector('.w-socrates-pen');
    var penBtns = Array.prototype.slice.call(el.querySelectorAll('.w-socrates-pb'));

    /* ---------- helpers ---------- */
    function setTally(c, a) {
      nC.textContent = c;
      nA.textContent = a;
      barC.style.width = (c / (N + 1) * 100).toFixed(2) + '%';
      barA.style.width = (a / (N + 1) * 100).toFixed(2) + '%';
    }
    function setCell(i, cls) { cells[i].setAttribute('class', 'w-socrates-h ' + cls); }
    function scrollTo(node, block) {
      if (node.scrollIntoView) node.scrollIntoView({ block: block || 'nearest', behavior: R ? 'auto' : 'smooth' });
    }
    /* Bottom edge of the sticky ticker (about 53px), so nothing important hides under it. */
    function tickerBottom() {
      var t = document.querySelector('.ticker');
      if (!t) return 0;
      var b = t.getBoundingClientRect().bottom;
      return b > 140 ? 56 : Math.max(0, b);
    }
    function vh() { return window.innerHeight || document.documentElement.clientHeight; }
    /* When the reader drags or wheels the page during a count, the automatic scroll after it stands down. */
    var userScrollAt = 0;
    function noteScroll() { userScrollAt = Date.now(); }
    window.addEventListener('touchmove', noteScroll, { passive: true });
    window.addEventListener('wheel', noteScroll, { passive: true });
    /* After a count: make sure the verdict line shows. If moving the board to the top of the screen is enough,
       do that, so the stamp and the brass rings stay in view; otherwise bring the result itself to the top. */
    function revealVerdict(since) {
      if (userScrollAt > since) return;
      var v = result.querySelector('.w-socrates-verdict');
      if (!v) return;
      var top = tickerBottom(), h = vh();
      var vr = v.getBoundingClientRect();
      if (vr.top >= top && vr.bottom + 8 <= h) return;
      var shift = boardBox.getBoundingClientRect().top - (top + 25);   // where 'start' puts the board (ticker + 25px)
      if (shift > 0 && vr.bottom + 8 - shift <= h) scrollTo(boardBox, 'start');
      else scrollTo(result, 'start');
    }
    function afterStamp(fn) {
      var id = run;
      if (R) { fn(); return; }
      setTimeout(function () { if (id === run) fn(); }, 650);
    }
    /* Phones keep the case fields folded; wide screens always show them. */
    var wide = window.matchMedia ? window.matchMedia('(min-width: 46rem)') : null;
    function syncCase() { if (wide && wide.matches) moreEl.open = true; }
    syncCase();
    if (wide) { if (wide.addEventListener) wide.addEventListener('change', syncCase); else if (wide.addListener) wide.addListener(syncCase); }
    function bumpStamp(text) {
      stampEl.textContent = text;
      stampEl.classList.remove('is-on');
      void stampEl.offsetWidth;
      stampEl.classList.add('is-on');
    }
    /* Runs fn(p) from 0 to 1 over dur ms; jumps to the end when reduced motion is on or the exhibit is off screen. */
    function tween(dur, fn, done) {
      var id = run;
      if (R || dur <= 0) { fn(1); done(); return; }
      var t0 = null;
      function step(now) {
        if (id !== run) return;
        if (t0 === null) t0 = now;
        var p = visible ? Math.min(1, (now - t0) / dur) : 1;
        fn(p);
        if (p < 1) requestAnimationFrame(step); else done();
      }
      requestAnimationFrame(step);
    }
    function yours(kind, round) {
      ymark.className = 'w-socrates-ymark';
      if (round === 1) {
        ymark.innerHTML = discSVG(kind);
        yval.textContent = DATA.ballots[kind].axle + ', ' + DATA.ballots[kind].verb.toLowerCase();
      } else {
        ymark.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle class="w-socrates-h ' + (kind === 'd' ? 'is-c' : 'is-a') + '" cx="10" cy="10" r="7"/></svg>';
        yval.textContent = kind === 'd' ? DATA.penBtn.d : DATA.penBtn.f;
      }
      if (!R) { ymark.classList.remove('is-pop'); void ymark.offsetWidth; ymark.classList.add('is-pop'); }
    }

    /* ---------- ballot one ---------- */
    function castFirst(kind) {
      if (state !== 'vote1') return;
      state = 'cast1';
      v1 = kind;
      ballotBtns.forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.dataset.v === kind));
        b.disabled = true;
      });
      var other = kind === 'c' ? 'a' : 'c';
      fallsG.innerHTML = edgeBallot(kind, 90) + edgeBallot(other, 215);
      urnsEl.classList.remove('is-cast');
      void urnsEl.offsetWidth;
      urnsEl.classList.add('is-cast');
      castP.textContent = DATA.cast[kind];
      castRow.hidden = false;
      yours(kind, 1);
      setTally(kind === 'c' ? 1 : 0, kind === 'a' ? 1 : 0);
      countBtn.focus({ preventScroll: true });
      scrollTo(castRow);
    }

    ballotBtns.forEach(function (b) {
      b.addEventListener('click', function () { castFirst(b.dataset.v); });
    });

    /* ---------- the first count ---------- */
    var othersC1 = 0;
    function countFirst() {
      if (state !== 'cast1') return;
      state = 'counting';
      countBtn.disabled = true;
      countBtn.textContent = DATA.counting;
      othersC1 = C1 - (v1 === 'c' ? 1 : 0);
      var othersA1 = N - othersC1;
      var you = { c: v1 === 'c' ? 1 : 0, a: v1 === 'a' ? 1 : 0 };
      var placedC = 0, placedA = 0;
      var since = Date.now();
      scrollTo(boardWrap, R ? 'nearest' : 'center');
      tween(2400, function (p) {
        var k = Math.min(othersC1, Math.floor(othersC1 * p));
        var m = Math.min(othersA1, Math.floor(othersC1 * p));
        if (p >= 1) { k = othersC1; m = othersA1; }
        for (; placedC < k; placedC++) setCell(placedC, 'is-c' + (R ? '' : ' is-pop'));
        for (; placedA < m; placedA++) setCell(N - 1 - placedA, 'is-a' + (R ? '' : ' is-pop'));
        setTally(placedC + you.c, placedA + you.a);
      }, function () {
        for (var s = othersC1 - SWING; s < othersC1; s++) setCell(s, 'is-c is-swing');
        board.setAttribute('aria-label', DATA.boardAria(C1, A1, false));
        setTally(C1, A1);
        bumpStamp(DATA.stamp1);
        result.innerHTML =
          '<p class="w-socrates-verdict">' + esc(DATA.verdict1) + '</p>' +
          '<p>' + esc(DATA.you1[v1]) + '</p>' +
          '<p class="w-socrates-swing"><span class="w-socrates-ring" aria-hidden="true"></span>' + esc(DATA.swing) + '</p>' +
          '<p class="w-socrates-doubt">' + esc(DATA.doubt) + '</p>' +
          '<div class="btn-row"><button type="button" class="btn btn-small w-socrates-tonext">' + esc(DATA.toPen) +
            '<svg class="w-socrates-down" viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M6 1.5v8.5M2 6.5l4 4 4-4"/></svg></button></div>';
        result.querySelector('.w-socrates-tonext').addEventListener('click', function () {
          pen.focus({ preventScroll: true });
          scrollTo(pen, 'start');
        });
        castRow.hidden = true;
        pen.hidden = false;
        state = 'counted';
        ctx.stamp('socrates');
        afterStamp(function () { revealVerdict(since); });
      });
    }
    countBtn.addEventListener('click', countFirst);

    /* ---------- ballot two: the penalty ---------- */
    function votePenalty(kind) {
      if (state !== 'counted') return;
      state = 'counting2';
      v2 = kind;
      penBtns.forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.dataset.v === kind));
        b.disabled = true;
      });
      tC.querySelector('.w-socrates-tlab').textContent = DATA.tally2.c;
      tA.querySelector('.w-socrates-tlab').textContent = DATA.tally2.a;
      root.classList.add('is-round2');
      stampEl.classList.remove('is-on');
      for (var s = 0; s < othersC1; s++) setCell(s, 'is-c');
      yours(kind, 2);
      var youD = kind === 'd' ? 1 : 0, youF = kind === 'f' ? 1 : 0;
      var othersD2 = D2 - youD;
      var flips = othersD2 - othersC1;
      var done = 0;
      setTally(othersC1 + youD, N - othersC1 + youF);
      var since = Date.now();
      scrollTo(boardBox, R ? 'nearest' : 'start');
      tween(1100, function (p) {
        var k = p >= 1 ? flips : Math.floor(flips * p);
        for (; done < k; done++) setCell(othersC1 + done, 'is-c is-swing' + (R ? '' : ' is-pop'));
        setTally(othersC1 + done + youD, N - othersC1 - done + youF);
      }, function () {
        board.setAttribute('aria-label', DATA.boardAria(D2, F2, true));
        setTally(D2, F2);
        bumpStamp(DATA.stamp2);
        result.innerHTML =
          '<p class="w-socrates-recap">' + esc(DATA.round1Recap) + '</p>' +
          '<p class="w-socrates-verdict">' + esc(DATA.verdict2) + '</p>' +
          '<p>' + esc(DATA.combo[v1 + kind]) + '</p>' +
          '<p class="w-socrates-swing"><span class="w-socrates-ring" aria-hidden="true"></span>' + esc(DATA.eighty) + '</p>' +
          '<p class="w-socrates-end">' + esc(DATA.end) + '</p>' +
          '<p class="w-socrates-doubt">' + esc(DATA.doubt) + '</p>' +
          '<div class="btn-row"><button type="button" class="btn btn-ghost btn-small w-socrates-replay">' + esc(DATA.replay) + '</button></div>';
        result.querySelector('.w-socrates-replay').addEventListener('click', reset);
        state = 'done';
        afterStamp(function () { revealVerdict(since); });
      });
    }
    penBtns.forEach(function (b) {
      b.addEventListener('click', function () { votePenalty(b.dataset.v); });
    });

    /* ---------- replay ---------- */
    function reset() {
      run++;
      state = 'vote1';
      v1 = v2 = null;
      root.classList.remove('is-round2');
      ballotBtns.forEach(function (b) { b.disabled = false; b.setAttribute('aria-pressed', 'false'); });
      penBtns.forEach(function (b) { b.disabled = false; b.setAttribute('aria-pressed', 'false'); });
      fallsG.innerHTML = '';
      urnsEl.classList.remove('is-cast');
      castRow.hidden = true;
      countBtn.disabled = false;
      countBtn.textContent = DATA.countBtn;
      cells.forEach(function (c) { c.setAttribute('class', 'w-socrates-h'); });
      board.setAttribute('aria-label', DATA.boardEmpty);
      stampEl.classList.remove('is-on');
      stampEl.textContent = '';
      ymark.className = 'w-socrates-ymark is-empty';
      ymark.innerHTML = '';
      yval.textContent = DATA.yoursEmpty;
      tC.querySelector('.w-socrates-tlab').textContent = DATA.tally1.c;
      tA.querySelector('.w-socrates-tlab').textContent = DATA.tally1.a;
      setTally(0, 0);
      result.innerHTML = '';
      pen.hidden = true;
      ballotBtns[0].focus({ preventScroll: true });
      scrollTo(el, 'start');
    }

    setTally(0, 0);
    ctx.onVisible(function (on) { visible = on; });
  });
})();
