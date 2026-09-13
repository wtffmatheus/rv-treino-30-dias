from pathlib import Path
import re, sys

try:
    import tinycss2
except ModuleNotFoundError:
    tinycss2 = None

ROOT = Path(__file__).resolve().parents[1]
css = (ROOT / 'assets/css/projeto.css').read_text(encoding='utf-8')
errors=[]
notes=[]

defined=set(re.findall(r'(--[\w-]+)\s*:', css))
used=set(re.findall(r'var\((--[\w-]+)', css))
undefined=sorted(used-defined)
if undefined:
    errors.append(f'Variáveis CSS usadas e não definidas: {undefined}')

def check_duplicate_props(selector, body, context='root'):
    props=re.findall(r'([\w-]+)\s*:', body)
    dup=sorted({name for name in props if props.count(name)>1})
    if dup:
        errors.append(f'{context} {selector}: propriedade duplicada no mesmo bloco: {dup}')

if tinycss2:
    stylesheet=tinycss2.parse_stylesheet(css,skip_whitespace=True,skip_comments=True)

    def walk(rules, context='root'):
        for rule in rules:
            if rule.type == 'error':
                errors.append(f'Erro CSS em {context}: {rule.message}')
                continue
            if rule.type == 'qualified-rule':
                selector=tinycss2.serialize(rule.prelude).strip()
                decls=tinycss2.parse_declaration_list(rule.content,skip_comments=True,skip_whitespace=True)
                props=[]
                for decl in decls:
                    if decl.type == 'error':
                        errors.append(f'{context} {selector}: {decl.message}')
                    elif decl.type == 'declaration':
                        props.append(decl.name)
                dup=sorted({name for name in props if props.count(name)>1})
                if dup:
                    errors.append(f'{context} {selector}: propriedade duplicada no mesmo bloco: {dup}')
            elif rule.type == 'at-rule' and rule.content is not None:
                nested=tinycss2.parse_rule_list(rule.content,skip_whitespace=True,skip_comments=True)
                walk(nested, f'{context} @{rule.at_keyword} {tinycss2.serialize(rule.prelude).strip()}')

    walk(stylesheet)
else:
    notes.append('tinycss2 ausente; usando auditoria CSS simplificada.')
    for selector, body in re.findall(r'([^{}]+)\{([^{}]*)\}', css):
        selector=selector.strip()
        if selector and not selector.startswith('@'):
            check_duplicate_props(selector, body)

important=css.count('!important')
notes.append(f'Variáveis definidas: {len(defined)} | usadas: {len(used)} | !important: {important}')
if important > 20:
    errors.append(f'Excesso de !important detectado: {important}')

for note in notes:
    print('NOTA:',note)
for error in errors:
    print('ERRO:',error)
if errors:
    sys.exit(1)
print('OK: css_integrity_audit.py não encontrou variável ausente nem declaração inválida.')
