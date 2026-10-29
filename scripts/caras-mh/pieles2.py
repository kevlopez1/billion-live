# pieles2.py — hornea el atlas de piel de la cabeza (atlas2.mjs) RASTERIZANDO cada triángulo de la
# malla: cada texel nuevo toma el uv viejo interpolado del triángulo y muestrea la piel 2048 (código
# propio, numpy + PIL). Después: relleno de bordes (dilatación) y aplanado de baja frecuencia.
# Uso: python3 -I cabeza/pieles2.py <personajes-mh.json> [--forzar]
import json, sys, os
from PIL import Image, ImageFilter
import numpy as np
AQUI = os.path.dirname(os.path.abspath(__file__)); VENDOR = os.environ.get('CARAS_MH_VENDOR') or os.path.join(AQUI, 'vendor')
SIS = os.path.join(VENDOR, 'sistema'); OUT = os.path.join(AQUI, 'out', '_comun')
os.makedirs(OUT, exist_ok=True)
topo = json.load(open(os.path.join(AQUI, 'topologia.json')))
assert topo['atlas'].get('version') == 2
A = topo['atlas']['tam']; UVN = topo['atlas']['uv']
APLANAR = float(os.environ.get('APLANAR', '0.75'))
# uv viejos de base.obj
uv_old = []
with open(os.path.join(VENDOR, 'core/3dobjs/base.obj')) as f:
    for l in f:
        if l.startswith('vt '):
            p = l.split(); uv_old.append((float(p[1]), float(p[2])))
uv_old = np.array(uv_old, np.float64)
tris_t = np.array(topo['piel']['tuv'], np.int64)

def bilineal(img, u, v):
    H, W = img.shape[:2]
    x = np.clip(u * W - 0.5, 0, W - 1.001); y = np.clip((1 - v) * H - 0.5, 0, H - 1.001)
    x0 = np.floor(x).astype(int); y0 = np.floor(y).astype(int); fx = (x - x0)[:, None]; fy = (y - y0)[:, None]
    a = img[y0, x0]; b = img[y0, x0 + 1]; c = img[y0 + 1, x0]; d = img[y0 + 1, x0 + 1]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy

def rasterizar(src, tam):
    out = np.zeros((tam, tam, src.shape[2]), np.float32); lleno = np.zeros((tam, tam), bool)
    for t in tris_t:
        n = np.array([UVN[str(k)] for k in t], np.float64) * tam  # px (y hacia arriba)
        o = uv_old[t]
        x0 = int(np.floor(n[:, 0].min())) - 1; x1 = int(np.ceil(n[:, 0].max())) + 1
        y0 = int(np.floor(n[:, 1].min())) - 1; y1 = int(np.ceil(n[:, 1].max())) + 1
        xs, ys = np.meshgrid(np.arange(max(0, x0), min(tam, x1)) + 0.5, np.arange(max(0, y0), min(tam, y1)) + 0.5)
        if xs.size == 0: continue
        (ax, ay), (bx, by), (cx, cy) = n
        den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        if abs(den) < 1e-12: continue
        l1 = ((by - cy) * (xs - cx) + (cx - bx) * (ys - cy)) / den
        l2 = ((cy - ay) * (xs - cx) + (ax - cx) * (ys - cy)) / den
        l3 = 1 - l1 - l2
        e = -0.02
        m = (l1 >= e) & (l2 >= e) & (l3 >= e)
        if not m.any(): continue
        L = np.stack([l1[m], l2[m], l3[m]], 1)
        L = np.clip(L, 0, None); L /= L.sum(1, keepdims=True)
        uo = L @ o
        col = bilineal(src, uo[:, 0], uo[:, 1])
        px = xs[m].astype(int); py = (tam - 1 - ys[m].astype(int))  # fila desde arriba
        out[py, px] = col; lleno[py, px] = True
    # dilatación: los texeles vacíos toman el promedio de sus vecinos llenos (12 pasadas)
    for _ in range(12):
        acc = np.zeros_like(out); cnt = np.zeros((tam, tam), np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            r = np.roll(np.roll(out, dy, 0), dx, 1); rl = np.roll(np.roll(lleno, dy, 0), dx, 1)
            acc += r * rl[..., None]; cnt += rl
        nuevo = (~lleno) & (cnt > 0)
        out[nuevo] = acc[nuevo] / cnt[nuevo][:, None]; lleno |= nuevo
    med = np.median(out[lleno], 0); out[~lleno] = med
    return out, lleno

def piel(nombre, forzar=False):
    dst = os.path.join(OUT, 'piel-' + nombre + '.jpg')
    if os.path.exists(dst) and not forzar: return
    src = np.asarray(Image.open(os.path.join(SIS, 'skins/textures', nombre + '_diffuse.png')).convert('RGB')).astype(np.float32) / 255
    lin = src ** 2.2
    out, lleno = rasterizar(lin, A)
    # aplanado de baja frecuencia (ver texturas.py v1): el tono lo pone la ficha, la textura da el detalle
    s = np.clip(out, 0, 1) ** (1 / 2.2)
    bajo = np.asarray(Image.fromarray((s * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(40))).astype(np.float32) / 255
    bajo = np.maximum(bajo ** 2.2, 1e-3)
    media = np.median(out[lleno], 0)
    out = out * (media[None, None, :] / bajo) ** APLANAR
    img = Image.fromarray((np.clip(out, 0, 1) ** (1 / 2.2) * 255).astype(np.uint8))
    img.save(dst, quality=90)
    img.resize((512, 512), Image.LANCZOS).save(dst.replace('.jpg', '-512.jpg'), quality=86)
    print('piel', nombre, os.path.getsize(dst), os.path.getsize(dst.replace('.jpg', '-512.jpg')))

if __name__ == '__main__':
    lista = json.load(open(sys.argv[1]))
    for p in sorted(set(c['piel'] for c in lista)): piel(p, '--forzar' in sys.argv)
