from pathlib import Path
import json, re, sys
ROOT=Path(__file__).resolve().parents[1]
text=(ROOT/'assets/js/content.js').read_text(encoding='utf-8').strip()
match=re.match(r'^window\.RV30_CONTENT\s*=\s*(\[.*\]);?$', text, re.S)
if not match:
    print('ERRO: formato do catálogo de conteúdo não reconhecido')
    sys.exit(1)
items=json.loads(match.group(1))
errors=[]
days=[x.get('day') for x in items]
if len(items)!=31: errors.append(f'esperados 31 conteúdos; encontrados {len(items)}')
if sorted(days)!=list(range(31)): errors.append(f'dias devem cobrir exatamente 0..30; encontrados {days}')
if len(set(days))!=len(days): errors.append('dias duplicados')
required=['phase','title','description','time','duration','type','objective','videoTitle','instructions']
for item in items:
    for key in required:
        value=item.get(key)
        if value in (None,'',[]): errors.append(f'dia {item.get("day")}: campo vazio {key}')
    if not isinstance(item.get('instructions'),list) or len(item['instructions'])<1:
        errors.append(f'dia {item.get("day")}: sem instruções')
    for instruction in item.get('instructions',[]):
        if not isinstance(instruction,list) or len(instruction)!=2 or not all(str(x).strip() for x in instruction):
            errors.append(f'dia {item.get("day")}: instrução inválida')
blank_videos=sum(1 for x in items if not x.get('videoUrl'))
placeholder_duration=sum(1 for x in items if 'Definida no conteúdo final' in str(x.get('duration')))
print(f'Conteúdos: {len(items)} | Dias: {min(days)}–{max(days)} | URLs de vídeo pendentes: {blank_videos} | Durações finais pendentes: {placeholder_duration}')
if errors:
    for e in errors: print('ERRO:',e)
    sys.exit(1)
print('OK: catálogo estrutural cobre Introdução + Dias 1–30 sem lacunas.')
