#!/usr/bin/env python3
"""Build the listening page (one HTML file) from renditions/selfcheck.json and the MIDI files.
Usage: python3 page.py OUT.html   (the MP3s are published next to the page under audio/)"""
import base64
import html
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
R = json.load(open(os.path.join(HERE, 'renditions', 'selfcheck.json')))
esc = html.escape


def card(i, r):
    n = r['notes']
    dur = r['mp3_seconds']
    secs = r['sections']
    segs = []
    for j, s in enumerate(secs):
        end = secs[j + 1]['start'] if j + 1 < len(secs) else r['music_seconds']
        cls = 'solo s' + s['name'][-1].lower() if s['name'].startswith('Solo') else 'plain'
        segs.append('<button type="button" class="seg %s" style="flex-grow:%.1f" data-t="%.1f" title="Play from %s">'
                    '<span class="sn">%s</span><span class="st">%s</span></button>' % (
                        cls, end - s['start'], s['start'], esc(s['name']), esc(s['name']), s['mmss']))
    d = r['density']
    b64 = base64.b64encode(open(os.path.join(HERE, 'renditions', r['slug'] + '.mid'), 'rb').read()).decode()
    return '''
<article class="card" id="r%d">
  <header><span class="num">%d</span><h2>%s</h2>
    <p class="meta">%s · %d BPM · %s · %d:%02d</p></header>
  <audio id="a%d" controls preload="metadata" src="audio/%s.mp3"></audio>
  <div class="tl" data-audio="a%d" role="group" aria-label="Sections. Select one to play from there.">%s</div>
  <p class="dens">Solo notes per second: slow %.1f, build %.1f, fast %.1f, recapitulation %.1f. Top note %s.</p>
  <dl>
    <dt>Direction</dt><dd>%s</dd>
    <dt>Harmony</dt><dd>%s</dd>
    <dt>Solo</dt><dd>%s</dd>
  </dl>
  <p class="q"><span>My question</span> %s</p>
  <p class="dl"><button type="button" class="save" data-name="%s.mid" data-b64="%s">Download %s.mid (in a .zip)</button></p>
</article>''' % (i, i, esc(r['title']), esc(r['key']), r['bpm'], r['meter'], int(dur) // 60, int(dur) % 60,
                 i, r['slug'], i, ''.join(segs), d['Solo-A'], d['Solo-B'], d['Solo-C'], d['Solo-D'],
                 r['range']['highest_sounding'], esc(n['direction']), esc(n['harmony']), esc(n['solo']),
                 esc(n['question']), r['slug'], b64, r['slug'])


def checks():
    rows = []
    for r in R:
        o = r['originality']
        rows.append('<tr><th scope="row">%s</th><td>%d:%02d</td><td>%.1f → %.1f → %.1f</td><td>%d of %d</td><td>%d of %d</td>'
                    '<td>%s–%s, %d hard moves</td><td>%.1f/s</td><td>%s</td></tr>' % (
                        esc(r['title']), int(r['mp3_seconds']) // 60, int(r['mp3_seconds']) % 60,
                        r['density']['Solo-A'], r['density']['Solo-B'], r['density']['Solo-C'],
                        r['solo_d']['theme_in_order'], r['solo_d']['theme_len'],
                        r['strong_beats']['chord_tones'], r['strong_beats']['total'],
                        r['range']['lowest'], r['range']['highest_fretted'], len(r['play']['hard']), r['fastest_note_rate'],
                        'not run' if o is None else '%d real, %d generic' % (len(o['real']), o['generic'])))
    return ''.join(rows)


PAGE = '''<title>I'll Never Love Again: five renditions</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;700&display=swap">
<style>
/* Layout: one reading column; each rendition is a block with a player and a to-scale section strip. */
:root{--bg:#f3f1f4;--surface:#fcfbfd;--fg:#1f1a24;--muted:#655d6e;--line:#d9d3de;--accent:#8c1c3a;--accent-fg:#fff;
 --amber:#b06a12;--s1:#e9c9a0;--s2:#e0a070;--s3:#cf6a52;--s4:#a8233f;--s4fg:#fff;--plain:#e4dfe8;
 --display:'Space Grotesk',system-ui,sans-serif;--body:'Inter',system-ui,sans-serif}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#17131b;--surface:#201b26;--fg:#ece7f0;--muted:#a79fb0;--line:#3a3342;--accent:#ee7d96;--accent-fg:#22060e;
 --amber:#e3a657;--s1:#5b4630;--s2:#7a4a2e;--s3:#96402f;--s4:#c23a58;--s4fg:#fff;--plain:#2d2734;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#17131b;--surface:#201b26;--fg:#ece7f0;--muted:#a79fb0;--line:#3a3342;--accent:#ee7d96;--accent-fg:#22060e;
 --amber:#e3a657;--s1:#5b4630;--s2:#7a4a2e;--s3:#96402f;--s4:#c23a58;--s4fg:#fff;--plain:#2d2734;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font:16px/1.55 var(--body)}
.wrap{max-width:46rem;margin:0 auto;padding-block:2.5rem 4rem;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));display:flex;flex-direction:column;gap:1.75rem}
h1{font:700 clamp(1.9rem,6vw,2.7rem)/1.08 var(--display);margin:0;text-wrap:balance;letter-spacing:-.01em}
h2{font:700 1.45rem/1.2 var(--display);margin:0}
h3{font:700 1.1rem/1.3 var(--display);margin:0 0 .5rem}
p{margin:0}
.lede{color:var(--muted);max-width:38rem}
.intro{display:flex;flex-direction:column;gap:.8rem}
.eyebrow{font:600 .75rem/1 var(--body);letter-spacing:.09em;text-transform:uppercase;color:var(--accent)}
.card{background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:1.25rem;display:flex;flex-direction:column;gap:.9rem;min-width:0}
.card header{display:grid;grid-template-columns:auto 1fr;column-gap:.75rem;align-items:baseline}
.num{font:700 1.45rem/1.2 var(--display);color:var(--accent)}
.meta{grid-column:2;color:var(--muted);font-size:.9rem;font-variant-numeric:tabular-nums}
audio{width:100%}
.tl{display:flex;gap:2px;min-width:0}
.seg{flex:1 1 0;min-width:0;border:0;border-radius:3px;padding:.35rem .15rem;background:var(--plain);color:var(--fg);font:500 .68rem/1.25 var(--body);cursor:pointer;display:flex;flex-direction:column;align-items:center;overflow:hidden}
.seg .sn{white-space:nowrap;overflow:hidden;text-overflow:clip;max-width:100%}
.seg .st{font-variant-numeric:tabular-nums;opacity:.8}
.seg.sa{background:var(--s1)}.seg.sb{background:var(--s2)}.seg.sc{background:var(--s3);color:var(--s4fg)}.seg.sd{background:var(--s4);color:var(--s4fg)}
.seg:hover{filter:brightness(1.08)}.seg:focus-visible,.save:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.seg.on{box-shadow:inset 0 -3px 0 var(--fg)}
.dens{font-size:.85rem;color:var(--muted);font-variant-numeric:tabular-nums}
dl{margin:0;display:grid;grid-template-columns:5.5rem 1fr;gap:.45rem .75rem;font-size:.95rem}
dt{font-weight:600;color:var(--muted)}dd{margin:0;min-width:0}
.q{border-left:3px solid var(--amber);padding-left:.75rem;font-size:.95rem}
.q span{display:block;font:600 .72rem/1.6 var(--body);letter-spacing:.08em;text-transform:uppercase;color:var(--amber)}
.save{font:600 .9rem/1 var(--body);background:var(--accent);color:var(--accent-fg);border:0;border-radius:4px;padding:.65rem .9rem;cursor:pointer}
.save.ghost{background:transparent;color:var(--accent);border:1px solid var(--accent)}
.save[disabled]{opacity:.5;cursor:default}
.note{font-size:.85rem;color:var(--muted)}
.tw{overflow-x:auto}
table{border-collapse:collapse;font-size:.82rem;font-variant-numeric:tabular-nums;min-width:40rem}
th,td{text-align:left;padding:.4rem .6rem;border-bottom:1px solid var(--line);vertical-align:top}
thead th{color:var(--muted);font-weight:600}
ul{margin:0;padding-left:1.1rem;display:flex;flex-direction:column;gap:.3rem;font-size:.95rem}
@media (max-width:30rem){dl{grid-template-columns:1fr}.seg .sn{font-size:.58rem}.card{padding:1rem}}
</style>
<div class="wrap">
<section class="intro">
  <p class="eyebrow">MIDI sketches · first round</p>
  <h1>I'll Never Love Again</h1>
  <p class="lede">Five two-minute versions of the song. Each one has the full arc: intro, verse, chorus, a four-phase solo and a resolution. The melodies are different in each, so you choose a direction and a theme at the same time.</p>
  <p class="note">The sounds are General MIDI. Judge the notes, the form and the solo arc, not the tone. A clarinet plays the guide vocal. Select a section in a strip to play from there.</p>
  <p><button type="button" class="save ghost" id="all">Download all five .mid files (one .zip)</button> <span class="note" id="msg" role="status"></span></p>
</section>
@@CARDS@@
<section>
  <h3>Self-check</h3>
  <p class="note" style="margin-bottom:.6rem">All five pass every check. I cannot listen, so these numbers stand in for ears.</p>
  <div class="tw"><table><thead><tr><th>Rendition</th><th>Length</th><th>Notes/s: slow → build → fast</th><th>Theme notes back in Solo-D</th><th>Strong beats on chord tones</th><th>Range, playability</th><th>Fastest</th><th>Matches with the reference</th></tr></thead><tbody>@@CHECKS@@</tbody></table></div>
</section>
<section>
  <h3>Read this before you listen</h3>
  <ul>
    <li>The hook "I'll never love again" is the melodic peak of each chorus. In versions 1, 2, 3 and 4 the word "again" lands on a chord that is not the tonic: the harmony does not agree with the vow. In version 5 it lands on the tonic.</li>
    <li>In each Solo-D the slow theme comes back one octave higher (version 4: also one whole step higher). Fast runs end on its long notes, and its notes become the accented top notes of fast groups.</li>
    <li>The lead track uses a pitch-bend range of ±12 semitones. The MIDI files set it with RPN 0.</li>
    <li>Vibrato is 4.9 Hz (5.3 Hz on peak notes). The measured references are at 4 to 5 Hz, so I used that and not 5 to 6 Hz.</li>
  </ul>
</section>
</div>
<script>
(function(){
  document.querySelectorAll('.tl').forEach(function(tl){
    var a=document.getElementById(tl.dataset.audio),segs=[].slice.call(tl.querySelectorAll('.seg'));
    segs.forEach(function(b){b.addEventListener('click',function(){
      document.querySelectorAll('audio').forEach(function(o){if(o!==a)o.pause();});
      a.currentTime=parseFloat(b.dataset.t);a.play().catch(function(){});});});
    a.addEventListener('timeupdate',function(){var t=a.currentTime,cur=null;
      segs.forEach(function(b){if(parseFloat(b.dataset.t)<=t+0.05)cur=b;});
      segs.forEach(function(b){b.classList.toggle('on',b===cur&&t>0);});});
    a.addEventListener('play',function(){document.querySelectorAll('audio').forEach(function(o){if(o!==a)o.pause();});});
  });
  var T=[];for(var n=0;n<256;n++){var c=n;for(var k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;T[n]=c>>>0;}
  function crc(u){var c=0xFFFFFFFF;for(var i=0;i<u.length;i++)c=T[(c^u[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0;}
  function bytes(b64){var s=atob(b64),u=new Uint8Array(s.length);for(var i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u;}
  function zip(files){var parts=[],cen=[],off=0;
    files.forEach(function(f){var nm=new TextEncoder().encode(f.name),c=crc(f.data),h=new DataView(new ArrayBuffer(30));
      h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(8,0,true);h.setUint16(12,0x21,true);
      h.setUint32(14,c,true);h.setUint32(18,f.data.length,true);h.setUint32(22,f.data.length,true);h.setUint16(26,nm.length,true);
      parts.push(new Uint8Array(h.buffer),nm,f.data);
      var d=new DataView(new ArrayBuffer(46));d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(14,0x21,true);
      d.setUint32(16,c,true);d.setUint32(20,f.data.length,true);d.setUint32(24,f.data.length,true);d.setUint16(28,nm.length,true);d.setUint32(42,off,true);
      cen.push(new Uint8Array(d.buffer),nm);off+=30+nm.length+f.data.length;});
    var cs=0;cen.forEach(function(x){cs+=x.length;});var e=new DataView(new ArrayBuffer(22));
    e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,cs,true);e.setUint32(16,off,true);
    return new Blob(parts.concat(cen,[new Uint8Array(e.buffer)]));}
  var msg=document.getElementById('msg'),btns=[].slice.call(document.querySelectorAll('.save'));
  var dl=null;btns.forEach(function(b){b.disabled=true;});
  function say(t){msg.textContent=t;}
  function save(name,files){if(!dl)return;dl.save({filename:name,data:zip(files)}).then(function(){say('Saved '+name+'.');},
    function(e){say(e&&e.code==='declined'?'Download cancelled.':'The download did not work here. The same files are in the repository folder renditions/.');});}
  function one(b){return{name:b.dataset.name,data:bytes(b.dataset.b64)};}
  var per=btns.filter(function(b){return b.dataset.b64;});
  per.forEach(function(b){b.addEventListener('click',function(){save(b.dataset.name.replace('.mid','.zip'),[one(b)]);});});
  document.getElementById('all').addEventListener('click',function(){save('ill-never-love-again-renditions.zip',per.map(one));});
  var ready=window.claude&&window.claude.use?window.claude.use('downloads'):Promise.resolve(null);
  ready.then(function(d){dl=d;if(d){btns.forEach(function(b){b.disabled=false;});}else{say('Downloads are not available in this view. The .mid files are in the repository folder renditions/.');}});
})();
</script>
'''

out = sys.argv[1]
open(out, 'w').write(PAGE.replace('@@CARDS@@', ''.join(card(i + 1, r) for i, r in enumerate(R))).replace('@@CHECKS@@', checks()))
print(out, os.path.getsize(out))
