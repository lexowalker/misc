/* verdict: "Jury instructions". Seven questions, then a certificate of service. Seal: 'verdict'. */
(function () {
  'use strict';

  /* ---- questions (edit here) ---- */
  var QUESTIONS = [
    { q: 'In 1300, the ideal English juror was someone who…',
      options: ['had never met the accused', 'knew the accused and the facts', 'had studied the law', 'was picked by lot'],
      answer: 1, ch: 'V', href: '#ch-twelve',
      why: 'Medieval jurors were neighbors, summoned because they already knew the people and what had happened. Their knowledge was the evidence.' },
    { q: 'How did Athens choose which citizens judged a case that day?',
      options: ['The magistrate picked the wisest', 'By lot, with an allotment machine', 'By election', 'First come, first served'],
      answer: 1, ch: 'II', href: '#ch-athens',
      why: 'Black and white dice decided whole rows of juror tickets. Nobody could know in advance who would sit, which made bribery hard.' },
    { q: 'What pushed England from the ordeal toward the jury?',
      options: ['Magna Carta', 'The Fourth Lateran Council of 1215', 'The Black Death', 'An act of Parliament'],
      answer: 1, ch: 'IV', href: '#ch-kings',
      why: 'The Church barred priests from blessing ordeals in 1215. Without God as the judge, English courts turned to juries of neighbors.' },
    { q: 'In Magna Carta, "the lawful judgment of his peers" first meant…',
      options: ['a jury of twelve', 'judgment by equals in rank', 'trial by battle', 'the king\'s own verdict'],
      answer: 1, ch: 'IV', href: '#ch-kings',
      why: 'The barons wanted to be judged by barons. Reading the clause as a promise of jury trial came centuries later.' },
    { q: 'What did Bushel\'s Case (1670) decide?',
      options: ['Verdicts must be unanimous', 'Jurors cannot be punished for their verdict', 'A jury must have twelve members', 'Quakers may preach in the street'],
      answer: 1, ch: 'VI', href: '#ch-talks',
      why: 'After the jury acquitted William Penn and was fined and jailed for it, Chief Justice Vaughan ruled that jurors may not be punished for the verdict they give.' },
    { q: 'What is the smallest jury the US Supreme Court allows in a criminal trial?',
      options: ['Three', 'Five', 'Six', 'Twelve'],
      answer: 2, ch: 'VII', href: '#ch-sit',
      why: 'Williams v. Florida (1970) upheld a jury of six. Ballew v. Georgia (1978) struck down a jury of five. In June 2026 the Court agreed to decide, in Kian v. Florida, whether a serious felony needs twelve.' },
    { q: 'About how many federal criminal cases end in a trial?',
      options: ['About half', 'About 1 in 10', 'About 2 in 100', 'None at all'],
      answer: 2, ch: 'IX', href: '#ch-strangers',
      why: 'In fiscal year 2022 about 90 percent of federal defendants pleaded guilty and about 8 percent had their cases dismissed. Only about 2 percent went to trial.' }
  ];

  var RANKS = [
    { min: 7, title: 'Foreperson of the Court', line: 'A perfect record. The court would trust you with the verdict form.' },
    { min: 5, title: 'Duly Sworn', line: 'Well informed and ready to deliberate.' },
    { min: 3, title: 'Seated, With Notes', line: 'The judge has a few instructions for you.' },
    { min: 0, title: 'Excused, With Thanks', line: 'Excused for cause, with the court\'s thanks. The record is above if you would like to try again.' }
  ];

  var LETTERS = ['A', 'B', 'C', 'D'];

  function sealPath(cx, cy, r, bumps) {
    var d = '', n = bumps * 2;
    for (var i = 0; i <= n; i++) {
      var a = (i / n) * Math.PI * 2, rr = i % 2 ? r : r * 0.9;
      d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(2) + ' ' + (cy + Math.sin(a) * rr).toFixed(2);
    }
    return d + 'Z';
  }

  TS.register('verdict', function (el, ctx) {
    var state = { i: 0, picks: [], done: false };

    el.innerHTML =
      '<div class="w-ver">' +
        '<div class="w-ver-tally" aria-hidden="true"></div>' +
        '<div class="w-ver-card"></div>' +
        '<p class="sr-only" aria-live="polite" id="w-ver-live"></p>' +
      '</div>';
    var tally = el.querySelector('.w-ver-tally');
    var card = el.querySelector('.w-ver-card');
    var live = el.querySelector('#w-ver-live');

    function renderTally() {
      tally.innerHTML = QUESTIONS.map(function (q, i) {
        var p = state.picks[i];
        var cls = p == null ? '' : p === q.answer ? ' is-right' : ' is-wrong';
        if (i === state.i && !state.done) cls += ' is-now';
        return '<span class="w-ver-mark' + cls + '"></span>';
      }).join('');
    }

    function renderQuestion() {
      var q = QUESTIONS[state.i];
      var picked = state.picks[state.i];
      var answered = picked != null;
      card.innerHTML =
        '<p class="w-ver-count label">Question ' + (state.i + 1) + ' of ' + QUESTIONS.length + '</p>' +
        '<h4 class="w-ver-q">' + q.q + '</h4>' +
        '<div class="w-ver-options" role="group" aria-label="Answers">' +
          q.options.map(function (o, k) {
            var cls = '';
            if (answered) cls = k === q.answer ? ' is-right' : k === picked ? ' is-wrong' : ' is-dim';
            return '<button type="button" class="w-ver-opt' + cls + '" data-k="' + k + '"' + (answered ? ' disabled' : '') + '><span class="w-ver-letter">' + LETTERS[k] + '</span><span>' + o + '</span></button>';
          }).join('') +
        '</div>' +
        (answered ?
          '<div class="w-ver-why"><p><b>' + (picked === q.answer ? 'Correct.' : 'Not quite.') + '</b> ' + q.why + ' <a href="' + q.href + '">Chapter ' + q.ch + '</a></p>' +
          '<button type="button" class="btn w-ver-next">' + (state.i + 1 < QUESTIONS.length ? 'Next question' : 'Return your verdict') + '</button></div>'
          : '');
      card.querySelectorAll('.w-ver-opt').forEach(function (b) {
        b.addEventListener('click', function () {
          state.picks[state.i] = +b.dataset.k;
          var right = +b.dataset.k === q.answer;
          live.textContent = (right ? 'Correct. ' : 'Not quite. The answer is ' + q.options[q.answer] + '. ') + q.why;
          renderTally();
          renderQuestion();
          var next = card.querySelector('.w-ver-next');
          if (next) next.focus({ preventScroll: true });
        });
      });
      var next = card.querySelector('.w-ver-next');
      if (next) next.addEventListener('click', function () {
        if (state.i + 1 < QUESTIONS.length) { state.i++; renderTally(); renderQuestion(); focusCard(); }
        else finish();
      });
    }

    function focusCard() {
      var h = card.querySelector('.w-ver-q, .w-ver-cert-title');
      if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    }

    function score() { return QUESTIONS.filter(function (q, i) { return state.picks[i] === q.answer; }).length; }

    function finish() {
      state.done = true;
      renderTally();
      ctx.stamp('verdict');
      ctx.store.set('last', score());
      renderCertificate(true);
      focusCard();
    }

    function renderCertificate(fresh) {
      var s = score();
      var rank = RANKS.filter(function (r) { return s >= r.min; })[0];
      var seals = TS.SEALS.map(function (x) { return { label: x.label, num: x.num, on: ctx.hasSeal(x.id) }; });
      var nSeals = seals.filter(function (x) { return x.on; }).length;
      var date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      var missed = QUESTIONS.map(function (q, i) { return state.picks[i] === q.answer ? null : '<a href="' + q.href + '">Ch. ' + q.ch + '</a>'; }).filter(Boolean);
      card.innerHTML =
        '<div class="w-ver-cert' + (fresh && !ctx.reduced ? ' is-fresh' : '') + '">' +
          '<p class="w-ver-cert-court">In the Court of All the Ages</p>' +
          '<h4 class="w-ver-cert-title">Certificate of Jury Service</h4>' +
          '<p class="w-ver-cert-body">This certifies that <b>Juror No. ' + ctx.juror + '</b> answered the summons, heard the evidence from before history to the present day, and returned a verdict of <b class="tnum">' + s + ' of ' + QUESTIONS.length + '</b>.</p>' +
          '<p class="w-ver-cert-rank">' + rank.title + '</p>' +
          '<p class="w-ver-cert-line">' + rank.line + (missed.length && s < 7 ? ' Review: ' + missed.join(', ') + '.' : '') + '</p>' +
          '<div class="w-ver-cert-box" aria-label="' + nSeals + ' of 12 seals earned">' +
            seals.map(function (x) { return '<span class="w-ver-cert-seat' + (x.on ? ' is-on' : '') + '" title="' + x.label + '">' + x.num + '</span>'; }).join('') +
          '</div>' +
          '<p class="w-ver-cert-seals typed">' + (nSeals === 12 ? 'Jury box full: all twelve seals.' : 'Seals earned: ' + nSeals + ' of 12. Each exhibit on the page holds one.') + '</p>' +
          '<div class="w-ver-cert-foot">' +
            '<span class="typed">Dated ' + date + '</span>' +
            '<svg class="w-ver-wax" viewBox="0 0 80 80" aria-hidden="true"><path d="' + sealPath(40, 40, 37, 14) + '"/><circle cx="40" cy="40" r="25"/><text x="40" y="47" text-anchor="middle">XII</text></svg>' +
          '</div>' +
        '</div>' +
        '<div class="btn-row w-ver-actions">' +
          '<button type="button" class="btn w-ver-copy">Copy my verdict</button>' +
          '<button type="button" class="btn btn-ghost w-ver-again">Retake</button>' +
        '</div>' +
        '<textarea class="w-ver-copytext" readonly hidden aria-label="Your verdict, ready to copy"></textarea>';
      live.textContent = 'Certificate of jury service. Verdict ' + s + ' of ' + QUESTIONS.length + '. ' + rank.title + '.';
      var text = 'I served as Juror No. ' + ctx.juror + ' in "Twelve Strangers," a history of trial by jury, and returned a verdict of ' + s + ' of ' + QUESTIONS.length + ' (' + rank.title + '), with ' + nSeals + ' of 12 seals.';
      var copyBtn = card.querySelector('.w-ver-copy');
      var ta = card.querySelector('.w-ver-copytext');
      copyBtn.addEventListener('click', function () {
        function fallback() { ta.value = text; ta.hidden = false; ta.focus(); ta.select(); copyBtn.textContent = 'Select and copy'; }
        try {
          navigator.clipboard.writeText(text).then(function () { copyBtn.textContent = 'Copied'; ctx.toast('Copied your verdict'); }, fallback);
        } catch (e) { fallback(); }
      });
      card.querySelector('.w-ver-again').addEventListener('click', function () {
        state = { i: 0, picks: [], done: false };
        renderTally(); renderQuestion(); focusCard();
      });
    }

    ctx.on('seal', function () { if (state.done) renderCertificate(false); });

    renderTally();
    renderQuestion();
  });
})();
