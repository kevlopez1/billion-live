#!/usr/bin/env python3
"""Detector de voseo en el texto de la web. Tiene que dar TOTAL: 0."""
import re, os, collections, sys

FORMAS = [
 "Poné","poné","Ponés","ponés","Dejá","dejá","Dejás","dejás","Mandá","mandá","Mandame","mandame",
 "Entrá","entrá","Entrás","entrás","Mirá","mirá","Mirás","mirás","Firmá","firmá","Elegí","elegí",
 "Elegís","elegís","Sumate","sumate","Sumá","sumá","Contame","contame","Decime","decime",
 "Quedate","quedate","Probá","probá","Probás","probás","Andá","andá","Volvé","volvé",
 "Compartí","compartí","Escribí","escribí","Sacá","sacá","Buscá","buscá","Revisá","revisá",
 "Agregá","agregá","Pedí","pedí","Cerrá","cerrá","Tocá","tocá","Llevá","llevá","Guardá","guardá",
 "Aprovechá","aprovechá","Seguí","seguí","Anotate","anotate","Registrate","registrate",
 "Compartilo","compartilo","Compartila","compartila","Mandalo","mandalo","Mandala","mandala",
 "Mirala","mirala","Miralo","miralo","Dejalo","dejalo","Dejala","dejala","Tomalo","tomalo",
 "Ponelo","ponelo","Ponela","ponela","Probalo","probalo","Probala","probala","Usalo","usalo",
 "Contalo","contalo","Guardalo","guardalo","Revisalo","revisalo","Buscalo","buscalo",
 "Seguilo","seguilo","Sumalo","sumalo","Anotalo","anotalo","Elegilo","elegilo",
 "querés","Querés","podés","Podés","tenés","Tenés","sabés","Sabés","hacés","Hacés","Sos","sos",
 "vivís","construís","Construís","vendés","Vendés","llamás","Llamás","creés","Creés",
 "venís","Venís","ganás","Ganás","acá","Acá","vos","Vos","Metele","Fijate","fijate",
]
PAT = re.compile(r"(?<![A-Za-zÁÉÍÓÚáéíóúñÑ])(" + "|".join(map(re.escape, FORMAS)) + r")(?![A-Za-zÁÉÍÓÚáéíóúñÑ])")

def vivos():
    out = []
    for base in ("app", "components", "lib", "context"):
        for raiz, _, files in os.walk(base):
            if "/ui" in raiz or raiz.endswith("/ui"): continue
            for f in files:
                if f.endswith((".tsx", ".ts")): out.append(os.path.join(raiz, f))
    return sorted(out)

def escanear():
    cuenta = collections.Counter(); porarch = collections.defaultdict(list)
    for ruta in vivos():
        for i, linea in enumerate(open(ruta, encoding="utf-8"), 1):
            s = linea.strip()
            if s.startswith("//") or s.startswith("*") or s.startswith("/*"): continue
            for m in PAT.finditer(linea):
                cuenta[m.group()] += 1
                porarch[ruta].append((i, m.group(), s[:100]))
    return cuenta, porarch

if __name__ == "__main__":
    # Devuelve 1 si encuentra voseo, para poder usarlo en CI.
    c, pa = escanear()
    print("TOTAL:", sum(c.values()))
    print("\nPOR ARCHIVO:")
    for a, it in sorted(pa.items(), key=lambda kv: -len(kv[1])):
        print(f"  {len(it):>3}  {a}")
    print("\nFORMAS:", dict(c.most_common(40)))
    for a, it in sorted(pa.items()):
        for i, f, linea in it:
            print(f"    {a}:{i}  [{f}]  {linea}")
    sys.exit(1 if sum(c.values()) else 0)
