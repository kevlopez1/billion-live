"""Convierte las mallas compiladas (.npz) de vendor/sistema a JSON plano para cargar.mjs.

Codigo propio. Lee el .npz como DATOS (allow_pickle=False: nunca ejecuta nada).
Uso: python3 -I npz2json.py <vendor/sistema> <salida>
Salida por proxy: {coord:[x,y,z,...], quads:[a,b,c,d,...], uv:[u,v,...], quv:[ta,tb,tc,td,...]}
(quads repiten el ultimo indice cuando la cara es triangulo).
"""
import json, os, sys
import numpy as np

src, dst = sys.argv[1], sys.argv[2]
n = 0
for root, _dirs, files in os.walk(src):
    for f in files:
        if not f.endswith('.npz'):
            continue
        z = np.load(os.path.join(root, f), allow_pickle=False)
        rel = os.path.relpath(root, src)
        out = os.path.join(dst, rel)
        os.makedirs(out, exist_ok=True)
        d = {
            'coord': [round(float(x), 5) for x in z['coord'].reshape(-1)],
            'quads': [int(x) for x in z['fvert'].reshape(-1)],
            'uv': [round(float(x), 5) for x in z['texco'].reshape(-1)],
            'quv': [int(x) for x in z['fuvs'].reshape(-1)],
        }
        with open(os.path.join(out, f[:-4] + '.json'), 'w') as fh:
            json.dump(d, fh, separators=(',', ':'))
        n += 1
print('convertidos', n)
