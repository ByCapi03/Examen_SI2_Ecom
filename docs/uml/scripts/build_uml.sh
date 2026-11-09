#!/usr/bin/env bash
# Genera TODOS los modelos UML del proyecto.
#   1) regenera diagramas de clases / BD desde las entidades TypeORM reales
#   2) verifica que los diagramas coinciden con el código (RNF12)
#   3) renderiza .puml -> PNG y SVG en docs/uml/out (si hay PlantUML disponible)
#
# Requisitos: python3 y, para renderizar, Java + PlantUML:
#   - binario `plantuml` en el PATH, o
#   - variable PLANTUML_JAR=/ruta/plantuml.jar
# Los modelos de clases/BD usan el motor Smetana: NO requieren Graphviz.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UML="$(dirname "$HERE")"
OUT="$UML/out"
mkdir -p "$OUT"

echo "==> 1/3 Generando modelos desde las entidades"
python3 "$HERE/gen_entities_uml.py"

echo "==> 2/3 Verificando coherencia con el código"
python3 "$HERE/verificar_coherencia.py"

echo "==> 3/3 Renderizando"
if [ -n "${PLANTUML_JAR:-}" ] && [ -f "$PLANTUML_JAR" ]; then
  PU=(java -Djava.awt.headless=true -jar "$PLANTUML_JAR")
elif command -v plantuml >/dev/null 2>&1; then
  PU=(plantuml -Djava.awt.headless=true)
else
  echo "   (!) PlantUML no encontrado: se omite el renderizado."
  echo "       Descarga plantuml.jar y ejecuta:  PLANTUML_JAR=/ruta/plantuml.jar $0"
  echo "       o pega los .puml en https://www.plantuml.com/plantuml"
  exit 0
fi
for fmt in png svg; do
  "${PU[@]}" -t"$fmt" -charset UTF-8 -o "$OUT" "$UML"/src/*.puml "$UML"/generated/*.puml
done
echo "✓ Diagramas en $OUT"
