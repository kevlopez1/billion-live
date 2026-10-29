# Une las texturas propias de cejas (ceja.png, 512x128) y pestañas (pestanas.png, 256x256) de propios.py en
# un solo atlas de 512x512 (una sola malla y un solo material en la web: menos llamadas de dibujo).
#   filas   0-127: cejas   (v' = 1 - 0,25 (1 - v))
#   filas 144-399, columnas 0-255: pestañas (u' = u / 2, v' = 1 - (144 + 256 (1 - v)) / 512)
# El RGB de los texeles transparentes se rellena con el color medio de los visibles: al filtrar no quedan
# bordes negros. Uso: python3 -I scripts/caras-mh/atlas-cejas.py <carpeta con ceja.png y pestanas.png> <salida.png>
import sys
import numpy as np
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
c = np.array(Image.open(src + '/ceja.png').convert('RGBA')).astype(np.float32)
p = np.array(Image.open(src + '/pestanas.png').convert('RGBA')).astype(np.float32)
out = np.zeros((512, 512, 4), np.float32)
out[0:128] = c
out[144:400, 0:256] = p
medias = []
for a, b, x in [(0, 128, 512), (144, 400, 256)]:
    reg = out[a:b, 0:x]
    w = reg[..., 3:4] / 255
    m = (reg[..., :3] * w).sum((0, 1)) / max(float(w.sum()), 1e-6)
    medias.append(m)
    reg[reg[..., 3] < 8, 0:3] = m
for a, b, x0 in [(128, 144, 0), (400, 512, 0), (144, 400, 256)]:
    out[a:b, x0:, 0:3] = medias[0] if a != 144 else medias[1]
    out[a:b, x0:, 3] = 0
Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8), 'RGBA').save(dst, optimize=True)
