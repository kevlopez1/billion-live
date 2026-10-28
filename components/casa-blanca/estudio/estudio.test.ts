// ──────────────────────────────────────────────────────────────
// Prueba del estudio (línea de tiempo, sin navegador):
//   npx tsx components/casa-blanca/estudio/estudio.test.ts
// Sale con código 1 si algo falla. Mismo estilo que motor/simulacion.test.ts.
// ──────────────────────────────────────────────────────────────

import { CHALLENGE_TARGET, RECAUDADO } from "@/lib/contador"
import { ESPECIALES, PERSONAJES } from "../datos/personajes"
import { LUGAR } from "../lugares"
import { Simulacion } from "../motor/simulacion"
import { CALENDARIO } from "./episodios"
import { duracionTotal, guionValido, type Episodio } from "./guion"
import {
  APERTURA_S,
  CIERRE_S,
  armarLinea,
  avisosDelEpisodio,
  codigoDeTiempo,
  cuadroDeTiempo,
  horarioDialogo,
  lineaActiva,
  lugarDelPlano,
  minutosDe,
  momentoEn,
  numerosDeCamara,
  opacidad,
  pulsoDeMano,
  rotuloDeCamara,
  textoFinal,
  tiempoDeCuadro,
  visorDe,
} from "./linea"
import { MUESTRA } from "./muestra"

let fallas = 0
let pasaron = 0
function ok(cond: unknown, msg: string) {
  if (cond) pasaron++
  else {
    fallas++
    console.error(`  FALLA: ${msg}`)
  }
}
function seccion(t: string) {
  console.log(`\n· ${t}`)
}
const cerca = (a: number, b: number, e = 1e-9) => Math.abs(a - b) < e

// Las tomas del motor. motor-camara.ts trae three: si no carga en Node, se usan las del contrato (guion.ts).
async function tomasDelMotor(): Promise<Array<{ id: string; duracion: number }>> {
  try {
    const m = await import("../escena/motor-camara")
    return [...m.TOMAS_CINE]
  } catch {
    return ["portico-norte", "dron", "bajada", "departamento", "seguir", "sala-guerra", "ciudad", "maqueta"].map((id) => ({ id, duracion: 9 }))
  }
}

async function main() {
  const TOMAS = await tomasDelMotor()
  const ids = {
    personajes: new Set(PERSONAJES.map((p) => p.id)),
    lugares: new Set(Object.keys(LUGAR)),
    tomas: new Set(TOMAS.map((t) => t.id)),
  }

  seccion("La muestra es un guion válido")
  {
    const errores = guionValido(MUESTRA, ids)
    ok(errores.length === 0, `guionValido(muestra) sin errores (${errores.join(" | ")})`)
    const d = duracionTotal(MUESTRA)
    ok(d >= 11 && d <= 14, `la muestra dura ~12 s (${d} s)`)
    ok(MUESTRA.planos.length >= 3 && MUESTRA.planos.length <= 4, "tiene 3 o 4 planos")
    ok(MUESTRA.planos.some((p) => p.camara.tipo === "seguir" && (p.dialogo?.length ?? 0) >= 2), "sigue a un residente con dos líneas")
    ok(MUESTRA.planos.some((p) => p.camara.tipo === "toma" && p.camara.toma === "sala-guerra" && p.visor === "camara" && p.reunir?.length === 3), "la Sala de guerra con visor de cámara y tres reunidos")
    ok(MUESTRA.planos.some((p) => p.rotulo?.includes("{RECAUDADO}")), "un rótulo usa {RECAUDADO}")
    const av = avisosDelEpisodio(MUESTRA, TOMAS)
    ok(av.length === 0, `la muestra no tiene avisos (${av.join(" | ")})`)
    // Las líneas de la muestra existen en los datos del personaje (no se inventan).
    for (const p of MUESTRA.planos)
      for (const l of p.dialogo ?? []) {
        const pj = PERSONAJES.find((x) => x.id === l.quien)!
        const todas = Object.values(pj.temas).flat().map((x) => (typeof x === "string" ? x : x.t))
        ok(todas.some((t) => t.startsWith(l.texto.replace(/[.?!]$/, "")) || t.includes(l.texto)), `"${l.texto}" sale de lo que dice ${l.quien} en datos/personajes.ts`)
      }
  }

  seccion("El calendario (episodios.ts)")
  {
    const vistos = new Set<string>()
    for (const e of CALENDARIO) {
      const errores = guionValido(e.episodio, ids)
      ok(errores.length === 0, `${e.episodio.id}: guion válido (${errores.join(" | ")})`)
      ok(!vistos.has(e.episodio.id), `${e.episodio.id}: id único`)
      vistos.add(e.episodio.id)
    }
    ok(!vistos.has("muestra"), "ningún episodio del calendario se llama \"muestra\"")
    console.log(`  (${CALENDARIO.length} episodios en el calendario)`)
  }

  seccion("guionValido marca lo que no existe")
  {
    const malo: Episodio = {
      id: "Malo 1",
      titulo: "x",
      formato: "9:16" as never,
      visor: "cine",
      planos: [
        { dur: 0, camara: { tipo: "toma", toma: "no-existe" }, hora: "25:00", visor: "tele" as never },
        { dur: 3, camara: { tipo: "seguir", personaje: "nadie" }, reunir: ["fantasma"], dialogo: [{ quien: "otro", texto: " " }] },
        { dur: 3, camara: { tipo: "lugar", lugar: "marte" } },
      ],
    }
    const e = guionValido(malo, ids)
    for (const parte of ["id", "formato", "dur 0", "hora", "visor \"tele\"", "no-existe", "\"nadie\"", "fantasma", "\"otro\"", "vacía", "marte"])
      ok(e.some((x) => x.includes(parte)), `marca: ${parte}`)
  }

  seccion("Línea de tiempo: apertura, planos y cierre")
  {
    const L = armarLinea(MUESTRA)
    const total = APERTURA_S + duracionTotal(MUESTRA) + CIERRE_S
    ok(cerca(L.duracion, total), `dura apertura + planos + cierre (${L.duracion} s)`)
    ok(L.cuadros === Math.round(total * 30), `cuadros = duración × 30 (${L.cuadros})`)
    ok(cerca(L.tramos[0].desde, APERTURA_S), "el primer plano empieza después de la apertura")
    for (let i = 1; i < L.tramos.length; i++) ok(cerca(L.tramos[i].desde, L.tramos[i - 1].hasta), `plano ${i + 1} empieza donde termina el anterior`)
    ok(momentoEn(L, 0).fase === "apertura" && momentoEn(L, 0).tramo.indice === 0, "t = 0: apertura, con la escena del primer plano")
    ok(momentoEn(L, APERTURA_S).fase === "plano" && momentoEn(L, APERTURA_S).local === 0, "al terminar la apertura empieza el plano 1 (local 0)")
    const t2 = L.tramos[1].desde
    ok(momentoEn(L, t2 - 1e-6).tramo.indice === 0 && momentoEn(L, t2).tramo.indice === 1, "el corte cae exacto en el borde")
    ok(momentoEn(L, L.duracion - 0.01).fase === "cierre" && momentoEn(L, L.duracion - 0.01).tramo.indice === L.tramos.length - 1, "al final: cierre, con la escena del último plano")
    // Cada cuadro tiene su plano, y el número de cortes es el de planos.
    let cortes = 0
    let previo = -1
    for (let i = 0; i < L.cuadros; i++) {
      const m = momentoEn(L, tiempoDeCuadro(i, L.fps))
      if (m.tramo.indice !== previo) cortes++
      previo = m.tramo.indice
    }
    ok(cortes === MUESTRA.planos.length, `recorrer los cuadros pasa por cada plano una vez (${cortes})`)
  }

  seccion("Cuadros ↔ tiempo")
  {
    ok(tiempoDeCuadro(0, 30) === 0 && cerca(tiempoDeCuadro(45, 30), 1.5), "cuadro 45 a 30 fps = 1,5 s")
    ok(cuadroDeTiempo(1.5, 30) === 45 && cuadroDeTiempo(1.499, 30) === 44, "1,5 s = cuadro 45; 1,499 s = cuadro 44")
    let idas = true
    for (let i = 0; i < 2000; i++) if (cuadroDeTiempo(tiempoDeCuadro(i, 30), 30) !== i) idas = false
    ok(idas, "ida y vuelta exacta para 2.000 cuadros (sin errores de coma flotante)")
    ok(cuadroDeTiempo(tiempoDeCuadro(7, 24), 24) === 7, "también a 24 fps")
    ok(codigoDeTiempo(0, 30) === "00:00:00:00", "código de tiempo en 0")
    ok(codigoDeTiempo(5.4, 30) === "00:00:05:12", `5,4 s = 00:00:05:12 (${codigoDeTiempo(5.4, 30)})`)
    ok(codigoDeTiempo(3725 + 29 / 30, 30) === "01:02:05:29", `1 h 2 min 5 s 29 cuadros (${codigoDeTiempo(3725 + 29 / 30, 30)})`)
  }

  seccion("Diálogo: repartido en partes iguales")
  {
    const plano = MUESTRA.planos.find((p) => (p.dialogo?.length ?? 0) === 2)!
    const h = horarioDialogo(plano)
    ok(h.length === 2, "dos líneas, dos turnos")
    ok(h[0].desde > 0 && h[0].desde < 0.2, "la primera entra apenas empieza el plano")
    ok(h[0].hasta <= plano.dur / 2 && h[1].desde >= plano.dur / 2, "cada una en su mitad")
    ok(cerca(h[0].hasta - h[0].desde, h[1].hasta - h[1].desde), "los dos turnos duran lo mismo")
    ok(h[1].hasta < plano.dur, "la última sale antes del corte")
    ok(lineaActiva(plano, plano.dur * 0.25)?.linea === plano.dialogo![0], "a un cuarto del plano habla la primera")
    ok(lineaActiva(plano, plano.dur * 0.75)?.linea === plano.dialogo![1], "a tres cuartos, la segunda")
    ok(lineaActiva(plano, plano.dur / 2) === null || lineaActiva(plano, plano.dur / 2)?.linea === plano.dialogo![1], "en el medio, un respiro o la segunda (nunca la primera)")
    ok(lineaActiva(plano, plano.dur + 0.1) === null && lineaActiva(plano, -0.1) === null, "fuera del plano, nadie")
    const cinco = { dur: 10, camara: { tipo: "lugar" as const, lugar: "rosas" }, dialogo: [1, 2, 3, 4, 5].map((n) => ({ quien: "trump", texto: `Línea ${n}.` })) }
    const h5 = horarioDialogo(cinco)
    ok(h5.every((l, k) => l.desde >= k * 2 && l.hasta <= (k + 1) * 2), "cinco líneas en 10 s: una cada 2 s")
    ok(horarioDialogo({ dur: 3, camara: { tipo: "lugar", lugar: "rosas" } }).length === 0, "sin diálogo, sin turnos")
    ok(opacidad(0.05, 0, 1, 0.1) > 0.4 && opacidad(0.05, 0, 1, 0.1) < 0.6 && opacidad(0.5, 0, 1, 0.1) === 1 && opacidad(1, 0, 1) === 0, "entra y sale con fundido")
  }

  seccion("Textos: {RECAUDADO} sale de lib/contador.ts")
  {
    const miles = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".")
    ok(textoFinal("Recaudado: {RECAUDADO}") === `Recaudado: $${miles(RECAUDADO)}`, `{RECAUDADO} → $${miles(RECAUDADO)}`)
    ok(textoFinal("{RECAUDADO} de {META}") === `$${miles(RECAUDADO)} de $${miles(CHALLENGE_TARGET)}`, "y {META} → la meta del reto")
    ok(textoFinal("{RECAUDADO} y {RECAUDADO}").split("$").length === 3, "todas las apariciones")
    ok(textoFinal("Sin marcas.") === "Sin marcas.", "un texto sin marcas no cambia")
    ok(!/\{[A-Z]+\}/.test(MUESTRA.planos.map((p) => textoFinal(p.rotulo ?? "")).join(" ")), "en la muestra no queda ninguna marca sin reemplazar")
  }

  seccion("Cámaras: número, nombre, lugar y visor")
  {
    const n = numerosDeCamara({ ...MUESTRA, planos: [MUESTRA.planos[0], MUESTRA.planos[1], MUESTRA.planos[0], MUESTRA.planos[2]] })
    ok(n.join(",") === "1,2,1,3", `la misma cámara repite su número (${n.join(",")})`)
    ok(rotuloDeCamara(3, "Sala de guerra") === "CAM 03 · SALA DE GUERRA", "CAM 03 · SALA DE GUERRA")
    ok(lugarDelPlano({ tipo: "toma", toma: "sala-guerra" }, () => null) === "sala-guerra", "la toma de la Sala de guerra muestra la Sala de guerra")
    ok(lugarDelPlano({ tipo: "lugar", lugar: "rosas" }, () => null) === "rosas", "un lugar es su lugar")
    ok(lugarDelPlano({ tipo: "seguir", personaje: "karp" }, (id) => (id === "karp" ? "jardin-sur" : null)) === "jardin-sur", "seguir: donde está el residente")
    ok(lugarDelPlano({ tipo: "toma", toma: "dron" }, () => "x") === null, "el dron no muestra un lugar")
    ok(visorDe(MUESTRA, MUESTRA.planos[2]) === "camara" && visorDe(MUESTRA, MUESTRA.planos[0]) === "cine", "el visor del plano gana al del episodio")
    ok(visorDe(MUESTRA, MUESTRA.planos[2], "cine") === "cine", "?visor= gana a los dos")
    ok(minutosDe("17:30") === 1050 && minutosDe("00:05") === 5, "\"17:30\" = 1050 minutos")
  }

  seccion("El pulso de la mano: suave, chico y determinista")
  {
    let max = 0
    let salto = 0
    let prev = pulsoDeMano(0, 1080)
    for (let i = 1; i < 30 * 60; i++) {
      const p = pulsoDeMano(i / 30, 1080)
      max = Math.max(max, Math.abs(p.dx), Math.abs(p.dy))
      salto = Math.max(salto, Math.hypot(p.dx - prev.dx, p.dy - prev.dy))
      prev = p
    }
    ok(max < 5, `se mueve menos de 5 px (${max.toFixed(2)})`)
    // Con 2,2 % de margen de escala el borde nunca se ve: 1920 × 0,011 = 21 px por lado.
    ok(max < 1920 * ((pulsoDeMano(0, 1080).escala - 1) / 2), "el margen de escala tapa el movimiento")
    ok(salto < 1, `de un cuadro al siguiente, menos de 1 px (${salto.toFixed(3)})`)
    ok(JSON.stringify(pulsoDeMano(7.3, 1080)) === JSON.stringify(pulsoDeMano(7.3, 1080)), "mismo t, mismo pulso")
    ok(cerca(pulsoDeMano(2, 540).dx * 2, pulsoDeMano(2, 1080).dx), "escala con el alto")
  }

  seccion("Avisos del estudio")
  {
    const largo: Episodio = { ...MUESTRA, id: "largo", planos: [{ dur: 20, camara: { tipo: "toma", toma: "sala-guerra" } }] }
    const av = avisosDelEpisodio(largo, TOMAS)
    ok(av.some((a) => a.includes("se repite")), "una toma más corta que el plano avisa que se repite")
    const rapido: Episodio = { ...MUESTRA, id: "rapido", planos: [{ dur: 1, camara: { tipo: "lugar", lugar: "rosas" }, dialogo: [{ quien: "trump", texto: "Una línea demasiado larga para un segundo de pantalla." }] }] }
    ok(avisosDelEpisodio(rapido, TOMAS).some((a) => a.includes("caracteres por segundo")), "una línea que no se alcanza a leer avisa")
    const sinLugar: Episodio = { ...MUESTRA, id: "sin-lugar", planos: [{ dur: 3, camara: { tipo: "toma", toma: "dron" }, reunir: ["trump"] }] }
    ok(avisosDelEpisodio(sinLugar, TOMAS).some((a) => a.includes("no tiene dónde reunir")), "reunir en el dron avisa")
  }

  seccion("La simulación del estudio es repetible (misma semilla, mismos cortes)")
  {
    const correr = () => {
      const L = armarLinea(MUESTRA)
      const sim = new Simulacion(PERSONAJES, ESPECIALES, { dia: 1, minutos: minutosDe(MUESTRA.planos[0].hora!), semilla: 20261028 })
      let plano = -1
      const huella: string[] = []
      for (let i = 0; i < L.cuadros; i++) {
        const t = tiempoDeCuadro(i, L.fps)
        const m = momentoEn(L, t)
        if (m.tramo.indice !== plano) {
          plano = m.tramo.indice
          const p = m.tramo.plano
          if (p.hora) sim.saltarA(minutosDe(p.hora))
          const lugar = lugarDelPlano(p.camara, (id) => sim.pj[id]?.lugarId ?? null)
          if (p.reunir?.length && lugar) sim.reunirYa(lugar, p.reunir)
        }
        sim.avanzar(1 / L.fps, t * 1000)
        if (i % 30 === 0) huella.push(JSON.stringify(PERSONAJES.map((p) => [sim.pj[p.id].pos, sim.pj[p.id].estado])))
      }
      return { huella: huella.join("|"), sim }
    }
    const a = correr()
    const b = correr()
    ok(a.huella === b.huella, "dos corridas, la misma historia cuadro a cuadro")
    ok(["suntzu", "napoleon", "claude"].every((id) => a.sim.pj[id].lugarId === "sala-guerra"), "los reunidos siguen en la Sala de guerra al final")
  }

  console.log(`\n${pasaron} pasaron, ${fallas} fallaron`)
  if (fallas) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
