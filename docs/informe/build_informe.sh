#!/usr/bin/env bash
# Regenera los modelos (clases/BD desde el código), verifica coherencia y compila el informe Word/PDF.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
python3 "$HERE/../uml/scripts/gen_entities_uml.py"
python3 "$HERE/../uml/scripts/verificar_coherencia.py"
python3 "$HERE/build_informe.py"
