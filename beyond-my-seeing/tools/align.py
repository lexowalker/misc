import json, re, sys, difflib
srt = open(sys.argv[1], encoding='utf-8').read()
blocks = [b for b in re.split(r'\n\s*\n', srt.strip()) if b.strip()]
lines = []
for b in blocks:
    p = b.strip().split('\n')
    m = re.match(r'(\d+):(\d+):(\d+),(\d+) --> (\d+):(\d+):(\d+),(\d+)', p[1])
    t0 = int(m[1])*3600+int(m[2])*60+int(m[3])+int(m[4])/1000
    t1 = int(m[5])*3600+int(m[6])*60+int(m[7])+int(m[8])/1000
    text = ' '.join(p[2:]).strip()
    if text.startswith('['): continue
    lines.append({'text': text, 's0': t0, 's1': t1})
norm = lambda w: re.sub(r"[^a-z']", '', w.lower().replace('’', "'"))
segs = json.load(open(sys.argv[2]))
W = [(norm(w['w']), w['s'], w['e']) for s in segs for w in s['words'] if norm(w['w'])]
L = []
for i, ln in enumerate(lines):
    for w in ln['text'].split():
        if norm(w): L.append((norm(w), i))
sm = difflib.SequenceMatcher(None, [x[0] for x in L], [x[0] for x in W], autojunk=False)
match = {}
for a, b, n in sm.get_matching_blocks():
    for k in range(n): match[a + k] = b + k
for i, ln in enumerate(lines):
    idx = [k for k, x in enumerate(L) if x[1] == i]
    hits = [match[k] for k in idx if k in match]
    ln['n'] = len(idx); ln['hit'] = len(hits)
    if hits:
        ln['a0'] = W[min(hits)][1]; ln['a1'] = W[max(hits)][2]
json.dump(lines, open(sys.argv[3], 'w'), indent=1, ensure_ascii=False)
for ln in lines:
    print(f"{ln.get('a0', -1):7.2f} {ln.get('a1', -1):7.2f}  srt {ln['s0']:7.2f}  {ln['hit']}/{ln['n']}  {ln['text']}")
