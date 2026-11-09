#!/usr/bin/env python3
"""
Genera, a partir de las ENTIDADES TypeORM reales del backend, dos modelos PlantUML:

  generated/diagrama_clases.puml   Diagrama de clases (modelo persistente)
  generated/diagrama_bd.puml       Diagrama entidad-relación de la base de datos

Así los modelos UML siempre representan la solución implementada (RNF12): si cambia una
entidad, se vuelve a ejecutar este script y el diagrama se actualiza solo.

Uso:  python3 gen_entities_uml.py [ruta/backend/src] [directorio_salida]
"""
import re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'backend' / 'src'
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / 'docs' / 'uml' / 'generated'
OUT.mkdir(parents=True, exist_ok=True)

REL = re.compile(r'@(ManyToOne|OneToMany|OneToOne|ManyToMany)\(\s*\(\)\s*=>\s*(\w+)')
PROP = re.compile(r'^\s*(\w+)(\?|!)?\s*:\s*([^;=]+?)\s*(?:=[^;]*)?;\s*$')
ENT = re.compile(r"@Entity\(\s*'([^']+)'")
CLS = re.compile(r'export class (\w+)')

def module_of(path: Path) -> str:
    return path.parent.name

classes = {}
for f in sorted(SRC.rglob('*.ts')):
    if f.name.endswith('.spec.ts'):
        continue
    text = f.read_text(encoding='utf-8')
    if '@Entity(' not in text:
        continue
    lines = text.splitlines()
    i = 0
    while i < len(lines):
        m = ENT.search(lines[i])
        if not m:
            i += 1; continue
        table = m.group(1)
        j = i
        while j < len(lines) and not CLS.search(lines[j]):
            j += 1
        if j >= len(lines):
            break
        name = CLS.search(lines[j]).group(1)
        cols, rels = [], []
        pending, pk, depth = [], False, 0
        k = j + 1
        while k < len(lines):
            ln = lines[k]
            depth += ln.count('{') - ln.count('}')
            if depth < 0 or (ln.startswith('}') and k > j + 1 and depth <= 0):
                break
            s = ln.strip()
            if s.startswith('@'):
                pending.append(s)
                if 'PrimaryGeneratedColumn' in s or 'PrimaryColumn' in s:
                    pk = True
            else:
                p = PROP.match(ln)
                if p and depth <= 1:
                    pname, opt, ptype = p.group(1), p.group(2), p.group(3).strip()
                    deco = ' '.join(pending)
                    rm = REL.search(deco)
                    if rm:
                        rels.append((pname, rm.group(1), rm.group(2)))
                    elif '@Column' in deco or '@PrimaryGeneratedColumn' in deco or '@CreateDateColumn' in deco \
                            or '@UpdateDateColumn' in deco or '@PrimaryColumn' in deco:
                        cols.append((pname, ptype, pk, opt == '?' or 'nullable: true' in deco))
                    pending, pk = [], False
                elif s and not s.startswith('//') and not s.startswith('*') and not s.startswith('/*'):
                    pending, pk = [], False
            k += 1
        classes[name] = dict(table=table, module=module_of(f), cols=cols, rels=rels)
        i = k

def short(t: str) -> str:
    t = re.sub(r'\s+', ' ', t)
    t = t.replace('Record<string, any>', 'json').replace('Date', 'Date')
    return t[:28]

names = set(classes)
NOTE = "Generado por docs/uml/scripts/gen_entities_uml.py a partir de backend/src/**/*.entity.ts"

# ---------- Diagrama de clases ----------
cd = ['@startuml diagrama_clases', f"' {NOTE}", '!pragma layout smetana', 'skinparam classAttributeIconSize 0',
      'skinparam shadowing false', 'skinparam linetype ortho', 'hide empty methods',
      'title Diagrama de clases del modelo persistente (generado desde las entidades TypeORM)']
by_mod = {}
for n, c in classes.items():
    by_mod.setdefault(c['module'], []).append(n)
for mod, ns in sorted(by_mod.items()):
    cd.append(f'package "{mod}" {{')
    for n in sorted(ns):
        cd.append(f'  class {n} {{')
        for (p, t, pk, nul) in classes[n]['cols']:
            cd.append(f"    {'+' if pk else '-'}{p} : {short(t)}{'  <<null>>' if nul else ''}")
        cd.append('  }')
    cd.append('}')
seen = set()
for n, c in classes.items():
    for (p, kind, tgt) in c['rels']:
        if tgt not in names:
            continue
        key = tuple(sorted([n, tgt])) + (kind if kind != 'OneToMany' else 'ManyToOne',)
        if kind == 'OneToMany':
            # el lado "muchos" ya declara la relación inversa: se omite para no duplicar
            if any(r[2] == n and r[1] == 'ManyToOne' for r in classes[tgt]['rels']):
                continue
            cd.append(f'{n} "1" --> "*" {tgt} : {p}')
        elif kind == 'ManyToOne':
            if (n, tgt, p) in seen:
                continue
            cd.append(f'{n} "*" --> "1" {tgt} : {p}')
        elif kind == 'OneToOne':
            if (tgt, n) in seen:
                continue
            seen.add((n, tgt))
            cd.append(f'{n} "1" -- "1" {tgt} : {p}')
        else:
            cd.append(f'{n} "*" -- "*" {tgt} : {p}')
cd.append('@enduml')
(OUT / 'diagrama_clases.puml').write_text('\n'.join(cd) + '\n', encoding='utf-8')

# ---------- Diagrama de BD ----------
er = ['@startuml diagrama_bd', f"' {NOTE}", '!pragma layout smetana', 'hide circle', 'skinparam linetype ortho',
      'skinparam shadowing false', 'title Modelo físico de la base de datos PostgreSQL (generado)']
for n, c in sorted(classes.items(), key=lambda x: x[1]['table']):
    er.append(f'entity "{c["table"]}" as {n} {{')
    for (p, t, pk, nul) in c['cols']:
        if pk:
            er.append(f'  * {p} : {short(t)} <<PK>>')
    er.append('  --')
    for (p, t, pk, nul) in c['cols']:
        if not pk:
            fk = ' <<FK>>' if p.endswith('Id') and p not in ('entityId', 'operationId') else ''
            er.append(f"  {'' if nul else '* '}{p} : {short(t)}{fk}")
    er.append('}')
for n, c in classes.items():
    for (p, kind, tgt) in c['rels']:
        if tgt in names and kind == 'ManyToOne':
            er.append(f'{tgt} ||--o{{ {n} : {p}')
        elif tgt in names and kind == 'OneToOne' and n < tgt:
            er.append(f'{n} ||--o| {tgt}')
er.append('@enduml')
(OUT / 'diagrama_bd.puml').write_text('\n'.join(er) + '\n', encoding='utf-8')

# ---------- Inventario en Markdown (para el informe) ----------
md = ['# Diccionario de datos (generado)', '', f'_{NOTE}_', '']
for n, c in sorted(classes.items(), key=lambda x: (x[1]['module'], x[1]['table'])):
    md += [f"## {c['table']}  (`{n}`, módulo {c['module']})", '', '| Campo | Tipo | PK | Nulo |', '|---|---|---|---|']
    for (p, t, pk, nul) in c['cols']:
        md.append(f"| {p} | `{short(t)}` | {'sí' if pk else ''} | {'sí' if nul else ''} |")
    md.append('')
(OUT / 'diccionario_datos.md').write_text('\n'.join(md), encoding='utf-8')

print(f'Entidades: {len(classes)}  ->  {OUT}')
