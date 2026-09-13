from pathlib import Path
from urllib.parse import urlsplit
from bs4 import BeautifulSoup
import re, subprocess, json, sys

try:
    import tinycss2
except ModuleNotFoundError:
    tinycss2 = None

ROOT = Path(__file__).resolve().parents[1]
errors=[]
warnings=[]
notes=[]
redirect_sources=set()

redirects_path=ROOT/'_redirects'
if redirects_path.exists():
    for line in redirects_path.read_text(encoding='utf-8').splitlines():
        line=line.strip()
        if line and not line.startswith('#'):
            redirect_sources.add(line.split()[0])

html_files=sorted(ROOT.glob('*.html'))

for path in html_files:
    text=path.read_text(encoding='utf-8')
    soup=BeautifulSoup(text,'html.parser')

    # IDs
    ids=[x.get('id') for x in soup.find_all(attrs={'id':True})]
    dup=sorted({x for x in ids if ids.count(x)>1})
    if dup: errors.append(f'{path.name}: IDs duplicados: {dup}')

    # H1
    h1s=soup.find_all('h1')
    if len(h1s)!=1: warnings.append(f'{path.name}: {len(h1s)} elementos h1')

    # meta duplicates
    meta_keys=[]
    for m in soup.find_all('meta'):
        key = ('name',m.get('name')) if m.get('name') else ('property',m.get('property')) if m.get('property') else None
        if key and key[1]: meta_keys.append(key)
    meta_dup=sorted({str(k) for k in meta_keys if meta_keys.count(k)>1})
    if meta_dup: errors.append(f'{path.name}: metas duplicadas: {meta_dup}')

    # Images
    for img in soup.find_all('img'):
        if img.get('alt') is None: errors.append(f'{path.name}: img sem alt: {img.get("src")}')
        src=img.get('src','')
        if src.startswith('http') and not img.get('loading') and path.name!='index.html':
            warnings.append(f'{path.name}: imagem externa sem loading=lazy: {src}')

    # Inputs / selects / textarea labels
    label_for={label.get('for') for label in soup.find_all('label') if label.get('for')}
    for field in soup.find_all(['input','select','textarea']):
        if field.get('type')=='hidden': continue
        wrapped=field.find_parent('label') is not None
        associated=bool(field.get('id') and field.get('id') in label_for)
        aria=bool(field.get('aria-label') or field.get('aria-labelledby'))
        if not (wrapped or associated or aria):
            errors.append(f'{path.name}: campo sem label acessível: {field.name}[name={field.get("name")}]')

    # Buttons/links accessible text
    for button in soup.find_all('button'):
        label=' '.join(button.stripped_strings).strip() or button.get('aria-label')
        if not label: errors.append(f'{path.name}: botão sem nome acessível')
    for a in soup.find_all('a'):
        label=' '.join(a.stripped_strings).strip() or a.get('aria-label')
        if not label: errors.append(f'{path.name}: link sem nome acessível: {a.get("href")}')
        if a.get('target')=='_blank':
            rel=set(a.get('rel') or [])
            if 'noopener' not in rel: errors.append(f'{path.name}: target=_blank sem noopener: {a.get("href")}')

    # Inline CSP conflicts
    if re.search(r'\sstyle\s*=',text,re.I): errors.append(f'{path.name}: style inline')
    for script in soup.find_all('script'):
        if not script.get('src') and script.get_text(strip=True): errors.append(f'{path.name}: script inline')

    # local references
    for tag,attr in [('a','href'),('img','src'),('script','src'),('link','href')]:
        for el in soup.find_all(tag):
            raw=el.get(attr)
            if not raw or raw.startswith(('#','mailto:','tel:','javascript:')): continue
            parts=urlsplit(raw)
            if parts.scheme or parts.netloc: continue
            local=parts.path
            if not local or local=='/': continue
            route='/' + local.lstrip('/')
            if route in redirect_sources: continue
            target=ROOT/local.lstrip('/')
            if not target.exists() and not target.suffix:
                target=ROOT/(local.lstrip('/')+'.html')
            if not target.exists(): errors.append(f'{path.name}: referência local inexistente: {raw}')

# CSS parse
css_path=ROOT/'assets/css/projeto.css'
css_text=css_path.read_text(encoding='utf-8')
selector_counts={}
if tinycss2:
    rules=tinycss2.parse_stylesheet(css_text, skip_comments=False, skip_whitespace=True)
    for rule in rules:
        if rule.type=='error': errors.append(f'CSS parse error: {rule.message}')
        if rule.type=='qualified-rule':
            selector=tinycss2.serialize(rule.prelude).strip()
            selector_counts[selector]=selector_counts.get(selector,0)+1
            decls=tinycss2.parse_declaration_list(rule.content,skip_comments=True,skip_whitespace=True)
            props=[]
            for d in decls:
                if d.type=='error': errors.append(f'CSS {selector}: {d.message}')
                if d.type=='declaration': props.append(d.name)
            dups=sorted({p for p in props if props.count(p)>1})
            if dups: warnings.append(f'CSS {selector}: propriedades repetidas no mesmo bloco: {dups}')
    css_rule_count=sum(1 for r in rules if r.type=="qualified-rule")
else:
    notes.append('tinycss2 ausente; usando auditoria CSS simplificada.')
    rule_matches=re.findall(r'([^{}]+)\{([^{}]*)\}', css_text)
    for selector, body in rule_matches:
        selector=selector.strip()
        if not selector or selector.startswith('@'): continue
        selector_counts[selector]=selector_counts.get(selector,0)+1
        props=re.findall(r'([\w-]+)\s*:', body)
        dups=sorted({p for p in props if props.count(p)>1})
        if dups: warnings.append(f'CSS {selector}: propriedades repetidas no mesmo bloco: {dups}')
    css_rule_count=len(selector_counts)

repeated=[(s,c) for s,c in selector_counts.items() if c>1]
notes.append(f'Seletores CSS repetidos em blocos diferentes (cascade intencional possível): {len(repeated)}')

# JS syntax
js_files=sorted((ROOT/'assets/js').glob('*.js'))
for js in js_files:
    proc=subprocess.run(['node','--check',str(js)],capture_output=True,text=True)
    if proc.returncode: errors.append(f'{js.name}: {proc.stderr.strip()}')

# config / deployment
try: json.loads((ROOT/'vercel.json').read_text(encoding='utf-8'))
except Exception as exc: errors.append(f'vercel.json inválido: {exc}')

config=(ROOT/'assets/js/config.js').read_text(encoding='utf-8')
index=(ROOT/'index.html').read_text(encoding='utf-8')
checkout=(ROOT/'checkout.html').read_text(encoding='utf-8')
if "paymentProvider:'stone_link'" not in config and "paymentProvider: 'stone_link'" not in config: errors.append('stone_link não está configurado como provider')
if 'testMode: true' not in config: warnings.append('testMode não está ativo')
if 'Resultado garantido pela profissional' in index: errors.append('claim antigo de resultado garantido reapareceu')
if re.search(r'\bKiwify\b', index+checkout+config, re.I): errors.append('referência Kiwify em arquivo público de venda/checkout/config')
if 'Esta V4' in index: errors.append('texto visível ainda identifica V4')
auth_demo=(ROOT/'assets/js/auth-demo.js').read_text(encoding='utf-8')
if "demoEnabled = () => window.RV_COURSE_CONFIG?.testMode === true" not in auth_demo: errors.append('adaptador demo não possui fail-closed explícito por testMode')
if "if (!window.RVCourseStore) window.RVCourseStore = api" not in auth_demo: errors.append('adaptador demo pode sobrescrever o adaptador real de produção')
if "db.users.length || db.orders.length" not in auth_demo: errors.append('seed do admin pode contaminar uma compra pendente')
if "adminReplyComment" not in auth_demo: errors.append('API de resposta individual de suporte ausente')
checkout_js=(ROOT/'assets/js/checkout.js').read_text(encoding='utf-8')
if "const productionMisconfigured = !config.testMode && !course.paymentUrl" not in checkout_js: errors.append('checkout não possui bloqueio de produção sem URL do provedor')
if "productionButton.href = withAttribution(course.paymentUrl)" not in checkout_js: errors.append('checkout real não prepara URL do provedor configurado')
if "location.href = withAttribution(course.paymentUrl)" not in checkout_js: errors.append('checkout real não redireciona após validação do formulário')
if "if (!simulationEnabled) return" not in checkout_js: errors.append('simulação de pagamento não está explicitamente bloqueada fora de testMode')

print(f'HTML: {len(html_files)} | JS: {len(js_files)} | CSS rules: {css_rule_count}')
for n in notes: print('NOTA:',n)
for w in warnings: print('AVISO:',w)
for e in errors: print('ERRO:',e)
if errors: sys.exit(1)
print('OK: deep_audit.py concluído sem erros bloqueantes.')
