/* Glue: fills the quotations from the source text, drives the field from the scroll
   position, and runs the glossary and the atlas. */
(function () {
  'use strict';

  var TLP = window.TLP || [];
  var Cosmos = window.Cosmos || {};
  var byN = {}, order = {}, kids = {};
  TLP.forEach(function (p, i) {
    byN[p.n] = p; order[p.n] = i; kids[p.n] = [];
    p.de = p.de.replace(/<figure[^>]*><\/figure>/g, '');   // the diagrams are shown once, with the English
  });
  TLP.forEach(function (p) { if (p.p) kids[p.p].push(p.n); });

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function plain(html) { var d = document.createElement('div'); d.innerHTML = html.replace(/<\/(p|div|tr)>/g, ' $&'); return d.textContent.replace(/\s+/g, ' ').trim(); }
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  /* ───────── terms ───────── */
  // [term, German, name in the Pears–McGuinness translation (if different), definition, remark]
  var TERMS = {
    'fact': ['Fact', 'Tatsache', '', 'Something that is the case. A fact can be complex. It then consists in the existence and non-existence of atomic facts.', '2'],
    'atomic-fact': ['Atomic fact', 'Sachverhalt', 'state of affairs', 'The simplest possible fact: a direct combination of objects. Each atomic fact exists or does not exist, independently of all others.', '2.01'],
    'state-of-affairs': ['State of affairs', 'Sachlage', 'situation', 'Ogden\'s word for any possible situation, simple or complex. Do not confuse it with “state of affairs” in later translations, which is the atomic fact.', '2.0122'],
    'object': ['Object', 'Gegenstand', '', 'A simple thing without parts. Objects are the same in every possible world. They occur only in combination with other objects. Wittgenstein gives no example.', '2.02'],
    'form': ['Form (of an object)', 'Form', '', 'The possibilities of combination that an object has: all the atomic facts in which it can occur.', '2.0141'],
    'substance': ['Substance', 'Substanz', '', 'The totality of objects. It is what stays the same, whatever is the case.', '2.021'],
    'logical-space': ['Logical space', 'logischer Raum', '', 'The totality of possibilities. Each place in it is a possible situation. The world is the part that is actual.', '1.13'],
    'picture': ['Picture', 'Bild', '', 'A fact that is used as a model of another fact. Its elements stand for things. The arrangement of its elements shows an arrangement of the things.', '2.1'],
    'form-of-representation': ['Form of representation', 'Form der Abbildung', 'pictorial form', 'What a picture has in common with the thing that it shows, so that it can show it. A spatial model has spatial form in common with a spatial scene.', '2.17'],
    'logical-form': ['Logical form', 'logische Form', '', 'The minimum that every picture has in common with reality: the possibility of structure. It cannot be represented. It shows itself.', '2.18'],
    'sense': ['Sense', 'Sinn', '', 'What a picture or a proposition shows: a possible situation. A proposition has its sense whether it is true or false.', '2.221'],
    'meaning': ['Meaning', 'Bedeutung', '', 'The object that a name stands for. In this book only names have meaning. Propositions have sense.', '3.203'],
    'thought': ['Thought', 'Gedanke', '', 'A logical picture of facts. It is not a mental event of a special kind. It is a proposition with sense.', '3'],
    'propositional-sign': ['Propositional sign', 'Satzzeichen', '', 'The sentence as something that you can see or hear. It is itself a fact: its words have a definite arrangement.', '3.12'],
    'proposition': ['Proposition', 'Satz', '', 'A propositional sign in use: a sentence that says that something is the case. It is true or false.', '3.12'],
    'name': ['Name', 'Name', '', 'A simple sign. It stands for one object and cannot be defined further.', '3.202'],
    'symbol': ['Symbol', 'Symbol', '', 'A sign together with its logical use. One sign can belong to different symbols.', '3.32'],
    'elementary-proposition': ['Elementary proposition', 'Elementarsatz', '', 'The simplest kind of proposition: a combination of names. It says that one atomic fact exists. No elementary proposition can contradict another.', '4.21'],
    'truth-possibilities': ['Truth-possibilities', 'Wahrheitsmöglichkeiten', '', 'The combinations of “true” and “false” for a set of elementary propositions. They are the rows of a truth-table.', '4.3'],
    'truth-function': ['Truth-function', 'Wahrheitsfunktion', '', 'A proposition whose truth depends only on the truth or falsity of other propositions.', '5'],
    'truth-grounds': ['Truth-grounds', 'Wahrheitsgründe', '', 'The truth-possibilities that make a proposition true: the rows in which it has a T.', '5.101'],
    'tautology': ['Tautology', 'Tautologie', '', 'A proposition that is true for all truth-possibilities. It says nothing. It is without sense, but it is not nonsense.', '4.46'],
    'contradiction': ['Contradiction', 'Kontradiktion', '', 'A proposition that is false for all truth-possibilities. It is the opposite limit to tautology.', '4.46'],
    'say-show': ['Saying and showing', 'sagen · zeigen', '', 'A proposition says that a situation is real. It shows its sense and its logical form by the way it is built. What can be shown cannot be said.', '4.1212'],
    'formal-concept': ['Formal concept', 'formaler Begriff', '', 'A concept such as “object”, “fact” or “number”. It does not sort things into those that fall under it and those that do not. A logical notation expresses it by a kind of variable, not by a predicate.', '4.126'],
    'operation': ['Operation', 'Operation', '', 'What must be done to propositions to make a new proposition from them. An operation is not a part of the result, and it stands for nothing.', '5.23'],
    'n-operator': ['The operation N', 'N(ξ̄)', '', 'Joint negation. N of some propositions is true when all of them are false. All truth-functions can be made with it.', '5.502'],
    'solipsism': ['Solipsism', 'Solipsismus', '', 'The view that only I and my experience exist. Wittgenstein says that what it means is correct, but that it cannot be said.', '5.62'],
    'transcendental': ['Transcendental', 'transzendental', '', 'Not a fact in the world, but a condition of the world. The book uses the word for logic and for ethics. (This definition is the guide\'s. The book does not define the word.)', '6.13'],
    'mystical': ['The mystical', 'das Mystische', '', 'That the world is. Also: the feeling of the world as a limited whole. It cannot be said. It shows itself.', '6.44']
  };

  /* ───────── quotations ───────── */
  function blocks(html) {
    var d = document.createElement('div'); d.innerHTML = html;
    return Array.prototype.slice.call(d.children);
  }
  function excerpt(html, spec) {
    var b = blocks(html);
    var want = spec.split(',').map(function (x) { return +x; });
    var out = '', prev = 0;
    want.forEach(function (k) {
      if (!b[k - 1]) return;
      if (k !== prev + 1 && prev !== 0) out += '<p class="gap"><span class="cut">[…]</span></p>';
      out += b[k - 1].outerHTML; prev = k;
    });
    return { html: out, partial: want.length < b.length, all: b.length };
  }
  function slice(html, from, until) {
    var t = plain(html);
    var a = from ? t.indexOf(from) : 0, u = until ? t.indexOf(until) : -2;
    if (a < 0 || u === -1) return null;
    var z = until ? u + until.length : t.length;
    return (a > 0 ? '<span class="cut">[…]</span> ' : '') + esc(t.slice(a, z)) + (z < t.length ? ' <span class="cut">[…]</span>' : '');
  }
  function fillQuotes() {
    $$('.w[data-n]').forEach(function (q) {
      var p = byN[q.dataset.n];
      if (!p) { q.textContent = 'Missing remark ' + q.dataset.n; return; }
      var en = p.en, de = p.de, partial = false;
      if (q.dataset.p) {
        var e = excerpt(p.en, q.dataset.p), g = excerpt(p.de, q.dataset.p);
        en = e.html; partial = e.partial;
        if (g.all === e.all) de = g.html;
        if (partial && !/gap/.test(en)) en = en.replace(/<\/p>$/, ' <span class="cut">[…]</span></p>');
      } else if (q.dataset.from || q.dataset.until) {
        var s = slice(p.en, q.dataset.from, q.dataset.until);
        if (s) { en = '<p>' + s + '</p>'; partial = true; }
      }
      q.innerHTML =
        '<a class="wn" data-n="' + p.n + '" role="button" tabindex="0" title="' + (partial ? 'This is an excerpt. ' : '') + 'Open remark ' + p.n + ' in the Atlas">' + p.n + '</a>' +
        '<div class="wt">' + en + '</div><div class="wd" lang="de">' + de + '</div>';
    });
    $$('[data-main]').forEach(function (h) {
      var p = byN[h.dataset.main];
      h.innerHTML = p.en.replace(/<sup class="fnm">\*<\/sup>/, '') + '<span class="de" lang="de">' + p.de.replace(/<sup class="fnm">\*<\/sup>/, '') + '</span>';
    });
    $$('[data-main-en]').forEach(function (e) { e.innerHTML = plain(byN[e.dataset.mainEn].en); });
    $$('[data-main-de]').forEach(function (e) { e.innerHTML = plain(byN[e.dataset.mainDe].de); });
    var fn = $('#footnote-1');
    if (fn && byN['1'].enNote) fn.innerHTML = '<p>' + byN['1'].enNote[0] + '</p>';
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
  var quoteEls = [], curStage = -1, ticking = false, curFocus = null;
  function measure() {
    quoteEls = $$('#journey .w[data-n]');
  }
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
    if (Cosmos.setJourney) Cosmos.setJourney(+stages[s].dataset.stage, u, a);
    if (s !== curStage) {
      curStage = s;
      document.body.dataset.stage = stages[s].dataset.stage;
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
    var best = null, bd = vh * 0.34;
    for (i = 0; i < quoteEls.length; i++) {
      var q = quoteEls[i].getBoundingClientRect();
      if (q.bottom < 0) continue;
      if (q.top > vh) break;
      var d = Math.abs((q.top + q.bottom) / 2 - vh * 0.45);
      if (d < bd) { bd = d; best = quoteEls[i].dataset.n; }
    }
    if (!best && stages[s].dataset.stage >= 1 && stages[s].dataset.stage <= 6 && u < a) best = stages[s].dataset.stage;
    if (best !== curFocus) { curFocus = best; if (Cosmos.setFocus) Cosmos.setFocus(best); }
  }
  function requestScroll() { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }

  /* ───────── glossary ───────── */
  var pop = $('#pop'), popFor = null;
  function termHTML(key) {
    var t = TERMS[key]; if (!t) return '';
    return '<h5>' + t[0] + '</h5><p class="orig">German: ' + t[1] + (t[2] ? ' · later translation: “' + t[2] + '”' : '') + '</p><p>' + t[3] + '</p>' +
      '<p><a class="ref" data-n="' + t[4] + '">' + t[4] + '</a></p>';
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
      return '<div><dt>' + t[0] + '<small>' + t[1] + (t[2] ? ' · later: ' + t[2] : '') + '</small></dt><dd>' + t[3] + ' <a class="ref" data-n="' + t[4] + '">' + t[4] + '</a></dd></div>';
    }).join('');
    $$('.t').forEach(function (t) { t.tabIndex = 0; t.setAttribute('role', 'button'); t.setAttribute('aria-expanded', 'false'); });
  }

  /* ───────── atlas ───────── */
  var atlas = $('#atlas'), abody = $('#atlas-body'), aq = $('#atlas-q'), btnAtlas = $('#btn-atlas');
  var atlasN = null, savedScroll = 0, firstQuote = {};
  function indexQuotes() {
    $$('#journey .w[data-n]').forEach(function (q) { if (!firstQuote[q.dataset.n]) firstQuote[q.dataset.n] = q; });
    $$('#journey [data-main]').forEach(function (q) { firstQuote[q.dataset.main] = q; });
  }
  function teaser(n) {
    var t = plain(byN[n].en);
    return t.length > 120 ? t.slice(0, 120).replace(/\s\S*$/, '') + ' …' : t;
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
      (p.enNote ? '<p class="note">* ' + p.enNote[0] + '</p>' : '') +
      '<div class="wd" lang="de">' + p.de + '</div>';
    if (firstQuote[n]) h += '<button type="button" class="tostation" data-jump="' + n + '">→ Read the guide\'s explanation of ' + n + '</button>';
    h += '</article>';
    if (ch.length) {
      h += '<div class="kids"><h5>' + ch.length + ' comment' + (ch.length > 1 ? 's' : '') + ' on ' + n + '</h5>' + ch.map(function (c) {
        var m = kids[c].length;
        return '<button type="button" data-go="' + c + '"><b>' + c + (m ? ' <i>+' + m + '</i>' : '') + '</b><span>' + esc(teaser(c)) + '</span></button>';
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
    if (jumpTo && firstQuote[jumpTo]) {
      var el = firstQuote[jumpTo];
      var det = el.closest('details'); if (det) det.open = true;
      var y = el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.35;
      window.scrollTo({ top: y, behavior: 'instant' });
    } else {
      window.scrollTo({ top: savedScroll, behavior: 'instant' });
    }
    requestScroll();
  }

  /* ───────── events ───────── */
  function wire() {
    document.addEventListener('click', function (e) {
      var t;
      if ((t = e.target.closest('.t'))) { openPop(t); return; }
      if ((t = e.target.closest('[data-go]'))) { renderAtlas(t.dataset.go); return; }
      if ((t = e.target.closest('[data-jump]'))) { closeAtlas(t.dataset.jump); return; }
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

    var btnDe = $('#btn-de');
    function setDe(on) {
      document.body.classList.toggle('de', on);
      btnDe.setAttribute('aria-pressed', on);
      try { localStorage.setItem('tlp-de', on ? '1' : '0'); } catch (err) {}
    }
    btnDe.addEventListener('click', function () {
      // keep the reader's place: German lines change the height of the page
      var anchor = null, top = 0, vh = window.innerHeight;
      $$('#journey .w, #journey p, #journey h3').some(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top >= 0 && r.top < vh) { anchor = el; top = r.top; return true; }
        return false;
      });
      setDe(!document.body.classList.contains('de'));
      if (anchor) window.scrollBy(0, anchor.getBoundingClientRect().top - top);
      requestScroll();
    });
    try { if (localStorage.getItem('tlp-de') === '1') setDe(true); } catch (err) {}

    window.addEventListener('scroll', requestScroll, { passive: true });
    window.addEventListener('resize', requestScroll);
    $$('details').forEach(function (d) { d.addEventListener('toggle', requestScroll); });
  }

  fillQuotes();
  buildRail();
  buildGlossary();
  if (window.Labs) window.Labs.mount();
  indexQuotes();
  measure();
  wire();
  onScroll();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(requestScroll);
})();
