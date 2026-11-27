/* whosat: "The jury box, year by year". Swimlanes of who could sit on American juries, 1791 to 2026, with a year
   scrubber and play button, a twelve-seat jury box drawn at random from the groups allowed in that year, and a
   milestone card that follows the scrubber. Seal: 'seated' (awarded on reaching 2020 or later). */
(function () {
  'use strict';

  /* =====================================================================
     FACTS. Every factual statement in this exhibit lives in this object.
     Lane statuses are broad national generalizations (see footnote).
     ===================================================================== */
  var FACTS = {
    start: 1791,
    end: 2026,
    sealYear: 2020,
    statuses: {
      barred: { short: 'Barred', legend: 'Barred by law' },
      practice: { short: 'Kept off', legend: 'Allowed on paper, kept off in practice' },
      allowed: { short: 'Allowed', legend: 'Allowed to serve' },
      shift: { legend: 'Changing state by state' }
    },
    /* share: rough share of the adult population, used only to weight the illustrative seat draw. */
    lanes: [
      { id: 'owner', name: 'White men with property', one: 'white man with property', many: 'white men with property',
        tag: 'Owner', share: 0.24,
        segs: [{ from: 1791, to: 2026, s: 'allowed' }] },
      { id: 'noprop', name: 'White men without property', one: 'white man without property', many: 'white men without property',
        tag: 'No property', share: 0.18,
        segs: [
          { from: 1791, to: 1860, s: 'shift', a: 'barred', b: 'allowed', notes: ['Mostly barred', 'Varies', 'Mostly allowed'] },
          { from: 1860, to: 2026, s: 'allowed' }
        ] },
      { id: 'black', name: 'Black men', one: 'Black man', many: 'Black men', tag: 'Black man', share: 0.05,
        segs: [
          { from: 1791, to: 1865, s: 'barred', note: 'Mostly barred' },
          { from: 1865, to: 1880, s: 'shift', a: 'barred', b: 'practice', notes: ['Mostly barred', 'Varies', 'Mostly kept off'] },
          { from: 1880, to: 1965, s: 'practice' },
          { from: 1965, to: 1986, s: 'shift', a: 'practice', b: 'allowed', notes: ['Mostly kept off', 'Varies', 'Mostly allowed'] },
          { from: 1986, to: 2026, s: 'allowed' }
        ] },
      { id: 'women', name: 'Women', one: 'woman', many: 'women', tag: 'Woman', share: 0.48,
        marks: [{ year: 1870, label: 'Laramie, 1870' }],
        segs: [
          { from: 1791, to: 1910, s: 'barred' },
          { from: 1910, to: 1968, s: 'shift', a: 'barred', b: 'practice', notes: ['Mostly barred', 'Varies', 'Mostly kept off'] },
          { from: 1968, to: 1975, s: 'practice' },
          { from: 1975, to: 2026, s: 'allowed' }
        ] },
      { id: 'young', name: 'Adults aged 18 to 20', one: 'juror aged 18 to 20', many: 'jurors aged 18 to 20', tag: 'Age', share: 0.05,
        segs: [
          { from: 1791, to: 1971, s: 'barred' },
          { from: 1971, to: 1980, s: 'shift', a: 'barred', b: 'allowed', notes: ['Mostly barred', 'Varies', 'Mostly allowed'] },
          { from: 1980, to: 2026, s: 'allowed', note: 'Mostly allowed' }
        ] }
    ],
    milestones: [
      { year: 1791, when: '1791', title: 'The Bill of Rights', lanes: ['owner'],
        text: 'The Sixth Amendment promises an impartial jury of the state and district. The Seventh keeps the civil jury. Neither says who may serve. Federal courts used each state\'s rules, and most states drew jurors from white men who owned property or paid taxes.' },
      { year: 1830, when: '1800 to 1860', title: 'Property tests fade', lanes: ['noprop'],
        text: 'State by state, property tests for voting fall away, and jury lists widen with them. By the 1850s most white men could vote without owning property. Some states kept property or householder rules for jurors longer.' },
      { year: 1860, when: '1860', title: 'Worcester, Massachusetts', lanes: ['black'],
        text: 'Two Black men are seated on a jury in Worcester, long called the first Black jurors in the country. No Massachusetts law had barred Black men. Custom had. Recent research has found a few earlier Black jurors elsewhere, as far back as 1820.' },
      { year: 1870, when: '1870', title: 'Laramie, Wyoming Territory', lanes: ['women'],
        text: 'Women sit on a grand jury and on trial juries in Laramie, the first women known to serve on American juries apart from juries of matrons, which only examined women\'s bodies, usually for signs of pregnancy. The experiment was short-lived.' },
      { year: 1875, when: '1875', title: 'Civil Rights Act of 1875', lanes: ['black'],
        text: 'Congress makes it a crime for an official to exclude anyone from a jury because of race, color or previous condition of servitude. The Supreme Court struck down the act\'s public accommodations sections in 1883. The jury section survived. It is still federal law.' },
      { year: 1880, when: '1880', title: '<i>Strauder v. West Virginia</i>', lanes: ['black'],
        text: 'The Supreme Court strikes down a state law that let only white men sit on juries. The same opinion said a state could still limit jury service to men, to property owners or to the educated.' },
      { year: 1898, when: '1898', title: 'Louisiana\'s convention', lanes: ['black'],
        text: 'Its avowed purpose, one committee chairman said, was to “establish the supremacy of the white race.” The new constitution lets juries convict on 9 votes of 12. In 2020 the Supreme Court recounted that the rule was meant to make Black jurors\' service meaningless.' },
      { year: 1935, when: '1935', title: '<i>Norris v. Alabama</i>', lanes: ['black'],
        text: 'Clarence Norris, one of the Scottsboro defendants, wins a new trial. Witnesses could not remember a Black person ever serving on a jury in the county. Shutting Black citizens out of jury service, the Court held, denied him equal protection.' },
      { year: 1946, when: '1946', title: '<i>Thiel</i> and <i>Ballard</i>', lanes: ['women'],
        text: 'The Court bars federal courts from leaving daily wage earners off jury lists, and from leaving women off where state law lets them serve. From <i>Ballard</i>: “[T]he two sexes are not fungible.”' },
      { year: 1954, when: '1954', title: '<i>Hernandez v. Texas</i>', lanes: [],
        text: 'In 25 years, no one with a Mexican or Latin American surname had served on a jury in Jackson County, Texas. Pete Hernandez wins a new trial. Equal protection, the Court held, is not limited to Black and white.' },
      { year: 1957, when: '1957', title: 'Civil Rights Act of 1957', lanes: ['women'],
        text: 'Congress sets its own qualifications for federal jurors instead of borrowing each state\'s. Women can now serve on federal juries even in states that still bar them.' },
      { year: 1961, when: '1961', title: '<i>Hoyt v. Florida</i>', lanes: ['women'],
        text: 'The Court upholds a Florida law that put women on jury lists only if they asked. A woman, it said, is “still regarded as the center of home and family life.” Gwendolyn Hoyt, tried for killing her husband, faced an all-male jury.' },
      { year: 1968, when: '1968', title: 'Random selection', lanes: ['women', 'black'],
        text: 'The Jury Selection and Service Act orders federal courts to draw jurors at random from a fair cross section of the community, starting from voter lists. The same year Mississippi, the last state to bar women from juries, lets them serve.' },
      { year: 1972, when: '1972', title: 'Eighteen', lanes: ['young'],
        text: 'A year after the 26th Amendment lowered the voting age to 18, Congress lowers the federal juror age to match. States follow one at a time. Missouri still requires jurors to be 21.' },
      { year: 1975, when: '1975', title: '<i>Taylor v. Louisiana</i>', lanes: ['women'],
        text: 'The Court strikes down Louisiana\'s rule that a woman served only if she filed a written request. The jury pool must be drawn from a fair cross section of the community.' },
      { year: 1986, when: '1986', title: '<i>Batson v. Kentucky</i>', lanes: ['black'],
        text: 'Each side may strike a few jurors without giving a reason. <i>Batson</i> holds that a prosecutor may not use those strikes to remove jurors because of their race.' },
      { year: 1994, when: '1994', title: '<i>J.E.B. v. Alabama ex rel. T.B.</i>', lanes: ['women'],
        text: 'The rule now covers sex. In a paternity case, the state had used its strikes to remove men, leaving an all-female jury.' },
      { year: 2019, when: '2019', title: '<i>Flowers v. Mississippi</i>', lanes: ['black'],
        text: 'Curtis Flowers was tried six times for the same murders. Over those trials the prosecutor struck 41 of the 42 Black prospective jurors he could have struck. The Court reversed. The charges were dropped in 2020.' },
      { year: 2020, when: '2020', title: '<i>Ramos v. Louisiana</i>', lanes: ['black'],
        text: 'A state conviction for a serious crime now needs a unanimous jury. The ruling ends the split-verdict rules of Louisiana (1898) and Oregon (1934). Louisiana voters had already ended theirs for crimes after 2018.' },
      { year: 2026, when: 'Today', title: 'Open to all, on paper', lanes: [],
        text: 'Every group on this chart may now serve. Juries are still filtered:',
        list: [
          ['Source lists.', 'Voter and driver rolls miss people who move often or never register.'],
          ['Hardship excuses.', 'People who cannot miss work or leave someone in their care are often excused.'],
          ['Peremptory strikes.', 'Lawyers may still remove a few people without giving a reason, as long as the reason is not race or sex.'],
          ['Legal limits.', 'Citizenship and English are usually required, many states bar people with felony convictions, and Missouri requires age 21.']
        ] }
    ],
    footnote: 'Each lane is a broad national picture. Jury rules were set state by state, and until 1957 federal courts borrowed them. Black women faced both the race and the sex barriers. Other groups fought their own exclusions, among them Mexican Americans, Native Americans and Asian immigrants barred from citizenship.',
    seatNote: 'Seats are an illustration. Each is drawn at random, weighted roughly by share of the adult population and by how open the box was to that group that year.'
  };
  /* ===================================================================== */

  var WEIGHT = { barred: 0, practice: 0.07, allowed: 1 };   // chance of being seated, relative to an open group
  var HEIGHT = { barred: 6, practice: 12, allowed: 18 };    // bar height in px: the second, color-free channel
  var BAND = 20;
  var TICKS = [1800, 1850, 1900, 1950, 2000];
  var SPEED = 24;      // years per second while playing
  var DWELL = 1000;    // ms pause at each milestone while playing

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function stripTags(s) { return String(s).replace(/<[^>]+>/g, ''); }

  var SVG_PLAY = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg>';
  var SVG_PAUSE = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z" fill="currentColor"/></svg>';
  var SVG_BUST = '<svg class="w-whosat-bust" viewBox="0 0 40 34" aria-hidden="true"><circle cx="20" cy="10" r="7"/><path d="M5 34c0-9 6.5-15 15-15s15 6 15 15z"/></svg>';

  TS.register('whosat', function (el, ctx) {
    var F = FACTS;
    var span = F.end - F.start;
    function pct(y) { return ((y - F.start) / span) * 100; }

    function segAt(lane, y) {
      for (var i = 0; i < lane.segs.length; i++) {
        if (y < lane.segs[i].to || i === lane.segs.length - 1) return lane.segs[i];
      }
      return lane.segs[lane.segs.length - 1];
    }
    function laneNow(lane, y) {
      var s = segAt(lane, y);
      if (s.s !== 'shift') return { kind: s.s, text: s.note || F.statuses[s.s].short, w: WEIGHT[s.s] };
      var t = clamp((y - s.from) / (s.to - s.from), 0, 1);
      return { kind: 'shift', from: s.a, to: s.b, text: s.notes[t < 1 / 3 ? 0 : t < 2 / 3 ? 1 : 2], w: WEIGHT[s.a] + (WEIGHT[s.b] - WEIGHT[s.a]) * t };
    }
    function milestoneIndex(y) {
      var idx = 0;
      for (var i = 0; i < F.milestones.length; i++) if (F.milestones[i].year <= y) idx = i;
      return idx;
    }

    /* ---------- markup ---------- */
    function segHTML(s) {
      var left = pct(s.from), width = pct(s.to) - left;
      var pos = 'left:calc(' + left.toFixed(3) + '% + 1px);width:calc(' + width.toFixed(3) + '% - 2px);';
      if (s.s !== 'shift') return '<span class="w-whosat-seg is-' + s.s + '" style="' + pos + '"></span>';
      var ha = HEIGHT[s.a], hb = HEIGHT[s.b];
      var clip = 'polygon(0 ' + (BAND - ha) / 2 + 'px, 100% ' + (BAND - hb) / 2 + 'px, 100% ' + (BAND + hb) / 2 + 'px, 0 ' + (BAND + ha) / 2 + 'px)';
      return '<span class="w-whosat-seg is-shift" style="' + pos + '-webkit-clip-path:' + clip + ';clip-path:' + clip + '">' +
        '<i class="w-whosat-fill is-' + s.a + '"></i><i class="w-whosat-fill is-' + s.b + ' w-whosat-fade"></i></span>';
    }
    function laneHTML(lane) {
      var grid = TICKS.map(function (t) { return '<span class="w-whosat-grid" style="left:' + pct(t).toFixed(3) + '%"></span>'; }).join('');
      var marks = (lane.marks || []).map(function (m) {
        return '<span class="w-whosat-mark" style="left:' + pct(m.year).toFixed(3) + '%" title="' + esc(m.label) + '"></span>';
      }).join('');
      return '<div class="w-whosat-lane" data-lane="' + lane.id + '">' +
        '<div class="w-whosat-lane-head"><span class="w-whosat-lane-name">' + esc(lane.name) + '</span>' +
        '<span class="w-whosat-now"><i class="w-whosat-sw"></i><span class="w-whosat-now-t"></span></span></div>' +
        '<div class="w-whosat-track">' + grid + '<span class="w-whosat-base"></span>' + lane.segs.map(segHTML).join('') + marks +
        '<span class="w-whosat-cur"></span></div></div>';
    }
    function legendHTML() {
      var S = F.statuses;
      return '<ul class="w-whosat-legend" aria-label="Key">' +
        '<li><i class="w-whosat-key is-allowed"></i>' + S.allowed.legend + '</li>' +
        '<li><i class="w-whosat-key is-practice"></i>' + S.practice.legend + '</li>' +
        '<li><i class="w-whosat-key is-barred"></i>' + S.barred.legend + '</li>' +
        '<li><i class="w-whosat-key is-shift"><i class="w-whosat-fill is-barred"></i><i class="w-whosat-fill is-allowed w-whosat-fade"></i></i>' + S.shift.legend + '</li>' +
        '</ul>';
    }

    var seatsHTML = '';
    for (var i = 0; i < 12; i++) {
      seatsHTML += '<div class="w-whosat-seat"><span class="w-whosat-chair" aria-hidden="true"></span>' + SVG_BUST + '<span class="w-whosat-tag"></span></div>';
    }

    el.innerHTML =
      '<div class="w-whosat">' +
        '<div class="w-whosat-top">' +
          '<div class="w-whosat-year"><span class="label">Year</span><b class="w-whosat-yr">1791</b></div>' +
          '<div class="w-whosat-ctrl">' +
            '<button type="button" class="btn btn-small w-whosat-play" aria-pressed="false">' + SVG_PLAY + '<span>Play</span></button>' +
            '<button type="button" class="btn btn-small btn-ghost w-whosat-draw">Draw again</button>' +
          '</div>' +
        '</div>' +
        '<div class="w-whosat-boxwrap">' +
          '<div class="w-whosat-box" role="group" aria-label="Twelve jury seats">' + seatsHTML + '</div>' +
          '<div class="w-whosat-stamp" aria-hidden="true"><span>Open to all</span><small>on paper</small></div>' +
        '</div>' +
        '<p class="w-whosat-comp"></p>' +
        legendHTML() +
        '<div class="w-whosat-chart" role="img">' +
          '<div class="w-whosat-axis" aria-hidden="true">' +
            TICKS.map(function (t) { return '<span class="w-whosat-tick" style="left:' + pct(t).toFixed(3) + '%">' + t + '</span>'; }).join('') +
            '<span class="w-whosat-pin"></span>' +
          '</div>' +
          F.lanes.map(laneHTML).join('') +
          '<div class="w-whosat-mticks" aria-hidden="true">' +
            F.milestones.map(function (m) { return '<span class="w-whosat-mt" style="left:' + pct(m.year).toFixed(3) + '%"></span>'; }).join('') +
          '</div>' +
        '</div>' +
        '<input class="w-whosat-range" type="range" min="' + F.start + '" max="' + F.end + '" step="1" value="' + F.start + '" aria-label="Year">' +
        '<div class="w-whosat-ends" aria-hidden="true"><span>' + F.start + '</span><span>' + F.end + '</span></div>' +
        '<article class="w-whosat-card" aria-label="Milestone">' +
          '<div class="w-whosat-card-head"><span class="w-whosat-when"></span><span class="w-whosat-count"></span></div>' +
          '<h4 class="w-whosat-card-title"></h4>' +
          '<div class="w-whosat-card-body"></div>' +
          '<div class="w-whosat-card-nav">' +
            '<button type="button" class="btn btn-small btn-ghost w-whosat-prev">Earlier</button>' +
            '<button type="button" class="btn btn-small btn-ghost w-whosat-next">Next event</button>' +
          '</div>' +
        '</article>' +
        '<p class="w-whosat-foot">' + esc(F.footnote) + ' ' + esc(F.seatNote) + '</p>' +
        '<p class="sr-only" aria-live="polite"></p>' +
      '</div>';

    var root = el.querySelector('.w-whosat');
    var yrEl = el.querySelector('.w-whosat-yr');
    var playBtn = el.querySelector('.w-whosat-play');
    var drawBtn = el.querySelector('.w-whosat-draw');
    var range = el.querySelector('.w-whosat-range');
    var chart = el.querySelector('.w-whosat-chart');
    var comp = el.querySelector('.w-whosat-comp');
    var stampEl = el.querySelector('.w-whosat-stamp');
    var live = el.querySelector('[aria-live]');
    var seats = Array.prototype.slice.call(el.querySelectorAll('.w-whosat-seat'));
    var laneEls = Array.prototype.slice.call(el.querySelectorAll('.w-whosat-lane'));
    var curs = Array.prototype.slice.call(el.querySelectorAll('.w-whosat-cur'));
    var pin = el.querySelector('.w-whosat-pin');
    var mts = Array.prototype.slice.call(el.querySelectorAll('.w-whosat-mt'));
    var card = el.querySelector('.w-whosat-card');
    var cardWhen = el.querySelector('.w-whosat-when');
    var cardCount = el.querySelector('.w-whosat-count');
    var cardTitle = el.querySelector('.w-whosat-card-title');
    var cardBody = el.querySelector('.w-whosat-card-body');
    var prevBtn = el.querySelector('.w-whosat-prev');
    var nextBtn = el.querySelector('.w-whosat-next');

    var year = null, mIdx = -1, lastProbs = null, lastDrawAt = 0, sealedHere = false;
    var playing = false, raf = 0, fy = F.start, lastT = null, dwellUntil = 0, stepTimer = 0;
    var announceTimer = 0, flashTimer = 0;

    /* ---------- the jury box ---------- */
    function probs(y) {
      var w = F.lanes.map(function (l) { return l.share * laneNow(l, y).w; });
      var tot = w.reduce(function (a, b) { return a + b; }, 0) || 1;
      return w.map(function (v) { return v / tot; });
    }
    function drift(a, b) {
      if (!a || !b) return 1;
      var d = 0;
      for (var k = 0; k < a.length; k++) d = Math.max(d, Math.abs(a[k] - b[k]));
      return d;
    }
    function drawSeats(animate) {
      var p = probs(year);
      lastProbs = p;
      lastDrawAt = Date.now();
      var counts = F.lanes.map(function () { return 0; });
      seats.forEach(function (seat, si) {
        var r = ctx.rand(), k = 0, acc = p[0];
        while (r > acc && k < p.length - 1) { k++; acc += p[k]; }
        counts[k]++;
        var lane = F.lanes[k];
        var tag = lane.id === 'young' ? 'Age ' + (18 + Math.floor(ctx.rand() * 3)) : lane.tag;
        seat.setAttribute('data-lane', lane.id);
        seat.setAttribute('aria-label', 'Seat ' + (si + 1) + ': ' + lane.one);
        seat.querySelector('.w-whosat-tag').textContent = tag;
        if (animate && !ctx.reduced) {
          seat.classList.remove('is-in');
          seat.style.animationDelay = (si * 28) + 'ms';
          void seat.offsetWidth;
          seat.classList.add('is-in');
        }
      });
      var parts = [];
      F.lanes.forEach(function (l, k) { if (counts[k]) parts.push(counts[k] + ' ' + (counts[k] === 1 ? l.one : l.many)); });
      var list = parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0];
      comp.innerHTML = '<span class="label">Seated, ' + year + '</span> ' + esc(list) + '.';
    }
    function maybeDraw(threshold) {
      var d = drift(lastProbs, probs(year));
      if (d > threshold && Date.now() - lastDrawAt > 380) drawSeats(true);
    }

    /* ---------- milestone card ---------- */
    function renderCard(i, fresh) {
      var m = F.milestones[i];
      cardWhen.textContent = m.when;
      cardCount.textContent = 'Event ' + (i + 1) + ' of ' + F.milestones.length;
      cardTitle.innerHTML = m.title;
      var body = '<p>' + m.text + '</p>';
      if (m.list) {
        body += '<ul class="w-whosat-filters">' + m.list.map(function (it) { return '<li><b>' + it[0] + '</b> ' + it[1] + '</li>'; }).join('') + '</ul>';
      }
      cardBody.innerHTML = body;
      prevBtn.disabled = i === 0;
      nextBtn.disabled = i === F.milestones.length - 1;
      card.classList.toggle('is-final', !!m.list);
      if (fresh && !ctx.reduced) {
        card.classList.remove('is-new');
        void card.offsetWidth;
        card.classList.add('is-new');
      }
      clearTimeout(flashTimer);
      laneEls.forEach(function (le) { le.classList.toggle('is-flash', fresh && m.lanes.indexOf(le.getAttribute('data-lane')) >= 0); });
      if (fresh) flashTimer = setTimeout(function () { laneEls.forEach(function (le) { le.classList.remove('is-flash'); }); }, 1400);
      mts.forEach(function (t, k) {
        t.classList.toggle('is-past', F.milestones[k].year <= year);
        t.classList.toggle('is-now', k === i);
      });
    }

    function announce(now) {
      clearTimeout(announceTimer);
      var go = function () {
        var m = F.milestones[mIdx];
        live.textContent = year + '. ' + (m.year <= year ? m.when + ': ' + stripTags(m.title) + '. ' : '') + comp.textContent.replace(/^Seated, \d+ /, 'Seated: ');
      };
      if (now) go(); else announceTimer = setTimeout(go, 650);
    }

    function chartLabel() {
      var bits = F.lanes.map(function (l) { return l.name + ': ' + laneNow(l, year).text.toLowerCase(); });
      chart.setAttribute('aria-label', 'Who could serve on American juries in ' + year + '. ' + bits.join('; ') + '.');
    }

    /* ---------- the year ---------- */
    function setYear(y, opts) {
      opts = opts || {};
      y = clamp(Math.round(y), F.start, F.end);
      if (y === year && !opts.force) return;
      year = y;
      range.value = String(y);
      var frac = (y - F.start) / span;
      range.style.setProperty('--p', 'calc(14px + (100% - 28px) * ' + frac.toFixed(4) + ')');
      range.setAttribute('aria-valuetext', String(y));
      yrEl.textContent = y;
      var left = pct(y).toFixed(3) + '%';
      curs.forEach(function (c) { c.style.left = left; });
      pin.style.left = left;
      F.lanes.forEach(function (l, k) {
        var now = laneNow(l, y);
        var le = laneEls[k];
        var kind = now.kind === 'shift' ? 'shift' : now.kind;
        if (le.getAttribute('data-now') !== kind) le.setAttribute('data-now', kind);
        var t = le.querySelector('.w-whosat-now-t');
        if (t.textContent !== now.text) t.textContent = now.text;
        var sw = le.querySelector('.w-whosat-sw');
        var swKey = now.kind === 'shift' ? 'shift:' + now.from + ':' + now.to : now.kind;
        if (sw.getAttribute('data-k') !== swKey) {
          sw.setAttribute('data-k', swKey);
          sw.className = 'w-whosat-sw is-' + now.kind;
          sw.innerHTML = now.kind === 'shift' ? '<i class="is-' + now.from + '"></i><i class="is-' + now.to + '"></i>' : '';
        }
      });
      var i = milestoneIndex(y);
      if (i !== mIdx) { mIdx = i; renderCard(i, !opts.quiet); }
      else mts.forEach(function (t, k) { t.classList.toggle('is-past', F.milestones[k].year <= year); });
      var open = y >= F.sealYear;
      if (open !== root.classList.contains('is-open')) {
        root.classList.toggle('is-open', open);
        if (open && !ctx.reduced) { stampEl.classList.remove('is-thump'); void stampEl.offsetWidth; stampEl.classList.add('is-thump'); }
      }
      if (open && !sealedHere) {
        sealedHere = true;
        ctx.stamp('seated');
      }
      chartLabel();
    }

    /* ---------- play ---------- */
    function setPlayUI() {
      playBtn.setAttribute('aria-pressed', String(playing));
      playBtn.innerHTML = (playing ? SVG_PAUSE : SVG_PLAY) + '<span>' + (playing ? 'Pause' : (year >= F.end ? 'Replay' : 'Play')) + '</span>';
    }
    function stop() {
      playing = false;
      cancelAnimationFrame(raf);
      clearTimeout(stepTimer);
      setPlayUI();
    }
    function frame(t) {
      if (!playing) return;
      if (lastT == null) lastT = t;
      var dt = Math.min(64, t - lastT);
      lastT = t;
      if (t >= dwellUntil) {
        var before = year;
        fy = Math.min(F.end, fy + dt * SPEED / 1000);
        var ny = Math.floor(fy);
        if (ny !== before) {
          var crossed = F.milestones.some(function (m) { return m.year > before && m.year <= ny; });
          if (crossed) {
            var stopAt = F.milestones.filter(function (m) { return m.year > before && m.year <= ny; })[0].year;
            ny = stopAt; fy = stopAt;
          }
          setYear(ny);
          if (crossed) { dwellUntil = t + DWELL; drawSeats(true); announce(true); }
          else maybeDraw(0.035);
        }
        if (year >= F.end) { stop(); drawSeats(true); announce(true); return; }
      }
      raf = requestAnimationFrame(frame);
    }
    function reducedStep() {
      if (!playing) return;
      var next = F.milestones[Math.min(F.milestones.length - 1, milestoneIndex(year) + 1)];
      setYear(next.year);
      drawSeats(false);
      announce(true);
      if (year >= F.end) { stop(); return; }
      stepTimer = setTimeout(reducedStep, 2200);
    }
    function play() {
      if (year >= F.end) { setYear(F.start); drawSeats(true); }
      playing = true;
      fy = year;
      lastT = null;
      dwellUntil = 0;
      setPlayUI();
      if (ctx.reduced) stepTimer = setTimeout(reducedStep, 900);
      else raf = requestAnimationFrame(frame);
    }

    playBtn.addEventListener('click', function () { if (playing) stop(); else play(); });
    drawBtn.addEventListener('click', function () { drawSeats(true); announce(true); });

    range.addEventListener('input', function () {
      if (playing) stop();
      setYear(+range.value);
      maybeDraw(0.035);
      announce(false);
    });
    range.addEventListener('change', function () {
      if (drift(lastProbs, probs(year)) > 0.004) drawSeats(true);
      setPlayUI();
      announce(false);
    });

    function jump(dir) {
      if (playing) stop();
      var i = milestoneIndex(year);
      var target;
      if (dir < 0) target = F.milestones[F.milestones[i].year < year ? i : Math.max(0, i - 1)];
      else target = F.milestones[Math.min(F.milestones.length - 1, i + 1)];
      setYear(target.year, { force: true });
      drawSeats(true);
      setPlayUI();
      announce(true);
    }
    prevBtn.addEventListener('click', function () { jump(-1); });
    nextBtn.addEventListener('click', function () { jump(1); });

    /* drag or tap on the chart to scrub (horizontal drags only, so vertical page scrolls still work) */
    var drag = null;
    function yearFromX(clientX) {
      var track = laneEls[0].querySelector('.w-whosat-track').getBoundingClientRect();
      return F.start + clamp((clientX - track.left) / track.width, 0, 1) * span;
    }
    chart.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, on: false, id: e.pointerId };
    });
    chart.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.on && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) {
        drag.on = true;
        if (playing) stop();
        try { chart.setPointerCapture(e.pointerId); } catch (err) {}
      }
      if (drag.on) { setYear(yearFromX(e.clientX)); maybeDraw(0.035); }
    });
    function endDrag(e, cancelled) {
      if (!drag || e.pointerId !== drag.id) return;
      var wasDrag = drag.on;
      if (!cancelled && !wasDrag && Math.abs(e.clientX - drag.x) < 6 && Math.abs(e.clientY - drag.y) < 6) {
        if (playing) stop();
        setYear(yearFromX(e.clientX));
      }
      drag = null;
      if (!cancelled) {
        if (drift(lastProbs, probs(year)) > 0.004) drawSeats(true);
        setPlayUI();
        announce(false);
      }
    }
    chart.addEventListener('pointerup', function (e) { endDrag(e, false); });
    chart.addEventListener('pointercancel', function (e) { endDrag(e, true); });

    ctx.onVisible(function (visible) { if (!visible && playing) stop(); });

    /* ---------- first render: 1791 ---------- */
    setYear(F.start, { force: true, quiet: true });
    drawSeats(false);
    setPlayUI();
  });
})();
