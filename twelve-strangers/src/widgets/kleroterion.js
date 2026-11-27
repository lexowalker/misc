/* Exhibit: "The allotment machine" (Chapter II). A kleroterion after Aristotle, Constitution of the Athenians 63 to 66.
   Seal: 'lot', awarded after the reader's first draw (served or sent home). */
(function () {
  'use strict';

  /* =====================================================================
     COPY AND FACTS. Everything the reader sees is here, so it is easy to correct.
     Main source: [Aristotle], Constitution of the Athenians (Ath. Pol.) 63 to 66, written in the 320s BCE.
     ===================================================================== */
  var DATA = {
    intro: 'Athens, 4th century BCE. Dawn on a court day. You are a citizen over 30, and you swore the jurors\' oath this year. Whether you judge today is up to the machine.',
    ticketLabel: 'Your juror\'s ticket (pinakion)',
    ticketNote: 'Surviving tickets are bronze. Aristotle says that by his day they were boxwood. Each one carried a name, a father\'s name, a deme and a section letter.',
    sections: [['Α', 'Alpha'], ['Β', 'Beta'], ['Γ', 'Gamma'], ['Δ', 'Delta'], ['Ε', 'Epsilon']],
    machineCap: 'One of your tribe\'s two machines. Columns Alpha to Epsilon. Its twin takes Zeta to Kappa.',
    /* Courts were lettered from Lambda, the 11th letter, onward (Ath. Pol. 63.2). */
    courts: [['Λ', 'Lambda'], ['Μ', 'Mu'], ['Ν', 'Nu'], ['Ξ', 'Xi'], ['Ο', 'Omicron']],
    /* Invented citizens with real Athenian name forms and real demes. [English, Greek] */
    names: [['Demochares', 'ΔΗΜΟΧΑΡΗΣ'], ['Lysikles', 'ΛΥΣΙΚΛΗΣ'],
            ['Kallias', 'ΚΑΛΛΙΑΣ'], ['Philon', 'ΦΙΛΩΝ'],
            ['Theodoros', 'ΘΕΟΔΩΡΟΣ'], ['Euthydemos', 'ΕΥΘΥΔΗΜΟΣ'],
            ['Mnesitheos', 'ΜΝΗΣΙΘΕΟΣ'], ['Sostratos', 'ΣΩΣΤΡΑΤΟΣ'],
            ['Diophantos', 'ΔΙΟΦΑΝΤΟΣ'], ['Phanostratos', 'ΦΑΝΟΣΤΡΑΤΟΣ'],
            ['Aristeides', 'ΑΡΙΣΤΕΙΔΗΣ'], ['Nikias', 'ΝΙΚΙΑΣ']],
    fathers: [['Lysimachos', 'ΛΥΣΙΜΑΧΟΥ'], ['Kallikrates', 'ΚΑΛΛΙΚΡΑΤΟΥΣ'],
              ['Philippos', 'ΦΙΛΙΠΠΟΥ'], ['Archippos', 'ΑΡΧΙΠΠΟΥ'],
              ['Nikostratos', 'ΝΙΚΟΣΤΡΑΤΟΥ'], ['Theophilos', 'ΘΕΟΦΙΛΟΥ'],
              ['Eukleides', 'ΕΥΚΛΕΙΔΟΥ'], ['Kephisodoros', 'ΚΗΦΙΣΟΔΩΡΟΥ']],
    demes: [['Acharnai', 'ΑΧΑΡΝΕΥΣ'], ['Kephisia', 'ΚΗΦΙΣΙΕΥΣ'],
            ['Marathon', 'ΜΑΡΑΘΩΝΙΟΣ'], ['Paiania', 'ΠΑΙΑΝΙΕΥΣ'],
            ['Eleusis', 'ΕΛΕΥΣΙΝΙΟΣ'], ['Rhamnous', 'ΡΑΜΝΟΥΣΙΟΣ'],
            ['Thorikos', 'ΘΟΡΙΚΙΟΣ'], ['Melite', 'ΜΕΛΙΤΕΥΣ'],
            ['Sounion', 'ΣΟΥΝΙΕΥΣ'], ['Lamptrai', 'ΛΑΜΠΤΡΕΥΣ']],
    rows: 10,
    btn: { insert: 'Insert your ticket', pour: 'Pour the dice', acorn: 'Draw an acorn', again: 'Try tomorrow', busy: 'The cubes are falling' },
    start: 'Tap the button to hand in your ticket.',
    inserted: function (sec, row) {
      return 'The ticket-inserter, himself picked by lot, slots every ' + sec + ' ticket into column ' + sec + '. Yours lands in row ' + row + '.';
    },
    need: function (white) {
      return 'Today the courts need ' + (white * 5) + ' jurors from this machine. In go ' + white + ' white cubes and ' + (10 - white) + ' black. Each cube decides a whole row.';
    },
    pouring: 'The archon pours the cubes into the bronze tube. They come out one at a time: the first for row 1, the next for row 2.',
    served: function (row) { return 'Row ' + row + ': white. Everyone in row ' + row + ' judges today, and that includes you.'; },
    servedNext: 'Draw an acorn from the urn to learn your court.',
    home: function (row) { return 'Row ' + row + ': black. Row ' + row + ' goes home. No court for you today, and no pay.'; },
    homeNext: 'Nobody knew that until the cube fell. That was the point.',
    court: function (c) { return 'Your acorn says ' + c[0] + ', ' + c[1] + '. You judge in court ' + c[1] + ' today.'; },
    courtWhy: 'Each court got its letter by lot this morning, so nobody knew which court your acorn would send you to.',
    staff: function (c) { return 'At the door of court ' + c[1] + ' you take a staff painted the color over that door. Walk into any other court and the color gives you away. Tonight you collect 3 obols.'; },
    figs: ['acorn', 'staff', 'court door'],
    colorNote: 'Some courts were even named for their colors. Pausanias mentions a Green Court and a Red Court.',
    stats: function (s) { return 'Days at the courts: ' + s.days + ' · Days judging: ' + s.served + ' · Obols earned: ' + s.obols; },
    tiles: [
      ['6,000', 'citizens over 30 swore the jurors\' oath each year'],
      ['501', 'jurors for a typical public case. The biggest got 1,001 or 1,501.'],
      ['3 obols', 'a day in pay, after Cleon raised it around 425 BCE']
    ],
    whyTitle: 'Why go to all this trouble?',
    why: [
      'Nobody knew who would judge until the cubes fell that morning.',
      'Nobody knew which court a juror would sit in until he drew his acorn.',
      'Even the man who slotted the tickets was picked by lot.',
      'Aristotle says the aim was simple: no one could pick the jurors he wanted.'
    ],
    bribe: 'Bribery was a real fear. Aristotle names the first man to bribe an Athenian jury: Anytus, after Athens lost Pylos in 409 BCE. You can bribe a juror. It is much harder to bribe a cube. You will meet Anytus again in the next exhibit.',
    srMachine: 'A stone allotment machine with five columns of ticket slots, lettered Alpha to Epsilon, ten rows deep, with a bronze tube for the dice down its right side.'
  };

  var NS = 'http://www.w3.org/2000/svg';
  var COLS = 5, ROWS = DATA.rows;
  function colX(c) { return 50 + 44 * c; }
  function rowY(r) { return 44 + 28 * r; }
  var MARK_X = 255, TUBE_X = 289, EXIT_Y = 330;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function svgEl(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeIn(t) { return t * t; }

  TS.register('kleroterion', function (el, ctx) {
    /* identity: stable for this reader (their ticket is good all year) */
    var j = parseInt(ctx.juror, 10) || 1234;
    var me = {
      name: DATA.names[j % DATA.names.length],
      father: DATA.fathers[Math.floor(j / 7) % DATA.fathers.length],
      deme: DATA.demes[Math.floor(j / 13) % DATA.demes.length],
      sec: j % COLS
    };
    var secL = DATA.sections[me.sec];

    var stats = ctx.store.get('stats', null) || { days: 0, served: 0, obols: 0 };
    var state = 'ready';
    var myRow = 0, whites = [], run = 0;

    el.innerHTML =
      '<div class="w-kl">' +
        '<p class="w-kl-intro">' + esc(DATA.intro) + '</p>' +
        '<div class="w-kl-grid">' +
          '<div class="w-kl-ticketwrap">' +
            '<p class="label w-kl-tlabel">' + esc(DATA.ticketLabel) + '</p>' +
            '<div class="w-kl-ticket">' +
              '<span class="w-kl-sec" aria-hidden="true">' + secL[0] + '</span>' +
              '<span class="w-kl-greek" aria-hidden="true"><span>' + me.name[1] + '</span><span>' + me.father[1] + '</span><span>' + me.deme[1] + '</span></span>' +
              '<svg class="w-kl-owl" viewBox="0 0 30 30" aria-hidden="true"><circle cx="15" cy="15" r="13"/><path d="M9 21c0-6 2.6-10 6-10s6 4 6 10"/><circle class="e" cx="12.3" cy="14" r="2"/><circle class="e" cx="17.7" cy="14" r="2"/><path d="M9.5 10.5l2.5 1.5M20.5 10.5L18 12"/></svg>' +
              '<span class="w-kl-used" aria-hidden="true">In the machine</span>' +
            '</div>' +
            '<p class="w-kl-eng"><b>' + esc(me.name[0]) + '</b>, son of ' + esc(me.father[0]) + ', of ' + esc(me.deme[0]) + '. Section ' + esc(secL[1]) + '.</p>' +
            '<p class="w-kl-tnote">' + esc(DATA.ticketNote) + '</p>' +
          '</div>' +
          '<div class="w-kl-machine">' +
            '<svg class="w-kl-svg" viewBox="0 0 320 344" role="img" aria-label="' + esc(DATA.srMachine) + '"></svg>' +
            '<p class="w-kl-cap">' + esc(DATA.machineCap) + '</p>' +
          '</div>' +
          '<div class="w-kl-ctrl">' +
            '<button type="button" class="btn w-kl-go">' + esc(DATA.btn.insert) + '</button>' +
            '<div class="w-kl-status" aria-live="polite"><p>' + esc(DATA.start) + '</p></div>' +
            '<div class="w-kl-court" hidden></div>' +
            '<p class="w-kl-stats tnum"></p>' +
          '</div>' +
        '</div>' +
        '<div class="w-kl-tiles">' + DATA.tiles.map(function (t) {
          return '<div class="w-kl-tile"><b>' + esc(t[0]) + '</b><span>' + esc(t[1]) + '</span></div>';
        }).join('') + '</div>' +
        '<div class="w-kl-why"><p class="label">' + esc(DATA.whyTitle) + '</p><ul>' + DATA.why.map(function (w) {
          return '<li>' + esc(w) + '</li>';
        }).join('') + '</ul><p class="w-kl-bribe">' + esc(DATA.bribe) + '</p></div>' +
      '</div>';

    var svg = el.querySelector('.w-kl-svg');
    var goBtn = el.querySelector('.w-kl-go');
    var statusEl = el.querySelector('.w-kl-status');
    var courtEl = el.querySelector('.w-kl-court');
    var statsEl = el.querySelector('.w-kl-stats');
    var ticketEl = el.querySelector('.w-kl-ticket');

    /* ---------- draw the machine ---------- */
    svgEl('rect', { 'class': 'w-kl-slab', x: 6, y: 6, width: 262, height: 332, rx: 5 }, svg);
    svgEl('path', { 'class': 'w-kl-grain', d: 'M14 120c40 6 90-4 140 2s80 4 106-2M14 236c50-5 96 6 150 0s70-6 96 1' }, svg);
    for (var c = 0; c < COLS; c++) {
      var t = svgEl('text', { 'class': 'w-kl-colhead' + (c === me.sec ? ' is-mine' : ''), x: colX(c), y: 31, 'text-anchor': 'middle' }, svg);
      t.textContent = DATA.sections[c][0];
    }
    var rowBg = [], slots = [], marks = [];
    for (var r = 0; r < ROWS; r++) {
      rowBg.push(svgEl('rect', { 'class': 'w-kl-rowbg', x: 11, y: rowY(r) - 4, width: 252, height: 28, rx: 3 }, svg));
      var n = svgEl('text', { 'class': 'w-kl-rownum', x: 21, y: rowY(r) + 14, 'text-anchor': 'middle' }, svg);
      n.textContent = r + 1;
      slots.push([]);
      for (c = 0; c < COLS; c++) {
        var g = svgEl('g', { 'class': 'w-kl-slot' }, svg);
        svgEl('rect', { 'class': 'w-kl-hole', x: colX(c) - 17, y: rowY(r), width: 34, height: 20, rx: 2 }, g);
        var tk = svgEl('g', { 'class': 'w-kl-tk' + (c === me.sec ? ' is-empty' : '') }, g);
        svgEl('rect', { x: colX(c) - 14, y: rowY(r) + 3, width: 28, height: 14, rx: 1.5 }, tk);
        svgEl('path', { d: 'M' + (colX(c) - 10) + ' ' + (rowY(r) + 8) + 'h16M' + (colX(c) - 10) + ' ' + (rowY(r) + 12) + 'h11' }, tk);
        slots[r].push(tk);
      }
      marks.push(svgEl('rect', { 'class': 'w-kl-mark', x: MARK_X - 6, y: rowY(r) + 4, width: 12, height: 12, rx: 1.5 }, svg));
    }
    // tube, funnel, brackets
    [70, 190, 300].forEach(function (y) { svgEl('rect', { 'class': 'w-kl-bracket', x: 266, y: y, width: 16, height: 8, rx: 1 }, svg); });
    svgEl('rect', { 'class': 'w-kl-tube', x: 280, y: 24, width: 18, height: 300, rx: 4 }, svg);
    svgEl('path', { 'class': 'w-kl-tube-hi', d: 'M285 30v288' }, svg);
    svgEl('path', { 'class': 'w-kl-funnel', d: 'M270 4h38l-10 22h-18z' }, svg);
    svgEl('path', { 'class': 'w-kl-tube', d: 'M282 322h14v10h-14z' }, svg);
    var you = svgEl('g', { 'class': 'w-kl-youtag' }, svg);
    var cubeLayer = svgEl('g', { 'class': 'w-kl-cubes' }, svg);

    /* ---------- helpers ---------- */
    function say(lines) {
      statusEl.innerHTML = lines.map(function (l, i) { return '<p' + (i === 0 ? ' class="is-main"' : '') + '>' + esc(l) + '</p>'; }).join('');
    }
    function renderStats() {
      statsEl.textContent = stats.days ? DATA.stats(stats) : '';
    }
    function tween(id, dur, fn, done) {
      if (ctx.reduced || dur <= 0) { fn(1); if (done) done(); return; }
      var t0 = null;
      function step(now) {
        if (id !== run) return;
        if (t0 === null) t0 = now;
        var p = Math.min(1, (now - t0) / dur);
        fn(p);
        if (p < 1) requestAnimationFrame(step); else if (done) done();
      }
      requestAnimationFrame(step);
    }
    function later(id, ms, fn) {
      if (ctx.reduced) { fn(); return; }
      setTimeout(function () { if (id === run) fn(); }, ms);
    }
    function setYouTag(row) {
      while (you.firstChild) you.removeChild(you.firstChild);
      var x = colX(me.sec), y = rowY(row);
      svgEl('rect', { 'class': 'w-kl-youring', x: x - 18.5, y: y - 1.5, width: 37, height: 23, rx: 3 }, you);
    }

    /* ---------- steps ---------- */
    function insert() {
      state = 'busy';
      var id = run;
      myRow = Math.floor(ctx.rand() * ROWS);
      ticketEl.classList.add('is-used');
      goBtn.disabled = true;
      var col = slots.map(function (row) { return row[me.sec]; });
      var i = 0;
      function next() {
        if (i >= ROWS) {
          setYouTag(myRow);
          var w = 4 + Math.floor(ctx.rand() * 3);
          whites = [];
          for (var k = 0; k < ROWS; k++) whites.push(k < w);
          for (k = ROWS - 1; k > 0; k--) { var s = Math.floor(ctx.rand() * (k + 1)); var tmp = whites[k]; whites[k] = whites[s]; whites[s] = tmp; }
          say([DATA.inserted(secL[1], myRow + 1), DATA.need(w)]);
          state = 'inserted';
          goBtn.textContent = DATA.btn.pour;
          goBtn.disabled = false;
          return;
        }
        var tk = col[i];
        tk.classList.remove('is-empty');
        if (i === myRow) tk.classList.add('is-you');
        if (!ctx.reduced) { tk.classList.remove('is-drop'); void tk.getBoundingClientRect(); tk.classList.add('is-drop'); }
        i++;
        if (ctx.reduced) next(); else later(id, 55, next);
      }
      next();
    }

    function pour() {
      state = 'busy';
      var id = run;
      goBtn.disabled = true;
      goBtn.textContent = DATA.btn.busy;
      say([DATA.pouring]);
      if (ctx.reduced) {
        for (var r = 0; r < ROWS; r++) settleRow(r);
        finish();
        return;
      }
      // the cubes go into the funnel
      var falling = whites.map(function (w, k) {
        var cube = svgEl('rect', { 'class': 'w-kl-cube ' + (w ? 'is-white' : 'is-black'), x: TUBE_X - 5.5, y: -14, width: 11, height: 11, rx: 1.5 }, cubeLayer);
        return { el: cube, delay: k * 45 };
      });
      falling.forEach(function (f) {
        later(id, f.delay, function () {
          tween(id, 260, function (p) {
            f.el.setAttribute('y', (-14 + 34 * easeIn(p)).toFixed(1));
            f.el.style.opacity = String(1 - Math.max(0, (p - .7) / .3));
          }, function () { if (f.el.parentNode) f.el.parentNode.removeChild(f.el); });
        });
      });
      later(id, 45 * ROWS + 380, function () { release(0); });

      function release(r) {
        if (r >= ROWS) { finish(); return; }
        var cube = svgEl('rect', { 'class': 'w-kl-cube ' + (whites[r] ? 'is-white' : 'is-black'), x: TUBE_X - 5.5, y: EXIT_Y - 5.5, width: 11, height: 11, rx: 1.5 }, cubeLayer);
        var x0 = TUBE_X, y0 = EXIT_Y, x1 = MARK_X, y1 = rowY(r) + 10;
        tween(id, 230, function (p) {
          var e = easeOut(p);
          cube.setAttribute('x', (x0 + (x1 - x0) * e - 5.5).toFixed(1));
          cube.setAttribute('y', (y0 + (y1 - y0) * e - 5.5).toFixed(1));
        }, function () {
          if (cube.parentNode) cube.parentNode.removeChild(cube);
          settleRow(r);
          later(id, r === myRow ? 520 : 70, function () { release(r + 1); });
        });
      }
    }

    function settleRow(r) {
      marks[r].setAttribute('class', 'w-kl-mark is-set ' + (whites[r] ? 'is-white' : 'is-black'));
      rowBg[r].setAttribute('class', 'w-kl-rowbg ' + (whites[r] ? 'is-white' : 'is-black'));
      slots[r].forEach(function (tk) { tk.classList.add(whites[r] ? 'is-in' : 'is-out'); });
    }

    function finish() {
      var served = whites[myRow];
      stats.days++;
      if (served) { stats.served++; stats.obols += 3; }
      ctx.store.set('stats', stats);
      renderStats();
      you.setAttribute('class', 'w-kl-youtag ' + (served ? 'is-in' : 'is-out'));
      if (served) {
        say([DATA.served(myRow + 1), DATA.servedNext]);
        state = 'served';
        goBtn.textContent = DATA.btn.acorn;
      } else {
        say([DATA.home(myRow + 1), DATA.homeNext]);
        state = 'home';
        goBtn.textContent = DATA.btn.again;
      }
      goBtn.disabled = false;
      ctx.stamp('lot');
    }

    var STAFF_TONES = ['c0', 'c1', 'c2', 'c3', 'c4'];
    function drawAcorn() {
      var ci = Math.floor(ctx.rand() * DATA.courts.length);
      var court = DATA.courts[ci];
      var tone = STAFF_TONES[Math.floor(ctx.rand() * STAFF_TONES.length)];
      courtEl.hidden = false;
      courtEl.className = 'w-kl-court tone-' + tone + (ctx.reduced ? '' : ' is-anim');
      courtEl.innerHTML =
        '<svg class="w-kl-courtsvg" viewBox="0 0 300 138" role="img" aria-label="An acorn marked ' + esc(court[1]) + ', a painted staff, and the door of court ' + esc(court[1]) + ' with the same color over it.">' +
          '<g class="w-kl-acorn">' +
            '<path class="nut" d="M22 52h44c0 26-9 46-22 52-13-6-22-26-22-52z"/>' +
            '<path class="cap" d="M18 54c0-14 11-24 26-24s26 10 26 24z"/>' +
            '<path class="hatch" d="M26 50l10-14M36 52l12-18M48 52l10-14M30 38l18 14M42 34l18 18"/>' +
            '<path class="stem" d="M44 30c0-6 2-10 6-12"/>' +
            '<text x="44" y="86" text-anchor="middle">' + court[0] + '</text>' +
          '</g>' +
          '<g class="w-kl-staff"><rect x="107" y="12" width="8" height="104" rx="4"/><circle cx="111" cy="11" r="7"/><rect class="band" x="107" y="24" width="8" height="4"/><rect class="band" x="107" y="106" width="8" height="4"/></g>' +
          '<g class="w-kl-door">' +
            '<rect class="jamb" x="168" y="22" width="112" height="96" rx="2"/>' +
            '<rect class="opening" x="186" y="44" width="76" height="74"/>' +
            '<rect class="lintel" x="160" y="12" width="128" height="18" rx="2"/>' +
            '<rect class="plate" x="210" y="50" width="28" height="28" rx="2"/>' +
            '<text x="224" y="71" text-anchor="middle">' + court[0] + '</text>' +
          '</g>' +
          '<g class="w-kl-figcap"><text x="44" y="134" text-anchor="middle">' + DATA.figs[0] + '</text><text x="111" y="134" text-anchor="middle">' + DATA.figs[1] + '</text><text x="224" y="134" text-anchor="middle">' + DATA.figs[2] + '</text></g>' +
        '</svg>' +
        '<p>' + esc(DATA.courtWhy) + '</p>' +
        '<p>' + esc(DATA.staff(court)) + '</p>' +
        '<p class="w-kl-note">' + esc(DATA.colorNote) + '</p>';
      say([DATA.court(court)]);
      state = 'acorn';
      goBtn.textContent = DATA.btn.again;
    }

    function tomorrow() {
      run++;
      state = 'ready';
      ticketEl.classList.remove('is-used');
      courtEl.hidden = true;
      courtEl.innerHTML = '';
      while (cubeLayer.firstChild) cubeLayer.removeChild(cubeLayer.firstChild);
      while (you.firstChild) you.removeChild(you.firstChild);
      you.setAttribute('class', 'w-kl-youtag');
      for (var r = 0; r < ROWS; r++) {
        marks[r].setAttribute('class', 'w-kl-mark');
        rowBg[r].setAttribute('class', 'w-kl-rowbg');
        slots[r].forEach(function (tk, c) { tk.setAttribute('class', 'w-kl-tk' + (c === me.sec ? ' is-empty' : '')); });
      }
      goBtn.textContent = DATA.btn.insert;
      goBtn.disabled = false;
      say([DATA.start]);
    }

    goBtn.addEventListener('click', function () {
      if (goBtn.disabled) return;
      if (state === 'ready') insert();
      else if (state === 'inserted') pour();
      else if (state === 'served') drawAcorn();
      else if (state === 'home' || state === 'acorn') tomorrow();
    });

    renderStats();
  });
})();
