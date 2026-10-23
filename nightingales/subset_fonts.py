# Subsets Shippori Mincho Bold to the kanji and kana the film actually draws.
import re, subprocess
ROOT = __file__.rsplit('/', 1)[0]
src = open(f'{ROOT}/scenes.js', encoding='utf-8').read() + open(f'{ROOT}/kit.js', encoding='utf-8').read()
chars = sorted(set(re.findall(r'[　-ヿ一-鿿]', src)))
subprocess.run(['pyftsubset', f'{ROOT}/fonts/ShipporiMincho-Bold.ttf', f'--text={"".join(chars)}',
                f'--output-file={ROOT}/fonts/ShipporiMincho-sub.ttf'], check=True)
print(''.join(chars))
