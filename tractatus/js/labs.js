/* Instruments: small interactive models for single ideas of the book.
   Each one is mounted on a <div class="lab" data-lab="name">. */
(function () {
  'use strict';

  var TLP = window.TLP || [];
  var byN = {};
  TLP.forEach(function (p) { byN[p.n] = p; });

  function frame(el, title, note) {
    el.innerHTML =
      '<div class="lab-h"><span class="lab-k">Instrument</span><span class="lab-t">' + title + '</span></div>' +
      '<div class="lab-b"></div>' +
      (note ? '<p class="lab-n"><b>Notice</b>' + note + '</p>' : '');
    return el.querySelector('.lab-b');
  }
  function tv(on, small) { return '<span class="tv ' + (on ? 'T' : 'F') + (small ? ' sm' : '') + '"></span>'; }
  function plain(html) { var d = document.createElement('div'); d.innerHTML = html.replace(/<\/(p|div|tr)>/g, ' $&'); return d.textContent.replace(/\s+/g, ' ').trim(); }
  function on(el, type, sel, fn) {
    el.addEventListener(type, function (e) {
      var t = e.target.closest(sel);
      if (t && el.contains(t)) fn(t, e);
    });
  }

  /* The sixteen truth-functions of p and q, in the row order of 4.31 and with the
     wording of 5.101. Rows: (p,q) = TT, FT, TF, FF. */
  var ROWS = [[1, 1], [0, 1], [1, 0], [0, 0]];
  var FN = {
    TTTT: ['Tautology', 'p ⊃ p . q ⊃ q'],
    FTTT: ['Not both p and q', '∼(p . q)'],
    TFTT: ['If q then p', 'q ⊃ p'],
    TTFT: ['If p then q', 'p ⊃ q'],
    TTTF: ['p or q', 'p ∨ q'],
    FFTT: ['Not q', '∼q'],
    FTFT: ['Not p', '∼p'],
    FTTF: ['p or q, but not both', 'p . ∼q : ∨ : q . ∼p'],
    TFFT: ['If p then q, and if q then p', 'p ≡ q'],
    TFTF: ['p', 'p'],
    TTFF: ['q', 'q'],
    FFFT: ['Neither p nor q', '∼p . ∼q'],
    FFTF: ['p and not q', 'p . ∼q'],
    FTFF: ['q and not p', 'q . ∼p'],
    TFFF: ['p and q', 'p . q'],
    FFFF: ['Contradiction', 'p . ∼p . q . ∼q']
  };
  var ORDER = Object.keys(FN);
  function ital(s) { return s.replace(/[pq]/g, '<i>$&</i>'); }
  function world(r, small) { return tv(ROWS[r][0], small) + tv(ROWS[r][1], small); }

  var labs = {};

  /* ── how the numbers work ── */
  labs.numbers = function (el) {
    var b = frame(el, 'The chain behind a number');
    var picks = ['1.1', '2.0121', '3.1432', '4.0312', '5.6331', '6.54', '7'];
    b.innerHTML = '<div class="row">' + picks.map(function (n) {
      return '<button type="button" class="chip" data-n="' + n + '" aria-pressed="false">' + n + '</button>';
    }).join('') + '</div><ol class="chain"></ol>';
    var out = b.querySelector('.chain');
    function show(n) {
      b.querySelectorAll('.chip').forEach(function (c) { c.setAttribute('aria-pressed', c.dataset.n === n); });
      var chain = [], p = byN[n];
      while (p) { chain.unshift(p); p = p.p ? byN[p.p] : null; }
      out.innerHTML = chain.map(function (c, d) {
        var text = plain(c.en);
        if (text.length > 150) text = text.slice(0, 150).replace(/\s\S*$/, '') + ' …';
        var rel = d === 0 ? 'main proposition' : 'comment on ' + chain[d - 1].n;
        return '<li style="--d:' + d + '"><b>' + c.n + '</b><span>' + text + '<em>' + rel + '</em></span></li>';
      }).join('') + (n === '7' ? '<li style="--d:0"><b></b><span><em>Proposition 7 has no comments. It is alone.</em></span></li>' : '');
    }
    on(b, 'click', '.chip', function (t) { show(t.dataset.n); });
    show('2.0121');
  };

  /* ── logical space ── */
  labs.space = function (el) {
    var b = frame(el, 'Logical space of three atomic facts',
      'The things are the same in all eight worlds. Only the facts are different. When you change one fact, the other two stay as they are.');
    var s = [1, 0, 1], names = ['A', 'B', 'C'];
    function render() {
      var facts = names.map(function (n, i) {
        return '<button type="button" class="fact" data-i="' + i + '" aria-pressed="' + !!s[i] + '">' + tv(s[i]) +
          '<b>' + n + '</b><span>' + (s[i] ? 'exists' : 'does not exist') + '</span></button>';
      }).join('');
      var worlds = '';
      for (var w = 7; w >= 0; w--) {
        var bits = [(w >> 2) & 1, (w >> 1) & 1, w & 1];
        var cur = bits[0] === s[0] && bits[1] === s[1] && bits[2] === s[2];
        worlds += '<button type="button" class="world' + (cur ? ' on' : '') + '" data-w="' + w + '" aria-label="World ' +
          bits.map(function (x, i) { return names[i] + (x ? ' exists' : ' does not exist'); }).join(', ') + '">' +
          bits.map(function (x) { return tv(x, true); }).join('') + '</button>';
      }
      var pos = names.filter(function (n, i) { return s[i]; }), neg = names.filter(function (n, i) { return !s[i]; });
      b.innerHTML =
        '<div class="space-grid"><div><p class="lbl">Three possible atomic facts</p><div class="facts">' + facts + '</div></div>' +
        '<div><p class="lbl">All possible worlds: 2 × 2 × 2 = 8</p><div class="worlds">' + worlds + '</div></div></div>' +
        '<p class="say">The actual world: ' +
        (pos.length ? '<em>' + pos.join(', ') + '</em> ' + (pos.length > 1 ? 'exist' : 'exists') + '. ' : 'no atomic fact exists. ') +
        (neg.length ? 'This list is complete, so you also know what is not the case: ' + neg.join(', ') + (neg.length > 1 ? ' do' : ' does') + ' not exist.' : 'This list is complete. Nothing else is the case.') +
        '</p>';
    }
    on(b, 'click', '.fact', function (t) { s[+t.dataset.i] ^= 1; render(); });
    on(b, 'click', '.world', function (t) { var w = +t.dataset.w; s = [(w >> 2) & 1, (w >> 1) & 1, w & 1]; render(); });
    render();
  };

  /* ── picture and reality ── */
  var SHAPES = [
    '<svg viewBox="0 0 24 24" aria-label="circle"><circle cx="12" cy="12" r="8.5" fill="currentColor"/></svg>',
    '<svg viewBox="0 0 24 24" aria-label="square"><rect x="4" y="4" width="16" height="16" fill="currentColor"/></svg>',
    '<svg viewBox="0 0 24 24" aria-label="triangle"><path d="M12 3.5 21.5 20.5H2.5Z" fill="currentColor"/></svg>'
  ];
  var SHAPE_NAMES = ['the circle', 'the square', 'the triangle'];
  labs.picture = function (el) {
    var b = frame(el, 'A picture and the reality it shows',
      'You understand what the picture says before you compare it with reality. Its sense does not depend on its truth. The comparison decides only if it is true.');
    var pic = [0, 1, 2], real = [1, 0, 2];
    function sayOrder(o) { return SHAPE_NAMES[o[0]] + ' is on the left of ' + SHAPE_NAMES[o[1]] + ', and ' + SHAPE_NAMES[o[1]] + ' is on the left of ' + SHAPE_NAMES[o[2]]; }
    function render() {
      var ok = pic.join() === real.join();
      var p = '';
      pic.forEach(function (x, i) {
        p += '<div class="tile name">' + 'abc'[x] + '</div>';
        if (i < 2) p += '<button type="button" class="swap" data-i="' + i + '" aria-label="Exchange these two names">⇄</button>';
      });
      b.innerHTML =
        '<div class="pic-key"><span>The names stand for things:</span>' +
        [0, 1, 2].map(function (i) { return '<span><i>' + 'abc'[i] + '</i> → ' + SHAPES[i] + '</span>'; }).join('') + '</div>' +
        '<div class="pic-rows">' +
        '<div><p class="lbl">The picture: an arrangement of names. Exchange them.</p><div class="pic-row">' + p + '</div></div>' +
        '<div><p class="lbl">Reality</p><div class="pic-row">' + real.map(function (x) { return '<div class="tile">' + SHAPES[x] + '</div>'; }).join('<span style="width:2.05rem"></span>') +
        '<button type="button" class="chg" style="margin-left:.8rem">Change reality</button></div></div></div>' +
        '<p class="say">The picture says: ' + sayOrder(pic) + '.<br>' +
        (ok ? 'Reality agrees.' : 'In reality, ' + sayOrder(real) + '.') +
        ' <span class="verdict ' + (ok ? 'T' : 'F') + '">' + (ok ? 'The picture is true' : 'The picture is false') + '</span></p>';
    }
    on(b, 'click', '.swap', function (t) { var i = +t.dataset.i, x = pic[i]; pic[i] = pic[i + 1]; pic[i + 1] = x; render(); });
    on(b, 'click', '.chg', function () {
      var old = real.join();
      do { real = [0, 1, 2].sort(function () { return Math.random() - 0.5; }); } while (real.join() === old);
      render();
    });
    render();
  };

  /* ── sign and symbol ── */
  labs.signs = function (el) {
    var b = frame(el, 'One sign, three symbols',
      'The written sign “is” appears three times. Its use is different each time. The logical notation has three different constructions for it, and no common part.');
    var S = [
      { w: [['Green', 'a proper name', 'It stands for a person: Mr Green.'], ['is', 'the copula', 'It attaches a property to a thing. In the notation it is not a separate sign. It is the way in which the two other signs are put together.'], ['green', 'an adjective', 'It gives a property.']],
        f: [['<i>g</i>', 2], ['(', 1], ['<i>G</i>', 0], [')', 1]] },
      { w: [['The morning star', 'a name', 'It stands for a planet.'], ['is', 'the sign of equality', 'It says that two names stand for the same thing.'], ['the evening star', 'a name', 'It stands for the same planet.']],
        f: [['<i>a</i>', 0], [' = ', 1], ['<i>b</i>', 2]] },
      { w: [['There is', 'the expression of existence', 'It says that at least one thing has the property. It does not name a thing, and it gives no property.'], ['a rose', 'a concept word', 'It gives a property: to be a rose.']],
        f: [['(∃<i>x</i>)', 0], [' . ', -1], ['<i>f</i>', 1], ['<i>x</i>', 0]] }
    ];
    var sel = [0, 1];
    function render() {
      var h = '';
      S.forEach(function (s, i) {
        h += '<div class="two" style="align-items:center"><div class="sent">' + s.w.map(function (w, j) {
          var cur = sel[0] === i && sel[1] === j;
          return '<button type="button" data-s="' + i + '" data-w="' + j + '" class="' + (cur ? 'on' : '') + '" aria-pressed="' + cur + '">' + w[0] + '</button>';
        }).join('') + '</div><div class="formal">' + s.f.map(function (f) {
          return '<span class="' + (sel[0] === i && sel[1] === f[1] ? 'hl' : '') + '">' + f[0] + '</span>';
        }).join('') + '</div></div>';
      });
      var w = S[sel[0]].w[sel[1]];
      h += '<p class="say">Sign: “' + w[0] + '”. Symbol in this sentence: <em>' + w[1] + '</em>. ' + w[2] + '</p>';
      b.innerHTML = h;
    }
    on(b, 'click', '.sent button', function (t) { sel = [+t.dataset.s, +t.dataset.w]; render(); });
    render();
  };

  /* ── truth-possibilities: make a proposition ── */
  labs.table = function (el) {
    var b = frame(el, 'A proposition as a selection of rows',
      'The last column is the whole proposition. Wittgenstein writes it as one line, for example (TTFT)(<i class="v">p</i>, <i class="v">q</i>). The more rows a proposition excludes, the more it says.');
    var col = 'TTFT'.split('');
    function render() {
      var key = col.join(''), f = FN[key], open = col.filter(function (c) { return c === 'T'; }).length;
      var rows = ROWS.map(function (r, i) {
        return '<tr><td class="wm">' + world(i) + '</td><td class="' + (r[0] ? 'T' : 'x') + '">' + (r[0] ? 'T' : 'F') + '</td><td class="' + (r[1] ? 'T' : 'x') + '">' + (r[1] ? 'T' : 'F') +
          '</td><td class="res"><button type="button" data-i="' + i + '" class="' + (col[i] === 'T' ? 'on' : '') + '" aria-label="Row ' + (i + 1) + ': the proposition is ' + (col[i] === 'T' ? 'true' : 'false') + '. Change.">' + col[i] + '</button></td></tr>';
      }).join('');
      var extra = '';
      if (open === 4) extra = 'It agrees with every possibility. So it excludes nothing and says nothing. It is <em>without sense</em>, but it is not nonsense.';
      else if (open === 0) extra = 'It agrees with no possibility. It excludes everything, so it also says nothing about how things are. It is <em>without sense</em>, but it is not nonsense.';
      else extra = 'It leaves ' + open + ' of 4 possibilities open and excludes ' + (4 - open) + '. If you know that it is true, you know that the world is one of the lit rows.';
      b.innerHTML =
        '<div class="tt-grid"><table class="ttab"><tr><th class="hw">world</th><th>p</th><th>q</th><th class="hw">your<br>proposition</th></tr>' + rows + '</table>' +
        '<div class="readout"><p class="lbl">You made</p><h6>' + ital(f[0]) + '</h6><p class="not">(' + key + ')(<i>p</i>, <i>q</i>) &nbsp; ' + ital(f[1]) + '</p>' +
        '<p class="lbl">Range that it leaves to the facts</p><div class="range">' + col.map(function (c) { return '<i class="' + c + '"></i>'; }).join('') + '</div>' +
        '<p class="say">' + extra + '</p></div></div>';
    }
    on(b, 'click', '.res button', function (t) { var i = +t.dataset.i; col[i] = col[i] === 'T' ? 'F' : 'T'; render(); });
    render();
  };

  /* ── following and probability ── */
  labs.follows = function (el) {
    var b = frame(el, 'What follows from what',
      'To follow is to be contained. Nothing new comes out of an inference. Try “<i class="v">p</i>” and “<i class="v">q</i>”: no elementary proposition follows from another.');
    var A = 'TFFF', B = 'TTTF';
    function opts(sel) {
      return ORDER.map(function (k) { return '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + FN[k][0] + '</option>'; }).join('');
    }
    b.innerHTML =
      '<div class="two"><label class="sel"><span class="lbl">Proposition r</span><select id="lab-follows-r">' + opts(A) + '</select></label>' +
      '<label class="sel"><span class="lbl">Proposition s</span><select id="lab-follows-s">' + opts(B) + '</select></label></div><div class="out"></div>';
    var out = b.querySelector('.out');
    function render() {
      var tr = 0, trs = 0, bad = 0;
      var rows = ROWS.map(function (r, i) {
        var a = A[i] === 'T', c = B[i] === 'T';
        if (a) { tr++; if (c) trs++; else bad++; }
        return '<tr><td class="wm">' + world(i) + '</td><td>' + tv(a) + '</td><td>' + tv(c) + '</td><td class="hw" style="text-align:left;font:400 .8rem/1.3 var(--sans);color:var(--dim)">' +
          (a && c ? 'truth-ground of both' : a ? 'r true, s false' : '') + '</td></tr>';
      }).join('');
      var say;
      if (tr === 0) say = '<em>r</em> has no truth-grounds: it is a contradiction. No possibility makes it true, so the question has no content here.';
      else if (bad === 0) say = '<em>s follows from r.</em> Every possibility that makes r true also makes s true. The truth-grounds of r are contained in those of s. So s says nothing that r did not say.';
      else say = '<em>s does not follow from r.</em> In ' + bad + ' possibilit' + (bad > 1 ? 'ies' : 'y') + ' r is true and s is false.';
      if (tr > 0) say += '<br>Probability that r gives to s: ' + trs + ' of ' + tr + (trs === tr ? ' = 1, the certainty of a logical conclusion.' : trs === 0 ? ' = 0. r excludes s.' : '.');
      out.innerHTML = '<div class="tt-grid"><table class="ttab"><tr><th class="hw">world</th><th>r</th><th>s</th><th></th></tr>' + rows + '</table><p class="say">' + say + '</p></div>';
    }
    b.addEventListener('change', function (e) {
      if (e.target.id === 'lab-follows-r') A = e.target.value; else B = e.target.value;
      render();
    });
    render();
  };

  /* ── the operation N ── */
  labs.nop = function (el) {
    var b = frame(el, 'Build everything with N',
      'N has no content of its own. It adds no object to the picture. It only makes a new selection of rows from selections that you have.');
    var pool, got, msg;
    function reset() {
      pool = [{ ex: 'p', col: 'TFTF', sel: false }, { ex: 'q', col: 'TTFF', sel: false }];
      got = { TFTF: 'p', TTFF: 'q' };
      msg = 'Select one or more propositions. Then apply N. The result is true in the rows where all of them are false.';
    }
    function cols(c, small) { return c.split('').map(function (x) { return tv(x === 'T', small); }).join(''); }
    function render() {
      var n = pool.filter(function (p) { return p.sel; }).length, have = Object.keys(got).length;
      b.innerHTML =
        '<div><p class="lbl">Propositions that you have. Under each: its four rows.</p><div class="pool">' + pool.map(function (p, i) {
          return '<button type="button" data-i="' + i + '" aria-pressed="' + p.sel + '"><span class="ex">' + ital(p.ex) + '</span><span class="cl">' + cols(p.col) + '</span></button>';
        }).join('') + '</div></div>' +
        '<div class="row"><button type="button" class="apply"' + (n ? '' : ' disabled') + '>Apply N to the selection</button><button type="button" class="again">Start again</button></div>' +
        '<p class="say">' + msg + '</p>' +
        '<div><p class="lbl">Truth-functions of p and q that you have reached: ' + have + ' of 16</p><div class="sixteen">' + ORDER.map(function (k) {
          return '<div class="' + (got[k] ? 'got' : '') + '"><span>' + cols(k, true) + '</span>' + ital(FN[k][0]) + '</div>';
        }).join('') + '</div></div>';
    }
    on(b, 'click', '.pool button', function (t) { var p = pool[+t.dataset.i]; p.sel = !p.sel; render(); });
    on(b, 'click', '.again', function () { reset(); render(); });
    on(b, 'click', '.apply', function () {
      var s = pool.filter(function (p) { return p.sel; });
      if (!s.length) return;
      var col = [0, 1, 2, 3].map(function (r) { return s.every(function (p) { return p.col[r] === 'F'; }) ? 'T' : 'F'; }).join('');
      var ex = 'N(' + s.map(function (p) { return p.ex; }).join(', ') + ')';
      pool.forEach(function (p) { p.sel = false; });
      if (got[col]) {
        msg = '<em>' + ital(ex) + '</em> selects the same rows as <em>' + ital(got[col]) + '</em>. They are the same truth-function: “' + ital(FN[col][0]) + '”. Two different signs, one symbol (5.41).';
      } else {
        got[col] = ex;
        pool.push({ ex: ex, col: col, sel: false });
        msg = 'New: <em>' + ital(ex) + '</em> is “' + ital(FN[col][0]) + '”.';
        if (Object.keys(got).length === 16) msg += ' You have all sixteen. Every truth-function of p and q is a result of N.';
      }
      render();
    });
    reset(); render();
  };

  /* ── the general form of proposition ── */
  labs.form = function (el) {
    var b = frame(el, 'The general form, part by part',
      'The bracket has the pattern of remark 5.2522: [first term, any term, the term that follows it]. It describes a series by its start and its step.');
    var parts = [
      ['<span class="ol"><i>p</i></span>', 'The start: all elementary propositions.', 'The line above the letter means “all of them”. These are the propositions that say that one atomic fact exists.', 0],
      ['<span class="ol"><i>ξ</i></span>', 'Any selection of propositions that you have at this time.', 'ξ (xi) is a variable. Its values are propositions. The line means: all the propositions in the selection.', 1],
      ['<i>N</i>(<span class="ol"><i>ξ</i></span>)', 'The step: deny all propositions in the selection together.', 'The result is one new proposition. Add it to what you have. Then the step can be applied again.', 2]
    ];
    var sel = 0;
    function render() {
      b.innerHTML =
        '<div class="gform">[' + parts.map(function (p, i) {
          return '<button type="button" data-i="' + i + '" class="' + (sel === i ? 'on' : '') + '" aria-pressed="' + (sel === i) + '">' + p[0] + '</button>';
        }).join(',&nbsp;') + ']</div>' +
        '<p class="say"><em>' + parts[sel][1] + '</em> ' + parts[sel][2] + '</p>' +
        '<div><p class="lbl">The formula as a procedure</p><ol class="steps">' +
        '<li class="' + (sel === 0 ? 'on' : '') + '">Start with all elementary propositions.</li>' +
        '<li class="' + (sel === 1 ? 'on' : '') + '">Take any of the propositions that you have.</li>' +
        '<li class="' + (sel === 2 ? 'on' : '') + '">Apply N to them. Add the result to what you have.</li>' +
        '<li class="' + (sel === 2 ? 'on' : '') + '">Go back to step 2.</li></ol></div>';
    }
    on(b, 'click', '.gform button', function (t) { sel = +t.dataset.i; render(); });
    render();
  };

  /* ── the net (6.341) ── */
  labs.mesh = function (el) {
    var b = frame(el, 'A surface and a net',
      'Every net can describe the surface, if it is fine enough. So the shape of the net tells you nothing about the surface. What you learn about the surface is how fine a given net must be.');
    b.innerHTML =
      '<div class="mesh-wrap"><canvas width="920" height="575" role="img" aria-label="An irregular surface described by a net of cells"></canvas></div>' +
      '<div class="ctrl"><div class="row" role="group" aria-label="Form of the net">' +
      ['square', 'triangle', 'hexagon'].map(function (k, i) { return '<button type="button" class="chip" data-k="' + k + '" aria-pressed="' + (i === 0) + '">' + k + '</button>'; }).join('') + '</div>' +
      '<label for="lab-mesh-fine">Coarse <input id="lab-mesh-fine" type="range" min="0" max="100" value="38"> Fine</label>' +
      '<label for="lab-mesh-surf"><input id="lab-mesh-surf" type="checkbox" checked> Show the surface</label></div>' +
      '<p class="say"></p>';
    var cv = b.querySelector('canvas'), g = cv.getContext('2d'), say = b.querySelector('.say');
    var kind = 'square', fine = 38, surf = true, Wc = cv.width, Hc = cv.height;
    var blobs = [[230, 190, 120], [330, 300, 95], [150, 360, 70], [610, 210, 105], [700, 330, 130], [560, 420, 60], [800, 150, 55], [440, 130, 48]];
    function inside(x, y) {
      var s = 0;
      for (var i = 0; i < blobs.length; i++) { var dx = x - blobs[i][0], dy = y - blobs[i][1]; s += Math.exp(-(dx * dx + dy * dy) / (blobs[i][2] * blobs[i][2] * 0.55)); }
      return s + 0.09 * Math.sin(x * 0.045) * Math.cos(y * 0.05) > 0.62;
    }
    // the surface itself, drawn once
    var base = document.createElement('canvas'); base.width = Wc / 2; base.height = Hc / 2;
    (function () {
      var bg = base.getContext('2d'), im = bg.createImageData(base.width, base.height);
      for (var y = 0; y < base.height; y++) for (var x = 0; x < base.width; x++) {
        var o = (y * base.width + x) * 4, inn = inside(x * 2 + 1, y * 2 + 1);
        im.data[o] = 150; im.data[o + 1] = 172; im.data[o + 2] = 214; im.data[o + 3] = inn ? 70 : 0;
      }
      bg.putImageData(im, 0, 0);
    })();
    function cells() {
      var s = 150 - fine * 1.32, list = [], x, y, r, c;
      if (kind === 'square') {
        for (y = 0; y < Hc; y += s) for (x = 0; x < Wc; x += s) list.push([[x, y], [x + s, y], [x + s, y + s], [x, y + s]]);
      } else if (kind === 'triangle') {
        s *= 1.5; var h = s * 0.866;
        for (r = 0; r * h < Hc; r++) for (c = -1; c * s / 2 < Wc; c++) {
          x = c * s / 2; y = r * h;
          list.push((r + c) % 2 === 0 ? [[x, y + h], [x + s, y + h], [x + s / 2, y]] : [[x, y], [x + s, y], [x + s / 2, y + h]]);
        }
      } else {
        var R = s * 0.62, w = R * 1.732;
        for (r = 0; r * R * 1.5 < Hc + R; r++) for (c = 0; c * w < Wc + w; c++) {
          var cx = c * w + (r % 2 ? w / 2 : 0), cy = r * R * 1.5, poly = [];
          for (var k = 0; k < 6; k++) { var a = Math.PI / 6 + k * Math.PI / 3; poly.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); }
          list.push(poly);
        }
      }
      return list;
    }
    function draw() {
      g.clearRect(0, 0, Wc, Hc);
      if (surf) g.drawImage(base, 0, 0, Wc, Hc);
      var list = cells(), lit = 0, wrong = 0;
      g.lineWidth = 1;
      list.forEach(function (poly) {
        var cx = 0, cy = 0;
        poly.forEach(function (p) { cx += p[0]; cy += p[1]; });
        cx /= poly.length; cy /= poly.length;
        var inn = inside(cx, cy);
        // how well does one yes/no describe this cell? sample its corners
        var mixed = poly.some(function (p) { return inside(p[0], p[1]) !== inn; });
        if (mixed) wrong++;
        g.beginPath();
        poly.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); });
        g.closePath();
        if (inn) { lit++; g.fillStyle = 'rgba(230,182,114,' + (surf ? 0.5 : 0.85) + ')'; g.fill(); }
        g.strokeStyle = 'rgba(118,130,154,.42)'; g.stroke();
      });
      say.innerHTML = 'The description: one “yes” or “no” for each of <em>' + list.length + '</em> cells. “Yes” for ' + lit + ' of them. ' +
        (wrong ? wrong + ' cells lie across an edge of the surface. There the description is not exact.' : 'No cell lies across an edge.') +
        ' Change the form of the net. The surface stays the same. The description changes.';
    }
    on(b, 'click', '.chip', function (t) {
      kind = t.dataset.k;
      b.querySelectorAll('.chip').forEach(function (c) { c.setAttribute('aria-pressed', c === t); });
      draw();
    });
    b.querySelector('#lab-mesh-fine').addEventListener('input', function (e) { fine = +e.target.value; draw(); });
    b.querySelector('#lab-mesh-surf').addEventListener('change', function (e) { surf = e.target.checked; draw(); });
    draw();
  };

  /* ── the diagrams of the original ── */
  var FIGS = {
    cube: '<svg viewBox="0 0 220 170" width="220" fill="none" stroke="currentColor" stroke-width="1.2" role="img" aria-label="A cube drawn in outline, with its corners marked a and b">' +
      '<rect x="30" y="55" width="100" height="100"/><rect x="80" y="15" width="100" height="100"/>' +
      '<path d="M30 55 80 15M130 55 180 15M30 155 80 115M130 155 180 115"/>' +
      '<g fill="currentColor" stroke="none" font-family="STIX Two Text, serif" font-style="italic" font-size="15">' +
      '<text x="16" y="52">a</text><text x="136" y="52">a</text><text x="16" y="166">a</text><text x="136" y="166">a</text>' +
      '<text x="68" y="14">b</text><text x="186" y="14">b</text><text x="68" y="128">b</text><text x="186" y="128">b</text></g></svg>',
    sight: '<svg viewBox="0 0 260 120" width="260" fill="none" stroke="currentColor" stroke-width="1.2" role="img" aria-label="A drop-shaped field with a small eye at its narrow end">' +
      '<path d="M52 60C90 10 250 6 250 60S90 110 52 60Z"/><circle cx="62" cy="60" r="6"/>' +
      '<text x="6" y="64" fill="currentColor" stroke="none" font-family="EB Garamond, serif" font-size="15">Eye —</text></svg>',
    space: '<svg viewBox="0 0 320 50" width="320" fill="none" stroke="currentColor" stroke-width="1.2" role="img" aria-label="Two congruent figures a and b on one line, as mirror images">' +
      '<path d="M10 22H50M270 22H310" stroke-dasharray="5 5"/><path d="M60 22H140M180 22H260"/>' +
      '<circle cx="60" cy="22" r="4"/><path d="M135 17 145 27M145 17 135 27M175 17 185 27M185 17 175 27"/><circle cx="260" cy="22" r="4"/>' +
      '<g fill="currentColor" stroke="none" font-family="STIX Two Text, serif" font-style="italic" font-size="15"><text x="96" y="44">a</text><text x="216" y="44">b</text></g></svg>'
  };
  /* The bracket notation of 6.1203, redrawn. A brace joins one truth-value of each
     argument; a thin line carries that combination to the T or F of the whole. */
  (function () {
    function mk(w, h, label, body) {
      return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" role="img" aria-label="' + label + '">' + body + '</svg>';
    }
    function tx(x, y, t, size) {
      return '<text x="' + x + '" y="' + y + '" text-anchor="middle" fill="currentColor" stroke="none" font-family="STIX Two Text, Times New Roman, serif" font-style="italic" font-size="' + (size || 17) + '">' + t + '</text>';
    }
    function ln(a, b) { return '<path stroke-width=".8" d="M' + a[0] + ' ' + a[1] + 'L' + b[0] + ' ' + b[1] + '"/>'; }
    // a curly brace from a to b; h > 0 bulges to the left of the direction a→b (up, for left-to-right)
    function brace(a, b, h, c) {
      var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = uy, ny = -ux;
      var q = Math.min(13, L * 0.12), m = L * (c || 0.5);
      function P(t, v) { return (a[0] + ux * t + nx * v).toFixed(1) + ' ' + (a[1] + uy * t + ny * v).toFixed(1); }
      var d = 'M' + P(0, 0) + 'Q' + P(0, h / 2) + ' ' + P(q, h / 2) + 'L' + P(m - q, h / 2) + 'Q' + P(m, h / 2) + ' ' + P(m, h) +
        'Q' + P(m, h / 2) + ' ' + P(m + q, h / 2) + 'L' + P(L - q, h / 2) + 'Q' + P(L, h / 2) + ' ' + P(L, 0);
      return { d: '<path d="' + d + '"/>', cusp: [a[0] + ux * m + nx * h, a[1] + uy * m + ny * h] };
    }
    function pair(l, r, y) {
      return tx(20, y, 'T') + tx(43, y, l) + tx(66, y, 'F') + tx(246, y, 'T') + tx(271, y, r) + tx(296, y, 'F');
    }
    // 01, 02: the four truth-combinations of p and q; then p ⊃ q
    var y = 96;
    var tt = brace([20, y - 18], [246, y - 18], 14), tf = brace([13, y - 20], [303, y - 20], 36, 0.56);
    var ft = brace([66, y + 8], [246, y + 8], -14), ff = brace([73, y + 10], [303, y + 10], -36, 0.56);
    var four = tt.d + tf.d + ft.d + ff.d + pair('p', 'q', y);
    FIGS.brackets01 = mk(320, 160, 'T p F and T q F. Four braces join T with T, T with F, F with T, and F with F.', four);
    FIGS.brackets02 = mk(320, 190, 'The same braces. The combination p true, q false is joined to F. The other three are joined to T.',
      four + tx(tf.cusp[0] + 9, tf.cusp[1] - 4, 'F', 15) + tx(168, 184, 'T', 15) +
      ln(tt.cusp, [164, 170]) + ln(ft.cusp, [166, 170]) + ln(ff.cusp, [172, 172]));
    // 03: negation exchanges T and F
    FIGS.brackets03 = mk(130, 150, 'T above is joined to the F of T xi F. The T of T xi F is joined to F below.',
      tx(34, 24, 'T', 19) + tx(22, 82, '“', 19) + tx(44, 82, 'T', 19) + tx(64, 82, 'ξ', 19) + tx(84, 82, 'F', 19) + tx(104, 82, '”', 19) +
      tx(92, 140, 'F', 19) + ln([42, 30], [80, 64]) + ln([48, 90], [86, 124]));
    // 04: ξ . η is true for one combination only
    y = 100;
    var a = brace([66, y - 18], [303, y - 20], 36, 0.5), b = brace([73, y - 16], [246, y - 16], 14, 0.5);
    var c = brace([20, y + 8], [246, y + 8], -14, 0.42), e = brace([13, y + 10], [296, y + 12], -36, 0.5);
    FIGS.brackets04 = mk(320, 200, 'T xi F and T eta F. The combination T with T is joined to T. The other three combinations are joined to F.',
      a.d + b.d + c.d + e.d + pair('ξ', 'η', y) + tx(c.cusp[0], 16, 'T', 15) + tx(182, 194, 'F', 15) +
      ln(c.cusp, [c.cusp[0], 22]) + ln(a.cusp, [181, 180]) + ln(b.cusp, [178, 180]) + ln(e.cusp, [176, 181]));
    // 05: ∼(p . ∼q)
    var g = brace([70, 118], [300, 178], 15, 0.45), h = brace([60, 116], [352, 178], 42, 0.5);
    var i = brace([92, 262], [300, 204], -15, 0.5), j = brace([84, 268], [352, 206], -42, 0.55);
    FIGS.brackets05 = mk(400, 350, 'The sign for not (p and not q), built from the three signs above: T q F with its values exchanged, braces to T p F, and the result exchanged once more.',
      g.d + h.d + i.d + j.d +
      tx(40, 198, 'T') + tx(62, 198, 'q') + tx(86, 198, 'F') + tx(60, 134, 'T') + tx(78, 264, 'F') +
      ln([66, 140], [84, 182]) + ln([44, 205], [70, 248]) +
      tx(300, 198, 'T') + tx(324, 198, 'p') + tx(350, 198, 'F') +
      tx(150, 62, 'T') + ln(g.cusp, [156, 68]) + ln([160, 52], [184, 34]) + tx(192, 32, 'F') +
      tx(262, 318, 'F') + ln(h.cusp, [258, 302]) + ln(i.cusp, [254, 304]) + ln(j.cusp, [256, 303]) +
      ln([272, 320], [296, 334]) + tx(306, 342, 'T'));
  })();

  window.Labs = {
    mount: function () {
      document.querySelectorAll('.lab[data-lab]').forEach(function (el) {
        var f = labs[el.dataset.lab];
        if (f && !el.dataset.ready) { el.dataset.ready = '1'; f(el); }
      });
    },
    figures: function (root) {
      root.querySelectorAll('figure.fig[data-fig]').forEach(function (f) {
        if (f.firstChild) return;
        var k = f.dataset.fig;
        f.innerHTML = FIGS[k] || '';
      });
    }
  };
})();
