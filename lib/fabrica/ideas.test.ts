// Corre con: npx tsx lib/fabrica/ideas.test.ts
// Sin red ni base: las fuentes son de mentira. Sale con código 1 si algo falla.

import assert from "node:assert/strict"
import type { Conciencia, Recuerdo } from "@/lib/casa-blanca-memoria"
import { TIPOS_RECUERDO, tipoDeConversacion } from "@/lib/casa-blanca-memoria"
import { elegirIdeas, esDeLaCasa, leerFuentesDeIdeas, mismoTema, palabrasClave, parDe, TIPOS_DE_LA_CASA, TIPOS_DE_VISITANTE, type FuentesDeIdeas, type PuertoIdeas } from "./ideas"
import { luzDe } from "./semaforo"

let fallos = 0
async function prueba(nombre: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    console.log(`ok   ${nombre}`)
  } catch (e) {
    fallos++
    console.log(`FALLA ${nombre}\n     ${e instanceof Error ? e.message : e}`)
  }
}

const DIA = "2026-11-15"
let n = 0
const rec = (personajeId: string, tipo: Recuerdo["tipo"], texto: string, con: string[] = [], importancia = 6, creado = "2026-11-14T20:00:00Z"): Recuerdo => ({
  id: `r${++n}`,
  personajeId,
  tipo,
  texto,
  importancia,
  con,
  creado,
})
const conc = (personajeId: string, opiniones: Conciencia["opiniones"], extra: Partial<Conciencia> = {}): Conciencia => ({
  personajeId,
  dia: "2026-11-14",
  animo: "tranquilo",
  meta: "",
  pensamiento: "",
  diario: "",
  opiniones,
  actualizado: "2026-11-14T10:00:00Z",
  ...extra,
})

function fuentes(): FuentesDeIdeas {
  return {
    recuerdos: [
      rec("napoleon", "conversacion", "Discutí con Sun Tzu sobre ajedrez en la biblioteca y perdí tres partidas.", ["suntzu"], 8),
      rec("cleopatra", "conversacion", "Le enseñé a Leonardo a negociar con mercaderes de especias.", ["leonardo"], 7),
      rec("socrates", "diario", "Hoy le hice tantas preguntas a Claude que se quedó pensando en silencio.", ["claude"], 6),
      rec("lincoln", "trabajo", "Mi equipo entregó: plan de alianzas para vender fuera de Bolivia", [], 7),
      rec("marco", "conversacion", "Jesús me habló del perdón junto a la fuente del jardín.", ["jesus"], 9),
      // Lo que trae texto de un visitante no entra aunque el lector lo traiga.
      rec("napoleon", "charla", "Un visitante me contó que su jefe lo explota.", [], 10),
      rec("suntzu", "noticia", "Llegó la noticia «el dólar sube». Dije: «el agua toma la forma del terreno»", ["napoleon"], 10),
      rec("lincoln", "consejo", "Consejo sobre «cómo ganar las elecciones»: votamos y ganó la prudencia.", ["napoleon"], 10),
      // Una semilla que nombra a un vivo: fuera.
      rec("leonardo", "conversacion", "Elon me mostró un cohete y le dibujé uno mejor.", ["chatgpt"], 10),
    ],
    conciencias: [
      conc("chatgpt", { claude: { valor: -45, frase: "Piensa tres segundos antes de cada respuesta." } }, { pensamiento: "Hoy hice 400 listas." }),
      conc("leonardo", { napoleon: { valor: 60, frase: "Quiere que le diseñe un cañón; prefiero un puente." } }),
      conc("musk", { napoleon: { valor: 90, frase: "Me cae bien." } }),
    ],
    historial: [
      { dia: "2026-11-13", personajes: ["napoleon", "suntzu"], tema: "partidas tablero" },
      { dia: "2026-11-01", personajes: ["cleopatra", "leonardo"], tema: "mercaderes especias" },
    ],
  }
}

async function main() {
  await prueba("palabras clave y temas", () => {
    assert.deepEqual(palabrasClave(["Napoleón perdió tres partidas de ajedrez en la biblioteca"]), ["perdió", "partidas", "ajedrez", "biblioteca"])
    assert.ok(mismoTema("ajedrez biblioteca partidas", "partidas ajedrez"))
    assert.ok(!mismoTema("ajedrez biblioteca", "cohete marte"))
    assert.equal(parDe("suntzu", "napoleon"), "napoleon|suntzu")
  })

  await prueba("3 ideas + 1 reserva verde, sin repetir par, tema ni historial de 7 días", () => {
    const r = elegirIdeas(fuentes(), { dia: DIA, cuantas: 3 })
    assert.equal(r.ideas.length, 3, r.faltan.join(" | "))
    assert.ok(r.reserva, "falta la reserva")
    const todas = [...r.ideas, r.reserva!]
    const pares = todas.map((i) => i.par)
    assert.equal(new Set(pares).size, pares.length, `pares repetidos: ${pares}`)
    assert.ok(!pares.includes("napoleon|suntzu"), "repitió el par de hace 2 días")
    // El de cleopatra|leonardo fue hace 14 días: puede volver.
    for (const i of todas) for (const id of i.personajes) assert.ok(["verde", "amarillo"].includes(luzDe(id, DIA)), `${id} no puede protagonizar`)
    for (const id of r.reserva!.personajes) assert.equal(luzDe(id, DIA), "verde", `la reserva tiene a ${id}`)
    assert.ok(r.reserva!.esReserva && r.ideas.every((i) => !i.esReserva))
  })

  await prueba("los pilares rotan: cámara oculta, historia, consejo", () => {
    const r = elegirIdeas(fuentes(), { dia: DIA, cuantas: 3 })
    assert.deepEqual(r.ideas.map((i) => i.pilar), ["camara-oculta", "historia", "consejo"])
  })

  await prueba("nunca una charla, una noticia ni un consejo de visitante; nunca una semilla con un vivo", () => {
    const r = elegirIdeas(fuentes(), { dia: DIA, cuantas: 6 })
    const semillas = [...r.ideas, ...(r.reserva ? [r.reserva] : [])].flatMap((i) => i.semilla).join(" ")
    assert.ok(!/visitante|dólar|elecciones|Elon/.test(semillas), semillas)
    assert.deepEqual([...TIPOS_DE_LA_CASA], ["conversacion", "trabajo", "diario"])
  })

  await prueba("una conversación sobre el tema de un visitante nunca entra, aunque pese más que todo", () => {
    const f: FuentesDeIdeas = {
      recuerdos: [
        rec("lincoln", "conversacion_visitante", "Jardín · Hablamos de cómo despedir a mi cuñado sin que se enoje.", ["socrates"], 10, "2026-11-14T23:00:00Z"),
        rec("cleopatra", "conversacion", "Le enseñé a Leonardo a negociar con mercaderes de especias.", ["leonardo"], 3),
      ],
      conciencias: [],
      historial: [],
    }
    const r = elegirIdeas(f, { dia: DIA, cuantas: 6 })
    const todas = [...r.ideas, ...(r.reserva ? [r.reserva] : [])]
    assert.ok(!todas.some((i) => /cuñado/.test(i.semilla.join(" "))), JSON.stringify(todas.map((i) => i.semilla)))
    assert.ok(!todas.some((i) => i.fuentes.includes(f.recuerdos[0].id)))
    assert.ok(todas.some((i) => i.par === "cleopatra|leonardo"), "la conversación de la casa sí entra")
  })

  await prueba("cada tipo de recuerdo está de un lado: de la casa o de un visitante (nunca de los dos, nunca de ninguno)", () => {
    const casa = new Set<string>(TIPOS_DE_LA_CASA)
    const visitante = new Set<string>(TIPOS_DE_VISITANTE)
    for (const t of TIPOS_RECUERDO) assert.ok(casa.has(t) !== visitante.has(t), `${t}: casa=${casa.has(t)} visitante=${visitante.has(t)}`)
    for (const t of [...casa, ...visitante]) assert.ok((TIPOS_RECUERDO as readonly string[]).includes(t), `${t} no es un tipo de recuerdo`)
    assert.ok(!esDeLaCasa("conversacion_visitante") && !esDeLaCasa("charla") && !esDeLaCasa("algo-nuevo"))
  })

  await prueba("conversar() con tema del visitante guarda su propio tipo; sin tema, una conversación de la casa", () => {
    assert.equal(tipoDeConversacion("¿Cómo le pido un aumento a mi jefe?"), "conversacion_visitante")
    assert.equal(tipoDeConversacion(undefined), "conversacion")
    assert.equal(tipoDeConversacion(null), "conversacion")
    assert.equal(tipoDeConversacion("   "), "conversacion")
    assert.ok(!esDeLaCasa(tipoDeConversacion("un tema cualquiera")))
  })

  await prueba("un vivo nunca protagoniza (aunque tenga opiniones fuertes)", () => {
    const r = elegirIdeas(fuentes(), { dia: DIA, cuantas: 6 })
    for (const i of r.ideas) assert.ok(!i.personajes.includes("musk"))
  })

  await prueba("un amarillo puede ser idea, nunca reserva", () => {
    const f = fuentes()
    f.recuerdos = [rec("marco", "conversacion", "Jesús me habló del perdón junto a la fuente.", ["jesus"], 9)]
    f.conciencias = []
    const r = elegirIdeas(f, { dia: DIA, cuantas: 3 })
    assert.ok(r.ideas.some((i) => i.par === "jesus|marco"))
    assert.ok(r.reserva && !r.reserva.personajes.includes("jesus"))
  })

  await prueba("Trump no protagoniza antes del 11-nov (y como vivo, tampoco después)", () => {
    for (const dia of ["2026-11-09", "2026-11-20"]) {
      const r = elegirIdeas({ recuerdos: [], conciencias: [], historial: [] }, { dia, cuantas: 6 })
      for (const i of [...r.ideas, ...(r.reserva ? [r.reserva] : [])]) assert.ok(!i.personajes.includes("trump"), `${dia}: ${i.par}`)
    }
  })

  await prueba("sin memoria, salen de ESPECIALES (solo verdes y amarillos) y es determinista", () => {
    const a = elegirIdeas({ recuerdos: [], conciencias: [], historial: [] }, { dia: DIA, cuantas: 6 })
    const b = elegirIdeas({ recuerdos: [], conciencias: [], historial: [] }, { dia: DIA, cuantas: 6 })
    assert.deepEqual(a, b)
    assert.ok(a.ideas.length >= 3, a.faltan.join(" | "))
    assert.ok(a.ideas.every((i) => i.fuentes[0].startsWith("especial:")))
  })

  await prueba("si no alcanza, lo dice (un vacío no es un dato)", () => {
    const historial = [] as FuentesDeIdeas["historial"]
    const r0 = elegirIdeas({ recuerdos: [], conciencias: [], historial }, { dia: DIA, cuantas: 6 })
    // Se ocupan todos los pares posibles: ya no hay ideas.
    const ocupado = [...r0.ideas, ...(r0.reserva ? [r0.reserva] : [])].map((i) => ({ dia: "2026-11-14", personajes: i.personajes, tema: i.tema }))
    let r = r0
    for (let k = 0; k < 10 && (r.ideas.length || r.reserva); k++) {
      historial.push(...ocupado.splice(0))
      r = elegirIdeas({ recuerdos: [], conciencias: [], historial }, { dia: DIA, cuantas: 6 })
      ocupado.push(...[...r.ideas, ...(r.reserva ? [r.reserva] : [])].map((i) => ({ dia: "2026-11-14", personajes: i.personajes, tema: i.tema })))
    }
    assert.equal(r.ideas.length, 0)
    assert.ok(r.faltan.some((f) => /salieron 0/.test(f)))
    assert.ok(r.faltan.some((f) => /reserva/.test(f)))
  })

  await prueba("cuántas: siempre entre 3 y 6", () => {
    assert.equal(elegirIdeas(fuentes(), { dia: DIA, cuantas: 1 }).ideas.length, 3)
    assert.ok(elegirIdeas(fuentes(), { dia: DIA, cuantas: 99 }).ideas.length <= 6)
  })

  await prueba("leer fuentes: sin historial no hay ideas; sin memoria se sigue", async () => {
    const roto: PuertoIdeas = {
      recuerdosDesde: async () => [],
      conciencias: async () => [],
      historialDesde: async () => {
        throw new Error('relation "fabrica_videos" does not exist')
      },
    }
    const a = await leerFuentesDeIdeas(roto, DIA)
    assert.ok(!a.ok && /fabrica_videos/.test(a.como))
    let pedidoDesde = ""
    let pedidoTipos: readonly string[] = []
    const sinMemoria: PuertoIdeas = {
      recuerdosDesde: async (desde, tipos) => {
        pedidoDesde = desde
        pedidoTipos = tipos
        throw new Error("timeout")
      },
      conciencias: async () => [conc("claude", {})],
      historialDesde: async () => [],
    }
    const b = await leerFuentesDeIdeas(sinMemoria, DIA)
    assert.ok(b.ok && b.fuentes.recuerdos.length === 0 && b.fuentes.conciencias.length === 1)
    assert.equal(pedidoDesde, "2026-11-08")
    assert.deepEqual([...pedidoTipos], ["conversacion", "trabajo", "diario"])
  })

  console.log(fallos ? `\n${fallos} fallaron` : "\ntodas pasaron")
  process.exit(fallos ? 1 : 0)
}

main()
