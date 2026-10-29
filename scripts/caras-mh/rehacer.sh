#!/bin/bash
# Rehace public/casa-blanca/caras/ desde cero. Ver README.md (hace falta vendor/ con los datos de MakeHuman).
#   bash scripts/caras-mh/rehacer.sh            todo: topología, texturas, cabezas, pelo de hoy y manifiesto
#   bash scripts/caras-mh/rehacer.sh pelo       solo el pelo de hoy (cuando cambió avatar-pelo.ts, una ficha o el cuerpo)
set -e
AQUI="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$AQUI/../.." && pwd)"
T="trump,musk,altman,thiel,karp,pichai,amodei,hormozi,tate,gadzhi,jobs,kobe,lincoln,napoleon,leonardo,cleopatra,suntzu,marco,socrates,jesus,mason,iluminado,claude,chatgpt"
HUMANOS="${T%,claude,chatgpt}"
cd "$REPO"
if [ "$1" != "pelo" ]; then
  export CARAS_MH_VENDOR="${CARAS_MH_VENDOR:-$AQUI/vendor}"
  test -f "$CARAS_MH_VENDOR/core/3dobjs/base.obj" || { echo "falta $CARAS_MH_VENDOR (ver README.md)"; exit 1; }
  [ -d "${CARAS_MH_CONV:-$AQUI/convertido}" ] || python3 -I "$AQUI/npz2json.py" "$CARAS_MH_VENDOR/sistema" "${CARAS_MH_CONV:-$AQUI/convertido}"
  # La topología (recorte + decimado) y la configuración de las caras (personajes-final.json) están CONGELADAS
  # en el repo; para regenerarlas: node topologia.mjs / fichas-mh.mts (cambia las caras: ver README.md).
  cd "$AQUI"
  # (topologia.json ya trae el atlas 2: atlas2.mjs solo hace falta si se rehace topologia.mjs)
  python3 -I pieles2.py personajes-final.json
  python3 -I propios.py
  node hornear.mjs personajes-final.json ${T//,/ }
  python3 -I exportar.py
  cd "$REPO"
fi
node "$AQUI/banco/correr.cjs" /tmp/caras-mh-pelo.png "modo=hornear&ids=$HUMANOS&tam=240&cols=8"
python3 -I "$AQUI/manifiesto.py"
