#!/usr/bin/env python3
"""Build the listening page for the full song. Usage: python3 song_page.py OUT.html
(the MP3 is published next to the page as audio/ill-never-love-again.mp3)"""
import base64
import html
import json
import os
import sys

from gen.song import LINES

HERE = os.path.dirname(os.path.abspath(__file__))
r = json.load(open(os.path.join(HERE, 'song', 'selfcheck.json')))[0]
esc = html.escape
secs = r['sections']
start = {s['name']: s for s in secs}
SHORT = {'Verse-1': 'V1', 'Verse-2': 'V2', 'Chorus-1': 'Ch', 'Chorus-2': 'Ch', 'Bridge': 'Br', 'Solo-A': 'Solo A', 'Solo-B': 'B',
         'Solo-C': 'C', 'Solo-D': 'D', 'Intro': 'In', 'Link': '', 'Coda': 'Coda', 'Outro': ''}

segs = []
for j, s in enumerate(secs):
    end = secs[j + 1]['start'] if j + 1 < len(secs) else r['music_seconds']
    cls = 'solo s' + s['name'][-1].lower() if s['name'].startswith('Solo') else ('vox' if s['name'] in r['lyrics'] and s['name'] != 'Outro' else 'plain')
    segs.append('<button type="button" class="seg %s" style="flex-grow:%.1f" data-t="%.1f" title="Play from %s (%s)" aria-label="%s, %s">'
                '<span class="sn">%s</span></button>' % (cls, end - s['start'], s['start'], esc(s['name']), s['mmss'],
                                                         esc(s['name']), s['mmss'], SHORT.get(s['name'], s['name'])))
blocks = []
d = r['density']
for key, label, lines in LINES:
    s = start[key]
    if lines is None:
        body = ('<ol class="phases">'
                '<li><button type="button" class="t" data-t="%.1f">%s</button><span><b>Slow.</b> The theme, low and warm, in phrases that run across the bar lines. %.1f notes per second.</span></li>'
                '<li><button type="button" class="t" data-t="%.1f">%s</button><span><b>Build.</b> One chord per bar. A rising sequence climbs two octaves. %.1f notes per second.</span></li>'
                '<li><button type="button" class="t" data-t="%.1f">%s</button><span><b>Fast.</b> Pentatonic fours, pull-off figures, harmonic-minor runs. %.1f notes per second, bursts of %.0f.</span></li>'
                '<li><button type="button" class="t" data-t="%.1f">%s</button><span><b>Together.</b> The theme one octave higher over the falling bass. Runs land on its long notes. The peak is a whole-step bend at fret 22 (%s). %.1f notes per second.</span></li>'
                '</ol>' % (start['Solo-A']['start'], start['Solo-A']['mmss'], d['Solo-A'], start['Solo-B']['start'], start['Solo-B']['mmss'], d['Solo-B'],
                           start['Solo-C']['start'], start['Solo-C']['mmss'], d['Solo-C'], r['fastest_note_rate'],
                           start['Solo-D']['start'], start['Solo-D']['mmss'], r['range']['highest_sounding'], d['Solo-D']))
        blocks.append('<section class="ly solo"><h2><button type="button" class="t" data-t="%.1f">%s</button>%s</h2>%s</section>' % (
            s['start'], s['mmss'], esc(label), body))
    else:
        hook = "I'll never love again."
        ls = ''.join('<span class="%s">%s</span>' % ('hook' if l == hook else 'l', esc(l)) for l in lines)
        blocks.append('<section class="ly"><h2><button type="button" class="t" data-t="%.1f">%s</button>%s</h2><p class="lines">%s</p></section>' % (
            s['start'], s['mmss'], esc(label), ls))
b64 = base64.b64encode(open(os.path.join(HERE, 'song', r['slug'] + '.mid'), 'rb').read()).decode()
o = r['originality']
sb = r['strong_beats']
dur = r['mp3_seconds']
PAGE = '''<title>I'll Never Love Again: full song</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;700&display=swap">
<style>
/* Layout: a lyric sheet. The player and the to-scale section strip stay on top while the words scroll. */
:root{--bg:#f3f1f4;--surface:#fcfbfd;--fg:#1f1a24;--muted:#655d6e;--line:#d9d3de;--accent:#8c1c3a;--accent-fg:#fff;
 --amber:#b06a12;--s1:#e9c9a0;--s2:#e0a070;--s3:#cf6a52;--s4:#a8233f;--s4fg:#fff;--plain:#e4dfe8;--vox:#cfc6dc;
 --display:'Space Grotesk',system-ui,sans-serif;--body:'Inter',system-ui,sans-serif}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#17131b;--surface:#201b26;--fg:#ece7f0;--muted:#a79fb0;--line:#3a3342;--accent:#ee7d96;--accent-fg:#22060e;
 --amber:#e3a657;--s1:#5b4630;--s2:#7a4a2e;--s3:#96402f;--s4:#c23a58;--s4fg:#fff;--plain:#2d2734;--vox:#463c56;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#17131b;--surface:#201b26;--fg:#ece7f0;--muted:#a79fb0;--line:#3a3342;--accent:#ee7d96;--accent-fg:#22060e;
 --amber:#e3a657;--s1:#5b4630;--s2:#7a4a2e;--s3:#96402f;--s4:#c23a58;--s4fg:#fff;--plain:#2d2734;--vox:#463c56;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font:16px/1.55 var(--body)}
body::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:10;background:var(--bg)}
.wrap{max-width:42rem;margin:0 auto;padding-block:2.5rem 4rem;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));display:flex;flex-direction:column;gap:1.6rem}
h1{font:700 clamp(1.9rem,6vw,2.7rem)/1.08 var(--display);margin:0;text-wrap:balance;letter-spacing:-.01em}
h2{font:700 1.05rem/1.3 var(--display);margin:0;display:flex;align-items:baseline;gap:.6rem}
h3{font:700 1.1rem/1.3 var(--display);margin:0 0 .5rem}
p{margin:0}
.eyebrow{font:600 .75rem/1 var(--body);letter-spacing:.09em;text-transform:uppercase;color:var(--accent)}
.intro{display:flex;flex-direction:column;gap:.7rem}
.meta{color:var(--muted);font-variant-numeric:tabular-nums}
.note{font-size:.85rem;color:var(--muted)}
.player{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;background:var(--bg);padding-block:.6rem;display:flex;flex-direction:column;gap:.5rem;border-bottom:1px solid var(--line)}
audio{width:100%}
.tl{display:flex;gap:2px;min-width:0}
.seg{flex:1 1 0;min-width:0;height:1.9rem;border:0;border-radius:3px;padding:0;background:var(--plain);color:var(--fg);font:500 .66rem/1 var(--body);cursor:pointer;overflow:hidden;white-space:nowrap}
.seg.vox{background:var(--vox)}
.seg.sa{background:var(--s1)}.seg.sb{background:var(--s2)}.seg.sc{background:var(--s3);color:var(--s4fg)}.seg.sd{background:var(--s4);color:var(--s4fg)}
.seg:hover{filter:brightness(1.08)}
.seg.on{box-shadow:inset 0 -3px 0 var(--fg)}
button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.now{font-size:.8rem;color:var(--muted);font-variant-numeric:tabular-nums;min-height:1.2em}
.sheet{display:flex;flex-direction:column;gap:1.5rem}
.ly{display:flex;flex-direction:column;gap:.45rem;border-left:3px solid transparent;padding-left:.9rem;margin-left:-.9rem}
.ly.cur{border-left-color:var(--accent)}
.t{font:600 .78rem/1 var(--body);font-variant-numeric:tabular-nums;color:var(--accent);background:transparent;border:1px solid var(--line);border-radius:3px;padding:.25rem .4rem;cursor:pointer}
.lines{display:flex;flex-direction:column;font-size:1.2rem;line-height:1.6}
.hook{font-family:var(--display);font-weight:700;color:var(--accent)}
.phases{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:.5rem;font-size:.95rem}
.phases li{display:grid;grid-template-columns:auto 1fr;column-gap:.6rem;align-items:baseline}
.phases b{font-weight:600}
.phases li>b{display:inline}
.phases li{color:var(--fg)}
ul{margin:0;padding-left:1.1rem;display:flex;flex-direction:column;gap:.35rem;font-size:.95rem}
.save{font:600 .9rem/1 var(--body);background:var(--accent);color:var(--accent-fg);border:0;border-radius:4px;padding:.65rem .9rem;cursor:pointer}
.save[disabled]{opacity:.5;cursor:default}
.q{border-left:3px solid var(--amber);padding-left:.75rem}
.q span{display:block;font:600 .72rem/1.6 var(--body);letter-spacing:.08em;text-transform:uppercase;color:var(--amber)}
</style>
<div class="wrap">
<section class="intro">
  <p class="eyebrow">Full song · first draft</p>
  <h1>I'll Never Love Again</h1>
  <p class="meta">@@KEY@@ · @@BPM@@ BPM · @@METER@@ · @@DUR@@ · solo from @@SOLO@@ to @@CODA@@</p>
  <p class="note">The sounds are General MIDI and a clarinet plays the vocal line. Judge the song, the words and the solo arc, not the tone. Select a section or a time to play from there.</p>
</section>
<div class="player">
  <audio id="au" controls preload="metadata" src="audio/@@SLUG@@.mp3"></audio>
  <div class="tl" role="group" aria-label="Sections">@@SEGS@@</div>
  <p class="now" id="now" role="status">Sung sections are violet. The solo runs from amber to red.</p>
</div>
<div class="sheet">@@BLOCKS@@</div>
<section>
  <h3>What is blended</h3>
  <ul>
    <li><b>From the Classic ballad:</b> the key, the tempo, the circle-of-fifths chorus, the hook and its deceptive cadence, and the fast section.</li>
    <li><b>From the Nocturne:</b> the bass that falls by semitones under the verse and the solo, the theme that rises against it, and guitar phrases that run on across the bar lines.</li>
    <li><b>New:</b> the verse and bridge melodies, the low last line of the chorus, and the coda, where the guitar holds its last note under the last words.</li>
  </ul>
</section>
<p class="q"><span>My questions</span> Does the solo arrive at the right time, or too late? Are the words plain enough, or too plain? Is the last line right?</p>
<section>
  <h3>Self-check</h3>
  <ul class="note" style="font-size:.9rem">
    <li>Solo density, notes per second: @@DA@@ slow, @@DB@@ build, @@DC@@ fast, @@DD@@ together.</li>
    <li>@@SBOK@@ of @@SBT@@ strong-beat notes (lead and vocal) are chord tones.</li>
    <li>Guitar range @@LO@@ to @@HI@@, highest sound @@TOP@@ by bend. @@HARD@@ hard moves. Fastest notes: @@FAST@@ per second.</li>
    <li>Each sung note has one syllable: the build fails if the counts differ.</li>
    <li>Originality against the reference score: @@OW@@ six-note windows, @@OR@@ real matches, @@OG@@ generic scale run.</li>
  </ul>
</section>
<p><button type="button" class="save" id="dl" data-b64="@@B64@@" disabled>Download the .mid file (in a .zip)</button> <span class="note" id="msg" role="status"></span></p>
</div>
<script>
(function(){
  var a=document.getElementById('au'),segs=[].slice.call(document.querySelectorAll('.seg')),now=document.getElementById('now');
  var lys=[].slice.call(document.querySelectorAll('.ly'));
  function go(t){a.currentTime=t;a.play().catch(function(){});}
  [].slice.call(document.querySelectorAll('[data-t]')).forEach(function(b){b.addEventListener('click',function(){go(parseFloat(b.dataset.t));});});
  function fmt(t){t=Math.floor(t);return Math.floor(t/60)+':'+('0'+t%60).slice(-2);}
  a.addEventListener('timeupdate',function(){var t=a.currentTime,cur=null;
    segs.forEach(function(b){if(parseFloat(b.dataset.t)<=t+0.05)cur=b;});
    segs.forEach(function(b){b.classList.toggle('on',b===cur&&t>0);});
    if(cur&&t>0)now.textContent=fmt(t)+' · '+cur.getAttribute('aria-label').split(',')[0];
    var c=null;lys.forEach(function(s){var st=parseFloat(s.querySelector('.t').dataset.t);if(st<=t+0.05)c=s;});
    lys.forEach(function(s){s.classList.toggle('cur',s===c&&t>0);});});
  var T=[];for(var n=0;n<256;n++){var c=n;for(var k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;T[n]=c>>>0;}
  function crc(u){var c=0xFFFFFFFF;for(var i=0;i<u.length;i++)c=T[(c^u[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0;}
  function zip(name,data){var nm=new TextEncoder().encode(name),c=crc(data),h=new DataView(new ArrayBuffer(30)),d=new DataView(new ArrayBuffer(46)),e=new DataView(new ArrayBuffer(22));
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(12,0x21,true);h.setUint32(14,c,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,nm.length,true);
    d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(14,0x21,true);d.setUint32(16,c,true);d.setUint32(20,data.length,true);d.setUint32(24,data.length,true);d.setUint16(28,nm.length,true);
    e.setUint32(0,0x06054b50,true);e.setUint16(8,1,true);e.setUint16(10,1,true);e.setUint32(12,46+nm.length,true);e.setUint32(16,30+nm.length+data.length,true);
    return new Blob([new Uint8Array(h.buffer),nm,data,new Uint8Array(d.buffer),nm,new Uint8Array(e.buffer)]);}
  var btn=document.getElementById('dl'),msg=document.getElementById('msg'),dl=null;
  btn.addEventListener('click',function(){if(!dl)return;var s=atob(btn.dataset.b64),u=new Uint8Array(s.length);for(var i=0;i<s.length;i++)u[i]=s.charCodeAt(i);
    dl.save({filename:'ill-never-love-again.zip',data:zip('ill-never-love-again.mid',u)}).then(function(){msg.textContent='Saved.';},
      function(e){msg.textContent=e&&e.code==='declined'?'Download cancelled.':'The download did not work here. The file is in the repository folder song/.';});});
  var ready=window.claude&&window.claude.use?window.claude.use('downloads'):Promise.resolve(null);
  ready.then(function(d){dl=d;if(d)btn.disabled=false;else msg.textContent='Downloads are not available in this view. The file is in the repository folder song/.';});
})();
</script>
'''
rep = {'KEY': esc(r['key']), 'BPM': r['bpm'], 'METER': r['meter'], 'DUR': '%d:%02d' % (dur // 60, dur % 60), 'SOLO': start['Solo-A']['mmss'],
       'CODA': start['Coda']['mmss'], 'SLUG': r['slug'], 'SEGS': ''.join(segs), 'BLOCKS': ''.join(blocks), 'B64': b64,
       'DA': d['Solo-A'], 'DB': d['Solo-B'], 'DC': d['Solo-C'], 'DD': d['Solo-D'], 'SBOK': sb['chord_tones'], 'SBT': sb['total'],
       'LO': r['range']['lowest'], 'HI': r['range']['highest_fretted'], 'TOP': r['range']['highest_sounding'], 'HARD': len(r['play']['hard']),
       'FAST': r['fastest_note_rate'], 'OW': o['windows'] if o else 'n/a', 'OR': len(o['real']) if o else 'n/a', 'OG': o['generic'] if o else 'n/a'}
for k, v in rep.items():
    PAGE = PAGE.replace('@@%s@@' % k, str(v))
open(sys.argv[1], 'w').write(PAGE)
print(sys.argv[1], os.path.getsize(sys.argv[1]))
