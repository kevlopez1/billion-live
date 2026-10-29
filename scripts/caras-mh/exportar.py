# Arma public/casa-blanca/caras/ desde el horneado de out/ (código propio).
#  - <id>/cab.bin + cab.json: el horneado de cabeza/out/<id>, re-empacado sin partes que el runtime
#    nunca dibuja (hoy solo la corona en tarjetas de Sócrates: con el pelo de hoy no se usa) y con la
#    cfg reducida a lo que lee el runtime (iris, montaje, piel). La cfg completa queda en
#    cabeza/personajes-final.json (la fuente para re-hornear).
#  - _comun/: ojo, ceja, pestañas, poros y SOLO los atlas de piel que usan los 24 (1024 y 512).
#  - _comun/cejas-pestanas.png: ceja.png + pestanas.png de propios.py en un atlas (atlas-cejas.py).
#  - pelo-hoy.* NO sale de aquí: lo hornea el banco contra el repo (banco/correr.cjs modo=hornear).
# Uso: python3 -I scripts/caras-mh/exportar.py
import json, os, shutil, sys
AQUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(AQUI))
OUT = os.path.join(AQUI, 'out')
DST = os.environ.get('CARAS_MH_DESTINO') or os.path.join(REPO, 'public', 'casa-blanca', 'caras')
cfgs = json.load(open(os.path.join(AQUI, 'personajes-final.json')))
CAMPOS_CFG = ('id', 'personaje', 'iris', 'montaje', 'piel')

os.makedirs(os.path.join(DST, '_comun'), exist_ok=True)
pieles = set()
for c in cfgs:
    i = c['id']
    cab = json.load(open(os.path.join(OUT, i, 'cab.json')))
    b = open(os.path.join(OUT, i, 'cab.bin'), 'rb').read()
    # la barba/corona en tarjetas solo se dibuja sin el pelo de hoy, o con montaje.sinBarbaHoy
    usaBarba = bool((c.get('montaje') or {}).get('sinBarbaHoy'))
    fuera = [k for k in cab['partes'] if k.startswith('barba.') and not usaBarba] + [k for k in cab['partes'] if k.startswith('pelo.')]
    partes = {}
    nuevo = bytearray()
    for k, p in sorted(cab['partes'].items(), key=lambda kv: kv[1]['off']):
        if k in fuera: continue
        tam = {'u16q': 2, 'uv': 2, 'u16': 2, 'u32': 4, 's8': 1, 'u8': 1}[p['tipo']] * p['n']
        while len(nuevo) % 4: nuevo.append(0)
        q = dict(p); q['off'] = len(nuevo)
        nuevo += b[p['off']:p['off'] + tam]
        partes[k] = q
    while len(nuevo) % 4: nuevo.append(0)
    salida = {
        'v': 1, 'id': i,
        'cfg': {k: c[k] for k in CAMPOS_CFG if k in c},
        'partes': partes, 'puntos': cab['puntos'], 'texturas': cab['texturas'],
        'mallas': [m for m in cab['mallas'] if not (m.get('nombre') == 'barba' and fuera)],
    }
    d = os.path.join(DST, i); os.makedirs(d, exist_ok=True)
    open(os.path.join(d, 'cab.bin'), 'wb').write(nuevo)
    json.dump(salida, open(os.path.join(d, 'cab.json'), 'w'), separators=(',', ':'))
    pieles.add(cab['texturas']['piel'])
    print(i, len(b), '->', len(nuevo), 'fuera:', ','.join(sorted(set(k.split('.')[0] for k in fuera))) or '-')

C = os.path.join(OUT, '_comun')
for f in ['ojo.png', 'poros.png'] + [f'piel-{p}{s}.jpg' for p in sorted(pieles) for s in ('', '-512')]:
    shutil.copy2(os.path.join(C, f), os.path.join(DST, '_comun', f))
print('pieles', sorted(pieles))
import subprocess
subprocess.run([sys.executable, '-I', os.path.join(AQUI, 'atlas-cejas.py'), C, os.path.join(DST, '_comun', 'cejas-pestanas.png')], check=True)
