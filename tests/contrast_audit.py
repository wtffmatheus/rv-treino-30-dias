from pathlib import Path
import re, sys

ROOT=Path(__file__).resolve().parents[1]
css=(ROOT/'assets/css/projeto.css').read_text(encoding='utf-8')
vars=dict(re.findall(r'--([\w-]+)\s*:\s*(#[0-9a-fA-F]{6})', css.split('}')[0]))

def luminance(value):
    rgb=[int(value[i:i+2],16)/255 for i in (1,3,5)]
    vals=[c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in rgb]
    return .2126*vals[0]+.7152*vals[1]+.0722*vals[2]

def ratio(a,b):
    x,y=luminance(a),luminance(b)
    hi,lo=max(x,y),min(x,y)
    return (hi+.05)/(lo+.05)

bg=vars.get('bg','#020b16')
errors=[]
for key in ('text','soft','muted','muted2','accent'):
    color=vars.get(key)
    if not color:
        errors.append(f'variável ausente: --{key}')
        continue
    value=ratio(color,bg)
    print(f'--{key} sobre --bg: {value:.2f}:1')
    if value < 4.5:
        errors.append(f'contraste base insuficiente para --{key}: {value:.2f}:1')
if errors:
    for e in errors: print('ERRO:',e)
    sys.exit(1)
print('OK: cores textuais-base atingem pelo menos 4.5:1 no fundo principal.')
