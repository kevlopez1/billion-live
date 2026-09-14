#!/usr/bin/env python3
"""
Detector de texto de más en la web.

Hermano de sin-voseo.py. Aquel busca un acento prestado; este busca palabras
que no hacen nada. Nace de una corrección de Kev:

    «Hay que ir reduciendo todo el copy innecesario de la web,
     todo lo que sea de más en palabras.»

No falla el build ni pretende tener razón siempre: señala candidatos y los
ordena por cuánto pesan. La decisión de cortar es de una persona.

    python3 scripts/sin-relleno.py            # resumen
    python3 scripts/sin-relleno.py --todo     # cada hallazgo con su línea
"""
import os, re, sys, collections

# Frases que casi nunca sobreviven a un recorte honesto.
RELLENO = [
    # preámbulos que retrasan la frase
    "lo que hacemos es", "se trata de", "es importante señalar", "cabe destacar",
    "hay que decir que", "la verdad es que", "lo cierto es que", "no es otra cosa que",
    "en otras palabras", "dicho de otro modo", "por así decirlo",
    # muletillas
    "simplemente", "básicamente", "literalmente", "totalmente", "completamente",
    "absolutamente", "realmente", "prácticamente", "sumamente", "enormemente",
    # cierres que no cierran nada
    "y mucho más", "entre otras cosas", "y demás", "etcétera", "y todo eso",
    # superlativos vacíos: si es verdad se prueba con un número
    "increíble", "espectacular", "impresionante", "revolucionario", "único en su tipo",
    "el mejor del mundo", "sin precedentes", "de primer nivel", "de alta calidad",
    # subordinadas que solo alargan
    "que es lo que", "lo cual permite", "con el fin de", "con el objetivo de",
    "a fin de que", "de manera que", "en el sentido de que",
    # redundancias
    "totalmente gratis", "completamente gratis", "planes a futuro", "experiencia previa",
    "pero sin embargo", "subir arriba", "bajar abajo", "entrar adentro", "salir afuera",
]
PAT_RELLENO = re.compile("|".join(r"(?<![A-Za-zÁÉÍÓÚáéíóúñÑ])" + re.escape(f) + r"(?![A-Za-zÁÉÍÓÚáéíóúñÑ])"
                                 for f in RELLENO), re.IGNORECASE)

# Lo que delata que una cadena es código y no algo que alguien lee.
CODIGO = re.compile(r"(=>|===|!==|\bimport\b|\bexport\b|\bconst\b|\blet\b|\bfunction\b|"
                    r"\breturn\b|\bawait\b|\basync\b|\buse[A-Z]\w+|\bNextResponse\b|"
                    r"\btypeof\b|\bnull\b|\bundefined\b|[{}\[\];]|\)\s*=|=\s*\()")

LARGO_FRASE = 22      # palabras: a partir de aquí una frase pide punto
LARGO_BLOQUE = 45     # palabras en una sola cadena: pide tijera

# Solo el texto que ve una persona. Fuera: metadatos de SEO (son descriptivos a
# propósito, para Google), mensajes de error (mejor claros que cortos), aria/alt.
SALTAR_LINEA = re.compile(r"(aria-label|alt=|title:|description:|keywords|className|import |from \"|href=|placeholder=)")
SALTAR_ARCHIVO = ("layout.tsx", "sitemap.ts", "robots.ts")


def archivos():
    for base in ("app", "components", "lib", "context"):
        for raiz, _, fs in os.walk(base):
            if raiz.endswith("/ui") or "/ui/" in raiz:
                continue
            for f in sorted(fs):
                if f.endswith((".tsx", ".ts")) and f not in SALTAR_ARCHIVO:
                    yield os.path.join(raiz, f)


def cadenas(ruta):
    """(línea, texto, tipo) de cada texto visible. tipo: "cadena" o "prosa".

    Hay dos formas de texto en este repo y hacen falta las dos:

    - CADENA: texto entre comillas, en los arrays de datos. Es un bloque de
      copy completo, así que se mide entero.
    - PROSA: texto suelto dentro del JSX. Viene partido por etiquetas en línea
      (<span>, <b>, <PrimeMark/>), así que hay que volver a pegarlo antes de
      medir: si no, "Tu nombre grabado" y "en la carrocería del Mercedes"
      parecen dos frases cortas cuando en pantalla son una sola larga.
    """
    bruto = open(ruta, encoding="utf-8", errors="replace").read()

    # Fuera los comentarios: no se ven en pantalla.
    sin_com = re.sub(r"/\*.*?\*/", lambda m: "\n" * m.group().count("\n"), bruto, flags=re.S)
    sin_com = re.sub(r"^\s*//.*$", "", sin_com, flags=re.M)

    # Los metadatos de SEO se saltan enteros, no línea por línea: una
    # description larga se escribe en varias líneas y solo la primera lleva la
    # palabra "description:", así que el filtro por línea dejaba pasar el resto.
    fuera = set()
    for m in re.finditer(r"export const (metadata|viewport)\b", sin_com):
        ini = sin_com.count("\n", 0, m.start()) + 1
        prof, i = 0, m.end()
        while i < len(sin_com):
            if sin_com[i] == "{": prof += 1
            elif sin_com[i] == "}":
                prof -= 1
                if prof == 0: break
            i += 1
        fuera.update(range(ini, sin_com.count("\n", 0, i) + 2))

    for i, linea in enumerate(sin_com.split("\n"), 1):
        if i in fuera or SALTAR_LINEA.search(linea):
            continue
        for m in re.finditer(r'"([^"\\]{25,})"', linea):
            t = m.group(1)
            if "http" not in t and t.count(" ") >= 4 and not CODIGO.search(t):
                yield i, t, "cadena"

    if not ruta.endswith(".tsx"):
        return

    # Las expresiones {…} se van (son código); las etiquetas también. Lo que
    # queda, pegado, es lo que lee una persona.
    sin_expr = sin_com
    for _ in range(4):
        sin_expr = re.sub(r"\{[^{}]*\}", " ", sin_expr)

    for bloque in re.finditer(r"return \(.*?\n  \)", sin_expr, flags=re.S):
        linea = sin_com.count("\n", 0, bloque.start()) + 1
        # Las etiquetas de bloque cortan frase: un <div> y el siguiente son dos
        # textos distintos en pantalla aunque no haya punto entre medio. Sin
        # esto, tres etiquetas cortas se pegaban en una "frase larga" falsa.
        crudo = re.sub(r"</?(div|p|h[1-6]|li|ul|ol|section|header|footer|button|a|td|th|tr|label|figcaption)\b[^<>]*>",
                       " · ", bloque.group(), flags=re.I)
        texto = " ".join(re.sub(r"<[^<>]*>", " ", crudo).split())
        for f in frases(texto):
            if len(f) >= 25 and f.count(" ") >= 4 and not CODIGO.search(f):
                yield linea, f, "prosa"


def frases(texto):
    return [f.strip() for f in re.split(r"(?<=[.!?·])\s+", texto) if f.strip()]


def escanear():
    hallazgos = []
    for ruta in archivos():
        for linea, texto, tipo in cadenas(ruta):
            for m in PAT_RELLENO.finditer(texto):
                hallazgos.append((ruta, linea, "relleno", m.group().strip(), texto))
            palabras = len(texto.split())
            if tipo == "cadena" and palabras >= LARGO_BLOQUE:
                hallazgos.append((ruta, linea, "bloque", f"{palabras} palabras", texto))
                continue
            for f in (frases(texto) if tipo == "cadena" else [texto]):
                n = len(f.split())
                if n >= LARGO_FRASE:
                    hallazgos.append((ruta, linea, "frase", f"{n} palabras", f))
    return hallazgos


def main():
    todo = "--todo" in sys.argv
    h = escanear()
    por_tipo = collections.Counter(x[2] for x in h)
    por_archivo = collections.Counter(x[0] for x in h)

    print("TEXTO DE MÁS — candidatos a recorte\n")
    print(f"  relleno (muletillas y frases hechas) : {por_tipo['relleno']}")
    print(f"  frases de {LARGO_FRASE}+ palabras              : {por_tipo['frase']}")
    print(f"  bloques de {LARGO_BLOQUE}+ palabras             : {por_tipo['bloque']}")

    if por_archivo:
        print("\nPOR ARCHIVO (los 12 peores):")
        for ruta, n in por_archivo.most_common(12):
            print(f"  {n:>3}  {ruta}")

    if todo and h:
        print("\nDETALLE:")
        for ruta, linea, tipo, que, texto in h:
            print(f"\n  {ruta}:{linea}  [{tipo}: {que}]")
            print(f"    {texto[:150]}")

    print(f"\nTOTAL: {len(h)}")
    if not todo and h:
        print("Corre con --todo para ver cada uno con su línea.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
