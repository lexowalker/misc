/* Glue: puts every remark of the book on the route in its order, places the guide's
   notes between them, drives the field from the scroll position, and runs the
   glossary, the reading depth and the atlas. */
(function () {
  'use strict';

  var TLP = window.TLP || [];
  var Cosmos = window.Cosmos || {};
  var byN = {}, order = {}, kids = {}, level = {}, below = {};
  TLP.forEach(function (p, i) { byN[p.n] = p; order[p.n] = i; kids[p.n] = []; below[p.n] = 0; });
  TLP.forEach(function (p) {
    if (p.p) kids[p.p].push(p.n);
    level[p.n] = p.p ? level[p.p] + 1 : 0;
    for (var a = p.p; a; a = byN[a].p) below[a]++;
  });

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function plain(html) {
    var d = document.createElement('div');
    d.innerHTML = html.replace(/<\/(p|div|tr)>/g, ' $&');
    return d.textContent.replace(/\s+/g, ' ').trim();
  }
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function rid(n) { return 'r' + n.replace('.', '-'); }
  function teaser(n, max) {
    var t = plain(byN[n].en).replace(/\*$/, '');
    max = max || 120;
    return t.length > max ? t.slice(0, max).replace(/\s\S*$/, '') + ' …' : t;
  }
  function on(type, sel, fn) {
    document.addEventListener(type, function (e) { var t = e.target.closest(sel); if (t) fn(t, e); });
  }

  /* ───────── terms ───────── */
  // [term, name in the Pears–McGuinness translation (if different), definition, remark]
  var TERMS = {
    'fact': ['Fact', '', 'Something that is the case. A fact can be complex. It then consists in the existence and non-existence of atomic facts.', '2'],
    'atomic-fact': ['Atomic fact', 'state of affairs', 'The simplest possible fact: a direct combination of objects. Each atomic fact exists or does not exist, independently of all others.', '2.01'],
    'state-of-affairs': ['State of affairs', 'situation', 'In this translation: any possible situation, simple or complex. Do not confuse it with “state of affairs” in later translations, which is the atomic fact.', '2.0122'],
    'object': ['Object', '', 'A simple thing without parts. Objects are the same in every possible world. They occur only in combination with other objects. Wittgenstein gives no example.', '2.02'],
    'form': ['Form (of an object)', '', 'The possibilities of combination that an object has: all the atomic facts in which it can occur.', '2.0141'],
    'substance': ['Substance', '', 'The totality of objects. It is what stays the same, whatever is the case.', '2.021'],
    'structure': ['Structure', '', 'The definite way in which the parts of a fact or of a picture are combined. Form is the possibility of a structure.', '2.032'],
    'logical-space': ['Logical space', '', 'The totality of possibilities. Each place in it is a possible situation. The world is the part that is actual.', '1.13'],
    'picture': ['Picture', '', 'A fact that is used as a model of another fact. Its elements stand for things. The arrangement of its elements shows an arrangement of the things.', '2.1'],
    'form-of-representation': ['Form of representation', 'pictorial form', 'What a picture has in common with the thing that it shows, so that it can show it. A spatial model has spatial form in common with a spatial scene.', '2.17'],
    'logical-form': ['Logical form', '', 'The minimum that every picture has in common with reality: the possibility of structure. It cannot be represented. It shows itself.', '2.18'],
    'sense': ['Sense', '', 'What a picture or a proposition shows: a possible situation. A proposition has its sense whether it is true or false.', '2.221'],
    'meaning': ['Meaning', '', 'The object that a name stands for. In this book only names have meaning. Propositions have sense.', '3.203'],
    'thought': ['Thought', '', 'A logical picture of facts. It is not a mental event of a special kind. It is a proposition with sense.', '3'],
    'propositional-sign': ['Propositional sign', '', 'The sentence as something that you can see or hear. It is itself a fact: its words have a definite arrangement.', '3.12'],
    'proposition': ['Proposition', '', 'A propositional sign in use: a sentence that says that something is the case. It is true or false.', '3.12'],
    'name': ['Name', '', 'A simple sign. It stands for one object and cannot be defined further.', '3.202'],
    'expression': ['Expression', '', 'Any part of a proposition that contributes to its sense. An expression is the common mark of a class of propositions. Wittgenstein also calls it a symbol.', '3.31'],
    'symbol': ['Symbol', '', 'A sign together with its logical use. One sign can belong to different symbols.', '3.32'],
    'variable': ['Variable', '', 'A sign that stands for any member of a class of expressions. Its values are the expressions that have a form in common.', '3.313'],
    'elementary-proposition': ['Elementary proposition', '', 'The simplest kind of proposition: a combination of names. It says that one atomic fact exists. No elementary proposition can contradict another.', '4.21'],
    'truth-possibilities': ['Truth-possibilities', '', 'The combinations of “true” and “false” for a set of elementary propositions. They are the rows of a truth-table.', '4.3'],
    'truth-conditions': ['Truth-conditions', '', 'The truth-possibilities with which a proposition agrees. To give them is to give the proposition.', '4.431'],
    'truth-function': ['Truth-function', '', 'A proposition whose truth depends only on the truth or falsity of other propositions.', '5'],
    'truth-grounds': ['Truth-grounds', '', 'The truth-possibilities that make a proposition true: the rows in which it has a T.', '5.101'],
    'tautology': ['Tautology', '', 'A proposition that is true for all truth-possibilities. It says nothing. It is without sense, but it is not nonsense.', '4.46'],
    'contradiction': ['Contradiction', '', 'A proposition that is false for all truth-possibilities. It is the opposite limit to tautology.', '4.46'],
    'say-show': ['Saying and showing', '', 'A proposition says that a situation is real. It shows its sense and its logical form by the way it is built. What can be shown cannot be said.', '4.1212'],
    'internal': ['Internal property, internal relation', '', 'A property or relation that a thing cannot lack, because it belongs to the thing\'s form. It cannot be stated. It shows itself in the propositions about the thing.', '4.123'],
    'formal-concept': ['Formal concept', '', 'A concept such as “object”, “fact” or “number”. It does not sort things into those that fall under it and those that do not. A logical notation expresses it by a kind of variable, not by a predicate.', '4.126'],
    'formal-series': ['Formal series', '', 'A series in which each member is made from the one before by the same operation. The numbers are the best-known case.', '4.1252'],
    'operation': ['Operation', '', 'What must be done to propositions to make a new proposition from them. An operation is not a part of the result, and it stands for nothing.', '5.23'],
    'n-operator': ['The operation N', '', 'Joint negation. N of some propositions is true when all of them are false. All truth-functions can be made with it.', '5.502'],
    'solipsism': ['Solipsism', '', 'The view that only I and my experience exist. Wittgenstein says that what it means is correct, but that it cannot be said.', '5.62'],
    'transcendental': ['Transcendental', '', 'Not a fact in the world, but a condition of the world. The book uses the word for logic and for ethics. (This definition is the guide\'s. The book does not define the word.)', '6.13'],
    'mystical': ['The mystical', '', 'That the world is. Also: the feeling of the world as a limited whole. It cannot be said. It shows itself.', '6.44']
  };

  /* ───────── the book on the route ───────── */
  function quote(p) {
    var q = document.createElement('blockquote'), lv = level[p.n];
    q.className = 'w'; q.id = rid(p.n);
    q.dataset.n = p.n; q.dataset.lv = lv; q.style.setProperty('--lv', lv);
    q.innerHTML =
      '<a class="wn" data-n="' + p.n + '" role="button" tabindex="0" title="Open remark ' + p.n + ' in the Atlas">' + p.n + '</a>' +
      '<div class="wt">' + p.en + '</div>' +
      (below[p.n] ? '<button type="button" class="more" data-all title="Show the ' + below[p.n] + ' remarks below ' + p.n + '">+' + below[p.n] + ' below</button>' : '');
    return q;
  }
  /* Each station holds every remark of its book, in the order of the book. The guide's
     notes are written in the page with data-a="n" (after remark n) or data-b="n" (before). */
  function buildBooks() {
    $$('.book').forEach(function (book) {
      var k = book.dataset.book, before = {}, after = {}, tail = [], frag = document.createDocumentFragment();
      Array.prototype.slice.call(book.children).forEach(function (el) {
        var a = el.dataset.a, b = el.dataset.b, n = a || b;
        if (!n) { tail.push(el); return; }
        if (!byN[n]) { console.warn('Note for unknown remark', n); tail.push(el); return; }
        el.dataset.lv = level[n]; el.style.setProperty('--lv', level[n]);
        var map = a ? after : before;
        (map[n] = map[n] || []).push(el);
      });
      function put(list) { (list || []).forEach(function (el) { frag.appendChild(el); }); }
      if (byN[k].enNote) {
        var fn = document.createElement('blockquote');
        fn.className = 'w footnote';
        fn.innerHTML = '<span class="wn">*</span><div class="wt"><p>' + byN[k].enNote[0] + '</p></div>';
        frag.appendChild(fn);
      }
      put(after[k]);
      TLP.forEach(function (p) {
        if (p.n.charAt(0) !== k || p.n === k) return;
        put(before[p.n]); frag.appendChild(quote(p)); put(after[p.n]);
      });
      put(tail);
      book.appendChild(frag);
    });
    $$('[data-main]').forEach(function (h) { h.innerHTML = byN[h.dataset.main].en; });
    $$('[data-main-en]').forEach(function (e) { e.textContent = plain(byN[e.dataset.mainEn].en); });
    $$('.w.sample[data-n]').forEach(function (q) {
      var p = byN[q.dataset.n];
      q.innerHTML = '<a class="wn" data-n="' + p.n + '" role="button" tabindex="0">' + p.n + '</a><div class="wt">' + p.en + '</div>';
    });
    var fn1 = $('#footnote-1');
    if (fn1 && byN['1'].enNote) fn1.innerHTML = '<p>' + byN['1'].enNote[0] + '</p>';
    // the branches of each book, as a table of contents for the station
    $$('[data-branches]').forEach(function (nav) {
      var list = kids[nav.dataset.branches];
      nav.innerHTML = '<p>The ' + list.length + ' direct comments on proposition ' + nav.dataset.branches + '</p>' + list.map(function (c) {
        return '<a href="#' + rid(c) + '"><b>' + c + '</b><span>' + esc(teaser(c, 78)) + '</span><i>' + (below[c] ? '+' + below[c] : '') + '</i></a>';
      }).join('');
    });
    if (window.Labs) window.Labs.figures(document);
  }

  /* ───────── stations and scroll ───────── */
  var stages = [], rail = $('#rail'), railLinks = [];
  function buildRail() {
    stages = $$('.stage');
    stages.forEach(function (s) {
      var k = +s.dataset.stage, a = document.createElement('a');
      a.href = '#' + s.id;
      a.innerHTML = '<b>' + (k === 0 ? '·' : k === 8 ? '∘' : k) + '</b><span>' + s.dataset.name + '</span>';
      a.setAttribute('aria-label', (k >= 1 && k <= 7 ? 'Station ' + k + ': ' : '') + s.dataset.name);
      rail.appendChild(a); railLinks.push(a);
    });
  }
  var quoteEls = [], curStage = -1, ticking = false, curFocus = null, lastBest = 0;
  function onScroll() {
    ticking = false;
    if (document.body.classList.contains('atlas')) return;
    var vh = window.innerHeight, line = vh * 0.5, i, s = 0, r;
    for (i = 0; i < stages.length; i++) {
      r = stages[i].getBoundingClientRect();
      if (r.top <= line) s = i;
    }
    r = stages[s].getBoundingClientRect();
    var u = Math.max(0, Math.min(1, (line - r.top) / r.height));
    var a = Math.min(0.5, (vh * 1.05) / r.height);
    if (s === 0) a = 0;
    var stageNo = +stages[s].dataset.stage;
    if (Cosmos.setJourney) Cosmos.setJourney(stageNo, u, a);
    if (s !== curStage) {
      curStage = s;
      document.body.dataset.stage = stageNo;
      railLinks.forEach(function (l, k) { l.classList.toggle('on', k === s); l.classList.toggle('done', k < s); });
      rail.classList.add('announce');
      clearTimeout(rail._t);
      rail._t = setTimeout(function () { rail.classList.remove('announce'); }, 2600);
    }
    // 7: the sentence appears, stays, and the field goes dark
    var seven = $('.seven');
    if (seven) {
      var sr = seven.parentNode.getBoundingClientRect();
      var k = (-vh * 0.4 - sr.top) / (vh * 0.5);
      var out = (sr.bottom - vh * 0.55) / (vh * 0.5);
      seven.style.setProperty('--seven', Math.max(0, Math.min(1, k, out)).toFixed(3));
    }
    // the remark nearest to the reading line is marked on the map
    var best = null, bd = vh * 0.34, target = vh * 0.42, n = quoteEls.length;
    if (n) {
      // the remarks are in document order: walk from the last hit towards the reading line
      i = Math.min(lastBest, n - 1);
      var q = quoteEls[i].getBoundingClientRect(), step = q.top > target ? -1 : 1, guard = 0;
      while (i >= 0 && i < n && guard++ < n) {
        q = quoteEls[i].getBoundingClientRect();
        if (q.height) {
          var d = q.top <= target && q.bottom >= target ? 0 : Math.min(Math.abs(q.top - target), Math.abs(q.bottom - target));
          if (d < bd) { bd = d; best = quoteEls[i].dataset.n; lastBest = i; }
          if (step > 0 ? q.top > target : q.bottom < target) break;
        }
        i += step;
      }
    }
    if (!best && stageNo >= 1 && stageNo <= 6 && u < a) best = String(stageNo);
    if (best !== curFocus) { curFocus = best; if (Cosmos.setFocus) Cosmos.setFocus(best); }
  }
  function requestScroll() { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }

  /* ───────── reading depth ───────── */
  // "1" shows only the direct comments on each main proposition, "2" one level more, and so on.
  function setDepth(d, keepPlace, anchor) {
    if (!/^[123]$/.test(d)) d = 'all';
    var top = null, vh = window.innerHeight;
    if (keepPlace && !anchor) {
      // Hold on to the first remark in view. If the new depth hides it, hold on to the
      // remark above it in the numbering that stays (2.0121, then 2.012, then 2.01).
      for (var i = 0; i < quoteEls.length; i++) {
        var r = quoteEls[i].getBoundingClientRect();
        if (!r.height || r.bottom < vh * 0.12) continue;
        if (r.top > vh) break;
        var n = quoteEls[i].dataset.n;
        while (d !== 'all' && n && level[n] > +d) n = byN[n].p;
        if (n && place[n] && place[n].classList.contains('w')) anchor = place[n];
        break;
      }
    }
    if (anchor && anchor.offsetParent) {
      var ar = anchor.getBoundingClientRect();
      if (ar.top >= 0 && ar.top < vh) top = ar.top;
    }
    document.body.dataset.depth = d;
    $$('[data-depth]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.depth === d); });
    try { localStorage.setItem('tlp-depth', d); } catch (err) {}
    if (anchor) window.scrollBy(0, anchor.getBoundingClientRect().top - (top === null ? vh * 0.3 : top));
    requestScroll();
  }
  function toRemark(el) {
    if (!el.offsetParent) setDepth('all');
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.3, behavior: 'instant' });
    requestScroll();
  }
  function toHash() {
    var el = location.hash.length > 1 && document.getElementById(location.hash.slice(1));
    if (el && el.classList.contains('w')) toRemark(el);
  }

  /* ───────── glossary ───────── */
  var pop = $('#pop'), popFor = null;
  function termHTML(key) {
    var t = TERMS[key]; if (!t) return '';
    return '<h5>' + t[0] + '</h5>' + (t[1] ? '<p class="orig">Later translation: “' + t[1] + '”</p>' : '') + '<p>' + t[2] + '</p>' +
      '<p><a class="ref" data-n="' + t[3] + '">' + t[3] + '</a></p>';
  }
  function closePop() {
    if (popFor) popFor.setAttribute('aria-expanded', 'false');
    pop.hidden = true; popFor = null;
  }
  function openPop(el) {
    if (popFor === el) { closePop(); return; }
    closePop();
    pop.innerHTML = termHTML(el.dataset.t);
    pop.hidden = false; popFor = el; el.setAttribute('aria-expanded', 'true');
    var r = el.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
    var x = Math.max(16, Math.min(window.innerWidth - pw - 16, r.left));
    var y = r.bottom + 10;
    if (y + ph > window.innerHeight - 10 && r.top - ph - 10 > 0) y = r.top - ph - 10;
    pop.style.left = x + window.scrollX + 'px';
    pop.style.top = y + window.scrollY + 'px';
  }
  function buildGlossary() {
    var g = $('#glossary'); if (!g) return;
    g.innerHTML = Object.keys(TERMS).map(function (k) {
      var t = TERMS[k];
      return '<div><dt>' + t[0] + (t[1] ? '<small>later translation: ' + t[1] + '</small>' : '') + '</dt><dd>' + t[2] + ' <a class="ref" data-n="' + t[3] + '">' + t[3] + '</a></dd></div>';
    }).join('');
    $$('.t').forEach(function (t) {
      if (!TERMS[t.dataset.t]) console.warn('Unknown term', t.dataset.t);
      t.tabIndex = 0; t.setAttribute('role', 'button'); t.setAttribute('aria-expanded', 'false');
    });
  }

  /* ───────── atlas ───────── */
  var atlas = $('#atlas'), abody = $('#atlas-body'), aq = $('#atlas-q'), btnAtlas = $('#btn-atlas');
  var atlasN = null, savedScroll = 0, place = {};
  function indexPlaces() {
    quoteEls = $$('#journey .book .w[data-n]');
    quoteEls.forEach(function (q) { place[q.dataset.n] = q; });
    $$('#journey [data-main]').forEach(function (q) { place[q.dataset.main] = q; });
    var seven = $('.seven'); if (seven) place['7'] = seven;
  }
  function renderAtlas(n) {
    var p = byN[n]; if (!p) return;
    atlasN = n;
    var chain = [], x = p.p ? byN[p.p] : null;
    while (x) { chain.unshift(x.n); x = x.p ? byN[x.p] : null; }
    var i = order[n], prev = TLP[i - 1], next = TLP[i + 1], ch = kids[n];
    var h = '<nav class="crumbs" aria-label="Position in the book">' +
      chain.map(function (c) { return '<button type="button" data-go="' + c + '">' + c + '</button><span>›</span>'; }).join('') + '<span>' + n + '</span></nav>';
    if (p.p) h += '<p class="ctx"><small>A comment on ' + p.p + '</small>' + esc(teaser(p.p)) + '</p>';
    h += '<article class="cur"><div class="num">' + n + '</div><div class="wt">' + p.en + '</div>' +
      (p.enNote ? '<p class="note">* ' + p.enNote[0] + '</p>' : '');
    if (place[n]) h += '<button type="button" class="tostation" data-jump="' + n + '">→ Read ' + n + ' in its place on the route</button>';
    h += '</article>';
    if (ch.length) {
      h += '<div class="kids"><h5>' + ch.length + ' comment' + (ch.length > 1 ? 's' : '') + ' on ' + n + '</h5>' + ch.map(function (c) {
        return '<button type="button" data-go="' + c + '"><b>' + c + (below[c] ? ' <i>+' + below[c] + '</i>' : '') + '</b><span>' + esc(teaser(c)) + '</span></button>';
      }).join('') + '</div>';
    }
    h += '<div class="anav"><span>' + (prev ? '<button type="button" data-go="' + prev.n + '">← ' + prev.n + '</button>' : '') + '</span><span>' +
      (next ? '<button type="button" data-go="' + next.n + '">' + next.n + ' →</button>' : '') + '</span></div>';
    abody.innerHTML = h;
    abody.scrollTop = 0;
    if (window.Labs) window.Labs.figures(abody);
    if (Cosmos.select) Cosmos.select(n);
    aq.value = n; aq.classList.remove('bad');
  }
  function openAtlas(n) {
    closePop();
    if (!document.body.classList.contains('atlas')) {
      savedScroll = window.scrollY;
      document.body.classList.add('atlas');
      atlas.hidden = false;
      btnAtlas.setAttribute('aria-pressed', 'true');
      btnAtlas.textContent = 'Close atlas';
      if (Cosmos.setMode) Cosmos.setMode('atlas');
    }
    renderAtlas(n || curFocus || (curStage >= 1 && curStage <= 7 ? String(curStage) : '1'));
  }
  function closeAtlas(jumpTo) {
    document.body.classList.remove('atlas');
    atlas.hidden = true;
    btnAtlas.setAttribute('aria-pressed', 'false');
    btnAtlas.textContent = 'Atlas';
    if (Cosmos.setMode) Cosmos.setMode('journey');
    if (jumpTo && place[jumpTo]) toRemark(place[jumpTo]);
    else window.scrollTo({ top: savedScroll, behavior: 'instant' });
    requestScroll();
  }

  /* ───────── events ───────── */
  function wire() {
    document.addEventListener('click', function (e) {
      var t;
      if ((t = e.target.closest('.t'))) { openPop(t); return; }
      if ((t = e.target.closest('[data-go]'))) { renderAtlas(t.dataset.go); return; }
      if ((t = e.target.closest('[data-jump]'))) { closeAtlas(t.dataset.jump); return; }
      if ((t = e.target.closest('[data-depth]'))) { setDepth(t.dataset.depth, true); return; }
      if ((t = e.target.closest('[data-all]'))) { setDepth('all', true, t.closest('.w')); return; }
      if ((t = e.target.closest('a.ref, a.wn'))) { e.preventDefault(); openAtlas(t.dataset.n); return; }
      if ((t = e.target.closest('[data-open-atlas]'))) { openAtlas(); return; }
      if (!e.target.closest('#pop')) closePop();
    });
    document.addEventListener('keydown', function (e) {
      var t = e.target;
      if ((e.key === 'Enter' || e.key === ' ') && t.matches && t.matches('.t, a.wn')) { e.preventDefault(); t.click(); return; }
      if (e.key === 'Escape') { if (!pop.hidden) closePop(); else if (document.body.classList.contains('atlas')) closeAtlas(); return; }
      if (!document.body.classList.contains('atlas') || t === aq) return;
      var i = order[atlasN];
      if (e.key === 'ArrowRight' && TLP[i + 1]) renderAtlas(TLP[i + 1].n);
      else if (e.key === 'ArrowLeft' && TLP[i - 1]) renderAtlas(TLP[i - 1].n);
      else if (e.key === 'ArrowUp' && byN[atlasN].p) { e.preventDefault(); renderAtlas(byN[atlasN].p); }
      else if (e.key === 'ArrowDown' && kids[atlasN].length) { e.preventDefault(); renderAtlas(kids[atlasN][0]); }
    });
    btnAtlas.addEventListener('click', function () {
      if (document.body.classList.contains('atlas')) closeAtlas(); else openAtlas();
    });
    rail.addEventListener('click', function () { if (document.body.classList.contains('atlas')) closeAtlas(); });
    aq.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var v = aq.value.trim().replace(',', '.');
      if (byN[v]) renderAtlas(v); else aq.classList.add('bad');
    });
    aq.addEventListener('input', function () { aq.classList.remove('bad'); });
    Cosmos.onPick = function (n) { renderAtlas(n); };

    window.addEventListener('hashchange', toHash);
    window.addEventListener('scroll', requestScroll, { passive: true });
    window.addEventListener('resize', requestScroll);
    $$('details').forEach(function (d) { d.addEventListener('toggle', requestScroll); });
  }

  buildBooks();
  buildRail();
  buildGlossary();
  if (window.Labs) window.Labs.mount();
  indexPlaces();
  wire();
  var saved = 'all';
  try { saved = localStorage.getItem('tlp-depth') || 'all'; } catch (err) {}
  setDepth(saved);
  toHash();
  onScroll();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(requestScroll);
})();
