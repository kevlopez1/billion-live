# propios.py — texturas PROPIAS (procedurales, código y datos nuestros, CC0 si se quiere):
#   ojo.png       512² RGB: esclera con venitas + iris en gris (detalle) que el shader tiñe con el color
#                 de la ficha. Centros de las pupilas en el uv del ojo CC0 de MakeHuman (core/eyes):
#                 (0,2939, 0,2984) y (0,7051, 0,6996); el iris se hornea con radio RI_TEX y el shader lo
#                 escala al radio que se quiera (uIrisR).
#   ceja.png      512×128 RGBA: hebras de ceja; u = de la cabeza (adentro) a la cola, v = de abajo arriba.
#   pestanas.png  256×256 RGBA: arriba (v 0,5..1) pestañas de arriba, abajo las de abajo; u = del lagrimal
#                 a la comisura externa, v = de la raíz a la punta (dentro de cada mitad).
#   poros.png     256² normal map (tangente) que se repite: poros y microsurcos.
# Uso: python3 -I cabeza/propios.py
import os, math
import numpy as np
from PIL import Image, ImageFilter
AQUI = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(AQUI, 'out', '_comun')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(20261029)
CENTROS = [(0.2939, 0.2984), (0.7051, 0.6996)]
RI_TEX = 0.075  # radio del iris horneado (uv); el shader lo escala

def ruido1d(n, k, s):
    """ruido periódico suave de n muestras con k armónicos aleatorios"""
    t = np.linspace(0, 2 * np.pi, n, endpoint=False); r = np.zeros(n)
    for i in range(1, k + 1):
        r += rng.normal(0, 1) / i ** s * np.cos(i * t + rng.uniform(0, 6.3))
    return (r - r.mean()) / (r.std() + 1e-9)

def ojo(N=512):
    yy, xx = np.mgrid[0:N, 0:N]
    u = (xx + 0.5) / N; v = 1 - (yy + 0.5) / N
    img = np.zeros((N, N, 3))
    # esclera: blanco cálido, apenas gris hacia la periferia, venitas finas lejos del iris
    img[:] = (0.55, 0.52, 0.48)
    ven = np.zeros((N, N))
    for (cu, cv) in CENTROS:
        r = np.hypot(u - cu, v - cv); th = np.arctan2(v - cv, u - cu)
        # venitas: líneas radiales onduladas que nacen en la periferia (r > 0.12) y se apagan hacia el iris
        for k in range(26):
            a0 = rng.uniform(-np.pi, np.pi); w = rng.uniform(0.6, 1.4)
            curva = th - a0 - 0.18 * np.sin(r * rng.uniform(25, 60) + rng.uniform(0, 6))
            curva = (curva + np.pi) % (2 * np.pi) - np.pi
            ven += np.exp(-(curva * r / (0.0016 * w)) ** 2) * np.clip((r - 0.10) / 0.12, 0, 1) * rng.uniform(0.3, 1)
        img *= (1 - 0.06 * np.clip((r - 0.12) / 0.15, 0, 1))[..., None]  # periferia un poco más gris
    ven = np.clip(ven, 0, 1)
    img = img * (1 - 0.18 * ven[..., None]) + np.array([0.62, 0.25, 0.22]) * 0.18 * ven[..., None]
    # iris en gris (detalle de luminancia, media ~0,5): fibras radiales, collarete, criptas, anillo limbal
    for (cu, cv) in CENTROS:
        r = np.hypot(u - cu, v - cv) / RI_TEX; th = np.arctan2(v - cv, u - cu)
        m = r < 1.08
        n1 = ruido1d(2048, 400, 0.35); n2 = ruido1d(2048, 120, 0.6); n3 = ruido1d(2048, 40, 0.9)
        idx = ((th + np.pi) / (2 * np.pi) * 2048).astype(int) % 2048
        # las fibras ondulan con el radio
        idx2 = (idx + (np.sin(r * 9 + n3[idx]) * 18).astype(int)) % 2048
        fib = 0.55 * n1[idx2] + 0.45 * n2[idx]
        L = 0.5 + 0.11 * fib
        # zona pupilar (r 0,32..0,45) algo más oscura y cálida en gris; collarete ondulado en ~0,47
        rc = 0.47 + 0.035 * n3[idx]
        L += 0.16 * np.exp(-((r - rc) / 0.035) ** 2)
        L -= 0.10 * (r < rc) * (r > 0.3)
        # criptas: manchas oscuras entre el collarete y 0,85
        for k in range(55):
            ra = rng.uniform(0.52, 0.86); ta = rng.uniform(-np.pi, np.pi); sz = rng.uniform(0.025, 0.06)
            d = np.hypot(r * np.cos(th) - ra * np.cos(ta), r * np.sin(th) - ra * np.sin(ta))
            L -= 0.13 * np.exp(-(d / sz) ** 2) * rng.uniform(0.4, 1)
        # periferia más oscura y anillo limbal
        L *= 1 - 0.25 * np.clip((r - 0.75) / 0.2, 0, 1)
        L *= 1 - 0.55 * np.exp(-((r - 0.99) / 0.07) ** 2)
        # pupila (r < 0,30) casi negra con borde suave
        L = L * np.clip((r - 0.27) / 0.05, 0, 1) + 0.03 * (1 - np.clip((r - 0.27) / 0.05, 0, 1))
        # el canal azul guarda la máscara del iris (1 dentro): el shader la usa para teñir
        a = np.clip((1.02 - r) / 0.05, 0, 1)
        for c in range(3): img[..., c] = np.where(m, img[..., c] * (1 - a) + np.clip(L, 0, 1) * a, img[..., c])
    Image.fromarray((np.clip(img, 0, 1) ** (1 / 2.2) * 255).astype(np.uint8)).save(os.path.join(OUT, 'ojo.png'), optimize=True)

def trazo(A, x0, y0, ang, largo, ancho, curva, alfa, ss):
    """hebra antialias (supersampleada ss) en A (alto, ancho) con x0,y0 en px de A"""
    H, W = A.shape
    n = max(8, int(largo * 2))
    for i in range(n + 1):
        t = i / n
        a = ang + curva * t
        x = x0 + math.cos(a) * largo * t; y = y0 - math.sin(a) * largo * t
        w = ancho * (1 - 0.7 * t)
        xi0, xi1 = int(x - w - 1), int(x + w + 2); yi0, yi1 = int(y - w - 1), int(y + w + 2)
        for yy in range(max(0, yi0), min(H, yi1)):
            for xx in range(max(0, xi0), min(W, xi1)):
                d = math.hypot(xx + 0.5 - x, yy + 0.5 - y)
                k = max(0.0, min(1.0, w + 0.5 - d)) * alfa * (1 - 0.35 * t)
                if k > A[yy, xx]: A[yy, xx] = k

def ceja(W=512, H=128, ss=2):
    A = np.zeros((H * ss, W * ss)); Lm = np.zeros_like(A)
    n = 900
    for i in range(n):
        u = rng.uniform(0.0, 1.0); v = rng.uniform(0.05, 0.85)
        # densidad: cabeza rala, cuerpo lleno, cola rala; más densa abajo
        dens = (0.35 + 0.65 * np.clip(u / 0.18, 0, 1)) * (1 - 0.65 * np.clip((u - 0.72) / 0.28, 0, 1)) * (1 - 0.35 * v)
        if rng.uniform() > dens: continue
        # dirección: en la cabeza casi vertical (hacia arriba y un poco afuera), cuerpo 20-30°, cola baja
        ang = math.radians(np.interp(u, [0, 0.15, 0.35, 0.75, 1], [78, 55, 28, 12, -8]) + rng.normal(0, 7))
        largo = H * ss * rng.uniform(0.28, 0.5)
        x0 = u * W * ss; y0 = (1 - v) * H * ss
        a = rng.uniform(0.75, 1)
        trazo(A, x0, y0, ang, largo, ss * rng.uniform(0.55, 0.9), math.radians(rng.normal(-6, 5)), a, ss)
    # borde suave arriba y abajo (la forma la da la tarjeta)
    vv = np.linspace(1, 0, H * ss)[:, None]
    A *= np.clip(vv / 0.12, 0, 1) * np.clip((1 - vv) / 0.1, 0, 1)
    A = np.asarray(Image.fromarray((A * 255).astype(np.uint8)).resize((W, H), Image.LANCZOS)).astype(np.float32) / 255
    # luminancia: raíces algo más oscuras abajo, variación por hebra suave
    L = 0.85 + 0.15 * np.linspace(0, 1, H)[::-1][:, None] * np.ones((1, W))
    rgba = np.zeros((H, W, 4), np.uint8); rgba[..., :3] = (L[..., None] * 255).astype(np.uint8); rgba[..., 3] = (np.clip(A * 1.15, 0, 1) * 255).astype(np.uint8)
    Image.fromarray(rgba, 'RGBA').save(os.path.join(OUT, 'ceja.png'), optimize=True)

def pestanas(W=256, H=256, ss=2):
    A = np.zeros((H * ss, W * ss))
    for mitad, n, largoM, alfa in ((1, 170, 0.95, 1.0), (0, 170, 0.6, 0.4)):
        y0m = (0.5 if mitad else 1.0)  # la raíz: borde inferior de cada mitad (v=0 de la mitad)
        for i in range(n):
            u = rng.uniform(0.02, 0.98)
            dens = np.clip(u / 0.25, 0.2, 1) * (1 - 0.3 * np.clip((u - 0.85) / 0.15, 0, 1))
            if rng.uniform() > dens: continue
            # en la textura la hebra sube (raíz abajo, punta arriba), inclinada hacia afuera (u+)
            ang = math.radians(90 - np.interp(u, [0, 0.5, 1], [-12, 8, 30]) + rng.normal(0, 6))
            largo = H / 2 * ss * rng.uniform(0.55, 0.95) * largoM * (0.6 + 0.4 * math.sin(math.pi * min(1, u * 1.15)))
            # mechones: algunas hebras se juntan
            x0 = u * W * ss; y0 = y0m * H * ss - 1
            trazo(A, x0, y0, ang, largo, ss * rng.uniform(0.5, 0.8) * (1 if mitad else 0.75), math.radians(rng.normal(-10, 6)), alfa, ss)
    A = np.asarray(Image.fromarray((A * 255).astype(np.uint8)).resize((W, H), Image.LANCZOS)).astype(np.float32) / 255
    rgba = np.zeros((H, W, 4), np.uint8); rgba[..., :3] = 255; rgba[..., 3] = (np.clip(A * 1.3, 0, 1) * 255).astype(np.uint8)
    Image.fromarray(rgba, 'RGBA').save(os.path.join(OUT, 'pestanas.png'), optimize=True)

def poros(N=256):
    h = np.zeros((N, N))
    yy, xx = np.mgrid[0:N, 0:N]
    for i in range(1400):  # poros: hoyitos gaussianos (periódicos)
        cx, cy = rng.uniform(0, N, 2); s = rng.uniform(0.6, 1.6); a = rng.uniform(0.4, 1)
        dx = (xx - cx + N / 2) % N - N / 2; dy = (yy - cy + N / 2) % N - N / 2
        h -= a * np.exp(-(dx * dx + dy * dy) / (2 * s * s))
    # microsurcos: ruido de baja amplitud y frecuencia media
    f = np.fft.fft2(rng.normal(0, 1, (N, N))); ky = np.fft.fftfreq(N)[:, None]; kx = np.fft.fftfreq(N)[None, :]
    k = np.hypot(kx, ky); filt = np.exp(-((k - 0.06) / 0.03) ** 2)
    h += 0.6 * np.real(np.fft.ifft2(f * filt)) / 0.05 * 0.05
    h = (h - h.mean()) / (h.std() + 1e-9)
    gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) / 2; gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) / 2
    s = 0.35
    n = np.stack([-gx * s, gy * s, np.ones_like(h)], -1); n /= np.linalg.norm(n, axis=-1, keepdims=True)
    Image.fromarray(((n * 0.5 + 0.5) * 255).astype(np.uint8)).save(os.path.join(OUT, 'poros.png'), optimize=True)

ojo(); ceja(); pestanas(); poros()
for f in ('ojo.png', 'ceja.png', 'pestanas.png', 'poros.png'): print(f, os.path.getsize(os.path.join(OUT, f)))
