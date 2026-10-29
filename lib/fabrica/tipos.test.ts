// Corre con: npx tsx lib/fabrica/tipos.test.ts
// Puro: sin red ni base.

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  ESTADOS_ENVIO,
  ESTADOS_VIDEO,
  TERMINALES_ENVIO,
  TERMINALES_VIDEO,
  TRANSICIONES,
  TRANSICIONES_ENVIO,
  diaBolivia,
  esperaTras,
  flag,
  horaBolivia,
  horariosDelDia,
  instanteBolivia,
  mananaBolivia,
  redesEncendidas,
  sumarDias,
} from "./tipos"

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

/** Cada estado vivo llega a un terminal, y todos se alcanzan desde el inicial. */
function recorrer<E extends string>(t: Readonly<Record<E, readonly E[]>>, todos: readonly E[], terminales: readonly E[], inicio: E) {
  for (const de of todos) {
    for (const a of t[de]) assert.ok(todos.includes(a), `${de} → ${a}: "${a}" no es un estado`)
    if (terminales.includes(de)) assert.equal(t[de].length, 0, `${de} es terminal y tiene salidas`)
    else {
      const vistos = new Set<E>([de])
      const cola = [de]
      while (cola.length) for (const s of t[cola.shift()!]) if (!vistos.has(s)) (vistos.add(s), cola.push(s))
      assert.ok(terminales.some((x) => vistos.has(x)), `desde ${de} no se llega a ningún terminal`)
    }
  }
  const alcanzados = new Set<E>([inicio])
  const cola = [inicio]
  while (cola.length) for (const s of t[cola.shift()!]) if (!alcanzados.has(s)) (alcanzados.add(s), cola.push(s))
  for (const e of todos) assert.ok(alcanzados.has(e), `"${e}" no se alcanza desde ${inicio}`)
}

prueba('flag: "false" está apagado (es una cadena no vacía, y en JS sería verdadera)', () => {
  for (const v of ["false", "FALSE", "0", "no", "off", "", "  ", "yes", "verdadero", undefined, null]) assert.equal(flag(v), false, String(v))
  for (const v of ["true", "1", "si", "sí", "on", " TRUE ", "Sí", "ON"]) assert.equal(flag(v), true, String(v))
})

prueba("redesEncendidas: sin FABRICA_ACTIVA no hay ninguna", () => {
  assert.deepEqual(redesEncendidas({ FABRICA_X_ACTIVA: "true" }), [])
  assert.deepEqual(redesEncendidas({ FABRICA_ACTIVA: "false", FABRICA_X_ACTIVA: "true" }), [])
  assert.deepEqual(redesEncendidas({ FABRICA_ACTIVA: "1", FABRICA_X_ACTIVA: "true", FABRICA_YOUTUBE_ACTIVA: "false" }), ["x"])
})

prueba("la máquina de estados del video: terminales sin salida, todo vivo llega a un final", () => {
  recorrer(TRANSICIONES, ESTADOS_VIDEO, TERMINALES_VIDEO, "idea")
})

prueba("la máquina de estados del envío: igual", () => {
  recorrer(TRANSICIONES_ENVIO, ESTADOS_ENVIO, TERMINALES_ENVIO, "pendiente")
  // Lo que importa del contrato:
  assert.ok(TRANSICIONES_ENVIO.ambiguo.includes("publicado"), "ambiguo → publicado (estaba en recientes)")
  assert.ok(!TRANSICIONES_ENVIO.ambiguo.includes("publicando"), "de ambiguo nunca se vuelve a mandar directo")
  assert.ok(TRANSICIONES_ENVIO.programado.includes("subido"), "desprogramar YouTube al pausar")
})

prueba("los estados son los mismos que acepta la base (check de supabase/correr-todo.sql)", () => {
  const sql = readFileSync(new URL("../../supabase/correr-todo.sql", import.meta.url), "utf8")
  const lista = (tabla: string) => {
    const bloque = sql.slice(sql.indexOf(`create table if not exists public.${tabla}`))
    const m = bloque.match(/estado\s+text not null default '\w+' check \(estado in \(([\s\S]*?)\)\)/)
    assert.ok(m, `no encontré el check de estado de ${tabla}`)
    return [...m![1].matchAll(/'(\w+)'/g)].map((x) => x[1]).sort()
  }
  assert.deepEqual(lista("fabrica_videos"), [...ESTADOS_VIDEO].sort())
  assert.deepEqual(lista("fabrica_envios"), [...ESTADOS_ENVIO].sort())
})

prueba("hora de Bolivia: UTC−4 fijo", () => {
  assert.equal(instanteBolivia("2026-11-10", "12:00").toISOString(), "2026-11-10T16:00:00.000Z")
  assert.equal(instanteBolivia("2026-11-10", "21:30").toISOString(), "2026-11-11T01:30:00.000Z")
  const madrugadaUTC = new Date("2026-11-11T03:00:00Z") // 23:00 del 10 en Bolivia
  assert.equal(diaBolivia(madrugadaUTC), "2026-11-10")
  assert.equal(horaBolivia(madrugadaUTC), "23:00")
  assert.equal(mananaBolivia(madrugadaUTC).toISOString(), "2026-11-11T04:00:00.000Z")
  assert.equal(sumarDias("2026-12-31", 1), "2027-01-01")
  assert.throws(() => instanteBolivia("2026-11-10", "25:00"))
})

prueba("horarios: 3 y 6 al día como el plan, nunca 19:00 en temporada", () => {
  assert.deepEqual(horariosDelDia(3, "2026-11-12"), ["12:00", "16:00", "21:30"])
  assert.deepEqual(horariosDelDia(6, "2026-11-12"), ["10:00", "12:00", "14:00", "16:00", "21:00", "22:30"])
  assert.equal(horariosDelDia(1, "2026-11-12").length, 1)
  assert.equal(horariosDelDia(9, "2026-11-12").length, 6)
  for (let n = 1; n <= 6; n++) assert.ok(!horariosDelDia(n, "2026-11-20").includes("19:00"))
})

prueba("esperas: 10, 30, 90 min", () => {
  assert.deepEqual([1, 2, 3, 7].map(esperaTras), [10, 30, 90, 90])
})

if (fallos) {
  console.log(`\n${fallos} prueba(s) fallaron`)
  process.exit(1)
}
console.log("\ntodo bien")
