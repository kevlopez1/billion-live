// Corre con: npx tsx lib/fabrica/semaforo.test.ts
// Sin red ni base. Sale con código 1 si algo falla.

import assert from "node:assert/strict"
import { PERSONAJES } from "@/components/casa-blanca/datos/personajes"
import { aliasDe, buscadorDe, diaDeBolivia, luzDe, luzDelVideo, nombradosEn, SEMAFORO } from "./semaforo"

let fallos = 0
function prueba(nombre: string, fn: () => void) {
  try {
    fn()
    console.log(`ok   ${nombre}`)
  } catch (e) {
    fallos++
    console.log(`FALLA ${nombre}\n     ${e instanceof Error ? e.message : e}`)
  }
}

prueba("los 24 personajes tienen entrada en el semáforo", () => {
  assert.equal(PERSONAJES.length, 24)
  for (const p of PERSONAJES) assert.ok(Object.prototype.hasOwnProperty.call(SEMAFORO, p.id), `falta "${p.id}"`)
  for (const id of Object.keys(SEMAFORO)) assert.ok(PERSONAJES.some((p) => p.id === id), `"${id}" no está en personajes.ts`)
})

prueba("ningún real: \"vivo\" es verde ni amarillo, en ninguna fecha", () => {
  for (const p of PERSONAJES.filter((x) => x.real === "vivo")) {
    for (const dia of ["2026-10-29", "2026-11-10", "2026-11-11", "2027-06-01"]) {
      const l = luzDe(p.id, dia)
      assert.ok(l === "vivo" || l === "fuera", `${p.id} el ${dia} es ${l}`)
    }
  }
})

prueba("verdes y amarillos según el plan", () => {
  for (const id of ["lincoln", "napoleon", "leonardo", "cleopatra", "suntzu", "marco", "socrates", "mason", "iluminado", "claude", "chatgpt"])
    assert.equal(luzDe(id, "2026-11-15"), "verde", id)
  for (const id of ["kobe", "jobs", "jesus"]) assert.equal(luzDe(id, "2026-11-15"), "amarillo", id)
  for (const id of ["thiel", "altman", "musk", "hormozi", "amodei", "pichai", "karp", "gadzhi"]) assert.equal(luzDe(id, "2026-11-15"), "vivo", id)
})

prueba("Trump: fuera hasta el 10-nov inclusive, vivo desde el 11, por fecha de salida", () => {
  assert.equal(luzDe("trump", "2026-10-29"), "fuera")
  assert.equal(luzDe("trump", "2026-11-10"), "fuera")
  assert.equal(luzDe("trump", "2026-11-11"), "vivo")
  // 02:00 UTC del 11 = 22:00 del 10 en Bolivia: todavía fuera.
  assert.equal(luzDe("trump", new Date("2026-11-11T02:00:00Z")), "fuera")
  assert.equal(luzDe("trump", new Date("2026-11-11T04:00:00Z")), "vivo")
})

prueba("Tate siempre fuera; un id desconocido, fuera", () => {
  assert.equal(luzDe("tate", "2026-10-29"), "fuera")
  assert.equal(luzDe("tate", "2030-01-01"), "fuera")
  assert.equal(luzDe("nadie", "2026-11-15"), "fuera")
  assert.equal(luzDe("constructor", "2026-11-15"), "fuera")
})

prueba("una fecha mal escrita no abre el semáforo", () => {
  assert.throws(() => luzDe("trump", "11/11/2026"))
  assert.throws(() => luzDe("trump", new Date("no")))
})

prueba("día de Bolivia: UTC−4 fijo", () => {
  assert.equal(diaDeBolivia(new Date("2026-11-11T03:59:00Z")), "2026-11-10")
  assert.equal(diaDeBolivia(new Date("2026-11-11T04:00:00Z")), "2026-11-11")
})

prueba("los alias encuentran al personaje como palabra entera", () => {
  assert.ok(aliasDe("musk").includes("Elon"))
  assert.ok(buscadorDe("musk").test("Hoy Elon llegó tarde"))
  assert.ok(buscadorDe("kobe").test("KOBE entrena"))
  assert.ok(buscadorDe("kobe").test("Bryant entrena"))
  assert.ok(!buscadorDe("musk").test("Muskaria"))
  assert.ok(!buscadorDe("trump").test("Trumpeta"))
  assert.deepEqual(nombradosEn("Napoleón y Sócrates discuten", ["napoleon", "socrates", "musk"]), ["napoleon", "socrates"])
})

prueba("la luz de un video: amarillo con un amarillo o un vivo de fondo, fuera con alguien fuera", () => {
  assert.equal(luzDelVideo(["napoleon", "suntzu"], "2026-11-15"), "verde")
  assert.equal(luzDelVideo(["napoleon", "kobe"], "2026-11-15"), "amarillo")
  assert.equal(luzDelVideo(["napoleon", "musk"], "2026-11-15"), "amarillo")
  assert.equal(luzDelVideo(["napoleon", "trump"], "2026-11-10"), "fuera")
  assert.equal(luzDelVideo(["napoleon", "trump"], "2026-11-11"), "amarillo")
})

console.log(fallos ? `\n${fallos} fallaron` : "\ntodas pasaron")
process.exit(fallos ? 1 : 0)
