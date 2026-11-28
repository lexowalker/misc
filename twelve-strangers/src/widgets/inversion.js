/* inversion: "Would you be seated?" Sort ten would-be jurors into 1300, 2026, both or neither.
   Four buttons sort each card (swipe left for 1300, right for 2026 as a bonus). The card flips to show
   the ruling for each era. Seal: 'inversion', awarded when the tenth card is ruled on. */
(function () {
  'use strict';

  /* =====================================================================
     FACTS AND COPY. Every factual claim in this widget lives here.
     then / now: seat is true (SEATED), false (EXCUSED) or 'maybe' (MAYBE).
     The correct answer is derived from the two seats. `accept` lists other
     answers that earn the point because they are defensible.
     ===================================================================== */
  var DATA = {
    then: '1300',
    now: '2026',
    cards: [
      {
        id: 'fence', icon: 'fence', short: 'a neighbor of twenty years',
        quote: 'I’ve known the accused for twenty years. We share a fence.',
        then: { seat: true, why: 'Ideal. The sheriff summoned jurors from the neighborhood of the deed because they knew the people. Your fence was your qualification.' },
        now: { seat: false, why: 'Expect to be struck for cause. Every panel is asked whether anyone knows the parties, and a close neighbor is a textbook challenge.' }
      },
      {
        id: 'stranger', icon: 'blank', short: 'a stranger who knows nothing',
        quote: 'I’ve never met the accused, and I know nothing about the case.',
        then: { seat: false, why: 'Useless. A juror who knew nothing could tell the court nothing. Jurors came from the neighborhood for a reason.' },
        now: { seat: true, why: 'The modern ideal. Jury selection exists to find people exactly like you.' }
      },
      {
        id: 'woman', icon: 'woman', short: 'a woman',
        quote: 'I’m a woman.',
        then: { seat: false, why: 'Barred from ordinary juries, which were made of men. The one exception was the jury of matrons, called to examine a woman who said she was pregnant.' },
        now: { seat: true, why: 'Seated on the same terms as men. Taylor v. Louisiana (1975) struck down a system that called women only if they asked to serve. J.E.B. v. Alabama (1994) barred striking jurors because of sex.' }
      },
      {
        id: 'read', icon: 'book', short: 'one who cannot read',
        quote: 'I can’t read.',
        then: { seat: true, why: 'No problem. Few jurors could read. They spoke their verdict aloud, and a clerk wrote it down in Latin.' },
        now: { seat: false, why: 'Disqualified in federal court. Jurors must read, write and understand English well enough to fill out the qualification form (28 U.S.C. 1865).' }
      },
      {
        id: 'knight', icon: 'shield', short: 'a knight with a manor',
        quote: 'I’m a knight, with a manor in the next valley.',
        then: { seat: true, why: 'Just the man the court wanted: free, landed and local. Under the Grand Assize, panels of knights decided disputes over land.' },
        now: { seat: true, why: 'Seated, as long as you are a citizen and do not know the parties. Rank counts for nothing in an American jury box.' }
      },
      {
        id: 'gossip', icon: 'talk', short: 'one who heard the talk of the town',
        quote: 'I’ve already heard all about this case around town.',
        accept: ['both'],
        acceptNote: 'Both is defensible, since you might survive questioning today. 1300 is the safer answer.',
        then: { seat: true, why: 'Expected. Jurors were supposed to arrive knowing the local story. Historians call these juries self-informing.' },
        now: { seat: 'maybe', why: 'Only if you can set it aside. In Irvin v. Dowd (1961) the Supreme Court said jurors need not be ignorant of a case, as long as they can decide on the evidence alone. In a famous case, lawyers often strike you anyway.' }
      },
      {
        id: 'land', icon: 'field', short: 'a juror with no land',
        quote: 'I don’t own any land.',
        then: { seat: false, why: 'Not qualified. Jurors were meant to be free and lawful men, and a statute of 1285 kept men with less than 20 shillings a year in land off most juries. A statute of 1293 raised the bar to 40 shillings.' },
        now: { seat: true, why: 'No property needed. Federal law forbids excluding anyone from a jury because of economic status (28 U.S.C. 1862).' }
      },
      {
        id: 'merchant', icon: 'ship', short: 'a foreign merchant',
        quote: 'I’m a foreign merchant, and so is the accused.',
        then: { seat: true, why: 'Seated on a mixed jury. Medieval England let a foreign merchant be tried by a jury de medietate linguae, half of them foreigners. The custom was older than its paperwork: a royal charter of 1303 and a statute of 1353 put it in writing.' },
        now: { seat: false, why: 'Not eligible. American jurors must be United States citizens.' }
      },
      {
        id: 'inquire', icon: 'lens', short: 'one who asks around',
        quote: 'I’ll go and ask around before the trial, to get the facts straight.',
        then: { seat: true, why: 'Diligent. In the 1200s jurors were expected to look into the matter before they came to court, and to answer from what they found. Historians debate how long that lasted.' },
        now: { seat: false, why: 'Forbidden. Judges order jurors not to investigate, visit the scene or search online. A juror who does can be held in contempt. In England, jurors have gone to prison for it, and since 2015 it has been a crime there.' }
      },
      {
        id: 'nullify', icon: 'scroll', short: 'one who will ignore the law',
        quote: 'I think this law is wrong, and I won’t convict, whatever the evidence.',
        then: { seat: false, why: 'Officially, no. Jurors swore an oath to tell the truth about the case, and a vow to ignore the law was no qualification.' },
        now: { seat: false, why: 'Struck for cause. Jurors swear to follow the law as the judge explains it, and saying this during jury selection gets you sent home.' },
        note: {
          label: 'Off the record',
          text: 'Juries have acquitted against the law anyway, for centuries. Medieval juries often called a killing self-defense, which brought a royal pardon instead of the gallows. In 1670 a London jury refused to convict the Quakers William Penn and William Mead, and Bushel’s Case then held that jurors cannot be punished for their verdict. Today this is called jury nullification. Juries have the power, but courts generally refuse to tell them so.'
        }
      }
    ],
    answers: [
      { key: 'then', label: '1300', sub: 'seated then only', said: '1300' },
      { key: 'now', label: '2026', sub: 'seated now only', said: '2026' },
      { key: 'both', label: 'Both', sub: 'seated either way', said: 'both' },
      { key: 'neither', label: 'Neither', sub: 'sent home both times', said: 'neither' }
    ],
    outcome: {
      then: 'Seated in 1300 only.',
      now: 'Seated in 2026 only.',
      both: 'Seated in both.',
      neither: 'Seated in neither.'
    },
    ranks: [
      { min: 10, title: 'Clerk of the Assize', line: 'A perfect sort. You could run jury selection in either century.' },
      { min: 8, title: 'Learned Counsel', line: 'You see the inversion clearly. The court is impressed.' },
      { min: 5, title: 'Duly Sworn', line: 'A solid showing, with a few surprises. The surprises are the point.' },
      { min: 0, title: 'Excused With Thanks', line: 'The past fooled you, as it fools most of us. The deck is ready for another round.' }
    ],
    summary: 'The two eras agree on only two of these ten. The knight gets a seat in both. The juror who vows to ignore the law gets one in neither, at least officially. On the other eight, what made a juror ideal in 1300 tends to get you sent home in 2026, and the reverse.'
  };

  /* Small line drawings for each would-be juror (48 x 48, stroked in currentColor). */
  var ICONS = {
    fence: '<path d="M8 40V15l4-5 4 5v25M22 40V15l4-5 4 5v25M36 40V15l4-5 4 5v25"/><path d="M4 22h42M4 33h42"/><path d="M2 42h44" class="w-inversion-ground"/>',
    blank: '<circle cx="24" cy="16" r="8" stroke-dasharray="3 3"/><path d="M9 42c1.5-9 7.5-14 15-14s13.5 5 15 14" stroke-dasharray="3 3"/><path d="M21.5 14.5c0-1.6 1.1-2.6 2.6-2.6 1.6 0 2.6 1 2.6 2.4 0 2.1-2.6 2.2-2.6 4.2"/><circle cx="24.1" cy="21.6" r=".6" class="w-inversion-dot"/>',
    woman: '<circle cx="24" cy="11" r="6"/><path d="M17.5 9.5c1-6 12-6 13 0M18 13c-.5 4 .5 6 2 7M30 13c.5 4-.5 6-2 7"/><path d="M19 22h10l6 20H13z"/><path d="M19 22l-6 9M29 22l6 9"/>',
    book: '<path d="M24 14c-5-3-11-3.5-17-2v26c6-1.5 12-1 17 2 5-3 11-3.5 17-2V12c-6-1.5-12-1-17 2z"/><path d="M24 14v26"/><path d="M11 19h8M11 24h8M29 19h8M29 24h8M11 29h6"/><path d="M33 29l6 6M39 29l-6 6" class="w-inversion-strike"/>',
    shield: '<path d="M24 5l15 5v12c0 10-6.5 17-15 21-8.5-4-15-11-15-21V10z"/><path d="M11 27l13-9 13 9"/><path d="M11 33l13-9 13 9"/>',
    talk: '<path d="M5 9h22v13H14l-5 5v-5H5z"/><path d="M31 17h12v13h-4v5l-5-5h-9v-4"/><path d="M10 14h12M10 18h8"/>',
    field: '<path d="M3 34l9-14h33l-9 14z"/><path d="M8 34l7-14M14 34l6-14M20 34l6-14M26 34l6-14M32 34l6-14"/><path d="M6 43L42 9" class="w-inversion-strike"/>',
    ship: '<path d="M6 30h36l-5 9H11z"/><path d="M24 30V6"/><path d="M24 8c7 2 11 6 12 14H24"/><path d="M24 11c-5 2-8 5-9 11h9"/><path d="M3 43c4-2 6-2 10 0s6 2 10 0 6-2 10 0 6 2 10 0" class="w-inversion-ground"/>',
    lens: '<circle cx="20" cy="20" r="11"/><path d="M28 28l13 13" stroke-width="4"/><path d="M14 17c1-3 3-4.5 6-5"/>',
    scroll: '<path d="M12 8h24v30a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4v-3h22v3a4 4 0 0 0 4 4"/><path d="M12 8a3 3 0 0 0-3 3v24"/><path d="M16 15h14M16 20h14M16 25h10"/><path d="M27 27l14 14M41 27L27 41" class="w-inversion-strike"/>'
  };

  var FIRST_ORDER = ['fence', 'stranger', 'woman', 'read', 'knight', 'gossip', 'land', 'merchant', 'inquire', 'nullify'];

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function answerOf(card) {
    var t = card.then.seat === true, n = card.now.seat === true;
    if (t && n) return 'both';
    if (t) return 'then';
    if (n) return 'now';
    return 'neither';
  }
  function byId(id) { return DATA.cards.filter(function (c) { return c.id === id; })[0]; }
  function answerMeta(key) { return DATA.answers.filter(function (a) { return a.key === key; })[0]; }
  function stampText(seat) { return seat === true ? 'Seated' : seat === 'maybe' ? 'Maybe' : 'Excused'; }
  function stampClass(seat) { return seat === true ? 'is-seated' : seat === 'maybe' ? 'is-maybe' : 'is-excused'; }

  TS.register('inversion', function (el, ctx) {
    var total = DATA.cards.length;
    var state = { order: FIRST_ORDER.slice(), i: 0, score: 0, marks: [], phase: 'ask', round: 0 };
    var busy = false;
    var drag = null;

    el.innerHTML =
      '<div class="w-inversion">' +
        '<div class="w-inversion-head">' +
          '<span class="w-inversion-count label">Juror <b class="tnum"></b> of ' + total + '</span>' +
          '<span class="w-inversion-tally" aria-hidden="true"></span>' +
          '<span class="w-inversion-score label">Score <b class="tnum">0</b></span>' +
        '</div>' +
        '<div class="w-inversion-stage">' +
          '<div class="w-inversion-card" tabindex="-1"></div>' +
        '</div>' +
        '<div class="w-inversion-controls"></div>' +
        '<p class="sr-only" aria-live="polite"></p>' +
      '</div>';

    var countEl = el.querySelector('.w-inversion-count b');
    var tallyEl = el.querySelector('.w-inversion-tally');
    var scoreEl = el.querySelector('.w-inversion-score b');
    var stage = el.querySelector('.w-inversion-stage');
    var card = el.querySelector('.w-inversion-card');
    var controls = el.querySelector('.w-inversion-controls');
    var live = el.querySelector('[aria-live]');
    var root = el.querySelector('.w-inversion');

    /* ---------- keeping the reader's place ----------
       The sticky ticker covers the top of the screen. The page's scroll-padding-top clears it, and everything we
       scroll to adds a small scroll-margin-top in inversion.css. gapOf() adds the two, which is where scrollIntoView
       would park the element; we move the page with window.scrollTo so we can decide whether to move it at all.
       We only scroll right after the reader's own tap or key, and never once they have scrolled since. */
    var acted = 0, moved = 0;
    function act() { acted = Date.now(); }
    window.addEventListener('touchmove', function () { moved = Date.now(); }, { passive: true });
    window.addEventListener('wheel', function () { moved = Date.now(); }, { passive: true });
    el.addEventListener('click', act, true);
    el.addEventListener('keydown', act, true);
    function gapOf(node) {
      var pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop);
      if (!(pad > 0)) pad = 64;
      return pad + (parseFloat(getComputedStyle(node).scrollMarginTop) || 0);
    }
    /* If `need` is hidden under the ticker (or, unless topOnly, runs off the bottom of the screen),
       put `anchor` (default: need) just under the ticker. */
    function show(need, anchor, topOnly) {
      if (!need || !need.isConnected || moved > acted) return;
      anchor = anchor || need;
      var gap = gapOf(anchor);
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var r = need.getBoundingClientRect();
      if (r.top >= gap - 12 && (topOnly || r.bottom <= vh)) return;
      var top = anchor.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop) - gap;
      try { window.scrollTo({ top: Math.max(0, top), behavior: ctx.reduced ? 'auto' : 'smooth' }); } catch (e) { window.scrollTo(0, Math.max(0, top)); }
    }

    function current() { return byId(state.order[state.i]); }
    function jurorNo(i) {
      var base = parseInt(ctx.juror, 10) || 1215;
      return String(1000 + ((base * 7 + (i + 3) * 389) % 9000));
    }

    function renderHead() {
      countEl.textContent = Math.min(state.i + 1, total);
      scoreEl.textContent = state.score;
      var html = '';
      for (var k = 0; k < total; k++) {
        var m = state.marks[k];
        var cls = m === true ? ' is-right' : m === false ? ' is-wrong' : '';
        if (k === state.i && state.phase !== 'done') cls += ' is-now';
        html += '<i class="w-inversion-mark' + cls + '"></i>';
      }
      tallyEl.innerHTML = html;
    }

    function frontHTML(c) {
      return '<div class="w-inversion-face w-inversion-front">' +
          '<span class="w-inversion-drag is-then" aria-hidden="true">1300</span><span class="w-inversion-drag is-now" aria-hidden="true">2026</span>' +
          '<div class="w-inversion-cardhead"><span>Prospective juror</span><span class="tnum">No. ' + jurorNo(state.i) + '</span></div>' +
          '<div class="w-inversion-cardbody">' +
            '<svg class="w-inversion-icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">' + ICONS[c.icon] + '</svg>' +
            '<blockquote class="w-inversion-quote"><p>“' + esc(c.quote) + '”</p></blockquote>' +
          '</div>' +
          '<p class="w-inversion-ask">Where would this juror be seated?</p>' +
        '</div>';
    }

    function rulingRow(era, side) {
      return '<div class="w-inversion-ruling">' +
          '<div class="w-inversion-era"><span class="w-inversion-year tnum">' + era + '</span>' +
          '<span class="w-inversion-stamp ' + stampClass(side.seat) + '">' + stampText(side.seat) + '</span></div>' +
          '<p>' + esc(side.why) + '</p>' +
        '</div>';
    }

    function backHTML(c, picked, right, exact) {
      var ans = answerOf(c);
      var verdict;
      if (exact) verdict = '<b>Sustained.</b> ' + DATA.outcome[ans];
      else if (right) verdict = '<b>Sustained, narrowly.</b> ' + esc(c.acceptNote || DATA.outcome[ans]);
      else verdict = '<b>Overruled.</b> You said ' + answerMeta(picked).said + '. ' + DATA.outcome[ans];
      return '<div class="w-inversion-face w-inversion-back">' +
          '<div class="w-inversion-cardhead"><span>Ruling on juror No. ' + jurorNo(state.i) + '</span><span class="w-inversion-mini" aria-hidden="true">“' + esc(c.quote.length > 34 ? c.quote.slice(0, 32).replace(/\s+\S*$/, '') + '…' : c.quote) + '”</span></div>' +
          '<p class="w-inversion-verdict ' + (right ? 'is-right' : 'is-wrong') + '">' + verdict + '</p>' +
          '<div class="w-inversion-rulings">' + rulingRow(DATA.then, c.then) + rulingRow(DATA.now, c.now) + '</div>' +
          (c.note ? '<div class="w-inversion-note"><span class="label">' + esc(c.note.label) + '</span><p>' + esc(c.note.text) + '</p></div>' : '') +
        '</div>';
    }

    function renderAsk(animateIn) {
      state.phase = 'ask';
      var c = current();
      card.className = 'w-inversion-card';
      card.style.transform = '';
      card.innerHTML = frontHTML(c);
      card.setAttribute('aria-label', 'Prospective juror ' + (state.i + 1) + ' of ' + total + ': ' + c.quote);
      controls.innerHTML =
        '<div class="w-inversion-answers" role="group" aria-label="Where would this juror be seated?">' +
          DATA.answers.map(function (a) {
            return '<button type="button" class="w-inversion-ans is-' + a.key + '" data-ans="' + a.key + '">' +
              '<span class="w-inversion-ans-label">' + a.label + '</span><span class="w-inversion-ans-sub">' + a.sub + '</span></button>';
          }).join('') +
        '</div>' +
        '<p class="w-inversion-swipe">Or swipe the card: left for 1300, right for 2026.</p>';
      renderHead();
      if (animateIn && !ctx.reduced && card.animate) {
        card.animate([{ opacity: 0, transform: 'translateY(10px) rotate(.8deg)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.3,1)' });
      }
    }

    function answer(key, viaSwipe) {
      if (state.phase !== 'ask' || busy) return;
      busy = true;
      var c = current();
      var ans = answerOf(c);
      var exact = key === ans;
      var right = exact || (c.accept || []).indexOf(key) >= 0;
      if (right) state.score++;
      state.marks[state.i] = right;
      state.phase = 'ruled';

      controls.querySelectorAll('.w-inversion-ans').forEach(function (b) {
        b.disabled = true;
        var k = b.getAttribute('data-ans');
        if (k === key) b.classList.add(right ? 'is-picked-right' : 'is-picked-wrong');
        if (k === ans && !exact) b.classList.add('is-answer');
      });

      var last = state.i === total - 1;
      var reveal = function () {
        card.innerHTML = backHTML(c, key, right, exact);
        card.removeAttribute('aria-label');
        renderHead();
        controls.innerHTML =
          '<div class="w-inversion-next">' +
            '<button type="button" class="btn w-inversion-go">' + (last ? 'Hear the verdict' : 'Next juror') + '</button>' +
            '<span class="w-inversion-left typed">' + (last ? 'Last card' : (total - state.i - 1) + ' left in the pool') + '</span>' +
          '</div>';
        var go = controls.querySelector('.w-inversion-go');
        go.addEventListener('click', next);
        live.textContent = (exact ? 'Sustained. ' : right ? 'Sustained, narrowly. ' : 'Overruled. ') + DATA.outcome[ans] + ' ' +
          DATA.then + ': ' + stampText(c.then.seat) + '. ' + c.then.why + ' ' + DATA.now + ': ' + stampText(c.now.seat) + '. ' + c.now.why +
          (c.note ? ' ' + c.note.label + ': ' + c.note.text : '');
        try { go.focus({ preventScroll: true }); } catch (e) { go.focus(); }
        busy = false;
        show(card.querySelector('.w-inversion-verdict'), card, true);
      };

      if (ctx.reduced || !card.animate) {
        card.style.transform = '';
        reveal();
        return;
      }
      var fromX = viaSwipe ? (key === 'then' ? -60 : 60) : 0;
      var out = card.animate([
        { transform: 'perspective(1000px) translateX(' + fromX + 'px) rotateY(0deg)' },
        { transform: 'perspective(1000px) translateX(' + (fromX / 3) + 'px) rotateY(90deg)' }
      ], { duration: 190, easing: 'cubic-bezier(.5,0,.9,.6)', fill: 'forwards' });
      out.onfinish = function () {
        card.style.transform = '';
        reveal();
        out.cancel();
        card.animate([
          { transform: 'perspective(1000px) rotateY(-90deg)' },
          { transform: 'perspective(1000px) rotateY(0deg)' }
        ], { duration: 240, easing: 'cubic-bezier(.15,.7,.3,1)' });
      };
    }

    function next() {
      if (state.i >= total - 1) { finish(); return; }
      state.i++;
      renderAsk(true);
      show(stage, root);
      try { card.focus({ preventScroll: true }); } catch (e) {}
      live.textContent = 'Juror ' + (state.i + 1) + ' of ' + total + ': ' + current().quote;
    }

    function rankFor(score) {
      for (var k = 0; k < DATA.ranks.length; k++) if (score >= DATA.ranks[k].min) return DATA.ranks[k];
      return DATA.ranks[DATA.ranks.length - 1];
    }

    function ledgerList(era) {
      var seated = DATA.cards.filter(function (c) { return c[era].seat === true; });
      var both = seated.filter(function (c) { return c.then.seat === true && c.now.seat === true; });
      var only = seated.filter(function (c) { return both.indexOf(c) < 0; });
      return both.concat(only).map(function (c) {
        var both = c.then.seat === true && c.now.seat === true;
        return '<li' + (both ? ' class="is-both"' : '') + '>' + esc(c.short) + '</li>';
      }).join('');
    }

    function finish() {
      state.phase = 'done';
      state.i = total;
      var best = Math.max(ctx.store.get('best', 0) || 0, state.score);
      ctx.store.set('best', best);
      var rank = rankFor(state.score);
      var neither = DATA.cards.filter(function (c) { return answerOf(c) === 'neither'; }).map(function (c) { return esc(c.short); }).join(', ');
      renderHead();
      stage.hidden = true;
      controls.innerHTML =
        '<section class="w-inversion-end" aria-labelledby="w-inversion-end-title">' +
          '<p class="label w-inversion-end-kicker">The court finds</p>' +
          '<h4 class="w-inversion-end-title" id="w-inversion-end-title" tabindex="-1">The Great Inversion</h4>' +
          '<div class="w-inversion-end-score">' +
            '<span class="w-inversion-big tnum">' + state.score + '<small>/' + total + '</small></span>' +
            '<span class="w-inversion-rank">' + esc(rank.title) + '</span>' +
          '</div>' +
          '<p class="w-inversion-end-line">' + esc(rank.line) + (best > state.score ? ' Your best so far: ' + best + ' of ' + total + '.' : '') + '</p>' +
          '<div class="w-inversion-ledger">' +
            '<div class="w-inversion-col"><h5><span class="tnum">1300</span> seats</h5><ul>' + ledgerList('then') + '</ul></div>' +
            '<div class="w-inversion-col"><h5><span class="tnum">2026</span> seats</h5><ul>' + ledgerList('now') + '</ul></div>' +
            '<p class="w-inversion-neither"><span class="label">Neither seats</span> ' + neither + '</p>' +
          '</div>' +
          '<p class="w-inversion-sum">' + esc(DATA.summary) + '</p>' +
          '<div class="btn-row"><button type="button" class="btn btn-ghost w-inversion-again">Sort again</button></div>' +
        '</section>';
      controls.querySelector('.w-inversion-again').addEventListener('click', replay);
      var t = controls.querySelector('.w-inversion-end-title');
      var end = controls.querySelector('.w-inversion-end');
      show(end.querySelector('.w-inversion-end-score'), end);
      try { t.focus({ preventScroll: true }); } catch (e) {}
      live.textContent = 'The Great Inversion. You scored ' + state.score + ' of ' + total + '. ' + rank.title + '. ' + DATA.summary;
      if (!ctx.reduced) end.classList.add('is-fresh');
      ctx.stamp('inversion');
    }

    function replay() {
      state.round++;
      var pool = FIRST_ORDER.slice(0, -1);
      for (var k = pool.length - 1; k > 0; k--) {
        var j = Math.floor(ctx.rand() * (k + 1));
        var tmp = pool[k]; pool[k] = pool[j]; pool[j] = tmp;
      }
      pool.push(FIRST_ORDER[FIRST_ORDER.length - 1]);
      state.order = pool;
      state.i = 0; state.score = 0; state.marks = [];
      stage.hidden = false;
      renderAsk(true);
      show(stage, root);
      try { card.focus({ preventScroll: true }); } catch (e) {}
      live.textContent = 'New round. Juror 1 of ' + total + ': ' + current().quote;
    }

    /* ---------- answer buttons (delegated) ---------- */
    controls.addEventListener('click', function (e) {
      var b = e.target.closest('.w-inversion-ans');
      if (b && !b.disabled) answer(b.getAttribute('data-ans'), false);
    });

    /* ---------- keyboard: arrows on the card ---------- */
    card.addEventListener('keydown', function (e) {
      if (state.phase !== 'ask') return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); answer('then', false); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); answer('now', false); }
    });

    /* ---------- swipe: left for 1300, right for 2026 ---------- */
    var THRESH = 70;
    function setEdges(dx) {
      var t = card.querySelector('.w-inversion-drag.is-then'), n = card.querySelector('.w-inversion-drag.is-now');
      if (!t || !n) return;
      var p = Math.min(1, Math.abs(dx) / THRESH);
      t.style.opacity = dx < 0 ? p : 0;
      n.style.opacity = dx > 0 ? p : 0;
      t.classList.toggle('is-hot', dx <= -THRESH);
      n.classList.toggle('is-hot', dx >= THRESH);
    }
    card.addEventListener('pointerdown', function (e) {
      if (state.phase !== 'ask' || busy || (e.pointerType === 'mouse' && e.button !== 0)) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, live: false };
    });
    card.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.live) {
        if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
        drag.live = true;
        try { card.setPointerCapture(e.pointerId); } catch (err) {}
        card.classList.add('is-dragging');
      }
      drag.dx = dx;
      var max = stage.clientWidth * 0.45;
      var shown = Math.max(-max, Math.min(max, dx));
      card.style.transform = 'translateX(' + shown + 'px) rotate(' + (shown / 22) + 'deg)';
      setEdges(dx);
    });
    function endDrag(e, cancelled) {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      var d = drag;
      drag = null;
      card.classList.remove('is-dragging');
      setEdges(0);
      if (!d.live) return;
      act();
      if (!cancelled && d.dx <= -THRESH) answer('then', true);
      else if (!cancelled && d.dx >= THRESH) answer('now', true);
      else {
        if (!ctx.reduced && card.animate) {
          var from = card.style.transform;
          card.style.transform = '';
          card.animate([{ transform: from }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,1.4,.4,1)' });
        } else card.style.transform = '';
      }
    }
    card.addEventListener('pointerup', function (e) { endDrag(e, false); });
    card.addEventListener('pointercancel', function (e) { endDrag(e, true); });
    card.addEventListener('lostpointercapture', function (e) { if (e.target === card && drag && drag.live) endDrag(e, false); });

    renderAsk(false);
  });
})();
