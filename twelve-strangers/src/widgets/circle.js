/* Exhibit: "Everyone knows everyone" (Chapter I). A speculative reconstruction of a village judging one of its own.
   Seal: 'circle', awarded when the circle settles the case. */
(function () {
  'use strict';

  /* =====================================================================
     COPY AND FACTS. Everything the reader sees is here, so it is easy to correct.
     The people and the dispute are invented. Only the closing note makes a claim
     about the real past, and it is labeled as speculation.
     ===================================================================== */
  var DATA = {
    recon: 'A reconstruction, not a record',
    caseKicker: 'The matter of the missing honey',
    caseText: 'Sura found a wild hive in the old oak. Each of the four families was owed one share at the feast. At first light, the Oak family\'s share was gone. Ketta of Oak accuses Pell of River.',
    prompt: 'Tap anyone in the circle. Start with Pell, the accused, or with Ketta, who accuses him.',
    need: 5,
    houses: {
      river: 'River family',
      oak: 'Oak family',
      reed: 'Reed family',
      hill: 'Hill family'
    },
    tags: {
      accused: 'Accused',
      accuser: 'Accuser',
      kin: 'Kin',
      witness: 'Witness',
      grudge: 'Grudge',
      reputation: 'Reputation'
    },
    weighs: {
      party: 'A party to the quarrel',
      'for': 'Weighs for Pell',
      against: 'Weighs against Pell',
      mixed: 'Cuts both ways',
      spite: 'Spite. Weigh it lightly.'
    },
    /* Seat order, clockwise from the top. Even seats sit in the outer ring, odd seats in the inner ring. */
    seats: ['pell', 'tobin', 'ora', 'esk', 'lio', 'ude', 'sura', 'gali', 'coro', 'dov',
            'ketta', 'faro', 'remi', 'nessa', 'vela', 'hesk', 'imi', 'bekk', 'tam', 'mara'],
    people: {
      pell:  { name: 'Pell',  house: 'river', tag: 'accused', weighs: 'party',
               how: 'He is the one accused.',
               says: 'I took two combs. One was River\'s share. The other pays for the net Dov lost in the flood. Oak never made that right, so I did.' },
      ketta: { name: 'Ketta', house: 'oak', tag: 'accuser', weighs: 'party',
               how: 'It was her family\'s share.',
               says: 'Our share was gone at first light. Debts get settled here at the fire, in front of everyone. Nobody settles them in the dark with sticky hands.' },
      mara:  { name: 'Mara',  house: 'river', tag: 'kin', weighs: 'for',
               how: 'She is his mother.',
               says: 'He fed half the riverbank in the hungry winter. He took that honey to make a point, because nobody would listen about the net.' },
      tobin: { name: 'Tobin', house: 'river', tag: 'kin', weighs: 'for',
               how: 'His cousin. He was with Pell at dusk.',
               says: 'He told me he would explain it all at the feast. He was angry. He was never hiding.' },
      tam:   { name: 'Tam',   house: 'river', tag: 'kin', weighs: 'for',
               how: 'His little sister.',
               says: 'This morning he gave half that comb to the Reed children. A real thief keeps what he steals.' },
      dov:   { name: 'Dov',   house: 'oak', tag: 'kin', weighs: 'against',
               how: 'Ketta\'s brother. He borrowed the net.',
               says: 'The flood took that net. Blame the river. Pell had no right to help himself to our share.' },
      faro:  { name: 'Faro',  house: 'oak', tag: 'kin', weighs: 'against',
               how: 'Ketta\'s husband.',
               says: 'Our little ones will sit at the feast with no honey. Whatever a net is worth, it is worth less than that.' },
      coro:  { name: 'Coro',  house: 'oak', tag: 'grudge', weighs: 'spite',
               how: 'He has never liked the River families.',
               says: 'River folk think they own the river. Now they think they own the bees.' },
      esk:   { name: 'Esk',   house: 'reed', tag: 'witness', weighs: 'against',
               how: 'He saw it himself.',
               says: 'At dusk I saw Pell walk away from the old oak with two combs wrapped in leaves. He walked fast. He would not meet my eye.' },
      ora:   { name: 'Ora',   house: 'reed', tag: 'witness', weighs: 'for',
               how: 'She watched the flood.',
               says: 'I saw Dov\'s borrowed net go down the river in the flood. Pell\'s father wove that net. It took him a whole season.' },
      lio:   { name: 'Lio',   house: 'reed', tag: 'grudge', weighs: 'spite',
               how: 'Pell beat him in the spring footrace.',
               says: 'He laughed when he won. A man who laughs like that would steal honey.' },
      ude:   { name: 'Ude',   house: 'reed', tag: 'grudge', weighs: 'spite',
               how: 'Ketta\'s family turned down his son\'s marriage gift.',
               says: 'If Pell took Oak\'s honey, the bees have good taste.' },
      sura:  { name: 'Sura',  house: 'reed', tag: 'witness', weighs: 'against',
               how: 'She found the hive.',
               says: 'I found the hive and marked it for all four families. Four shares. Two of them went the same way.' },
      gali:  { name: 'Gali',  house: 'reed', tag: 'reputation', weighs: 'for',
               how: 'Pell helped rebuild her house.',
               says: 'When my roof fell in, Pell was first up the ladder. He never asked for a thing.' },
      remi:  { name: 'Remi',  house: 'hill', tag: 'witness', weighs: 'against',
               how: 'He followed the trail at first light.',
               says: 'Honey drips on the path, all the way to the River houses. The ants found them before I did.' },
      nessa: { name: 'Nessa', house: 'hill', tag: 'reputation', weighs: 'mixed',
               how: 'The eldest. She has watched him since he was born.',
               says: 'That boy keeps every promise he makes. Some of them he keeps crooked.' },
      vela:  { name: 'Vela',  house: 'hill', tag: 'reputation', weighs: 'mixed',
               how: 'She trades with both families.',
               says: 'Oak always says it will repay. Pell always says he was owed. Both are telling the truth, a little.' },
      hesk:  { name: 'Hesk',  house: 'hill', tag: 'witness', weighs: 'for',
               how: 'He overheard them argue.',
               says: 'Last moon I heard Dov promise to replace the net after the harvest. The harvest came. The net did not.' },
      imi:   { name: 'Imi',   house: 'hill', tag: 'reputation', weighs: 'against',
               how: 'She grew up next door to him.',
               says: 'As a boy he raided the nests the elders told us to leave. He has always taken first and asked later.' },
      bekk:  { name: 'Bekk',  house: 'hill', tag: 'grudge', weighs: 'spite',
               how: 'His grandfather told him. Every winter.',
               says: 'That family has been light-fingered since Pell\'s grandfather moved our boundary stone. I saw nothing last night. I do not need to.' }
    },
    /* Ties drawn across the circle: kin, trade, friend, grudge. 'dispute' is the live quarrel. */
    ties: [
      ['pell', 'mara', 'kin'], ['pell', 'tobin', 'kin'], ['mara', 'tam', 'kin'], ['ketta', 'dov', 'kin'], ['ketta', 'faro', 'kin'],
      ['dov', 'coro', 'kin'], ['mara', 'nessa', 'kin'], ['ora', 'esk', 'kin'], ['lio', 'ude', 'kin'], ['remi', 'sura', 'kin'],
      ['vela', 'hesk', 'kin'], ['imi', 'bekk', 'kin'],
      ['pell', 'dov', 'trade'], ['tobin', 'gali', 'trade'], ['ora', 'coro', 'trade'], ['sura', 'ketta', 'trade'],
      ['hesk', 'faro', 'trade'], ['esk', 'imi', 'trade'], ['tam', 'vela', 'trade'], ['remi', 'lio', 'trade'],
      ['pell', 'gali', 'friend'], ['ketta', 'nessa', 'friend'], ['tobin', 'lio', 'friend'], ['sura', 'mara', 'friend'],
      ['faro', 'esk', 'friend'], ['vela', 'ora', 'friend'], ['hesk', 'ude', 'friend'], ['tam', 'remi', 'friend'],
      ['bekk', 'pell', 'grudge'], ['lio', 'pell', 'grudge'], ['coro', 'mara', 'grudge'], ['ude', 'ketta', 'grudge'], ['imi', 'gali', 'grudge'],
      ['pell', 'ketta', 'dispute']
    ],
    legendTies: [['kin', 'Kin'], ['trade', 'Trade'], ['friend', 'Friends'], ['grudge', 'Grudge']],
    legendHouses: [['river', 'River'], ['oak', 'Oak'], ['reed', 'Reed'], ['hill', 'Hill']],
    decide: 'Decide together',
    needMore: function (n) { return 'Hear ' + n + ' more ' + (n === 1 ? 'villager' : 'villagers') + ' first'; },
    ready: 'The circle is ready',
    question: 'You speak first. What do you say at the fire?',
    proposals: [
      { id: 'exile', label: 'Cast him out',
        reply: 'Mara stands. So do Tobin and Tam. If Pell goes, his family goes with him, and so do the best hands at the fish weir. Nobody splits the village over two combs of honey.' },
      { id: 'repair', label: 'Make it right',
        reply: 'Heads nod around the fire. Even Bekk grunts. It is what the circle was going to say anyway.' },
      { id: 'drop', label: 'Let it go',
        reply: 'The Oak family goes quiet. A grudge left alone grows. By next moon it is a fight, and fights here spread through every family.' }
    ],
    settleStamp: 'Settled at the fire',
    settleTitle: 'The circle settles on repair',
    settleItems: [
      { icon: 'comb', head: 'Give it back', text: 'Pell returns Oak\'s comb and adds a basket of smoked fish.' },
      { icon: 'net', head: 'Clear the old debt', text: 'Dov owns up to the lost net. Oak will weave River a new one before the rains.' },
      { icon: 'voice', head: 'Say sorry', text: 'Pell apologizes at the fire, where everyone can hear it.' },
      { icon: 'pot', head: 'Eat together', text: 'River and Oak cook the feast side by side.' }
    ],
    missedNet: 'You never heard about the net. Pell, Dov, Ora and Hesk all knew. In a village, someone always knows the story behind the story.',
    heardNet: 'Only people who knew the history could see the net behind the honey.',
    lessons: [
      ['The whole group judged.', 'There was no outsider to hand the case to.'],
      ['Reputation was the evidence.', 'Everyone knew who kept promises, and who carried grudges.'],
      ['Peace mattered more than punishment.', 'Tomorrow they all still share the river.']
    ],
    note: 'Speculation. The people and the quarrel are invented. The pattern is drawn from how anthropologists describe disputes in small communities: talk it out in public, pay something back, and keep exile as a last resort.',
    replay: 'Hear it again'
  };

  var NS = 'http://www.w3.org/2000/svg';
  var R_OUT = 42.2, R_IN = 28.6; // ring radii, percent of the stage width

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function seatPos(k) {
    var a = (-90 + 18 * k) * Math.PI / 180;
    var r = k % 2 === 0 ? R_OUT : R_IN;
    return { x: 50 + r * Math.cos(a), y: 50 + r * Math.sin(a) };
  }

  var FIGURE = '<svg class="w-circle-fig" viewBox="0 0 20 14" aria-hidden="true"><circle cx="10" cy="4" r="3.3"/><path d="M3 14c0-4 3-6.6 7-6.6s7 2.6 7 6.6z"/></svg>';

  var ICONS = {
    comb: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M10 5l5 3v6l-5 3-5-3V8zM22 5l5 3v6l-5 3-5-3V8zM16 15l5 3v6l-5 3-5-3v-6z"/></svg>',
    net: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 6h22M5 6l4 20M27 6l-4 20M9 26h14M11 6l1.5 20M16 6v20M21 6l-1.5 20M6.3 12h19.4M7.5 19h17"/></svg>',
    voice: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="11" cy="14" r="5"/><path d="M3 28c0-5 3.5-8 8-8s8 3 8 8M20 9c2 1.5 3 3.2 3 5s-1 3.5-3 5M24 6c3 2.4 4.5 5 4.5 8s-1.5 5.6-4.5 8"/></svg>',
    pot: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 14h20c0 7-4 12-10 12S6 21 6 14zM4 14h24M12 9c0-2 2-2 2-4M18 9c0-2 2-2 2-4M9 29h14"/></svg>'
  };

  TS.register('circle', function (el, ctx) {
    var people = DATA.people;
    var heard = {};
    var heardCount = 0;
    var ledger = { 'for': 0, against: 0, mixed: 0, spite: 0 };
    var active = null;
    var settled = false;

    /* ---------- build ---------- */
    var seatsHtml = DATA.seats.map(function (id, k) {
      var p = people[id], pos = seatPos(k);
      return '<button type="button" class="w-circle-seat" data-id="' + id + '" data-house="' + p.house + '" data-tag="' + p.tag + '"' +
        ' style="left:' + pos.x.toFixed(2) + '%;top:' + pos.y.toFixed(2) + '%">' + FIGURE +
        '<span class="w-circle-name">' + esc(p.name) + '</span><span class="w-circle-dot" aria-hidden="true"></span></button>';
    }).join('');

    var legendTies = DATA.legendTies.map(function (t) {
      return '<span class="w-circle-key"><svg viewBox="0 0 26 8" aria-hidden="true"><line class="w-circle-tie t-' + t[0] + '" x1="1" y1="4" x2="25" y2="4"/></svg>' + t[1] + '</span>';
    }).join('');
    var legendHouses = DATA.legendHouses.map(function (h) {
      return '<span class="w-circle-key"><span class="w-circle-ring" data-house="' + h[0] + '" aria-hidden="true"></span>' + h[1] + '</span>';
    }).join('');

    el.innerHTML =
      '<div class="w-circle">' +
        '<div class="w-circle-top">' +
          '<p class="w-circle-recon">' + esc(DATA.recon) + '</p>' +
          '<p class="w-circle-kicker">' + esc(DATA.caseKicker) + '</p>' +
          '<p class="w-circle-case">' + esc(DATA.caseText) + '</p>' +
        '</div>' +
        '<div class="w-circle-main">' +
        '<div class="w-circle-left">' +
        '<div class="w-circle-stage" role="group" aria-label="Twenty villagers seated in two rings around a fire. Lines between them show kin, trade, friendship and grudges.">' +
          '<svg class="w-circle-web" viewBox="0 0 400 400" aria-hidden="true">' +
            '<defs><radialGradient id="w-circle-glow-grad"><stop offset="0" class="w-circle-glow-a"/><stop offset="1" class="w-circle-glow-b"/></radialGradient></defs>' +
            '<circle class="w-circle-glow" cx="200" cy="200" r="78" fill="url(#w-circle-glow-grad)"/>' +
            '<g class="w-circle-lines"></g>' +
            '<g class="w-circle-fire" transform="translate(200 196)">' +
              '<ellipse class="w-circle-stones" cx="0" cy="22" rx="30" ry="8"/>' +
              '<path class="w-circle-log" d="M-24 22L20 12M-20 12L24 22"/>' +
              '<g class="w-circle-flames">' +
                '<path class="w-circle-flame f1" d="M0-30C8-18 20-10 18 4 17 16 9 21 0 21S-17 16-18 4C-19-8-6-12 0-30z"/>' +
                '<path class="w-circle-flame f2" d="M2-16C8-8 13-2 12 7 11 15 6 19 0 19S-11 15-11 7C-11-1-3-4 2-16z"/>' +
                '<path class="w-circle-flame f3" d="M0-4C4 1 7 5 6 11 5 16 3 18 0 18S-6 16-6 11C-6 6-2 3 0-4z"/>' +
              '</g>' +
            '</g>' +
          '</svg>' +
          seatsHtml +
          '<p class="w-circle-count" aria-hidden="true"><b class="tnum">0</b> heard</p>' +
        '</div>' +
        '<div class="w-circle-legend" aria-hidden="true"><div>' + legendTies + '</div><div>' + legendHouses + '</div></div>' +
        '</div>' +
        '<div class="w-circle-right">' +
        '<div class="w-circle-card" aria-live="polite"></div>' +
        '<div class="w-circle-ledger" aria-label="Testimony heard so far"></div>' +
        '<div class="w-circle-actions">' +
          '<button type="button" class="btn w-circle-decide" disabled>' + esc(DATA.decide) + '</button>' +
          '<span class="w-circle-need"></span>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '<div class="w-circle-proposals" hidden>' +
          '<p class="w-circle-q">' + esc(DATA.question) + '</p>' +
          '<div class="w-circle-options">' + DATA.proposals.map(function (p) {
            return '<button type="button" class="btn btn-ghost w-circle-opt" data-id="' + p.id + '" aria-pressed="false">' + esc(p.label) + '</button>';
          }).join('') + '</div>' +
        '</div>' +
        '<div class="w-circle-outcome" aria-live="polite"></div>' +
      '</div>';

    var root = el.querySelector('.w-circle');
    var stage = el.querySelector('.w-circle-stage');
    var linesG = el.querySelector('.w-circle-lines');
    var card = el.querySelector('.w-circle-card');
    var ledgerEl = el.querySelector('.w-circle-ledger');
    var decideBtn = el.querySelector('.w-circle-decide');
    var needEl = el.querySelector('.w-circle-need');
    var propEl = el.querySelector('.w-circle-proposals');
    var outEl = el.querySelector('.w-circle-outcome');
    var countEl = el.querySelector('.w-circle-count b');
    var seatEls = {};
    Array.prototype.forEach.call(el.querySelectorAll('.w-circle-seat'), function (b) { seatEls[b.dataset.id] = b; });

    /* lines */
    var seatIndex = {};
    DATA.seats.forEach(function (id, k) { seatIndex[id] = k; });
    var lineEls = DATA.ties.map(function (t) {
      var a = seatPos(seatIndex[t[0]]), b = seatPos(seatIndex[t[1]]);
      var ln = document.createElementNS(NS, 'line');
      ln.setAttribute('x1', (a.x * 4).toFixed(1)); ln.setAttribute('y1', (a.y * 4).toFixed(1));
      ln.setAttribute('x2', (b.x * 4).toFixed(1)); ln.setAttribute('y2', (b.y * 4).toFixed(1));
      ln.setAttribute('class', 'w-circle-tie t-' + t[2]);
      ln.__a = t[0]; ln.__b = t[1]; ln.__type = t[2];
      linesG.appendChild(ln);
      return ln;
    });
    var disputeLine = lineEls.filter(function (l) { return l.__type === 'dispute'; })[0];

    /* ---------- render helpers ---------- */
    function seatLabel(id) {
      var p = people[id];
      var role = p.tag === 'accused' ? ', the accused' : p.tag === 'accuser' ? ', the accuser' : '';
      return p.name + ', ' + DATA.houses[p.house] + role + (heard[id] ? '. Heard.' : '. Not yet heard.');
    }
    function refreshSeat(id) { seatEls[id].setAttribute('aria-label', seatLabel(id)); }

    function promptCard() {
      card.className = 'w-circle-card is-prompt';
      card.innerHTML = '<p class="w-circle-prompt">' + esc(DATA.prompt) + '</p>';
    }

    function showCard(id) {
      var p = people[id];
      card.className = 'w-circle-card';
      card.innerHTML =
        '<div class="w-circle-card-head">' +
          '<p class="w-circle-card-name">' + esc(p.name) + ' <span>' + esc(DATA.houses[p.house]) + '</span></p>' +
          '<span class="w-circle-stamp" data-tag="' + p.tag + '">' + esc(DATA.tags[p.tag]) + '</span>' +
        '</div>' +
        '<p class="w-circle-how"><span>How they know</span> ' + esc(p.how) + '</p>' +
        '<p class="w-circle-says">' + esc(p.says) + '</p>' +
        '<p class="w-circle-weighs" data-weighs="' + p.weighs + '"><span class="w-circle-wmark" aria-hidden="true"></span>' + esc(DATA.weighs[p.weighs]) + '</p>';
      if (!ctx.reduced) {
        card.classList.remove('is-in');
        void card.offsetWidth;
        card.classList.add('is-in');
      }
    }

    function tallyMarks(n) {
      var out = '';
      for (var g = 0; g < Math.ceil(n / 5); g++) {
        var inGroup = Math.min(5, n - g * 5);
        out += '<span class="w-circle-gate' + (inGroup === 5 ? ' is-full' : '') + '">';
        for (var i = 0; i < Math.min(4, inGroup); i++) out += '<i></i>';
        out += '</span>';
      }
      return out || '<span class="w-circle-none">none</span>';
    }

    function renderLedger() {
      var rows = [['for', 'For Pell'], ['against', 'Against'], ['mixed', 'Both ways'], ['spite', 'Spite']];
      ledgerEl.innerHTML = rows.map(function (r) {
        return '<div class="w-circle-lrow" data-weighs="' + r[0] + '"><span class="w-circle-lname">' + r[1] + '</span>' +
          '<span class="w-circle-tally" aria-hidden="true">' + tallyMarks(ledger[r[0]]) + '</span>' +
          '<span class="sr-only">' + ledger[r[0]] + '</span></div>';
      }).join('');
    }

    function renderNeed() {
      var left = Math.max(0, DATA.need - heardCount);
      decideBtn.disabled = left > 0 || settled;
      decideBtn.classList.toggle('is-ready', left === 0 && !settled);
      needEl.textContent = settled ? '' : left > 0 ? DATA.needMore(left) : DATA.ready;
      countEl.textContent = heardCount;
    }

    function highlight(id) {
      lineEls.forEach(function (ln) {
        var on = id && (ln.__a === id || ln.__b === id);
        ln.classList.toggle('is-lit', !!on);
        ln.classList.toggle('is-dim', !!id && !on);
      });
      Object.keys(seatEls).forEach(function (k) {
        seatEls[k].classList.toggle('is-active', k === id);
        seatEls[k].setAttribute('aria-pressed', String(k === id));
      });
    }

    /* ---------- interaction ---------- */
    function keepCardInView() {
      var r = card.getBoundingClientRect();
      var vh = window.innerHeight || document.documentElement.clientHeight;
      if (r.top > vh - 80 || r.bottom < 60) card.scrollIntoView({ block: 'nearest', behavior: ctx.reduced ? 'auto' : 'smooth' });
    }

    function hear(id) {
      active = id;
      highlight(id);
      showCard(id);
      keepCardInView();
      if (!heard[id]) {
        heard[id] = true;
        heardCount++;
        var w = people[id].weighs;
        if (ledger[w] != null) ledger[w]++;
        seatEls[id].classList.add('is-heard');
        refreshSeat(id);
        renderLedger();
        renderNeed();
      }
    }

    stage.addEventListener('click', function (e) {
      var b = e.target.closest('.w-circle-seat');
      if (!b) return;
      if (active === b.dataset.id) { active = null; highlight(null); promptCard(); return; }
      hear(b.dataset.id);
    });

    decideBtn.addEventListener('click', function () {
      if (decideBtn.disabled) return;
      propEl.hidden = false;
      decideBtn.hidden = true;
      needEl.textContent = '';
      var first = propEl.querySelector('.w-circle-opt');
      if (first) first.focus({ preventScroll: true });
      if (propEl.scrollIntoView) propEl.scrollIntoView({ block: 'nearest', behavior: ctx.reduced ? 'auto' : 'smooth' });
    });

    propEl.addEventListener('click', function (e) {
      var b = e.target.closest('.w-circle-opt');
      if (!b || settled) return;
      var prop = DATA.proposals.filter(function (p) { return p.id === b.dataset.id; })[0];
      Array.prototype.forEach.call(propEl.querySelectorAll('.w-circle-opt'), function (o) {
        o.setAttribute('aria-pressed', String(o === b));
        o.disabled = true;
      });
      settle(prop);
    });

    function settle(prop) {
      settled = true;
      renderNeed();
      highlight(null);
      active = null;
      var knewNet = heard.pell || heard.dov || heard.ora || heard.hesk;
      outEl.innerHTML =
        '<p class="w-circle-reply">' + esc(prop.reply) + '</p>' +
        '<div class="w-circle-settle">' +
          '<span class="w-circle-settle-stamp" aria-hidden="true">' + esc(DATA.settleStamp) + '</span>' +
          '<h4 class="w-circle-settle-title">' + esc(DATA.settleTitle) + '</h4>' +
          '<ol class="w-circle-items">' + DATA.settleItems.map(function (it, i) {
            return '<li style="--i:' + i + '"><span class="w-circle-icon">' + ICONS[it.icon] + '</span><span><b>' + esc(it.head) + '.</b> ' + esc(it.text) + '</span></li>';
          }).join('') + '</ol>' +
          '<p class="w-circle-net">' + esc(knewNet ? DATA.heardNet : DATA.missedNet) + '</p>' +
        '</div>' +
        '<ul class="w-circle-lessons">' + DATA.lessons.map(function (l) {
          return '<li><b>' + esc(l[0]) + '</b> ' + esc(l[1]) + '</li>';
        }).join('') + '</ul>' +
        '<p class="w-circle-note">' + esc(DATA.note) + '</p>' +
        '<div class="btn-row"><button type="button" class="btn btn-ghost btn-small w-circle-replay">' + esc(DATA.replay) + '</button></div>';
      root.classList.add('is-settled');
      seatEls.pell.classList.add('is-mended');
      seatEls.ketta.classList.add('is-mended');
      if (disputeLine) disputeLine.setAttribute('class', 'w-circle-tie t-mended');
      if (!ctx.reduced) {
        root.classList.remove('is-flare');
        void root.offsetWidth;
        root.classList.add('is-flare');
      }
      ctx.stamp('circle');
      outEl.querySelector('.w-circle-replay').addEventListener('click', reset);
    }

    function reset() {
      heard = {};
      heardCount = 0;
      ledger = { 'for': 0, against: 0, mixed: 0, spite: 0 };
      settled = false;
      active = null;
      root.classList.remove('is-settled', 'is-flare');
      Object.keys(seatEls).forEach(function (k) {
        seatEls[k].classList.remove('is-heard', 'is-mended');
        refreshSeat(k);
      });
      if (disputeLine) disputeLine.setAttribute('class', 'w-circle-tie t-dispute');
      highlight(null);
      outEl.innerHTML = '';
      propEl.hidden = true;
      Array.prototype.forEach.call(propEl.querySelectorAll('.w-circle-opt'), function (o) { o.disabled = false; o.setAttribute('aria-pressed', 'false'); });
      decideBtn.hidden = false;
      promptCard();
      renderLedger();
      renderNeed();
      seatEls.pell.focus({ preventScroll: true });
      if (stage.scrollIntoView) stage.scrollIntoView({ block: 'nearest', behavior: ctx.reduced ? 'auto' : 'smooth' });
    }

    /* ---------- start ---------- */
    Object.keys(seatEls).forEach(refreshSeat);
    highlight(null);
    promptCard();
    renderLedger();
    renderNeed();
    if (ctx.reduced) root.classList.add('is-still');
    ctx.onVisible(function (on) { root.classList.toggle('is-off', !on); });
  });
})();
