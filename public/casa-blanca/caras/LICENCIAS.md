# Caras MakeHuman de La Casa Blanca: licencias de estos archivos

Todo lo de esta carpeta son DATOS procesados con código propio (`scripts/caras-mh/`).
No se distribuye ni se portó código de MakeHuman (AGPL).

| Archivo | Origen | Licencia |
|---|---|---|
| `<id>/cab.bin`, `<id>/cab.json`: malla de cabeza y cuello, morphs de boca y parpadeo, pesos, globo del ojo, dientes y lengua | Malla base, targets, unidades de expresión, rig y globo del ojo de MakeHuman (git `makehumancommunity/makehuman` @a8bc2d54, `makehuman/data/`), horneados con código propio | CC0 1.0: cabecera de cada archivo de origen ("This asset was explicitly released as CC0 in september 2020") |
| `<id>/pelo-hoy.bin`, `<id>/pelo-hoy.json` | El pelo y la barba de los avatares de este repo (`avatar-pelo.ts`), reajustados sobre la cara con código propio | del proyecto |
| `_comun/ojo.png`, `_comun/cejas-pestanas.png`, `_comun/poros.png` | Generados con código propio (procedurales: `propios.py`, `atlas-cejas.py`) | del proyecto |
| `_comun/piel-*.jpg` | Atlas propio horneado desde 5 texturas de piel de MakeHuman (`skins/*/textures/*_diffuse.png`) | CC0 1.0 (ver abajo) |
| `manifest.json`, este archivo | propios | del proyecto |

## Base de la licencia de las texturas de piel

Las texturas de piel son parte de los "system assets" de MakeHuman. Se tomaron del paquete de Ubuntu
`makehuman-data` 1.1.1 (http://archive.ubuntu.com/ubuntu/pool/universe/m/makehuman/makehuman-data_1.1.1-1_all.deb),
cuya cabecera vieja dice AGPL-3. Se usan como CC0 1.0 sobre esta base:

1. `LICENSE.md` de MakeHuman, sección C (https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.md):
   "The assets ... base mesh and proxies, targets and modifiers, textures, clothes (any MHCLO-based asset),
   poses and expressions ... have been released under CC0 1.0 Universal."
2. La relicencia de septiembre de 2020 de los assets que vienen con MakeHuman (los mismos archivos, publicados
   con cabecera CC0 en `makehuman_system_assets_cc0.zip`). Donde se pudo comparar (el ojo: `.mhclo` y malla),
   la copia 1.1.1 y la CC0 de master solo difieren en la cabecera; las texturas de piel no se pudieron comparar
   porque el zip CC0 no era alcanzable al hornear.

Copyright al momento de la relicencia: Data Collection AB, Joel Palmius, Jonas Hauquier.
Si se consigue `makehuman_system_assets_cc0.zip`, se pueden re-hornear los atlas desde ese archivo
(`scripts/caras-mh/pieles2.py --forzar`): mismo resultado, con la cabecera CC0 en el original.
