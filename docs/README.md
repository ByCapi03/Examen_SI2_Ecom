# Documentación ICONIX / UML de DRESSED

Cumple **RNF-12 (coherencia documental)**: los modelos UML representan la solución realmente implementada.

```
docs/
├─ uml/
│  ├─ src/          Modelos PlantUML escritos a mano (casos de uso, dominio, robustez, secuencia, clases de diseño, arquitectura)
│  ├─ generated/    Generados desde las entidades TypeORM (clases, base de datos, diccionario de datos)
│  ├─ out/          PNG/SVG renderizados (se crean con build_uml.sh)
│  └─ scripts/
│     ├─ gen_entities_uml.py       entidades → diagrama de clases + ER + diccionario
│     ├─ verificar_coherencia.py   comprueba que endpoints y clases citados existen en el código
│     └─ build_uml.sh              genera + verifica + renderiza todo
└─ informe/         Informe por capítulos (Cap. I–VI, bibliografía y anexos) y su compilador
   ├─ 01_…07_*.md
   ├─ build_informe.py / .sh       une los capítulos → Word (con índice y portada) y PDF
   └─ out/                         Informe_ICONIX.docx / .pdf
```

## Uso

```bash
bash docs/uml/scripts/build_uml.sh      # UML: requiere PlantUML para renderizar (PLANTUML_JAR=/ruta/plantuml.jar o `plantuml` en el PATH)
bash docs/informe/build_informe.sh      # informe Word + PDF (requiere pandoc, python-docx y LibreOffice)
```

Orden recomendado: 1) `build_uml.sh` (crea los PNG) y 2) `build_informe.sh` (los incrusta en el informe).
Si cambia el código, vuelva a ejecutar ambos.
