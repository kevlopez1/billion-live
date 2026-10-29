// ──────────────────────────────────────────────────────────────
// Las voces de la casa: 3 candidatas por residente para que Kev elija.
//
//   npx tsx scripts/fabrica/disenar-voces.ts [--solo lincoln,kobe] [--rehacer] [--salida <carpeta>] [--seco]
//       Diseña 3 candidatas por cada residente que puede hablar (verde o
//       amarillo; los vivos y los de fuera no llevan voz) desde su arquetipo
//       en lib/fabrica/voz/arquetipos.ts. Deja los audios y candidatas.json
//       en la carpeta de salida. Lo que ya tiene 3 candidatas no se vuelve a
//       pagar (salvo --rehacer).
//
//   npx tsx scripts/fabrica/disenar-voces.ts --elegir <id> <n> --aprobado-por <quien> [--salida <carpeta>]
//       Guarda la candidata n de ese residente en la biblioteca de
//       ElevenLabs y la anota en lib/fabrica/voz/voces.json.
//
//   npx tsx scripts/fabrica/disenar-voces.ts --estado [--salida <carpeta>]
//       Quién habla, quién tiene voz aprobada y quién tiene candidatas.
//
// Sin FABRICA_ELEVENLABS_KEY (o con --seco) corre EN SECO: voz falsa (un
// tono por candidata), sin red y sin tocar voces.json.
// Variables: FABRICA_ELEVENLABS_KEY, FABRICA_ELEVENLABS_MODELO_DISENO,
// FABRICA_VOZ_TOPE_CARACTERES.
// Sale con 0 = todo bien, 1 = algo falló (dice qué y cómo), 2 = argumentos.
// ──────────────────────────────────────────────────────────────

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { diaBolivia } from "@/lib/fabrica/tipos"
import { luzDe } from "@/lib/fabrica/semaforo"
import { ARQUETIPOS, hablaEnLaFabrica, puedeHablarAlgunaVez } from "@/lib/fabrica/voz/arquetipos"
import { disenarVoces, elegirVoz, planDeDiseno, type Candidatas } from "@/lib/fabrica/voz/diseno"
import { crearElevenLabs } from "@/lib/fabrica/voz/elevenlabs"
import { crearVozFalsa } from "@/lib/fabrica/voz/falso"
import { guardarRegistro, leerRegistro, RUTA_REGISTRO } from "@/lib/fabrica/voz/registro"
import type { Disenador } from "@/lib/fabrica/voz/tipos"
import { esFallo } from "@/lib/fabrica/redes/http"

interface Args {
  solo: string[]
  rehacer: boolean
  seco: boolean
  salida: string | null
  elegir: { id: string; n: number } | null
  aprobadoPor: string
  estado: boolean
}

function args(): Args | string {
  const a = process.argv.slice(2)
  const o: Args = { solo: [], rehacer: false, seco: false, salida: null, elegir: null, aprobadoPor: "", estado: false }
  for (let i = 0; i < a.length; i++) {
    const x = a[i]
    if (x === "--solo") o.solo = (a[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean)
    else if (x === "--rehacer") o.rehacer = true
    else if (x === "--seco") o.seco = true
    else if (x === "--salida") o.salida = a[++i] ?? null
    else if (x === "--estado") o.estado = true
    else if (x === "--aprobado-por") o.aprobadoPor = a[++i] ?? ""
    else if (x === "--elegir") {
      const id = a[++i]
      const n = Number(a[++i])
      if (!id || !Number.isInteger(n) || n < 1) return "--elegir pide <id> <n> (n = 1, 2 o 3)"
      o.elegir = { id, n }
    } else return `argumento desconocido: ${x}`
  }
  if (o.elegir && !o.aprobadoPor.trim()) return "--elegir pide --aprobado-por <quien> (la voz la aprueba Kev)"
  return o
}

const log = (m: string) => console.log(m)

function leerCandidatas(ruta: string): Candidatas {
  if (!existsSync(ruta)) return {}
  try {
    return JSON.parse(readFileSync(ruta, "utf8")) as Candidatas
  } catch (e) {
    // Un archivo roto no se toma como vacío en silencio: se diría "no hay" y se pagaría todo otra vez.
    throw new Error(`${ruta} no es JSON válido (${e instanceof Error ? e.message : e}); arréglalo o bórralo a mano`)
  }
}

async function main(): Promise<number> {
  const o = args()
  if (typeof o === "string") {
    console.error(`[disenar-voces] ${o}`)
    return 2
  }
  const clave = (process.env.FABRICA_ELEVENLABS_KEY ?? "").trim()
  const seco = o.seco || !clave
  const salida = resolve(o.salida ?? join(tmpdir(), seco ? "fabrica-voces-seco" : "fabrica-voces"))
  const rutaCandidatas = join(salida, "candidatas.json")
  const rutaRegistro = resolve(process.cwd(), RUTA_REGISTRO)
  const reg = leerRegistro(rutaRegistro)
  for (const e of reg.errores) log(`[disenar-voces] registro: ${e}`)
  const previas = leerCandidatas(rutaCandidatas)
  const hoy = diaBolivia(new Date())

  if (o.estado) {
    log(`Voces al ${hoy} (registro: ${rutaRegistro}; candidatas: ${rutaCandidatas})\n`)
    for (const a of ARQUETIPOS) {
      const luz = luzDe(a.id, hoy)
      const voz = reg.registro.voces[a.id]
      const cands = previas[a.id]?.candidatas.length ?? 0
      const estado = !puedeHablarAlgunaVez(a.id)
        ? "sin voz (no habla en la fábrica)"
        : voz
          ? `aprobada: candidata ${voz.candidata} por ${voz.aprobadoPor} el ${voz.aprobadoEn.slice(0, 10)}`
          : cands
            ? `${cands} candidata(s), falta elegir`
            : "falta diseñar"
      log(`  ${a.id.padEnd(10)} ${luz.padEnd(9)} ${hablaEnLaFabrica(a.id, hoy) ? "habla" : "     "}  ${estado}`)
    }
    return 0
  }

  const disenador: Disenador = seco
    ? crearVozFalsa()
    : crearElevenLabs({
        fetch,
        clave,
        log,
        modeloDiseno: process.env.FABRICA_ELEVENLABS_MODELO_DISENO?.trim() || undefined,
        topeCaracteres: Number(process.env.FABRICA_VOZ_TOPE_CARACTERES) > 0 ? Number(process.env.FABRICA_VOZ_TOPE_CARACTERES) : undefined,
      })
  log(seco ? `[disenar-voces] EN SECO (${o.seco ? "--seco" : "sin FABRICA_ELEVENLABS_KEY"}): voz falsa, sin red, voces.json no se toca` : `[disenar-voces] ElevenLabs, modelo de diseño ${disenador.modeloDiseno}`)

  if (o.elegir) {
    const r = await elegirVoz({ id: o.elegir.id, n: o.elegir.n, aprobadoPor: o.aprobadoPor }, previas, reg.registro, { disenador, ahora: () => new Date(), log })
    if (esFallo(r)) {
      if (seco && r.clase === "fatal" && /no se anota nada/.test(r.como)) {
        log(`[disenar-voces] en seco: todo lo demás pasó; con la clave se guardaría la candidata ${o.elegir.n} de ${o.elegir.id} y se anotaría en ${RUTA_REGISTRO}`)
        return 0
      }
      console.error(`[disenar-voces] ${r.como} (${r.clase})`)
      return 1
    }
    guardarRegistro(rutaRegistro, r.registro)
    log(`[disenar-voces] ${o.elegir.id}: voz ${r.entrada.voiceId} (${r.reutilizada ? "ya estaba en la biblioteca" : "creada"}) anotada en ${RUTA_REGISTRO}, aprobada por ${r.entrada.aprobadoPor}`)
    return 0
  }

  const plan = planDeDiseno({ solo: o.solo, previas, registro: reg.registro, rehacer: o.rehacer, proveedor: disenador.nombre })
  for (const s of plan.saltar) log(`  saltado ${s.id}: ${s.porque}`)
  if (!plan.disenar.length) {
    log("[disenar-voces] nada que diseñar")
    return plan.saltar.some((s) => /no pasa la guarda|no es un residente/.test(s.porque)) ? 1 : 0
  }
  log(`[disenar-voces] se diseñan ${plan.disenar.length}: ${plan.disenar.join(", ")}\n  salida: ${salida}`)
  mkdirSync(salida, { recursive: true })
  const r = await disenarVoces(plan.disenar, previas, {
    disenador,
    escribir: (nombre, datos) => {
      writeFileSync(join(salida, nombre), datos)
      return nombre
    },
    guardarCandidatas: (c) => writeFileSync(rutaCandidatas, `${JSON.stringify(c, null, 2)}\n`),
    ahora: () => new Date(),
    log,
  })
  log(`\n[disenar-voces] listas: ${r.hechas.length}; fallidas: ${r.fallidas.length}`)
  for (const f of r.fallidas) log(`  ${f.id}: ${f.como}`)
  if (r.hechas.length) log(`  Escuchar en ${salida} y elegir con: npx tsx scripts/fabrica/disenar-voces.ts --elegir <id> <n> --aprobado-por kev`)
  return r.fallidas.length ? 1 : 0
}

main().then(
  (codigo) => process.exit(codigo),
  (e) => {
    console.error(`[disenar-voces] se cortó: ${e instanceof Error ? e.stack ?? e.message : e}`)
    process.exit(1)
  },
)
