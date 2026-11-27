/* scale: "The scales". A brass balance with two pans, a jury of neighbors and a jury of strangers.
   The reader puts each argument on the pan it supports; the beam swings on a damped spring.
   When every argument is placed: "Your ruling" and a "Then and now" panel. Seal: 'scale'. */
(function () {
  'use strict';

  /* =====================================================================
     FACTS AND COPY. Every factual claim in this widget lives here.
     lean: 'n' (usually counted for neighbors), 's' (for strangers) or 'either'.
     note: the one true thing the reader learns after placing the chip.
     ===================================================================== */
  var DATA = {
    pans: {
      n: { name: 'A jury of neighbors', short: 'Neighbors', pan: 'the neighbors’ pan' },
      s: { name: 'A jury of strangers', short: 'Strangers', pan: 'the strangers’ pan' }
    },
    chips: [
      { id: 'know', lean: 'n', text: 'Knows the people and the place.',
        note: 'Medieval sheriffs summoned jurors from the vicinage, the neighborhood of the deed, because they knew the people and the ground.' },
      { id: 'grudge', lean: 's', text: 'No grudges, feuds or favors.',
        note: 'A neighbor brings his history into the box. Today every panel is asked whether anyone knows the parties, the lawyers or the witnesses.' },
      { id: 'conscience', lean: 'either', text: 'Carries the community’s conscience.',
        note: 'Both sides claim this one. In Duncan v. Louisiana (1968) the Supreme Court called a jury of one’s peers \u201Can inestimable safeguard against the corrupt or overzealous prosecutor and against the compliant, biased, or eccentric judge.\u201D Neighbors and strangers can both be that.' },
      { id: 'lord', lean: 's', text: 'Can’t be leaned on by local powers.',
        note: 'Medieval England had a word for bribing or bullying a jury: embracery. Powerful men did it often enough to need one.' },
      { id: 'life', lean: 'n', text: 'Weighs a lifetime of character.',
        note: 'In early English courts, oath-helpers swore that a man’s own oath was clean, so his reputation was the evidence. Neighbors judged the person along with the deed, and that cut both ways for anyone with enemies.' },
      { id: 'evidence', lean: 's', text: 'Judges only the evidence shown in court.',
        note: 'A juror who knows the facts now belongs on the witness stand. Courts tell jurors not to research the case, visit the scene or post about it.' },
      { id: 'fool', lean: 'either', text: 'Harder to fool with a smooth story.',
        note: 'Your call. Neighbors know who lies, but they also believe gossip. Strangers carry no gossip, but they meet every witness for the first time.' },
      { id: 'outsider', lean: 's', text: 'Protects outsiders from local prejudice.',
        note: 'In 1955 an all-white, all-male jury in Sumner, Mississippi, acquitted Emmett Till’s killers in about an hour. Strangers from the same county would not have changed it: no Black residents were on the voter rolls jurors were drawn from.' },
      { id: 'cross', lean: 's', text: 'Fits the modern meaning of peers: a fair cross section.',
        note: 'The idea came before the rule. In 1946 the Supreme Court said the American jury \u201Cnecessarily contemplates an impartial jury drawn from a cross-section of the community\u201D (Thiel v. Southern Pacific Co.). In 1975, Taylor v. Louisiana made it part of the Sixth Amendment.' }
    ],
    contrarian: 'A contrarian ruling, and the court allows it.',
    either: 'This one honestly cuts both ways.',
    rulings: {
      s: 'The law agrees with you, though it took centuries to get there. The modern jury trades local knowledge for independence, and the trade has a price.',
      n: 'A medieval sheriff would agree with you. The law went the other way, and the Sixth Amendment’s promise of an impartial jury is why.',
      close: 'That may be the most honest answer. Each version of the jury fixed one danger and opened another.'
    },
    thenNow: {
      thenTag: 'Then', thenSub: 'the aspiration, about 1300',
      nowTag: 'Now', nowSub: 'the reality, 2026',
      rows: [
        { row: 'Who the jurors are',
          then: 'Free, lawful men of the neighborhood. From 1285, men with land.',
          now: 'Adult citizens of the district, drawn at random. Women and men, owners and renters alike.' },
        { row: 'What they bring',
          then: 'What they already know about the people and the deed.',
          now: 'Common sense and no prior knowledge. Everything else comes from the courtroom.' },
        { row: 'How they are chosen',
          then: 'The sheriff summons men from the vicinage, the neighborhood of the deed.',
          now: 'Random summonses from lists such as voter rolls, then questioning and strikes.' },
        { row: 'What protects the accused',
          then: 'Neighbors who know his good name, and the right to challenge jurors.',
          now: 'An impartial jury from a fair cross section, a unanimous verdict and proof beyond a reasonable doubt.' },
        { row: 'How often a jury decides',
          then: 'After the ordeal ended, a jury decided nearly every felony trial.',
          now: 'In fiscal 2022, about 2 in 100 federal criminal defendants went to trial, some before a judge alone. About 90 in 100 pleaded guilty.' }
      ]
    }
  };

  /* ---- geometry of the balance (SVG user units) ---- */
  var PX = 170, PY = 52, ARM = 116, HANG = 84, MAXDEG = 15, STEP = 3.6;

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function chipById(id) { return DATA.chips.filter(function (c) { return c.id === id; })[0]; }

  function panSVG(side) {
    return '<g class="w-scale-pan is-' + side + '" data-side="' + side + '">' +
        '<path class="w-scale-string" d="M0 0L-42 ' + HANG + 'M0 0L42 ' + HANG + 'M0 0L0 ' + (HANG - 2) + '"/>' +
        '<circle class="w-scale-ring" cx="0" cy="0" r="3.2"/>' +
        '<g class="w-scale-tokens"></g>' +
        '<path class="w-scale-bowl" d="M-50 ' + HANG + 'Q0 ' + (HANG + 30) + ' 50 ' + HANG + 'Z"/>' +
        '<path class="w-scale-rim" d="M-50 ' + HANG + 'H50"/>' +
        '<rect class="w-scale-hit" x="-56" y="' + (HANG - 40) + '" width="112" height="76" rx="6"/>' +
      '</g>';
  }

  function scaleSVG() {
    var ticks = '';
    for (var a = -30; a <= 30; a += 10) {
      var r1 = 36, r2 = a === 0 ? 44 : 41, rad = (a - 90) * Math.PI / 180;
      ticks += 'M' + (PX + r1 * Math.cos(rad)).toFixed(1) + ' ' + (PY + r1 * Math.sin(rad)).toFixed(1) +
        'L' + (PX + r2 * Math.cos(rad)).toFixed(1) + ' ' + (PY + r2 * Math.sin(rad)).toFixed(1);
    }
    var arcR = 38, a0 = (-34 - 90) * Math.PI / 180, a1 = (34 - 90) * Math.PI / 180;
    var arc = 'M' + (PX + arcR * Math.cos(a0)).toFixed(1) + ' ' + (PY + arcR * Math.sin(a0)).toFixed(1) +
      'A' + arcR + ' ' + arcR + ' 0 0 1 ' + (PX + arcR * Math.cos(a1)).toFixed(1) + ' ' + (PY + arcR * Math.sin(a1)).toFixed(1);
    return '<svg class="w-scale-svg" viewBox="0 0 340 236" role="img" focusable="false">' +
        '<path class="w-scale-dial" d="' + arc + '"/>' +
        '<path class="w-scale-tick" d="' + ticks + '"/>' +
        /* plinth and column */
        '<path class="w-scale-base" d="M112 230h116l-8-12H120z"/>' +
        '<path class="w-scale-base2" d="M128 218h84l-6-8h-72z"/>' +
        '<rect class="w-scale-post" x="165" y="' + PY + '" width="10" height="' + (210 - PY) + '" rx="2"/>' +
        '<rect class="w-scale-collar" x="160" y="196" width="20" height="6" rx="2"/>' +
        '<rect class="w-scale-collar" x="161" y="' + (PY + 10) + '" width="18" height="5" rx="2"/>' +
        /* the beam (rotated from JS) */
        '<g class="w-scale-beam">' +
          '<path class="w-scale-needle" d="M' + PX + ' ' + PY + 'L' + (PX - 2.6) + ' ' + (PY - 30) + 'L' + PX + ' ' + (PY - 40) + 'L' + (PX + 2.6) + ' ' + (PY - 30) + 'Z"/>' +
          '<path class="w-scale-bar" d="M' + (PX - ARM) + ' ' + (PY - 2.5) + 'Q' + PX + ' ' + (PY - 9) + ' ' + (PX + ARM) + ' ' + (PY - 2.5) +
            'V' + (PY + 2.5) + 'Q' + PX + ' ' + (PY + 6) + ' ' + (PX - ARM) + ' ' + (PY + 2.5) + 'Z"/>' +
          '<circle class="w-scale-cap" cx="' + (PX - ARM) + '" cy="' + PY + '" r="5"/>' +
          '<circle class="w-scale-cap" cx="' + (PX + ARM) + '" cy="' + PY + '" r="5"/>' +
          '<circle class="w-scale-pivot" cx="' + PX + '" cy="' + PY + '" r="7"/>' +
          '<circle class="w-scale-pivot-dot" cx="' + PX + '" cy="' + PY + '" r="2.4"/>' +
        '</g>' +
        panSVG('n') + panSVG('s') +
      '</svg>';
  }

  function weightIcon() {
    return '<svg class="w-scale-weight" viewBox="0 0 40 40" aria-hidden="true" focusable="false">' +
      '<circle class="w-scale-weight-ring" cx="20" cy="9" r="5"/>' +
      '<path class="w-scale-weight-body" d="M11 14h18l6 21H5z"/>' +
      '<path class="w-scale-weight-line" d="M12 26h16"/></svg>';
  }

  TS.register('scale', function (el, ctx) {
    var total = DATA.chips.length;
    var FIRST = DATA.chips.map(function (c) { return c.id; });
    var state = { order: FIRST.slice(), placed: [], done: false, sealed: false };
    var busy = false;

    el.innerHTML =
      '<div class="w-scale">' +
        '<div class="w-scale-deck"></div>' +
        '<div class="w-scale-stage">' + scaleSVG() + '</div>' +
        '<div class="w-scale-pans">' +
          ['n', 's'].map(function (side) {
            return '<button type="button" class="w-scale-panbtn is-' + side + '" data-side="' + side + '">' +
              '<span class="w-scale-panname">' + esc(DATA.pans[side].name) + '</span>' +
              '<span class="w-scale-pancount"><b class="tnum">0</b> <span>arguments</span></span>' +
              '<span class="w-scale-panhint" aria-hidden="true">Place here</span>' +
            '</button>';
          }).join('') +
        '</div>' +
        '<div class="w-scale-note" aria-live="polite"></div>' +
        '<div class="w-scale-ruling" hidden></div>' +
      '</div>';

    var root = el.querySelector('.w-scale');
    var deck = el.querySelector('.w-scale-deck');
    var svg = el.querySelector('.w-scale-svg');
    var beam = el.querySelector('.w-scale-beam');
    var pans = { n: el.querySelector('.w-scale-pan.is-n'), s: el.querySelector('.w-scale-pan.is-s') };
    var tokens = { n: pans.n.querySelector('.w-scale-tokens'), s: pans.s.querySelector('.w-scale-tokens') };
    var panBtns = { n: el.querySelector('.w-scale-panbtn.is-n'), s: el.querySelector('.w-scale-panbtn.is-s') };
    var note = el.querySelector('.w-scale-note');
    var ruling = el.querySelector('.w-scale-ruling');

    /* ---------- spring physics for the beam ---------- */
    var phys = { a: 0, v: 0, target: 0 };
    var raf = 0, lastT = 0, visible = true;

    function counts() {
      var c = { n: 0, s: 0 };
      state.placed.forEach(function (p) { c[p.side]++; });
      return c;
    }
    function targetAngle() {
      var c = counts();
      return Math.max(-MAXDEG, Math.min(MAXDEG, (c.s - c.n) * STEP));
    }
    function draw() {
      var a = phys.a;
      beam.setAttribute('transform', 'rotate(' + a.toFixed(3) + ' ' + PX + ' ' + PY + ')');
      var rad = a * Math.PI / 180, dx = ARM * Math.cos(rad), dy = ARM * Math.sin(rad);
      pans.n.setAttribute('transform', 'translate(' + (PX - dx).toFixed(2) + ' ' + (PY - dy).toFixed(2) + ')');
      pans.s.setAttribute('transform', 'translate(' + (PX + dx).toFixed(2) + ' ' + (PY + dy).toFixed(2) + ')');
    }
    function tick(t) {
      raf = 0;
      var dt = Math.min(0.032, (t - (lastT || t)) / 1000 || 0.016);
      lastT = t;
      var k = 95, c = 6.5;
      /* two half steps for stability */
      for (var i = 0; i < 2; i++) {
        var h = dt / 2;
        var acc = -k * (phys.a - phys.target) - c * phys.v;
        phys.v += acc * h;
        phys.a += phys.v * h;
      }
      draw();
      if (Math.abs(phys.a - phys.target) < 0.02 && Math.abs(phys.v) < 0.05) {
        phys.a = phys.target; phys.v = 0; draw(); lastT = 0; return;
      }
      if (!visible) { phys.a = phys.target; phys.v = 0; draw(); lastT = 0; return; }
      raf = requestAnimationFrame(tick);
    }
    function settle(kick) {
      phys.target = targetAngle();
      if (ctx.reduced || !window.requestAnimationFrame) { phys.a = phys.target; phys.v = 0; draw(); return; }
      if (kick) phys.v += kick;
      if (!raf) { lastT = 0; raf = requestAnimationFrame(tick); }
    }
    ctx.onVisible(function (on) {
      visible = on;
      if (on && (phys.a !== phys.target || phys.v)) settle(0);
    });

    /* ---------- tokens in the pans ---------- */
    function renderTokens() {
      ['n', 's'].forEach(function (side) {
        var list = state.placed.filter(function (p) { return p.side === side; });
        var html = '';
        list.forEach(function (p, i) {
          var col = [0, -24, 24][i % 3], lvl = Math.floor(i / 3);
          var y = HANG - 8 - lvl * 8.5;
          html += '<rect class="w-scale-token" x="' + (col - 11) + '" y="' + y + '" width="22" height="7" rx="2"/>' +
            '<path class="w-scale-token-line" d="M' + (col - 6) + ' ' + (y + 3.5) + 'h12"/>';
        });
        tokens[side].innerHTML = html;
        var b = panBtns[side].querySelector('.w-scale-pancount');
        b.querySelector('b').textContent = list.length;
        b.querySelector('span').textContent = list.length === 1 ? 'argument' : 'arguments';
      });
      var c = counts();
      var tilt = c.s > c.n ? 'The beam tips toward the strangers.' : c.n > c.s ? 'The beam tips toward the neighbors.' : 'The beam is level.';
      svg.setAttribute('aria-label', 'A brass balance. The neighbors’ pan holds ' + c.n + ', the strangers’ pan holds ' + c.s + '. ' + tilt);
    }

    /* ---------- the deck ---------- */
    function pending() { return state.order[state.placed.length]; }

    function renderDeck(animateIn) {
      var id = pending();
      root.classList.toggle('is-waiting', !!id && !state.done);
      if (!id) { deck.innerHTML = ''; deck.hidden = true; return; }
      deck.hidden = false;
      var c = chipById(id), left = total - state.placed.length;
      deck.innerHTML =
        '<div class="w-scale-stack" data-left="' + Math.min(left, 4) + '">' +
          '<div class="w-scale-chip" tabindex="-1">' + weightIcon() +
            '<div class="w-scale-chip-body">' +
              '<span class="w-scale-chip-num label">Argument <b class="tnum">' + (state.placed.length + 1) + '</b> of ' + total + '</span>' +
              '<p class="w-scale-chip-text">' + esc(c.text) + '</p>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="w-scale-deckbar">' +
          '<span class="w-scale-ask typed">Which pan does it weigh for?</span>' +
          (state.placed.length ? '<button type="button" class="btn btn-ghost btn-small w-scale-undo">Take back</button>' : '') +
        '</div>';
      var undo = deck.querySelector('.w-scale-undo');
      if (undo) undo.addEventListener('click', takeBack);
      panBtns.n.disabled = panBtns.s.disabled = false;
      panBtns.n.setAttribute('aria-label', 'Place “' + c.text + '” on ' + DATA.pans.n.pan);
      panBtns.s.setAttribute('aria-label', 'Place “' + c.text + '” on ' + DATA.pans.s.pan);
      if (animateIn && !ctx.reduced) {
        var chip = deck.querySelector('.w-scale-chip');
        if (chip.animate) chip.animate([{ opacity: 0, transform: 'translateY(8px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.2,.8,.3,1)' });
      }
    }

    function noteFor(chip, side) {
      var lead = chip.lean === 'either' ? DATA.either + ' ' : chip.lean !== side ? DATA.contrarian + ' ' : '';
      return '<p><b>' + esc(DATA.pans[side].short) + '.</b> ' + esc(lead) + esc(chip.note) + '</p>';
    }

    function panPoint(side) {
      /* the screen position of the middle of a pan, relative to the widget */
      var m = svg.getScreenCTM();
      var r = root.getBoundingClientRect();
      if (!m || !svg.createSVGPoint) return null;
      var rad = phys.a * Math.PI / 180, sign = side === 's' ? 1 : -1;
      var p = svg.createSVGPoint();
      p.x = PX + sign * ARM * Math.cos(rad);
      p.y = PY + sign * ARM * Math.sin(rad) + HANG - 4;
      var q = p.matrixTransform(m);
      return { x: q.x - r.left, y: q.y - r.top };
    }

    function place(side) {
      if (busy || state.done) return;
      var id = pending();
      if (!id) return;
      var chip = chipById(id);
      busy = true;
      var chipEl = deck.querySelector('.w-scale-chip');
      var finish = function () {
        state.placed.push({ id: id, side: side });
        renderTokens();
        settle(side === 's' ? 55 : -55);
        note.innerHTML = noteFor(chip, side);
        if (!ctx.reduced) {
          var pb = panBtns[side];
          pb.classList.remove('is-thud'); void pb.offsetWidth; pb.classList.add('is-thud');
        }
        busy = false;
        if (state.placed.length === total) complete();
        else {
          renderDeck(true);
          var nextChip = deck.querySelector('.w-scale-chip');
          if (document.activeElement && document.activeElement.classList.contains('w-scale-undo')) {
            try { nextChip.focus({ preventScroll: true }); } catch (e) {}
          }
        }
      };
      var to = panPoint(side);
      if (ctx.reduced || !chipEl || !chipEl.animate || !to) { finish(); return; }
      var r = root.getBoundingClientRect(), cr = chipEl.getBoundingClientRect();
      var fly = document.createElement('div');
      fly.className = 'w-scale-fly';
      fly.setAttribute('aria-hidden', 'true');
      fly.textContent = chip.text;
      fly.style.left = (cr.left - r.left) + 'px';
      fly.style.top = (cr.top - r.top) + 'px';
      fly.style.width = cr.width + 'px';
      fly.style.height = cr.height + 'px';
      root.appendChild(fly);
      chipEl.style.visibility = 'hidden';
      var dx = to.x - (cr.left - r.left + cr.width / 2), dy = to.y - (cr.top - r.top + cr.height / 2);
      var anim = fly.animate([
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: 'translate(' + (dx * 0.35) + 'px,' + (dy * 0.2 - 18) + 'px) scale(.62)', opacity: 1, offset: 0.4 },
        { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.12)', opacity: 0.2 }
      ], { duration: 460, easing: 'cubic-bezier(.45,0,.75,.5)' });
      anim.onfinish = function () { if (fly.parentNode) fly.parentNode.removeChild(fly); finish(); };
    }

    function takeBack() {
      if (busy || !state.placed.length) return;
      var last = state.placed.pop();
      state.done = false;
      ruling.hidden = true;
      ruling.innerHTML = '';
      renderTokens();
      settle(last.side === 's' ? -30 : 30);
      note.innerHTML = '<p>Taken back. The argument is on top of the deck again.</p>';
      renderDeck(true);
      var chipEl = deck.querySelector('.w-scale-chip');
      try { chipEl.focus({ preventScroll: true }); } catch (e) {}
    }

    /* ---------- the ruling ---------- */
    function verdictKey() {
      var c = counts();
      if (Math.abs(c.s - c.n) <= 1) return 'close';
      return c.s > c.n ? 's' : 'n';
    }

    function listFor(side) {
      var items = state.placed.filter(function (p) { return p.side === side; });
      if (!items.length) return '<li class="is-empty">Nothing. The pan is empty.</li>';
      return items.map(function (p) {
        var c = chipById(p.id), other = side === 'n' ? 's' : 'n';
        return '<li><span>' + esc(c.text) + '</span>' +
          '<button type="button" class="w-scale-move" data-id="' + p.id + '" aria-label="Move “' + esc(c.text) + '” to ' + esc(DATA.pans[other].pan) + '">' +
          (side === 'n' ? 'To strangers' : 'To neighbors') + '</button></li>';
      }).join('');
    }

    function renderRuling(fresh) {
      var c = counts(), key = verdictKey(), tn = DATA.thenNow;
      var tally = c.s >= c.n ? 'Strangers ' + c.s + ', neighbors ' + c.n : 'Neighbors ' + c.n + ', strangers ' + c.s;
      ruling.innerHTML =
        '<div class="w-scale-rhead">' +
          '<h4 class="w-scale-rtitle" tabindex="-1">Your ruling</h4>' +
          '<span class="w-scale-rstamp is-' + key + '">' + (key === 'close' ? 'Close call' : key === 's' ? 'For the strangers' : 'For the neighbors') + '</span>' +
        '</div>' +
        '<p class="w-scale-tally typed tnum">' + tally + '</p>' +
        '<p class="w-scale-verdict">' + esc(DATA.rulings[key]) + '</p>' +
        '<div class="w-scale-split">' +
          '<div class="w-scale-side is-n"><h5>' + esc(DATA.pans.n.name) + '</h5><ul>' + listFor('n') + '</ul></div>' +
          '<div class="w-scale-side is-s"><h5>' + esc(DATA.pans.s.name) + '</h5><ul>' + listFor('s') + '</ul></div>' +
        '</div>' +
        '<div class="w-scale-tn">' +
          '<div class="w-scale-tnhead"><h4>Then and now</h4>' +
            '<p class="w-scale-tnkey"><span><span class="w-scale-tag is-then">' + tn.thenTag + '</span> ' + esc(tn.thenSub) + '</span>' +
            '<span><span class="w-scale-tag is-now">' + tn.nowTag + '</span> ' + esc(tn.nowSub) + '</span></p></div>' +
          tn.rows.map(function (r) {
            return '<div class="w-scale-tnrow"><h5 class="label">' + esc(r.row) + '</h5>' +
              '<div class="w-scale-tnpair">' +
                '<p class="w-scale-then"><span class="w-scale-tag is-then">' + tn.thenTag + '</span> ' + esc(r.then) + '</p>' +
                '<p class="w-scale-now"><span class="w-scale-tag is-now">' + tn.nowTag + '</span> ' + esc(r.now) + '</p>' +
              '</div></div>';
          }).join('') +
        '</div>' +
        '<div class="btn-row"><button type="button" class="btn btn-ghost w-scale-again">Weigh again</button></div>';
      ruling.hidden = false;
      ruling.querySelector('.w-scale-again').addEventListener('click', reset);
      if (fresh && !ctx.reduced) {
        ruling.classList.remove('is-fresh'); void ruling.offsetWidth; ruling.classList.add('is-fresh');
      }
    }

    function complete() {
      state.done = true;
      root.classList.remove('is-waiting');
      panBtns.n.disabled = panBtns.s.disabled = true;
      panBtns.n.removeAttribute('aria-label');
      panBtns.s.removeAttribute('aria-label');
      renderDeck(false);
      renderRuling(true);
      var key = verdictKey(), c = counts();
      note.insertAdjacentHTML('beforeend', '<p class="sr-only">All arguments placed. ' + (key === 'close' ? 'A close call. ' : key === 's' ? 'For the strangers. ' : 'For the neighbors. ') + esc(DATA.rulings[key]) + ' Neighbors ' + c.n + ', strangers ' + c.s + '.</p>');
      var t = ruling.querySelector('.w-scale-rtitle');
      try { t.focus({ preventScroll: true }); } catch (e) {}
      if (!ctx.reduced && t.scrollIntoView) {
        setTimeout(function () {
          var rr = ruling.getBoundingClientRect();
          if (rr.top > window.innerHeight * 0.75) window.scrollBy({ top: Math.min(rr.top - window.innerHeight * 0.35, 320), behavior: 'smooth' });
        }, 380);
      }
      ctx.store.set('last', counts());
      if (!state.sealed) { state.sealed = true; ctx.stamp('scale'); }
    }

    ruling.addEventListener('click', function (e) {
      var b = e.target.closest('.w-scale-move');
      if (!b) return;
      var id = b.getAttribute('data-id');
      var p = state.placed.filter(function (x) { return x.id === id; })[0];
      if (!p) return;
      p.side = p.side === 'n' ? 's' : 'n';
      renderTokens();
      settle(p.side === 's' ? 45 : -45);
      renderRuling(false);
      note.innerHTML = noteFor(chipById(id), p.side);
      var again = ruling.querySelector('.w-scale-move[data-id="' + id + '"]');
      if (again) { try { again.focus({ preventScroll: true }); } catch (err) {} }
    });

    function reset() {
      var pool = FIRST.slice();
      for (var k = pool.length - 1; k > 0; k--) {
        var j = Math.floor(ctx.rand() * (k + 1));
        var tmp = pool[k]; pool[k] = pool[j]; pool[j] = tmp;
      }
      state.order = pool;
      state.placed = [];
      state.done = false;
      ruling.hidden = true;
      ruling.innerHTML = '';
      note.innerHTML = '<p>The pans are empty. A fresh deck, shuffled.</p>';
      renderTokens();
      settle(0);
      renderDeck(true);
      var chipEl = deck.querySelector('.w-scale-chip');
      try { chipEl.focus({ preventScroll: false }); } catch (e) {}
    }

    /* ---------- input ---------- */
    panBtns.n.addEventListener('click', function () { place('n'); });
    panBtns.s.addEventListener('click', function () { place('s'); });
    pans.n.addEventListener('click', function () { place('n'); });
    pans.s.addEventListener('click', function () { place('s'); });
    deck.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); place('n'); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); place('s'); }
    });

    /* ---------- first render ---------- */
    draw();
    renderTokens();
    renderDeck(false);
    note.innerHTML = '<p class="w-scale-start">Read the argument, then tap the pan it supports. Some arguments honestly cut both ways. Your call.</p>';
  });
})();
