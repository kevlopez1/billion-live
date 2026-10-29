# public/casa-blanca/caras/manifest.json: cada archivo con bytes, gzip -9, sha256; totales por residente,
# compartidos y total; iris, piel y huella del pelo por residente; de qué versión del repo sale.
# Uso: python3 -I scripts/caras-mh/manifiesto.py
import gzip, hashlib, json, os
AQUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(AQUI))
D = os.path.join(REPO, 'public', 'casa-blanca', 'caras')
ORDEN = "trump musk altman thiel karp pichai amodei hormozi tate gadzhi jobs kobe lincoln napoleon leonardo cleopatra suntzu marco socrates jesus mason iluminado claude chatgpt".split()

def info(p):
    b = open(p, 'rb').read()
    return {'bytes': len(b), 'gzip': len(gzip.compress(b, 9, mtime=0)), 'sha256': hashlib.sha256(b).hexdigest()[:16]}

def h(p):
    return hashlib.sha256(open(p, 'rb').read()).hexdigest()[:16]

cfgs = {c['id']: c for c in json.load(open(os.path.join(AQUI, 'personajes-final.json')))}
res = {}
for i in ORDEN:
    fs = {f: info(os.path.join(D, i, f)) for f in sorted(os.listdir(os.path.join(D, i)))}
    cab = json.load(open(os.path.join(D, i, 'cab.json')))
    ph = os.path.join(D, i, 'pelo-hoy.json')
    pj = json.load(open(ph)) if os.path.exists(ph) else None
    res[i] = {
        'archivos': fs,
        'bytes': sum(x['bytes'] for x in fs.values()), 'gzip': sum(x['gzip'] for x in fs.values()),
        'iris': cab['cfg'].get('iris'), 'piel': cab['texturas']['piel'], 'montaje': cab['cfg'].get('montaje') or {},
        'peloHoy': ({'vertices': pj['n'], 'indices': pj['nIdx'], 'huella': pj.get('huella')} if pj else None),
        'tris': sum(m.get('tris', 0) for m in cab['mallas']),
    }
com = {f: info(os.path.join(D, '_comun', f)) for f in sorted(os.listdir(os.path.join(D, '_comun')))}
c1024 = {f: v for f, v in com.items() if not f.endswith('-512.jpg')}
c512 = {f: v for f, v in com.items() if not (f.startswith('piel-') and not f.endswith('-512.jpg'))}
S = os.path.join(REPO, 'components', 'casa-blanca', 'escena')
import subprocess, time
tom = [time.strftime('%Y-%m-%d %H:%M UTC', time.gmtime()), subprocess.run(['git', '-C', REPO, 'rev-parse', 'HEAD'], capture_output=True, text=True).stdout.strip() + ' (+ cambios sin commit al hornear)']
m = {
    'v': 1,
    'que': 'Caras MakeHuman horneadas de los 24 residentes (datos CC0, código propio: scripts/caras-mh/). Las lee components/casa-blanca/escena/avatar-cara-mh.ts.',
    'repo': {'tomado': tom[0], 'head': tom[1] if len(tom) > 1 else '', 'nota': 'pelo-hoy depende de la geometría del pelo de HOY de este repo (huella por residente); si cambia avatar-pelo.ts o el pelo/barba de una ficha, re-hornear ese pelo-hoy',
             'sha256': {f: h(os.path.join(S, f)) for f in ['avatar-pelo.ts', 'avatar-cabeza.ts', 'avatar-fichas.ts', 'avatar-cuerpo.ts', 'avatar-armado.ts', 'avatar-materiales.ts', 'avatar-androide.ts']}},
    'fuente': {'config': 'scripts/caras-mh/personajes-final.json (24, congelada)', 'sha256': h(os.path.join(AQUI, 'personajes-final.json'))},
    'residentes': res,
    'comun': com,
    'totales': {
        'residentes_bytes': sum(r['bytes'] for r in res.values()), 'residentes_gzip': sum(r['gzip'] for r in res.values()),
        'comun_bytes': sum(x['bytes'] for x in com.values()), 'comun_gzip': sum(x['gzip'] for x in com.values()),
        'comun_solo1024_gzip': sum(x['gzip'] for x in c1024.values()), 'comun_solo512_gzip': sum(x['gzip'] for x in c512.values()),
    },
}
t = m['totales']; t['total_bytes'] = t['residentes_bytes'] + t['comun_bytes']; t['total_gzip'] = t['residentes_gzip'] + t['comun_gzip']
json.dump(m, open(os.path.join(D, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)
kb = lambda x: f'{x/1024:.0f}'
print(f"{'id':10s} {'cab.bin':>8s} {'gz':>5s} {'json gz':>7s} {'pelo gz':>7s} {'total gz':>8s} iris     piel")
for i, r in res.items():
    a = r['archivos']; pg = a.get('pelo-hoy.bin', {}).get('gzip', 0) + a.get('pelo-hoy.json', {}).get('gzip', 0)
    print(f"{i:10s} {kb(a['cab.bin']['bytes']):>8s} {kb(a['cab.bin']['gzip']):>5s} {a['cab.json']['gzip']/1024:7.1f} {kb(pg):>7s} {kb(r['gzip']):>8s} {r['iris']} {r['piel']}")
for f, v in com.items(): print(f"  _comun/{f:42s} {kb(v['bytes']):>5s} KB  gz {kb(v['gzip']):>5s} KB")
print({k: f'{v/1024/1024:.2f} MB' for k, v in t.items()})
