#!/usr/bin/env python3
"""
Compila el informe por capítulos en un solo documento Word (y PDF si hay LibreOffice).

  1) Une los capítulos (docs/informe/*.md) y el diccionario de datos generado.
  2) Pandoc -> DOCX con tabla de contenido.
  3) python-docx: portada institucional (escudo), banner de la facultad en el encabezado y
     numeración de páginas.

Uso:  python3 build_informe.py        (genera docs/informe/out/Informe_ICONIX.docx y .pdf)
"""
import re, shutil, subprocess, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = HERE / 'out'
OUT.mkdir(exist_ok=True)
GEN = ROOT / 'docs' / 'uml' / 'generated' / 'diccionario_datos.md'

# Portada (datos del grupo)
PORTADA = [
    ('UNIVERSIDAD AUTONOMA GABRIEL RENE MORENO', 16, True),
    ('FACULTAD DE INGENIERÍA EN CIENCIAS DE LA COMPUTACIÓN Y TELECOMUNICACIONES', 13, True),
    ('IMG', 0, False),
    ('SEGUNDO PARCIAL', 12, True),
    ('“DRESSED — Plataforma SaaS multitenant para tiendas de ropa con Vestidor Virtual Inteligente”', 12, True),
    ('Proyecto de Desarrollo de Software con ICONIX y UML', 11, False),
    ('“Grupo 19”', 11, False),
    ('Docente: MSc. Ing. Angélica Garzón Cuéllar', 11, False),
    ('Materia: Sistemas de Información 2', 11, False),
    ('Semestre: 2 - 2026', 11, False),
    ('Integrantes: Carrasco Surco Cinthia — 221025121', 11, False),
    ('Fecha: ____ /____ /2026', 11, False),
]

parts = []
for f in sorted(HERE.glob('0[1-7]_*.md')):
    t = f.read_text(encoding='utf-8')
    if '{{DICCIONARIO}}' in t:
        dic = GEN.read_text(encoding='utf-8') if GEN.exists() else '_Ejecute docs/uml/scripts/gen_entities_uml.py_'
        dic = re.sub(r'^# ', '#### ', dic, flags=re.M)
        dic = re.sub(r'^## ', '##### ', dic, flags=re.M)
        t = t.replace('{{DICCIONARIO}}', dic)
    parts.append(t)
merged = OUT / 'informe_completo.md'
merged.write_text('\n\n'.join(parts), encoding='utf-8')

docx = OUT / 'Informe_ICONIX.docx'
cmd = ['pandoc', str(merged), '-o', str(docx), '--from', 'markdown+pipe_tables+implicit_figures',
       '--toc', '--toc-depth=3', '--metadata', 'lang=es', '--metadata', 'toc-title=TABLA DE CONTENIDO', f'--resource-path={HERE}:{HERE.parent / "uml" / "out"}:{HERE.parent / "uml"}']
r = subprocess.run(cmd, capture_output=True, text=True)
if r.returncode:
    sys.exit(r.stderr)
missing = sorted(set(re.findall(r'(?:Could not fetch resource|resource not found).*?([\w./-]+\.png)', r.stderr)))
if r.stderr.strip():
    print('Avisos de pandoc (p. ej. diagramas aún no renderizados):\n', r.stderr[:600])

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, Cm

d = Document(str(docx))
sec = d.sections[0]
sec.left_margin = sec.right_margin = Cm(2.5)
sec.top_margin = Cm(2.2)

# Encabezado con el banner de la facultad
banner = HERE / 'assets' / 'banner.jpg'
if banner.exists():
    p = sec.header.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.add_run().add_picture(str(banner), width=Cm(15.5))
# Numeración de páginas en el pie
fp = sec.footer.paragraphs[0]
fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = fp.add_run()
for tag, text in (('begin', None), (None, 'PAGE'), ('end', None)):
    if tag:
        el = OxmlElement('w:fldChar'); el.set(qn('w:fldCharType'), tag)
    else:
        el = OxmlElement('w:instrText'); el.set(qn('xml:space'), 'preserve'); el.text = text
    run._r.append(el)

# Portada al inicio
body = d.element.body
first = body[0]
def add_before(par):
    first.addprevious(par._p)
for text, size, bold in PORTADA:
    para = d.add_paragraph()
    para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    para.paragraph_format.space_after = Pt(10)
    if text == 'IMG':
        esc = HERE / 'assets' / 'escudo.jpg'
        if esc.exists():
            para.add_run().add_picture(str(esc), height=Cm(6))
    else:
        r_ = para.add_run(text); r_.font.size = Pt(size); r_.bold = bold; r_.font.name = 'Times New Roman'
    add_before(para)
br = d.add_paragraph(); br.add_run().add_break(WD_BREAK.PAGE); add_before(br)

# Tablas con borde y encabezado resaltado
from docx.shared import RGBColor
def borders(tbl):
    tblPr = tbl._tbl.tblPr
    b = OxmlElement('w:tblBorders')
    for edge in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        e = OxmlElement(f'w:{edge}')
        e.set(qn('w:val'), 'single'); e.set(qn('w:sz'), '4'); e.set(qn('w:color'), '8A9BB5')
        b.append(e)
    tblPr.append(b)
for t in d.tables:
    borders(t)
    for c in t.rows[0].cells:
        tcPr = c._tc.get_or_add_tcPr()
        sh = OxmlElement('w:shd'); sh.set(qn('w:val'), 'clear'); sh.set(qn('w:fill'), 'DCE6F2'); tcPr.append(sh)
        for par in c.paragraphs:
            for r_ in par.runs: r_.bold = True
# Títulos en azul institucional oscuro, tipografía serif como el documento del Primer Parcial
for st in d.styles:
    n = (st.name or '').lower()
    try:
        if n in ('heading 1', 'heading 2', 'heading 3', 'heading 4', 'title'):
            st.font.color.rgb = RGBColor(0x1F, 0x38, 0x64); st.font.name = 'Times New Roman'
        elif n in ('normal', 'body text', 'first paragraph', 'compact'):
            st.font.name = 'Times New Roman'; st.font.size = Pt(11)
    except Exception:
        pass
d.save(str(docx))
print('✓', docx)

def refresh_with_libreoffice(path: Path):
    """Actualiza la tabla de contenido (números de página) y exporta a PDF con LibreOffice (UNO)."""
    soffice = shutil.which('soffice') or shutil.which('libreoffice')
    if not soffice:
        print('(!) LibreOffice no encontrado: abra el .docx en Word y pulse F9 para actualizar el índice.')
        return
    import time
    port = 2002
    proc = subprocess.Popen([soffice, '--headless', '--invisible', '--norestore', f'--accept=socket,host=localhost,port={port};urp;'],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        import uno
        from com.sun.star.beans import PropertyValue
        def pv(n, v):
            x = PropertyValue(); x.Name = n; x.Value = v; return x
        ctx = None
        for _ in range(40):
            try:
                local = uno.getComponentContext()
                resolver = local.ServiceManager.createInstanceWithContext('com.sun.star.bridge.UnoUrlResolver', local)
                ctx = resolver.resolve(f'uno:socket,host=localhost,port={port};urp;StarOffice.ComponentContext')
                break
            except Exception:
                time.sleep(0.5)
        if ctx is None:
            print('(!) No se pudo conectar con LibreOffice'); return
        desktop = ctx.ServiceManager.createInstanceWithContext('com.sun.star.frame.Desktop', ctx)
        doc = desktop.loadComponentFromURL(uno.systemPathToFileUrl(str(path)), '_blank', 0, (pv('Hidden', True),))
        idx = doc.getDocumentIndexes()
        for i in range(idx.getCount()):
            idx.getByIndex(i).update()
        doc.store()
        doc.storeToURL(uno.systemPathToFileUrl(str(path.with_suffix('.pdf'))), (pv('FilterName', 'writer_pdf_Export'),))
        doc.close(True)
        print('✓', path.with_suffix('.pdf'))
    finally:
        try:
            desktop.terminate()
        except Exception:
            pass
        proc.wait(timeout=20) if proc.poll() is None else None

refresh_with_libreoffice(docx)
