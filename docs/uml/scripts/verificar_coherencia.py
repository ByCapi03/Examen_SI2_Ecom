#!/usr/bin/env python3
"""
RNF12 - Coherencia documental: comprueba que lo que dicen los diagramas EXISTE en el código.

  1. Cada endpoint citado en los .puml (p. ej. "POST /sync/batch") debe existir en un controlador NestJS.
  2. Cada clase/servicio citado (AuthService, SyncService...) debe existir en backend/src.
  3. Cada archivo .puml debe tener @startuml/@enduml balanceados.

Sale con código 1 si encuentra incoherencias.
"""
import re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / 'backend' / 'src'
PUML = sorted((ROOT / 'docs' / 'uml' / 'src').glob('*.puml'))

# --- rutas reales: prefijo del @Controller + @Verbo('ruta') ---
routes = set()
for f in SRC.rglob('*.controller.ts'):
    text = f.read_text(encoding='utf-8')
    for ctrl in re.split(r'(?=@Controller\()', text)[1:]:
        m = re.match(r"@Controller\(\s*'?([^')]*)'?\s*\)", ctrl)
        prefix = (m.group(1) if m else '').strip('/')
        for v, p in re.findall(r"@(Get|Post|Patch|Put|Delete)\(\s*(?:'([^']*)')?\s*\)", ctrl):
            full = '/' + '/'.join(x for x in [prefix, (p or '').strip('/')] if x)
            routes.add((v.upper(), re.sub(r':\w+', ':p', full)))

def norm(path):
    path = path.split('?')[0].rstrip('/') or '/'
    return re.sub(r':\w+', ':p', path)

classes = set()
for f in SRC.rglob('*.ts'):
    classes.update(re.findall(r'export class (\w+)', f.read_text(encoding='utf-8')))

errors = []
for f in PUML:
    t = f.read_text(encoding='utf-8')
    if t.count('@startuml') != t.count('@enduml') or '@startuml' not in t:
        errors.append(f'{f.name}: @startuml/@enduml no balanceados')
    for v, p in re.findall(r'\b(GET|POST|PATCH|PUT|DELETE)\s+(/[\w/:\-\.]*)', t):
        if p.startswith('/t/') or p in ('/register',):
            continue  # rutas del frontend
        if (v, norm(p)) not in routes:
            errors.append(f'{f.name}: endpoint inexistente en el backend -> {v} {p}')
    for c in set(re.findall(r'\b([A-Z][A-Za-z]+(?:Service|Guard|Subscriber|Middleware|Controller))\b', t)):
        if c not in classes:
            errors.append(f'{f.name}: clase inexistente en el backend -> {c}')

# 4. Dependencias dibujadas entre servicios (A ..> B) deben existir como importación/inyección en el código
defs = {}
for f in SRC.rglob('*.ts'):
    t = f.read_text(encoding='utf-8')
    for c in re.findall(r'export class (\w+)', t):
        defs.setdefault(c, []).append(t)
for f in PUML:
    for a, b in re.findall(r'^(\w+(?:Service|Middleware|Subscriber))\s+\.\.>\s+(\w+(?:Service|Middleware|Subscriber))\b', f.read_text(encoding='utf-8'), re.M):
        if a in defs and not any(b in t for t in defs[a]):
            errors.append(f'{f.name}: {a} no depende de {b} en el código')

print(f'Endpoints reales: {len(routes)}   Clases reales: {len(classes)}   Diagramas: {len(PUML)}')
if errors:
    print('\n'.join(' ✗ ' + e for e in sorted(set(errors))))
    sys.exit(1)
print('✓ Todos los diagramas son coherentes con el código.')
