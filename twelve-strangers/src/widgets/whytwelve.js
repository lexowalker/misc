/* Exhibit: "Why twelve?" (Chapter V). Part A weighs five theories for the number twelve; Part B is a jury-size lab.
   Seal: 'twelve', awarded after the ruling is revealed and at least one jury has been drawn. */
(function () {
  'use strict';

  /* =====================================================================
     COPY AND FACTS. Everything the reader sees is here, so it is easy to correct.
     ===================================================================== */
  const DATA = {
    partA: {
      kicker: 'Part A',
      title: 'Five theories for twelve',
      intro: 'Mark each theory plausible or doubtful. Star a favorite if you have one. Then hear the ruling.'
    },
    theories: [
      {
        id: 'apostles', name: 'The twelve apostles', emblem: 'arc',
        text: 'Jesus told the twelve apostles they would sit on twelve thrones, judging the twelve tribes of Israel (Matthew 19:28). Twelve who judge, twelve jurors.',
        quote: 'If the twelve apostles on their twelve thrones must try us in our eternal state, good reason hath the law to appoint the number of twelve to try our temporal.',
        quoteBy: 'Giles Duncombe, *Tryals per Pais* (1665)',
        tag: 'A later gloss',
        record: 'No known medieval source ties the jury to the apostles. Writers reached for them centuries after twelve was fixed.'
      },
      {
        id: 'tribes', name: 'The twelve tribes', emblem: 'breastplate',
        text: 'Israel had twelve tribes, and the high priest’s breastplate carried twelve stones, one for each (Exodus 28). Sir Edward Coke listed the tribes and the stones among the twelves the law respects.',
        tag: 'A later gloss',
        record: 'Coke wrote in 1628, more than four centuries after Henry II’s twelves. The tribes are a reason found after the fact.'
      },
      {
        id: 'north', name: 'Norse and English custom', emblem: 'ring',
        text: 'Around 997, King Æthelred’s Wantage code told the twelve leading thegns of each wapentake, a Danelaw district, to swear on relics that they would accuse no innocent man and shield no guilty one. Norse law knew panels of twelve too.',
        tag: 'Old habit, link unproven',
        record: 'Twelve was a common size for sworn groups across the north before 1066. Historians still argue whether Æthelred’s thegns led to Henry II’s juries. The evidence between 997 and 1166 is thin.'
      },
      {
        id: 'dozen', name: 'A handy dozen', emblem: 'coins', speculative: true,
        text: 'Norman England counted twelve pence to the shilling. Twelve splits evenly into halves, thirds, quarters and sixths. In a world that counted by the dozen, twelve was a natural size for any group.',
        tag: 'Guesswork',
        record: 'A tidy idea with nothing behind it. No known medieval source links jurors to counting in dozens.'
      },
      {
        id: 'henry', name: 'Henry II’s habit', emblem: 'crown',
        text: 'Henry II’s reforms ran on twelves: twelve lawful men of each hundred to report crimes (1166), twelve neighbors to view disputed land, twelve knights to decide who had the better right to it.',
        tag: 'Where it stuck',
        record: 'The best-documented step. Royal writs made twelve routine, and the trial jury inherited it after 1215. Even so, no record says why Henry chose twelve.'
      }
    ],
    specLabel: 'Speculation',
    marks: { p: 'Plausible', d: 'Doubtful' },
    fav: 'Favorite',
    weighed: function (n) { return n + ' of 5 weighed'; },
    reveal: 'Hear the ruling',
    needAll: function (name) { return 'Weigh all five first. Still open: ' + name + '.'; },
    markedMsg: function (name, m, n) { return name + ': ' + m.toLowerCase() + '. ' + n + ' of 5 weighed.'; },
    ruling: {
      stamp: 'Nobody knows',
      lead: 'No medieval document explains the number. Twelve was already the habit for sworn panels under Henry II, who reigned 1154 to 1189. The trial jury inherited it, and sometime in the 1300s twelve became fixed.',
      cokePre: 'The reasons came later. In 1628 Sir Edward Coke wrote that the law',
      cokeQ: 'delighteth herself in the number of 12.',
      cokeCite: 'Coke on Littleton, fol. 155a',
      willPre: 'In 1970 the Supreme Court said the fixed number twelve',
      willQ: 'appears to have been a historical accident, unrelated to the great purposes which gave rise to the jury in the first place.',
      willPre2: 'Its conclusion: the precise number is',
      willQ2: 'wholly without significance ‘except to mystics.’',
      kian: 'In June 2026 the Court agreed to look again, in *Kian v. Florida*. The accident is back on the docket.',
      willCite: '*Williams v. Florida*, 399 U.S. 78 (1970), opinion of Justice White. “Except to mystics” is Justice Harlan’s phrase, from his dissent in *Duncan v. Louisiana* (1968).',
      quotesTitle: 'Coke and the Supreme Court',
      benchTitle: 'Your bench against the record',
      you: 'You',
      record: 'Record',
      tally: function (n) { return 'You found ' + n + ' of 5 plausible. The safest answer is plain custom: twelve was a habit before anyone explained it.'; },
      favNote: {
        apostles: 'Your favorite has a fine pedigree among later writers and no medieval evidence.',
        tribes: 'Your favorite was Coke’s. He wrote it down some 460 years after Henry II’s first twelves.',
        north: 'Your favorite has the earliest jury-like twelve in English law, around 997. The missing link is the century and a half after it.',
        dozen: 'Your favorite is tidy and untestable, which is the trouble with it.',
        henry: 'Your favorite is the best documented. It shows how twelve stuck, though not why.'
      },
      again: 'Weigh again'
    },

    partB: {
      kicker: 'Part B',
      title: 'Size lab',
      intro: 'Pick a jury size and a group’s share of the community. Then draw juries at random and see who sits.'
    },
    sizeLabel: 'Jury size',
    shareLabel: 'Group’s share of the community',
    shares: [0.1, 0.2, 0.3],
    min: 3, max: 15, start: 12,
    landmarks: [
      { n: 5, chip: 'Ballew' },
      { n: 6, chip: 'Williams' },
      { n: 12, chip: 'Common law' },
      { n: 15, chip: 'Scotland' }
    ],
    law: {
      low: { title: 'Too small', text: 'Since *Ballew v. Georgia* (1978), a US criminal jury that tries anything more than a petty offense needs at least six members.' },
      5: { title: '*Ballew v. Georgia*, 1978', text: 'Georgia tried a man for showing an obscene film, a misdemeanor, before five jurors. The Court held that five is too few to try any crime that is more than petty. Six is the floor.' },
      6: { title: '*Williams v. Florida*, 1970', text: 'The Court allowed six jurors in a Florida robbery trial. *Burch v. Louisiana* (1979) added that a six-person jury must be unanimous to convict of a serious crime. Florida still tries most felonies with six, and in June 2026 the Court agreed to decide whether that is enough (*Kian v. Florida*).' },
      mid: { title: 'Allowed', text: 'Arizona seats eight jurors unless the crime can bring death or 30 years or more. Federal civil juries can have six to twelve.' },
      12: { title: 'The common law number', text: 'Federal criminal juries have twelve under Rule 23 of the Federal Rules of Criminal Procedure, unless both sides agree in writing, with the court’s approval, to fewer.' },
      high: { title: 'Alternates only', text: 'In US courts, jurors beyond twelve are alternates. A federal criminal judge may seat up to six, who step in if a juror drops out.' },
      15: { title: 'Scotland', text: 'Scotland seats fifteen jurors in serious criminal trials, and no verdict need be unanimous. A bare majority of eight could once convict. Since January 2026 it takes ten, and the not proven verdict is gone.' }
    },
    ramos: 'Size is one question, agreement another. Since *Ramos v. Louisiana* (2020), a state conviction for a serious crime needs a unanimous jury. Louisiana and Oregon had allowed votes of 10 to 2.',
    lesson: 'Smaller juries cost less. The studies cited in *Ballew* suggested they also deliberate less well, reach less consistent verdicts, and are less likely to include anyone from a minority group.',
    ballewMath: 'Justice Blackmun’s opinion in *Ballew* cited this same arithmetic: with a group at 10 percent of the community, about 53 percent of six-person juries would include no one from it.',
    draw: 'Draw a jury',
    drawAgain: 'Draw again',
    chanceLabel: 'chance at least one sits',
    expLabel: 'expected from the group',
    drewMsg: function (k, n) {
      if (k === 0) return 'Drawn: ' + n + ' jurors, nobody from the group.';
      return 'Drawn: ' + n + ' jurors, ' + k + ' from the group.';
    },
    tallyMsg: function (draws, none, predicted) {
      return 'Draws at this setting: ' + draws + '. With nobody from the group: ' + none + ' (' + Math.round(100 * none / draws) + '%). The math predicts ' + predicted + '%.';
    },
    idle: 'The seats are empty. Draw a jury to fill them.',
    boxLabel: 'JURY BOX',
    legendG: 'From the group',
    legendO: 'Everyone else',
    sealReq: 'Seal',
    req1: 'Hear the ruling',
    req2: 'Draw a jury'
  };

  const NS = 'http://www.w3.org/2000/svg';
  const T = DATA.theories;
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function fmt(s) { return esc(s).replace(/\*([^*]+)\*/g, '<i>$1</i>'); }
  function h(tag, cls, html) { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
  function pct(x) { return Math.round(x * 100); }
  function chanceAtLeastOne(n, p) { return 1 - Math.pow(1 - p, n); }

  /* Every emblem has exactly twelve marks. */
  function emblem(kind) {
    let s = '';
    if (kind === 'arc') {
      for (let i = 0; i < 12; i++) {
        const t = (i / 11) * Math.PI;
        s += '<circle cx="' + (32 - 25 * Math.cos(t)).toFixed(1) + '" cy="' + (44 - 25 * Math.sin(t)).toFixed(1) + '" r="3.3"/>';
      }
      s += '<path d="M10 54 H54"/>';
    } else if (kind === 'breastplate') {
      s += '<rect class="w-wt-frame" x="15" y="5" width="34" height="54" rx="4"/>';
      for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) s += '<rect x="' + (19.5 + c * 9) + '" y="' + (10 + r * 12) + '" width="7" height="8" rx="1.5"/>';
    } else if (kind === 'ring') {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        s += '<circle cx="' + (32 + 23 * Math.cos(a)).toFixed(1) + '" cy="' + (32 + 23 * Math.sin(a)).toFixed(1) + '" r="3.6"/>';
      }
      s += '<rect class="w-wt-solid" x="28" y="28" width="8" height="8" rx="1"/>';
    } else if (kind === 'coins') {
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
        const x = 14 + c * 12, y = 18 + r * 14;
        s += '<circle cx="' + x + '" cy="' + y + '" r="5.2"/><path class="w-wt-thin" d="M' + (x - 2.6) + ' ' + y + ' H' + (x + 2.6) + ' M' + x + ' ' + (y - 2.6) + ' V' + (y + 2.6) + '"/>';
      }
    } else if (kind === 'crown') {
      s += '<path class="w-wt-frame" d="M20 21 L20 8 L26 13 L32 4 L38 13 L44 8 L44 21 Z"/>';
      for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) {
        const x = 12 + c * 8, y = 32 + r * 15;
        s += '<circle class="w-wt-solid" cx="' + x + '" cy="' + y + '" r="2.4"/><path d="M' + x + ' ' + (y + 4) + ' V' + (y + 10) + '"/>';
      }
    }
    return '<svg class="w-wt-em" viewBox="0 0 64 64" aria-hidden="true">' + s + '</svg>';
  }
  const STAR = '<svg class="w-wt-star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8 14.7 8.6 21 9.3 16.3 13.6 17.6 19.9 12 16.7 6.4 19.9 7.7 13.6 3 9.3 9.3 8.6Z"/></svg>';
  const TICK = '<svg class="w-wt-tick" viewBox="0 0 20 20" aria-hidden="true"><rect x="1.5" y="1.5" width="17" height="17" rx="3"/><path d="M5.5 10.5 8.6 13.5 14.5 6.5"/></svg>';

  TS.register('whytwelve', function (el, ctx) {
    const st = {
      marks: ctx.store.get('marks', {}) || {},
      fav: ctx.store.get('fav', null),
      revealed: !!ctx.store.get('revealed', false),
      drawn: !!ctx.store.get('drawn', false),
      idx: 0,
      n: ctx.store.get('n', DATA.start),
      p: ctx.store.get('p', 0.1),
      seats: null,
      draws: 0,
      none: 0,
      openQ: null,
      openB: null
    };
    if (!(st.n >= DATA.min && st.n <= DATA.max)) st.n = DATA.start;
    if (DATA.shares.indexOf(st.p) < 0) st.p = 0.1;
    const firstOpen = T.findIndex((t) => !st.marks[t.id]);
    st.idx = firstOpen < 0 ? 0 : firstOpen;

    const root = h('div', 'w-wt');
    el.appendChild(root);

    /* =================== PART A =================== */
    const partA = h('section', 'w-wt-part w-wt-a');
    partA.innerHTML = '<header class="w-wt-phead"><span class="w-wt-kicker">' + esc(DATA.partA.kicker) + '</span>' +
      '<h4 class="w-wt-ptitle">' + esc(DATA.partA.title) + '</h4><p class="w-wt-intro">' + esc(DATA.partA.intro) + '</p></header>';
    const tabs = h('div', 'w-wt-tabs');
    tabs.setAttribute('role', 'group');
    tabs.setAttribute('aria-label', 'Theories');
    const tabBtns = T.map((t, i) => {
      const b = h('button', 'w-wt-tab');
      b.type = 'button';
      b.innerHTML = '<span class="w-wt-tabn tnum">' + (i + 1) + '</span><span class="w-wt-tabm" aria-hidden="true"></span>';
      b.addEventListener('click', () => { st.idx = i; renderCard(true); });
      tabs.appendChild(b);
      return b;
    });
    partA.appendChild(tabs);

    const card = h('article', 'w-wt-card');
    card.innerHTML =
      '<div class="w-wt-chead"><div class="w-wt-emwrap"></div><div class="w-wt-ctitles"><span class="w-wt-cnum label"></span><h5 class="w-wt-cname"></h5></div></div>' +
      '<p class="w-wt-spec" hidden></p>' +
      '<p class="w-wt-ctext"></p>' +
      '<blockquote class="w-wt-cquote" hidden><p></p><footer></footer></blockquote>' +
      '<div class="w-wt-cact"></div>' +
      '<div class="w-wt-crecord" hidden><span class="w-wt-ctag"></span><p></p></div>';
    const cEm = card.querySelector('.w-wt-emwrap');
    const cNum = card.querySelector('.w-wt-cnum');
    const cName = card.querySelector('.w-wt-cname');
    const cSpec = card.querySelector('.w-wt-spec');
    const cText = card.querySelector('.w-wt-ctext');
    const cQuote = card.querySelector('.w-wt-cquote');
    const cRec = card.querySelector('.w-wt-crecord');
    const act = card.querySelector('.w-wt-cact');
    const markBtns = {};
    ['p', 'd'].forEach((m) => {
      const b = h('button', 'w-wt-mark w-wt-mark-' + m);
      b.type = 'button';
      b.textContent = DATA.marks[m];
      b.addEventListener('click', () => mark(m));
      markBtns[m] = b;
      act.appendChild(b);
    });
    const favBtn = h('button', 'w-wt-fav');
    favBtn.type = 'button';
    favBtn.innerHTML = STAR + '<span class="w-wt-favtext">' + esc(DATA.fav) + '</span>';
    favBtn.addEventListener('click', toggleFav);
    act.appendChild(favBtn);
    partA.appendChild(card);

    const revealRow = h('div', 'w-wt-revealrow');
    const weighed = h('p', 'w-wt-weighed tnum');
    const revealBtn = h('button', 'btn btn-seal w-wt-reveal');
    revealBtn.type = 'button';
    revealBtn.textContent = DATA.reveal;
    revealBtn.addEventListener('click', reveal);
    revealRow.appendChild(weighed);
    revealRow.appendChild(revealBtn);
    partA.appendChild(revealRow);
    const statusA = h('p', 'w-wt-status');
    statusA.setAttribute('aria-live', 'polite');
    partA.appendChild(statusA);
    const ruling = h('section', 'w-wt-ruling');
    ruling.hidden = true;
    partA.appendChild(ruling);
    /* The seal needs both parts: say so beside the ruling button and again beside the draw button. This copy sits
       after the ruling, so before the reveal it is just under the button, and after it the ruling leads into it. */
    const reqA = makeReq();
    partA.appendChild(reqA);
    root.appendChild(partA);

    /* =================== PART B =================== */
    const partB = h('section', 'w-wt-part w-wt-b');
    partB.innerHTML = '<header class="w-wt-phead"><span class="w-wt-kicker">' + esc(DATA.partB.kicker) + '</span>' +
      '<h4 class="w-wt-ptitle">' + esc(DATA.partB.title) + '</h4><p class="w-wt-intro">' + esc(DATA.partB.intro) + '</p></header>';
    const lab = h('div', 'w-wt-lab');
    partB.appendChild(lab);

    const controls = h('div', 'w-wt-controls');
    const sizeRow = h('div', 'w-wt-sizerow');
    const minus = h('button', 'w-wt-step', '−');
    minus.type = 'button';
    minus.setAttribute('aria-label', 'One fewer juror');
    const sizeOut = h('p', 'w-wt-size');
    const plus = h('button', 'w-wt-step', '+');
    plus.type = 'button';
    plus.setAttribute('aria-label', 'One more juror');
    sizeRow.appendChild(minus);
    sizeRow.appendChild(sizeOut);
    sizeRow.appendChild(plus);
    const sizeLbl = h('p', 'label w-wt-clabel', esc(DATA.sizeLabel));
    sizeLbl.id = 'w-wt-sizelbl';
    controls.appendChild(sizeLbl);
    controls.appendChild(sizeRow);
    const sliderWrap = h('div', 'w-wt-slider');
    const range = h('input', 'w-wt-range');
    range.type = 'range';
    range.min = DATA.min;
    range.max = DATA.max;
    range.step = 1;
    range.setAttribute('aria-labelledby', 'w-wt-sizelbl');
    sliderWrap.appendChild(range);
    const ticks = h('div', 'w-wt-ticks');
    ticks.setAttribute('aria-hidden', 'true');
    DATA.landmarks.forEach((lm) => {
      const t = h('span', 'w-wt-tickmark', '<i></i><b>' + lm.n + '</b>');
      t.style.setProperty('--f', ((lm.n - DATA.min) / (DATA.max - DATA.min)).toFixed(4));
      ticks.appendChild(t);
    });
    sliderWrap.appendChild(ticks);
    controls.appendChild(sliderWrap);
    const lmChips = h('div', 'chips w-wt-lmchips');
    lmChips.setAttribute('role', 'group');
    lmChips.setAttribute('aria-label', 'Landmark sizes');
    const lmBtns = DATA.landmarks.map((lm) => {
      const b = h('button', 'chip w-wt-lm', '<b class="tnum">' + lm.n + '</b> ' + esc(lm.chip));
      b.type = 'button';
      b.addEventListener('click', () => setN(lm.n));
      lmChips.appendChild(b);
      return b;
    });
    controls.appendChild(lmChips);
    controls.appendChild(h('p', 'label w-wt-clabel', esc(DATA.shareLabel)));
    const shareChips = h('div', 'chips w-wt-share');
    shareChips.setAttribute('role', 'group');
    shareChips.setAttribute('aria-label', DATA.shareLabel);
    const shareBtns = DATA.shares.map((p) => {
      const b = h('button', 'chip', pct(p) + '%');
      b.type = 'button';
      b.addEventListener('click', () => setP(p));
      shareChips.appendChild(b);
      return b;
    });
    controls.appendChild(shareChips);
    lab.appendChild(controls);

    const boxWrap = h('div', 'w-wt-boxwrap');
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 340 170');
    svg.setAttribute('class', 'w-wt-box');
    svg.setAttribute('role', 'img');
    boxWrap.appendChild(svg);
    const legend = h('p', 'w-wt-legend', '<span class="w-wt-key is-g"></span>' + esc(DATA.legendG) + '<span class="w-wt-key"></span>' + esc(DATA.legendO));
    legend.setAttribute('aria-hidden', 'true');
    boxWrap.appendChild(legend);
    const drawRow = h('div', 'w-wt-drawrow');
    const drawBtn = h('button', 'btn w-wt-draw');
    drawBtn.type = 'button';
    drawBtn.textContent = DATA.draw;
    drawBtn.addEventListener('click', draw);
    drawRow.appendChild(drawBtn);
    boxWrap.appendChild(drawRow);
    const resultB = h('div', 'w-wt-result');
    resultB.setAttribute('aria-live', 'polite');
    boxWrap.appendChild(resultB);
    const reqB = makeReq();
    boxWrap.appendChild(reqB);
    lab.appendChild(boxWrap);

    const mathBox = h('div', 'w-wt-math');
    mathBox.innerHTML =
      '<div class="w-wt-stats"><div class="w-wt-stat"><span class="w-wt-big tnum" data-k="chance"></span><span class="w-wt-slabel">' + esc(DATA.chanceLabel) + '</span></div>' +
      '<div class="w-wt-stat"><span class="w-wt-big tnum" data-k="exp"></span><span class="w-wt-slabel">' + esc(DATA.expLabel) + '</span></div></div>' +
      '<p class="w-wt-formula tnum"></p>' +
      '<div class="w-wt-bars" aria-hidden="true"></div>' +
      '<p class="w-wt-ballew">' + fmt(DATA.ballewMath) + '</p>';
    const bars = mathBox.querySelector('.w-wt-bars');
    const barEls = [];
    for (let n = DATA.min; n <= DATA.max; n++) {
      const isLm = DATA.landmarks.some((lm) => lm.n === n);
      const b = h('span', 'w-wt-bar' + (isLm ? ' is-lm' : ''), '<i></i><b class="tnum">' + n + '</b>');
      bars.appendChild(b);
      barEls.push(b);
    }
    lab.appendChild(mathBox);

    const lawBox = h('div', 'w-wt-law');
    lawBox.innerHTML = '<div class="w-wt-lawnow"><span class="w-wt-gavel" aria-hidden="true"><svg viewBox="0 0 32 32"><rect x="5" y="6" width="14" height="8" rx="2" transform="rotate(-35 12 10)"/><path d="M15 15 L26 26"/><path d="M4 28 H18"/></svg></span><div><h5 class="w-wt-lawtitle"></h5><p class="w-wt-lawtext"></p></div></div>' +
      '<p class="w-wt-ramos">' + fmt(DATA.ramos) + '</p><p class="w-wt-lesson">' + fmt(DATA.lesson) + '</p>';
    lab.appendChild(lawBox);
    root.appendChild(partB);


    function makeReq() {
      const r = h('div', 'w-wt-req');
      r.innerHTML = '<span class="label">' + esc(DATA.sealReq) + '</span><span class="w-wt-reqi" data-r="1">' + TICK + esc(DATA.req1) + '</span><span class="w-wt-reqi" data-r="2">' + TICK + esc(DATA.req2) + '</span>';
      return r;
    }

    /* =================== keeping what a tap reveals on screen =================== */
    /* The sticky ticker covers the top of the viewport. Scroll only in answer to a tap, and only when the target is
       under the ticker or below the fold. */
    function tickerBottom() {
      const t = document.querySelector('.ticker');
      const b = t ? t.getBoundingClientRect().bottom : 0;
      return b > 0 ? b : 0;
    }
    /* html may already pad its scroll by the ticker (scroll-padding-top); trim the margin so the gap under the ticker
       is 16px either way, never double. */
    function fitMargin(target) {
      let pad = 0;
      try { pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0; } catch (e) {}
      target.style.scrollMarginTop = Math.max(0, Math.round(tickerBottom() + 16 - pad)) + 'px';
    }
    /* block 'nearest': scroll when any part is hidden. block 'start': scroll when the top is hidden or sits in the
       lower half of the screen with the rest below the fold. */
    function show(target, block) {
      const r = target.getBoundingClientRect();
      if (!r.height) return false;
      const tb = tickerBottom(), vh = window.innerHeight;
      let need = r.top < tb - 1;
      if (!need && block === 'nearest') need = r.bottom > vh + 1;
      if (!need && block === 'start') need = r.bottom > vh + 1 && r.top > tb + (vh - tb) / 2;
      if (!need) return false;
      fitMargin(target);
      target.scrollIntoView({ block: block, behavior: ctx.reduced ? 'auto' : 'smooth' });
      return true;
    }
    function isPhone() {
      try { return window.matchMedia('(max-width: 40rem)').matches; } catch (e) { return false; }
    }

    /* =================== Part A behaviour =================== */
    function nMarked() { return T.filter((t) => st.marks[t.id]).length; }
    function saveA() { ctx.store.set('marks', st.marks); ctx.store.set('fav', st.fav); ctx.store.set('revealed', st.revealed); }

    function renderTabs() {
      T.forEach((t, i) => {
        const b = tabBtns[i];
        const m = st.marks[t.id];
        b.classList.toggle('is-cur', i === st.idx);
        b.classList.toggle('is-p', m === 'p');
        b.classList.toggle('is-d', m === 'd');
        b.classList.toggle('is-fav', st.fav === t.id);
        if (i === st.idx) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
        b.setAttribute('aria-label', 'Theory ' + (i + 1) + ', ' + t.name + (m ? ', marked ' + DATA.marks[m].toLowerCase() : ', not yet weighed') + (st.fav === t.id ? ', favorite' : ''));
        b.querySelector('.w-wt-tabm').textContent = m === 'p' ? 'P' : m === 'd' ? 'D' : '';
      });
      const n = nMarked();
      weighed.textContent = DATA.weighed(n);
      revealBtn.classList.toggle('is-ready', n === T.length && !st.revealed);
    }

    function fillCard(idx) {
      const t = T[idx];
      cEm.innerHTML = emblem(t.emblem);
      cNum.textContent = 'Theory ' + (idx + 1) + ' of 5';
      cName.textContent = t.name;
      cSpec.hidden = !t.speculative;
      cSpec.textContent = DATA.specLabel;
      cText.textContent = t.text;
      if (t.quote) {
        cQuote.hidden = false;
        cQuote.querySelector('p').textContent = '“' + t.quote + '”';
        cQuote.querySelector('footer').innerHTML = fmt(t.quoteBy);
      } else cQuote.hidden = true;
      const m = st.marks[t.id];
      markBtns.p.setAttribute('aria-pressed', String(m === 'p'));
      markBtns.d.setAttribute('aria-pressed', String(m === 'd'));
      favBtn.setAttribute('aria-pressed', String(st.fav === t.id));
      favBtn.setAttribute('aria-label', 'Favorite: ' + t.name);
      cRec.hidden = !st.revealed;
      cRec.querySelector('.w-wt-ctag').textContent = t.tag;
      cRec.querySelector('p').textContent = t.record;
      card.classList.toggle('is-spec', !!t.speculative);
      card.dataset.tag = t.id;
    }

    /* Every card gets the height of the tallest, so the mark buttons (pinned to the bottom) do not jump under the
       thumb when the next theory slides in. Measured, because the tallest depends on width, fonts and the ruling. */
    let cardW = 0;
    function sizeCard() {
      card.style.minHeight = '';
      if (!card.offsetWidth) return;
      let max = 0;
      T.forEach((t, i) => { fillCard(i); max = Math.max(max, card.getBoundingClientRect().height); });
      fillCard(st.idx);
      cardW = card.offsetWidth;
      card.style.minHeight = Math.ceil(max) + 'px';
    }

    function renderCard(anim) {
      fillCard(st.idx);
      if (anim && !ctx.reduced) { card.classList.remove('is-in'); void card.offsetWidth; card.classList.add('is-in'); }
      renderTabs();
    }

    let advanceTimer = null;
    function mark(m) {
      const t = T[st.idx];
      const wasAll = nMarked() === T.length;
      st.marks[t.id] = m;
      saveA();
      renderCard(false);
      statusA.textContent = DATA.markedMsg(t.name, DATA.marks[m], nMarked());
      clearTimeout(advanceTimer);
      const next = T.findIndex((x, i) => i > st.idx && !st.marks[x.id]);
      const wrap = next < 0 ? T.findIndex((x) => !st.marks[x.id]) : next;
      if (wrap >= 0 && !st.revealed) {
        const y0 = window.scrollY;
        advanceTimer = setTimeout(() => {
          st.idx = wrap;
          renderCard(true);
          if (Math.abs(window.scrollY - y0) < 48) show(card, 'nearest');
        }, ctx.reduced ? 150 : 450);
      } else if (!wasAll && nMarked() === T.length && !st.revealed) {
        /* all five weighed: the next step is the ruling button, with the seal checklist under it */
        show(reqA, 'nearest');
      }
    }

    function toggleFav() {
      const t = T[st.idx];
      st.fav = st.fav === t.id ? null : t.id;
      saveA();
      renderCard(false);
      if (st.revealed) renderRuling();
    }

    function renderRuling() {
      const R = DATA.ruling;
      const nP = T.filter((t) => st.marks[t.id] === 'p').length;
      /* On a phone the quotes and the bench table fold away behind toggles; wider screens open them. */
      const wide = !isPhone();
      const openQ = st.openQ == null ? wide : st.openQ;
      const openB = st.openB == null ? wide : st.openB;
      ruling.innerHTML =
        '<div class="w-wt-rstamp" tabindex="-1">' + esc(R.stamp) + '</div>' +
        '<p class="w-wt-rlead">' + esc(R.lead) + '</p>' +
        '<details class="w-wt-more" data-k="q"' + (openQ ? ' open' : '') + '><summary><span class="w-wt-moretitle">' + esc(R.quotesTitle) + '</span></summary><div class="w-wt-morebody">' +
        '<figure class="w-wt-rq"><blockquote><p>' + esc(R.cokePre) + ' <q>' + esc(R.cokeQ) + '</q></p></blockquote><figcaption>' + esc(R.cokeCite) + '</figcaption></figure>' +
        '<figure class="w-wt-rq"><blockquote><p>' + esc(R.willPre) + ' <q>' + esc(R.willQ) + '</q> ' + esc(R.willPre2) + ' <q>' + esc(R.willQ2) + '</q></p></blockquote><figcaption>' + fmt(R.willCite) + '</figcaption></figure>' +
        '<p class="w-wt-kian">' + fmt(R.kian) + '</p></div></details>' +
        '<details class="w-wt-more" data-k="b"' + (openB ? ' open' : '') + '><summary><span class="w-wt-moretitle">' + esc(R.benchTitle) + '</span></summary><div class="w-wt-morebody">' +
        '<ul class="w-wt-bench">' + T.map((t) => {
          const m = st.marks[t.id];
          return '<li><span class="w-wt-bname">' + (st.fav === t.id ? STAR : '') + esc(t.name) + '</span>' +
            '<span class="w-wt-byou w-wt-mk-' + (m || 'x') + '"><i>' + esc(R.you) + '</i> ' + esc(m ? DATA.marks[m] : 'none') + '</span>' +
            '<span class="w-wt-brec"><i>' + esc(R.record) + '</i> ' + esc(t.tag) + '</span></li>';
        }).join('') + '</ul></div></details>' +
        '<p class="w-wt-rtally">' + esc(R.tally(nP)) + (st.fav ? ' ' + esc(R.favNote[st.fav]) : '') + '</p>';
      const again = h('button', 'btn btn-ghost btn-small w-wt-again');
      again.type = 'button';
      again.textContent = R.again;
      again.addEventListener('click', weighAgain);
      ruling.appendChild(again);
      ruling.querySelectorAll('.w-wt-more').forEach((d) => {
        d.addEventListener('toggle', () => {
          if (d.dataset.k === 'q') st.openQ = d.open; else st.openB = d.open;
          if (d.open) show(d, 'nearest');
        });
      });
    }

    function reveal() {
      const open = T.findIndex((t) => !st.marks[t.id]);
      if (open >= 0) {
        st.idx = open;
        renderCard(true);
        statusA.textContent = DATA.needAll(T[open].name);
        show(card, 'nearest');
        return;
      }
      clearTimeout(advanceTimer);
      const first = !st.revealed;
      st.revealed = true;
      saveA();
      renderRuling();
      ruling.hidden = false;
      revealBtn.hidden = true;
      if (first && !ctx.reduced) { ruling.classList.remove('is-in'); void ruling.offsetWidth; ruling.classList.add('is-in'); }
      sizeCard();
      renderCard(false);
      statusA.textContent = '';
      const stamp = ruling.querySelector('.w-wt-rstamp');
      if (stamp) stamp.focus({ preventScroll: true });
      show(ruling, 'start');
      checkSeal();
    }

    function weighAgain() {
      st.marks = {};
      st.fav = null;
      st.revealed = false;
      saveA();
      ruling.hidden = true;
      revealBtn.hidden = false;
      st.idx = 0;
      sizeCard();
      renderCard(true);
      tabBtns[0].focus({ preventScroll: true });
      show(tabs, 'start');
    }

    /* =================== Part B behaviour =================== */
    function seatPos(n) {
      const back = Math.ceil(n / 2), front = n - back, s = 38;
      const out = [];
      for (let i = 0; i < back; i++) out.push({ x: 170 + (i - (back - 1) / 2) * s, y: 58, row: 0 });
      for (let i = 0; i < front; i++) out.push({ x: 170 + (i - (front - 1) / 2) * s, y: 104, row: 1 });
      return out;
    }

    function juror(p, g, delay) {
      const cls = 'w-wt-juror' + (g ? ' is-g' : '') + (delay != null ? ' is-pop' : '');
      const style = delay != null ? ' style="animation-delay:' + delay + 'ms"' : '';
      return '<g class="' + cls + '"' + style + '><path d="M' + (p.x - 12) + ' ' + (p.y + 11) + ' C' + (p.x - 12) + ' ' + (p.y - 4) + ' ' + (p.x + 12) + ' ' + (p.y - 4) + ' ' + (p.x + 12) + ' ' + (p.y + 11) + ' Z"/>' +
        '<circle cx="' + p.x + '" cy="' + (p.y - 13) + '" r="7"/>' + (g ? '<circle class="w-wt-badge" cx="' + p.x + '" cy="' + (p.y + 4) + '" r="2.4"/>' : '') + '</g>';
    }

    function renderBox(animate) {
      const n = st.n;
      const pos = seatPos(n);
      const filled = st.seats && st.seats.length === n;
      let s = '';
      const chair = (p) => '<rect class="w-wt-chair' + (filled ? ' is-taken' : '') + '" x="' + (p.x - 14) + '" y="' + (p.y - 25) + '" width="28" height="32" rx="6"/>';
      pos.forEach((p, i) => { if (p.row === 0) { s += chair(p); if (filled) s += juror(p, st.seats[i], animate ? i * Math.min(38, 520 / n) : null); } });
      s += '<rect class="w-wt-tier" x="12" y="74" width="316" height="9" rx="2"/>';
      pos.forEach((p, i) => { if (p.row === 1) { s += chair(p); if (filled) s += juror(p, st.seats[i], animate ? i * Math.min(38, 520 / n) : null); } });
      s += '<rect class="w-wt-panel" x="6" y="118" width="328" height="46" rx="3"/>';
      s += '<rect class="w-wt-rail" x="2" y="113" width="336" height="7" rx="2"/>';
      for (let k = 0; k < 6; k++) s += '<rect class="w-wt-inset" x="' + (14 + k * 53.5) + '" y="125" width="44.5" height="32" rx="2"/>';
      s += '<rect class="w-wt-plaque" x="113" y="129" width="114" height="24" rx="2"/><text class="w-wt-plaquetext" x="170" y="146" text-anchor="middle">' + esc(DATA.boxLabel) + '</text>';
      svg.innerHTML = s;
      const k = filled ? st.seats.filter(Boolean).length : 0;
      svg.setAttribute('aria-label', 'A jury box with ' + n + ' seats' + (filled ? ', ' + k + ' filled by members of the group' : ', all empty') + '.');
    }

    function renderMath() {
      const n = st.n, p = st.p;
      const P = chanceAtLeastOne(n, p);
      mathBox.querySelector('[data-k="chance"]').textContent = pct(P) + '%';
      mathBox.querySelector('[data-k="exp"]').textContent = (n * p).toFixed(1);
      mathBox.querySelector('.w-wt-formula').innerHTML = '1 − (1 − ' + p.toFixed(1) + ')<sup>' + n + '</sup> = ' + P.toFixed(3) + ' &nbsp;·&nbsp; ' + n + ' × ' + p.toFixed(1) + ' = ' + (n * p).toFixed(1);
      barEls.forEach((b, i) => {
        const nn = DATA.min + i;
        b.querySelector('i').style.height = (chanceAtLeastOne(nn, p) * 100).toFixed(1) + '%';
        b.classList.toggle('is-cur', nn === n);
      });
      mathBox.querySelector('.w-wt-ballew').hidden = !(p === 0.1);
    }

    function lawFor(n) {
      const L = DATA.law;
      if (L[n]) return L[n];
      if (n < 5) return L.low;
      if (n < 12) return L.mid;
      return L.high;
    }

    function renderControls() {
      range.value = st.n;
      range.setAttribute('aria-valuetext', st.n + ' jurors');
      range.style.setProperty('--f', ((st.n - DATA.min) / (DATA.max - DATA.min)).toFixed(4));
      sizeOut.innerHTML = '<b class="tnum">' + st.n + '</b> jurors';
      minus.disabled = st.n <= DATA.min;
      plus.disabled = st.n >= DATA.max;
      lmBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(DATA.landmarks[i].n === st.n)));
      shareBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(DATA.shares[i] === st.p)));
      const L = lawFor(st.n);
      lawBox.querySelector('.w-wt-lawtitle').innerHTML = '<span class="tnum">' + st.n + '</span> · ' + fmt(L.title);
      lawBox.querySelector('.w-wt-lawtext').innerHTML = fmt(L.text);
    }

    function renderResult(k) {
      if (!st.seats) {
        resultB.innerHTML = '<p class="w-wt-idle">' + esc(DATA.idle) + '</p>';
        return;
      }
      const predicted = pct(Math.pow(1 - st.p, st.n));
      resultB.innerHTML = '<p class="w-wt-drew' + (k === 0 ? ' is-none' : '') + '">' + esc(DATA.drewMsg(k, st.n)) + '</p>' +
        '<p class="w-wt-tally">' + esc(DATA.tallyMsg(st.draws, st.none, predicted)) + '</p>';
    }

    function resetDraws() { st.seats = null; st.draws = 0; st.none = 0; drawBtn.textContent = DATA.draw; }

    function setN(n) {
      n = Math.max(DATA.min, Math.min(DATA.max, n));
      if (n === st.n) return;
      st.n = n;
      ctx.store.set('n', n);
      resetDraws();
      renderControls(); renderBox(false); renderMath(); renderResult();
    }
    function setP(p) {
      if (p === st.p) return;
      st.p = p;
      ctx.store.set('p', p);
      resetDraws();
      renderControls(); renderBox(false); renderMath(); renderResult();
    }

    function draw() {
      const seats = [];
      for (let i = 0; i < st.n; i++) seats.push(ctx.rand() < st.p);
      st.seats = seats;
      const k = seats.filter(Boolean).length;
      st.draws++;
      if (k === 0) st.none++;
      drawBtn.textContent = DATA.drawAgain;
      renderBox(!ctx.reduced);
      renderResult(k);
      if (!st.drawn) { st.drawn = true; ctx.store.set('drawn', true); }
      checkSeal();
      show(reqB, 'nearest');
    }

    range.addEventListener('input', () => setN(+range.value));
    minus.addEventListener('click', () => setN(st.n - 1));
    plus.addEventListener('click', () => setN(st.n + 1));

    function renderReq() {
      [reqA, reqB].forEach((req) => {
        req.querySelector('[data-r="1"]').classList.toggle('is-done', st.revealed);
        req.querySelector('[data-r="2"]').classList.toggle('is-done', st.drawn);
        req.classList.toggle('is-done', st.revealed && st.drawn);
      });
    }

    function checkSeal() {
      renderReq();
      if (st.revealed && st.drawn) ctx.stamp('twelve');
    }

    /* =================== first render =================== */
    renderCard(false);
    if (st.revealed) { renderRuling(); ruling.hidden = false; revealBtn.hidden = true; }
    renderControls();
    renderBox(false);
    renderMath();
    renderResult();
    renderReq();
    sizeCard();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(sizeCard);
    if ('ResizeObserver' in window) {
      new ResizeObserver(() => { if (card.offsetWidth && card.offsetWidth !== cardW) sizeCard(); }).observe(partA);
    }
  });
})();
