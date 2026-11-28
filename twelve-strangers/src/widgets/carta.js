/* Exhibit: "Clause 39, word by word" (Chapter IV). Magna Carta 1215, clause 39, as a strip of tappable Latin.
   Seal: 'carta', awarded when all twelve phrases are decoded. */
(function () {
  'use strict';

  /* =====================================================================
     COPY AND FACTS. Everything the reader sees is here, so it is easy to correct.
     Latin: the common modern transcription of the 1215 text (as in J. C. Holt's edition and the spec).
       Editions differ in spelling: the Magna Carta Project prints "dissaisiatur" and "terrae".
     English of the whole clause: British Library translation (after G. R. C. Davis).
     ===================================================================== */
  const DATA = {
    sheetLabel: 'Magna Carta, 1215',
    sheetSub: 'Clause 39',
    start: 'Tap any word in the charter. Twelve phrases make up the clause. Decode them all to seal it.',
    startBtn: 'Start at the first word',
    modes: { m1215: 'What it meant in 1215', later: 'What it came to mean' },
    enLabel: { m1215: 'In English, so far', later: 'As later readers took it (our paraphrase)' },
    noteLabel: { m1215: 'In 1215', later: 'What it came to mean', same: 'In 1215, and after' },
    phrases: [
      {
        la: ['Nullus', 'liber', 'homo'], lit: ['no', 'free', 'man'],
        en: 'No free man', enLater: 'No person',
        note: 'Free man meant exactly that. Villeins, the unfree peasants who could seek justice only in their lord’s court, were left out. The British Library says most people in England were unfree. The historian David Carpenter puts it at perhaps half.',
        later: 'In 1354 a statute widened the promise to any man “of what estate or condition that he be.” The Fifth Amendment opens with “No person.”'
      },
      {
        la: ['capiatur'], lit: ['shall be seized'],
        en: 'shall be seized', enLater: 'shall be arrested',
        note: 'Seized means taken into custody. The list of verbs that starts here reads like a charge sheet against King John.',
        later: null
      },
      {
        la: ['vel', 'imprisonetur'], lit: ['or', 'shall be imprisoned'],
        en: 'or imprisoned', enLater: 'or jailed',
        note: 'In 1210 the wife and eldest son of the baron William de Braose died in John’s custody, reportedly starved.',
        later: 'In 1627 and 1628 lawyers invoked this clause against Charles I, who jailed men without showing cause. So did the Petition of Right (1628).'
      },
      {
        la: ['aut', 'disseisiatur'], lit: ['or', 'shall be disseised'],
        en: 'or stripped of his land', enLater: 'or deprived of property',
        note: 'Disseised means thrown off land you held. Disseisin cases were among the commonest in the royal courts, and Henry II had let twelve neighbors decide them.',
        later: 'The 1225 reissue spelled it out: disseised of his freehold, his liberties or his free customs. The Fifth Amendment says “property.”'
      },
      {
        la: ['aut', 'utlagetur', 'aut', 'exuletur'], lit: ['or', 'shall be outlawed', 'or', 'shall be exiled'],
        en: 'or outlawed or exiled', enLater: 'or outlawed or exiled',
        note: 'An outlaw lost the law’s protection. Medieval lawyers said he bore a wolf’s head, like an animal anyone might hunt. An exile was banished from the realm.',
        later: null
      },
      {
        la: ['aut', 'aliquo', 'modo', 'destruatur'], lit: ['or', 'any', 'way', 'shall be destroyed'],
        en: 'or ruined in any way', enLater: 'or punished in any way',
        note: 'A catch-all, so no new punishment could slip past. The British Library translates it “deprived of his standing in any way.”',
        later: null
      },
      {
        la: ['nec', 'super', 'eum', 'ibimus'], lit: ['nor', 'upon', 'him', 'we will go'],
        en: 'nor will we go against him', enLater: 'nor will the government move against him',
        note: '“We” is King John. Here the king himself promises not to move against a free man by force.',
        later: 'Later readers took the royal “we” to mean the state itself, whoever holds power.'
      },
      {
        la: ['nec', 'super', 'eum', 'mittemus'], lit: ['nor', 'upon', 'him', 'we will send'],
        en: 'nor send others against him', enLater: 'nor send its agents against him',
        note: 'No acting through sheriffs, castle keepers or soldiers either. Clause 51 even promised to send John’s foreign mercenaries home.',
        later: null
      },
      {
        la: ['nisi', 'per', 'legale', 'judicium'], lit: ['unless', 'by', 'lawful', 'judgment'],
        en: 'except by the lawful judgment', enLater: 'except by the verdict',
        note: 'Judgment first, punishment after. John had often acted by his will alone. Clause 52 promised to give back what he had taken without a lawful judgment.',
        later: null
      },
      {
        la: ['parium', 'suorum'], lit: ['of peers', 'his own'],
        en: 'of his peers', enLater: 'of a jury',
        note: 'Peers meant equals in rank: barons judged by barons. Clause 21 says earls and barons may be fined only by their peers. This was no promise of jury trial as we know it. The criminal trial jury did not exist yet.',
        later: 'Coke and the American founders read it as a guarantee of trial by jury. Americans still quote it that way.'
      },
      {
        la: ['vel'], lit: ['or (and?)'],
        en: 'or', enLater: 'or',
        note: 'Vel usually means or, but medieval Latin sometimes used it for and. Most scholars, J. C. Holt among them, read or: either route was enough. Walter Ullmann argued for and: the king needed both.',
        later: null
      },
      {
        la: ['per', 'legem', 'terre'], lit: ['by', 'law', 'of the land'],
        en: 'by the law of the land', enLater: 'by due process of law',
        note: 'The customary law of England. In June 1215 that still included the ordeal and trial by battle. The Church pulled its priests out of ordeals that November.',
        later: 'A statute of 1354 spoke of “due process of the law.” The Fifth Amendment forbids depriving any person of life, liberty or property “without due process of law.”'
      }
    ],
    /* Punctuation that follows a phrase in the Latin line, by phrase index. */
    punct: { 5: ',', 7: ',', 11: '.' },
    blTranslation: 'No free man shall be seized or imprisoned, or stripped of his rights or possessions, or outlawed or exiled, or deprived of his standing in any way, nor will we proceed with force against him, or send others to do so, except by the lawful judgement of his equals or by the law of the land.',
    blCite: 'British Library translation of the 1215 text',
    peers: {
      title: 'Trial by peers, 1215 to 1948',
      items: [
        ['1215', 'Barons win judgment by their equals. Clause 21 adds that earls and barons may be fined only by their peers.'],
        ['Later', 'For centuries, a peer of the realm accused of treason or felony was tried by the House of Lords. No jury sat.'],
        ['1935', 'The last such trial. Lord de Clifford was charged with manslaughter after a fatal car crash. More than eighty peers heard the case and acquitted him.'],
        ['1948', 'The Criminal Justice Act ended the privilege. Peers now face juries like everyone else.']
      ]
    },
    context: {
      m1215: {
        title: 'In 1215, a peace deal',
        items: [
          ['June 1215', 'Rebel barons force the charter on King John at Runnymede.'],
          ['Aug 1215', 'It fails. Pope Innocent III annuls it about ten weeks later, and civil war follows.'],
          ['The text', 'The clause numbers are modern. The original is one unbroken block of Latin, and scribes spelled freely: editions print disseisiatur or dissaisiatur, terre or terrae.']
        ]
      },
      later: {
        title: 'The afterlife of clause 39',
        items: [
          ['1225', 'Henry III reissues the charter. Clauses 39 and 40 merge into chapter 29.'],
          ['1297', 'Edward I confirms it. Chapter 29 of this text is still law in England and Wales.'],
          ['1354', 'A statute says “no man of what estate or condition that he be” and speaks of “due process of the law.” Both phrases are the standard English translation. The statute itself is in law French.'],
          ['1642', 'Sir Edward Coke’s *Second Institute* reads judgment of peers as trial by jury and the law of the land as due process of law.'],
          ['1791', 'The Fifth Amendment promises due process of law. The Sixth promises an impartial jury.'],
          ['1856', 'The Supreme Court says “due process of law” means the same as “by the law of the land” in Magna Carta.']
        ]
      }
    },
    done: 'Clause decoded. King John never signed Magna Carta. It was sealed, like this.',
    replay: 'Start over',
    prev: 'Back',
    next: 'Next',
    decodedCount: function (n) { return n + ' of 12 decoded'; },
    phraseOf: function (i) { return 'Phrase ' + (i + 1) + ' of 12'; },
    sealAria: function (n) { return n === 12 ? 'Wax seal: the clause is sealed.' : 'Wax seal, waiting: ' + n + ' of 12 phrases decoded.'; }
  };

  const NS = 'http://www.w3.org/2000/svg';
  const N = DATA.phrases.length;

  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function fmt(s) { return esc(s).replace(/\*([^*]+)\*/g, '<i>$1</i>'); }
  function h(tag, cls, html) { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }

  /* a slightly irregular blob, like a wax seal */
  function blobPath(cx, cy, r) {
    const pts = [];
    const k = 18;
    for (let i = 0; i < k; i++) {
      const a = (i / k) * Math.PI * 2;
      const rr = r + Math.sin(i * 2.3) * 1.6 + Math.cos(i * 1.7) * 1.2;
      pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
    }
    let d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
    for (let i = 0; i < k; i++) {
      const p1 = pts[(i + 1) % k];
      const mid = [(pts[i][0] + p1[0]) / 2, (pts[i][1] + p1[1]) / 2];
      d += ' Q' + pts[i][0].toFixed(1) + ' ' + pts[i][1].toFixed(1) + ' ' + mid[0].toFixed(1) + ' ' + mid[1].toFixed(1);
    }
    return d + 'Z';
  }

  TS.register('carta', function (el, ctx) {
    let decoded = {};
    (ctx.store.get('decoded', []) || []).forEach((i) => { if (i >= 0 && i < N) decoded[i] = true; });
    let mode = ctx.store.get('mode', 'm1215') === 'later' ? 'later' : 'm1215';
    let current = -1;
    let focusIdx = 0;

    const root = h('div', 'w-carta');
    el.appendChild(root);

    /* ---------- mode toggle ---------- */
    const modeRow = h('div', 'w-carta-modes chips');
    modeRow.setAttribute('role', 'group');
    modeRow.setAttribute('aria-label', 'Reading of the clause');
    const modeBtns = {};
    ['m1215', 'later'].forEach((m) => {
      const b = h('button', 'chip w-carta-mode');
      b.type = 'button';
      b.textContent = DATA.modes[m];
      b.addEventListener('click', () => setMode(m));
      modeBtns[m] = b;
      modeRow.appendChild(b);
    });
    root.appendChild(modeRow);

    /* ---------- the parchment strip ---------- */
    const sheet = h('div', 'w-carta-sheet');
    sheet.innerHTML = '<div class="w-carta-sheethead"><span class="w-carta-title">' + esc(DATA.sheetLabel) + '</span><span class="w-carta-clause">' + esc(DATA.sheetSub) + '</span></div>';
    const latin = h('p', 'w-carta-latin');
    latin.setAttribute('lang', 'la');
    const phraseEls = [];
    const wordBtns = [];
    DATA.phrases.forEach((ph, i) => {
      const span = h('span', 'w-carta-ph');
      span.dataset.i = i;
      ph.la.forEach((w, j) => {
        const b = h('button', 'w-carta-w');
        b.type = 'button';
        b.textContent = w;
        b.dataset.i = i;
        b.tabIndex = -1;
        b.addEventListener('click', () => select(i, true));
        b.addEventListener('keydown', onKey);
        span.appendChild(b);
        if (j < ph.la.length - 1) span.appendChild(document.createTextNode(' '));
        if (j === 0) wordBtns[i] = b;
      });
      const sup = h('sup', 'w-carta-sup');
      sup.setAttribute('aria-hidden', 'true');
      sup.textContent = i + 1;
      span.appendChild(sup);
      phraseEls.push(span);
      latin.appendChild(span);
      if (DATA.punct[i]) latin.appendChild(h('span', 'w-carta-punct', DATA.punct[i]));
      latin.appendChild(document.createTextNode(' '));
    });
    sheet.appendChild(latin);
    root.appendChild(sheet);

    /* ---------- tally: twelve small seals and the big one ---------- */
    const tally = h('div', 'w-carta-tally');
    const dotsWrap = h('div', 'w-carta-tallyleft');
    const dots = h('div', 'w-carta-dots');
    dots.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < N; i++) dots.appendChild(h('span', 'w-carta-dot'));
    const count = h('p', 'w-carta-count tnum');
    dotsWrap.appendChild(dots);
    dotsWrap.appendChild(count);
    tally.appendChild(dotsWrap);
    const big = document.createElementNS(NS, 'svg');
    big.setAttribute('viewBox', '0 0 80 92');
    big.setAttribute('class', 'w-carta-big');
    big.setAttribute('role', 'img');
    big.innerHTML =
      '<path class="w-carta-cord" d="M31 0 C33 9 27 17 33 27"/><path class="w-carta-cord" d="M49 0 C47 9 53 17 47 27"/>' +
      '<g class="w-carta-wax"><path class="w-carta-blob" d="' + blobPath(40, 58, 27) + '"/>' +
      '<circle class="w-carta-ring" cx="40" cy="58" r="20"/>' +
      '<path class="w-carta-crown" d="M29 66 L29 54 L34.5 59 L40 49.5 L45.5 59 L51 54 L51 66 Z M29 69.5 L51 69.5"/>' +
      '<text class="w-carta-left" x="40" y="62.5" text-anchor="middle"></text></g>';
    tally.appendChild(big);
    root.appendChild(tally);

    /* ---------- the English, phrase by phrase ---------- */
    const enBox = h('div', 'w-carta-enbox');
    const enLabel = h('p', 'label w-carta-enlabel');
    const enLine = h('p', 'w-carta-en');
    const enSegs = DATA.phrases.map((ph, i) => {
      const s = h('span', 'w-carta-seg');
      s.dataset.i = i;
      return s;
    });
    enSegs.forEach((s, i) => { enLine.appendChild(s); if (i < N - 1) enLine.appendChild(document.createTextNode(' ')); });
    const bl = h('blockquote', 'w-carta-bl');
    bl.hidden = true;
    bl.innerHTML = '<p>“' + esc(DATA.blTranslation) + '”</p><footer>' + esc(DATA.blCite) + '</footer>';
    enBox.appendChild(enLabel);
    enBox.appendChild(enLine);
    enBox.appendChild(bl);

    /* ---------- gloss and the peers card ---------- */
    const panels = h('div', 'w-carta-panels');
    const gloss = h('section', 'w-carta-gloss');
    gloss.setAttribute('aria-live', 'polite');
    gloss.setAttribute('aria-label', 'Gloss');
    const peers = h('aside', 'w-carta-peers');
    peers.hidden = true;
    peers.innerHTML =
      '<div class="w-carta-peershead"><svg class="w-carta-coronet" viewBox="0 0 48 32" aria-hidden="true">' +
      '<path class="w-carta-cor-band" d="M6 24 H42 V29 H6 Z"/><path class="w-carta-cor-top" d="M7 24 L9 12 L16 19 L24 8 L32 19 L39 12 L41 24"/>' +
      '<circle class="w-carta-cor-pearl" cx="9" cy="10" r="2.4"/><circle class="w-carta-cor-pearl" cx="24" cy="6" r="2.4"/><circle class="w-carta-cor-pearl" cx="39" cy="10" r="2.4"/></svg>' +
      '<h4 class="w-carta-peerstitle">' + esc(DATA.peers.title) + '</h4></div>' +
      '<ol class="w-carta-tl">' + DATA.peers.items.map((it) => '<li><b class="tnum">' + esc(it[0]) + '</b><span>' + esc(it[1]) + '</span></li>').join('') + '</ol>';
    panels.appendChild(gloss);
    panels.appendChild(peers);
    /* On a phone the gloss sits straight under the strip and its tally, so a tapped word and its meaning share a screen.
       The running English follows the gloss. */
    root.appendChild(panels);
    root.appendChild(enBox);

    /* ---------- context card ---------- */
    const context = h('section', 'w-carta-context');
    root.appendChild(context);

    const actions = h('div', 'btn-row w-carta-actions');
    const replayBtn = h('button', 'btn btn-ghost btn-small');
    replayBtn.type = 'button';
    replayBtn.textContent = DATA.replay;
    replayBtn.addEventListener('click', replay);
    actions.appendChild(replayBtn);
    root.appendChild(actions);

    /* ---------- behaviour ---------- */
    function nDecoded() { return Object.keys(decoded).length; }

    /* Keeping what a tap reveals on screen. The sticky ticker covers the top of the viewport; scroll only when the
       target is under it or below the fold, and only in answer to a tap. */
    function tickerBottom() {
      const t = document.querySelector('.ticker');
      const b = t ? t.getBoundingClientRect().bottom : 0;
      return b > 0 ? b : 0;
    }
    function offScreen(top, bottom) { return top < tickerBottom() - 1 || bottom > window.innerHeight + 1; }
    function behavior() { return ctx.reduced ? 'auto' : 'smooth'; }
    /* The page may already pad its scroll by the ticker (scroll-padding-top on html); trim the margin so the gap
       under the ticker is 16px either way, never double. */
    function fitMargin(target) {
      let pad = 0;
      try { pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0; } catch (e) {}
      target.style.scrollMarginTop = Math.max(0, Math.round(tickerBottom() + 16 - pad)) + 'px';
    }
    /* Show the gloss after a tap on the strip. */
    function showGloss() {
      const r = gloss.getBoundingClientRect();
      if (!r.height || !offScreen(r.top, r.bottom)) return false;
      fitMargin(gloss);
      gloss.scrollIntoView({ block: 'nearest', behavior: behavior() });
      return true;
    }
    /* Show the big seal and the gloss under it together. The seal toast drops in just under the ticker, so the seal
       is kept below that strip; if seal and gloss do not fit together, the seal comes first. */
    function showSeal() {
      const a = big.getBoundingClientRect();
      const b = gloss.getBoundingClientRect();
      if (!a.height) return false;
      const vh = window.innerHeight;
      const clear = tickerBottom() + 64;
      if (a.top >= clear && b.bottom <= vh) return false;
      const delta = b.bottom - a.top <= vh - 16 - clear ? b.bottom - (vh - 16) : a.top - clear;
      if (Math.abs(delta) < 2) return false;
      window.scrollBy({ top: delta, behavior: behavior() });
      return true;
    }
    /* Run cb once a smooth scroll has settled, so an animation plays where the reader can see it. */
    function afterScroll(moved, cb) {
      if (!moved || ctx.reduced) { cb(); return; }
      let done = false;
      const go = () => { if (done) return; done = true; window.removeEventListener('scrollend', go); cb(); };
      window.addEventListener('scrollend', go);
      setTimeout(go, 700);
    }

    function setRoving(i) {
      focusIdx = i;
      wordBtns.forEach((b, k) => { b.tabIndex = k === i ? 0 : -1; });
    }

    function onKey(e) {
      const i = +e.currentTarget.dataset.i;
      let t = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') t = Math.min(N - 1, i + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') t = Math.max(0, i - 1);
      else if (e.key === 'Home') t = 0;
      else if (e.key === 'End') t = N - 1;
      if (t == null) return;
      e.preventDefault();
      setRoving(t);
      wordBtns[t].focus();
    }

    function wordLabels() {
      DATA.phrases.forEach((ph, i) => {
        const lab = ph.la.join(' ') + ', phrase ' + (i + 1) + ' of 12' + (decoded[i] ? ', decoded' : '');
        phraseEls[i].querySelectorAll('.w-carta-w').forEach((b) => b.setAttribute('aria-label', lab));
      });
    }

    function renderEnglish() {
      enLabel.textContent = DATA.enLabel[mode];
      enSegs.forEach((s, i) => {
        const ph = DATA.phrases[i];
        if (decoded[i]) {
          s.textContent = mode === 'later' ? ph.enLater : ph.en;
          s.className = 'w-carta-seg is-on' + (i === current ? ' is-cur' : '') + (mode === 'later' && ph.enLater !== ph.en ? ' is-changed' : '');
          s.removeAttribute('aria-label');
        } else {
          s.textContent = '';
          s.className = 'w-carta-seg is-blank';
          s.setAttribute('aria-label', 'blank');
        }
      });
      const all = nDecoded() === N;
      bl.hidden = !(all && mode === 'm1215');
    }

    function renderTally(popIdx) {
      const n = nDecoded();
      const ds = dots.children;
      for (let i = 0; i < N; i++) {
        ds[i].classList.toggle('is-on', !!decoded[i]);
        ds[i].classList.toggle('is-pop', i === popIdx && !ctx.reduced);
      }
      count.textContent = DATA.decodedCount(n);
      big.querySelector('.w-carta-left').textContent = n + '/12';
      big.setAttribute('aria-label', DATA.sealAria(n));
      root.classList.toggle('is-sealed', n === N);
      replayBtn.hidden = n === 0;
    }

    function renderStrip() {
      phraseEls.forEach((span, i) => {
        span.classList.toggle('is-on', !!decoded[i]);
        span.classList.toggle('is-cur', i === current);
        span.querySelectorAll('.w-carta-w').forEach((b) => {
          if (i === current) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
        });
      });
      wordLabels();
    }

    function renderGloss() {
      if (current < 0) {
        gloss.className = 'w-carta-gloss is-empty';
        gloss.innerHTML = '<p class="w-carta-start">' + esc(DATA.start) + '</p>';
        const b = h('button', 'btn btn-small');
        b.type = 'button';
        b.textContent = DATA.startBtn;
        b.addEventListener('click', () => { select(0, true); });
        gloss.appendChild(b);
        peers.hidden = true;
        panels.classList.remove('has-peers');
        return;
      }
      const ph = DATA.phrases[current];
      const useLater = mode === 'later' && ph.later;
      const lab = mode === 'later' ? (ph.later ? DATA.noteLabel.later : DATA.noteLabel.same) : DATA.noteLabel.m1215;
      const il = ph.la.map((w, j) => '<span class="w-carta-il"><i lang="la">' + esc(w) + '</i><small>' + esc(ph.lit[j]) + '</small></span>').join('');
      gloss.className = 'w-carta-gloss' + (mode === 'later' ? ' is-later' : '');
      gloss.innerHTML =
        '<div class="w-carta-ghead"><span class="label">' + esc(DATA.phraseOf(current)) + '</span>' +
        '<span class="w-carta-nav"><button type="button" class="btn btn-ghost btn-small w-carta-prev">' + esc(DATA.prev) + '</button>' +
        '<button type="button" class="btn btn-ghost btn-small w-carta-next">' + esc(DATA.next) + '</button></span></div>' +
        '<p class="w-carta-ilrow">' + il + '</p>' +
        '<p class="w-carta-gen">“' + esc(mode === 'later' ? ph.enLater : ph.en) + '”</p>' +
        '<p class="w-carta-gnote"><span class="w-carta-nlabel">' + esc(lab) + '</span> ' + esc(useLater ? ph.later : ph.note) + '</p>';
      const prev = gloss.querySelector('.w-carta-prev');
      const next = gloss.querySelector('.w-carta-next');
      prev.disabled = current === 0;
      next.disabled = current === N - 1;
      prev.setAttribute('aria-label', 'Previous phrase');
      next.setAttribute('aria-label', 'Next phrase');
      prev.addEventListener('click', () => { if (current > 0) select(current - 1, false, 'prev'); });
      next.addEventListener('click', () => { if (current < N - 1) select(current + 1, false, 'next'); });
      const isPeers = current === 9;
      peers.hidden = !isPeers;
      panels.classList.toggle('has-peers', isPeers);
      if (isPeers && !ctx.reduced) { peers.classList.remove('is-in'); void peers.offsetWidth; peers.classList.add('is-in'); }
    }

    function renderContext() {
      const c = DATA.context[mode];
      context.className = 'w-carta-context' + (mode === 'later' ? ' is-later' : '');
      context.innerHTML = '<h4 class="w-carta-ctitle">' + esc(c.title) + '</h4><ol class="w-carta-tl">' +
        c.items.map((it) => '<li><b class="tnum">' + esc(it[0]) + '</b><span>' + fmt(it[1]) + '</span></li>').join('') + '</ol>';
    }

    function renderModes() {
      Object.keys(modeBtns).forEach((m) => modeBtns[m].setAttribute('aria-pressed', String(m === mode)));
      root.classList.toggle('is-later', mode === 'later');
    }

    function renderAll(popIdx) {
      renderModes();
      renderStrip();
      renderTally(popIdx);
      renderEnglish();
      renderGloss();
      renderContext();
    }

    function select(i, fromStrip, navFocus) {
      const fresh = !decoded[i];
      current = i;
      decoded[i] = true;
      setRoving(i);
      ctx.store.set('decoded', Object.keys(decoded).map(Number));
      renderModes();
      renderStrip();
      renderTally(fresh ? i : -1);
      renderEnglish();
      renderGloss();
      if (fresh && !ctx.reduced) {
        phraseEls[i].classList.remove('is-fresh');
        void phraseEls[i].offsetWidth;
        phraseEls[i].classList.add('is-fresh');
      }
      if (navFocus) {
        const b = gloss.querySelector(navFocus === 'prev' ? '.w-carta-prev' : '.w-carta-next');
        if (b && !b.disabled) b.focus();
        else { const o = gloss.querySelector(navFocus === 'prev' ? '.w-carta-next' : '.w-carta-prev'); if (o) o.focus(); }
      }
      if (fresh && nDecoded() === N) finish();
      else if (fromStrip) showGloss();
    }

    function finish() {
      const msg = h('p', 'w-carta-done', esc(DATA.done));
      gloss.appendChild(msg);
      big.classList.remove('is-stamp');
      /* the wax stays empty until the stamp lands */
      if (!ctx.reduced) root.classList.remove('is-sealed');
      afterScroll(showSeal(), () => {
        if (!ctx.reduced) {
          root.classList.toggle('is-sealed', nDecoded() === N);
          void big.getBoundingClientRect();
          big.classList.add('is-stamp');
        }
        ctx.stamp('carta');
      });
    }

    function setMode(m) {
      if (m === mode) return;
      mode = m;
      ctx.store.set('mode', mode);
      renderAll(-1);
    }

    function replay() {
      decoded = {};
      current = -1;
      ctx.store.set('decoded', []);
      big.classList.remove('is-stamp');
      setRoving(0);
      renderAll(-1);
      wordBtns[0].focus();
    }

    setRoving(0);
    renderAll(-1);
  });
})();
