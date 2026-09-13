from pathlib import Path
from urllib.parse import urlsplit
import json, re, subprocess, sys
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
errors = []
warnings = []
redirect_sources = set()

redirects_path = ROOT / "_redirects"
if redirects_path.exists():
    for line in redirects_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        redirect_sources.add(line.split()[0])

html_files = sorted(ROOT.glob("*.html"))
for path in html_files:
    text = path.read_text(encoding="utf-8")
    soup = BeautifulSoup(text, "html.parser")

    # IDs únicos
    ids = [tag.get("id") for tag in soup.find_all(attrs={"id": True})]
    dupes = sorted({x for x in ids if ids.count(x) > 1})
    if dupes:
        errors.append(f"{path.name}: IDs duplicados: {dupes}")


    # Buttons explicit type
    for button in soup.find_all("button"):
        if not button.get("type"):
            errors.append(f"{path.name}: botão sem type explícito: {' '.join(button.stripped_strings)[:50]}")

    # Imagens com alt
    for img in soup.find_all("img"):
        if img.get("alt") is None:
            errors.append(f"{path.name}: imagem sem alt: {img.get('src')}")

    # CSP compatível: nada de style= ou script inline
    if re.search(r'\sstyle\s*=', text, re.I):
        errors.append(f"{path.name}: atributo style inline encontrado")
    for script in soup.find_all("script"):
        if not script.get("src") and script.get_text(strip=True):
            errors.append(f"{path.name}: script inline encontrado")

    # Recursos locais existentes
    for tag, attr in [("a","href"),("img","src"),("script","src"),("link","href")]:
        for el in soup.find_all(tag):
            raw = el.get(attr)
            if not raw or raw.startswith(("#","mailto:","tel:","javascript:")):
                continue
            parts = urlsplit(raw)
            if parts.scheme or parts.netloc:
                continue
            local = parts.path
            if not local or local == "/":
                continue
            route = "/" + local.lstrip("/")
            if route in redirect_sources:
                continue
            target = ROOT / local.lstrip("/")
            # Vercel cleanUrls: links sem .html podem representar arquivo html
            if not target.exists() and not target.suffix:
                alt = ROOT / f"{local.lstrip('/')}.html"
                if alt.exists():
                    continue
            if not target.exists():
                errors.append(f"{path.name}: recurso/link local inexistente: {raw}")

    # Estrutura básica
    h1s = soup.find_all("h1")
    if path.name not in {"404.html"} and len(h1s) != 1:
        warnings.append(f"{path.name}: esperado 1 h1; encontrado {len(h1s)}")
    if not soup.find("title"):
        errors.append(f"{path.name}: sem <title>")

# JSON Vercel
try:
    json.loads((ROOT/"vercel.json").read_text(encoding="utf-8"))
except Exception as e:
    errors.append(f"vercel.json inválido: {e}")

# JS sintaxe
for js in sorted((ROOT/"assets/js").glob("*.js")):
    proc = subprocess.run(["node","--check",str(js)],capture_output=True,text=True)
    if proc.returncode:
        errors.append(f"{js.name}: sintaxe JS inválida: {proc.stderr.strip()}")

# Conteúdo crítico de pré-produção
index = (ROOT/"index.html").read_text(encoding="utf-8")
checkout = (ROOT/"checkout.html").read_text(encoding="utf-8")
config = (ROOT/"assets/js/config.js").read_text(encoding="utf-8")
if "Resultado garantido pela profissional" in index:
    errors.append("Claim antigo de resultado garantido encontrado")
if not re.search(r"paymentProvider\s*:\s*['\"]stone_link['\"]", config):
    errors.append("Configuração stone_link não encontrada")
if re.search(r"\bKiwify\b", index + checkout + config, re.I):
    errors.append("Referência Kiwify encontrada em arquivo público de venda/checkout/config")
if "testMode: true" not in config:
    warnings.append("Modo de teste não está ativo")

print(f"HTML verificados: {len(html_files)}")
print(f"JS verificados: {len(list((ROOT/'assets/js').glob('*.js')))}")
for item in warnings:
    print("AVISO:", item)
if errors:
    for item in errors:
        print("ERRO:", item)
    sys.exit(1)
print("OK: smoke test concluído sem erros.")
