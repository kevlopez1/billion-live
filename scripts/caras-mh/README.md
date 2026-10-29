# Caras MakeHuman de La Casa Blanca: cómo se rehacen

Las caras de los 24 residentes salen de los **datos** CC0 de MakeHuman (malla base, targets, rig, ojo),
procesados con **código propio** (esta carpeta). No se copió ni se portó código de MakeHuman (AGPL).
El resultado vive en `public/casa-blanca/caras/` y lo lee `components/casa-blanca/escena/avatar-cara-mh.ts`.
Licencias: `public/casa-blanca/caras/LICENCIAS.md`.

## 1. Los datos de MakeHuman (no están en el repo)

Pesan unos 300 MB (124 MB son targets). Van en `scripts/caras-mh/vendor/` (ignorada por git) o en la carpeta
que diga `CARAS_MH_VENDOR`:

| Carpeta | De dónde | Qué se usa |
|---|---|---|
| `vendor/core/` | `git clone --depth 1 --filter=blob:none --sparse https://github.com/makehumancommunity/makehuman` → `makehuman/data/` (se usó el commit `a8bc2d54ff0ac92e78ff71431b1023eda42bf482`) | `3dobjs/base.obj`, `targets/**`, `modifiers/*.json`, `rigs/default.mhskel` + `default_weights.mhw`, `eyes/`, `poseunits/face-poseunits.*` |
| `vendor/sistema/` | "MakeHuman system assets": `makehuman_system_assets_cc0.zip` de `files2.makehumancommunity.org/asset_packs/makehuman_system_assets/` (las mismas texturas están en el paquete Debian `makehuman-data_1.1.1-1_all.deb`, de donde se tomaron) | `skins/**` (las 5 texturas de piel), `teeth/`, `tongue/`, `eyebrows/`, `eyelashes/` |

Las mallas de `sistema/` vienen compiladas en `.npz`: `npz2json.py` las pasa a JSON en `convertido/`
(se leen con `allow_pickle=False`, nunca se ejecuta nada de esos archivos).

## 2. Rehacer

```bash
bash scripts/caras-mh/rehacer.sh          # todo (≈40 s de cabezas + ≈2,5 min de pelo de hoy en Chromium)
bash scripts/caras-mh/rehacer.sh pelo     # solo el pelo de hoy reajustado + manifest.json
```

Pasos (lo que hace `rehacer.sh`):

1. `pieles2.py personajes-final.json`: atlas de piel 1024 y 512 (desde `sistema/skins`), uno por tipo usado.
2. `propios.py`: texturas propias (ojo, ceja, pestañas, poros).
3. `hornear.mjs personajes-final.json <ids>`: por residente, `out/<id>/cab.bin` + `cab.json` (cabeza y cuello
   recortados y decimados, targets aplicados, ojos, cejas, pestañas, dientes, lengua, morphs de boca y parpadeo,
   pesos).
4. `exportar.py`: copia a `public/casa-blanca/caras/` lo que la web usa (y arma `_comun/cejas-pestanas.png`
   con `atlas-cejas.py`).
5. `banco/correr.cjs modo=hornear`: el **pelo de hoy** (avatar-pelo.ts) reajustado sobre cada cara, con la
   huella del pelo de hoy → `<id>/pelo-hoy.bin|json`. Usa el código del repo tal cual (crearAvatarReal + caraMH).
6. `manifiesto.py`: `manifest.json` (bytes, gzip, sha256 de cada archivo y de los archivos del repo contra los
   que se horneó).

Verificado el 2026-10-29: los pasos 1–4 rehacen los 61 archivos de `public/casa-blanca/caras/` byte a byte iguales.

## 3. Cuándo hay que rehacer qué

| Cambió | Qué rehacer | Si no |
|---|---|---|
| `avatar-pelo.ts`, el pelo o la barba de una ficha, el cuerpo o la cabeza de hoy (`avatar-cuerpo.ts`, `avatar-cabeza.ts`) | `rehacer.sh pelo` | la huella no coincide y la web deja la **cabeza de hoy** a ese residente (aviso en consola: "el pelo de hoy cambió") |
| La cara de alguien (parecido, expresión, iris, montaje) | editar `extra-mh.json` → `fichas-mh.mts` → `rehacer.sh` | — |
| Nada de lo anterior | nada | — |

**Las caras están CONGELADAS** en `personajes-final.json`: editar la ficha de alguien en `avatar-fichas.ts`
no cambia su cara MH (solo los colores de piel, pelo, cejas, barba, que el runtime lee en vivo).
`fichas-mh.mts` regenera `personajes-final.json` desde las fichas **actuales** + `extra-mh.json`; como las
fichas cambiaron desde el afinado (2026-10-28), correrlo cambia caras: mirar antes de publicar.

```bash
EXTRA_DIR=scripts/caras-mh npx esbuild@0.28.2 scripts/caras-mh/fichas-mh.mts --bundle --platform=node --format=esm \
  --outfile=scripts/caras-mh/_fichas.mjs --tsconfig=tsconfig.json && \
  EXTRA_DIR=scripts/caras-mh node scripts/caras-mh/_fichas.mjs "<ids>" scripts/caras-mh/personajes-final.json
```

`topologia.mjs` (recorte de cabeza y cuello + decimado, `decimar.mjs`) y `atlas2.mjs` (atlas de la cara)
dejaron `topologia.json`, también congelado: solo se rehacen si se cambia la malla.

## 4. Banco

`node scripts/caras-mh/banco/correr.cjs <png> "<query>"` abre Chromium (WebGL por software) con el código del
repo. `modo=ver&ids=trump,lincoln&horas=12,17.5&hoy=1&encuadre=cara|cuello|cuerpo&calidad=alta|media`:
recortes con la cara de hoy al lado; `estado=habla&t=2.3` para ver la boca. Necesita Playwright y esbuild
(`npx esbuild@0.28.2` si no está en `node_modules`).

## 5. En la página (runtime)

- **Una llamada de dibujo por cabeza**: piel, ojos, cejas, pestañas, dientes y lengua van fundidos en una malla
  con un material (`avatar-cara-mh-cabeza.ts`, atributo `aReg`). Los androides llevan la piel aparte (con la piel
  del repo) y las facciones en otra malla.
- **Se pide de a una**: el motor pide la cara de un residente cuando está en el nivel que se ve y a menos de
  `CARA_DISTANCIA` (30 m) de la cámara, o cuando se lo sigue (`motor.ts`). Hasta que llega, va la cabeza de hoy.
  El estudio pide las de todos los residentes del episodio antes del cuadro 0 (`caras: "pedidas"`).
- **Nivel de detalle**: con la cabeza a menos de `CARA_PX_CERCA` (64 px de alto) no se dibujan pestañas, dientes
  ni lengua, ni la pasada del borde del pelo, y la cabeza no proyecta sombra. En calidad baja, siempre así.
- **Sin tirón**: los materiales nuevos se compilan antes de montar (`renderer.compileAsync`), y armar y montar
  son tareas separadas (el montaje mide 6–50 ms con WebGL por software).
