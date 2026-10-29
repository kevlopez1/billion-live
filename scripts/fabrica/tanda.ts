// ──────────────────────────────────────────────────────────────
// La tanda diaria de la fábrica, en la máquina con GPU (D−1, 22:00 de Bolivia).
//
//   npx tsx scripts/fabrica/tanda.ts [--carpeta <dir>] [--esperar <min>] [--dia AAAA-MM-DD]
//       De verdad: reclama el día en Supabase, escribe ideas y guiones, pide
//       las voces, renderiza, revisa la calidad, sube al almacén y hace las
//       subidas pesadas (YouTube, X). Antes de las 12:00 de Bolivia no
//       reclama: retoma la tanda de anoche (ver lib/fabrica/tanda.ts).
//       --dia AAAA-MM-DD: llena los lugares de ese día de salida con su propio
//       candado («tanda:<día>»), sin tocar el de la tanda de la noche.
//
//   npx tsx scripts/fabrica/tanda.ts --seco [--carpeta <dir>] [--render-real]
//       EN SECO: base, IA, voz, render, calidad, almacén y redes de mentira.
//       Sin red y sin tocar la base. Corre la cadena entera y la cuenta.
//       --carpeta deja en disco el episodio y el audio de prueba (si no, en memoria).
//       --render-real usa el render y ffmpeg de verdad (la web en
//       FABRICA_RENDER_URL); lo demás sigue de mentira.
//
// Variables (de verdad): SUPABASE_SERVICE_ROLE_KEY, FABRICA_ANTHROPIC_KEY,
// FABRICA_MODELO_GUION, FABRICA_MODELO_REVISION, FABRICA_VOZ (elevenlabs |
// falso), FABRICA_ELEVENLABS_KEY, FABRICA_ALMACEN, FABRICA_BUCKET,
// FABRICA_ACTIVA y FABRICA_<RED>_ACTIVA (+ las de cada red: registro-redes.ts),
// FABRICA_TANDA_CARPETA (./fabrica-trabajo), FABRICA_TANDA_ESPERA_MIN (0),
// FABRICA_RENDER_URL (http://localhost:3110), FABRICA_RENDER_CALIDAD (media),
// FABRICA_LIMITE_MB, FABRICA_EXIGIR_AUDIO, FABRICA_EXIGIR_NVIDIA.
//
// Sale con 0 = terminó con los lugares del día listos (o no había nada que
// hacer: pausada, día ya hecho), 1 = se cortó, falló o quedó incompleta (hubo
// errores y algún lugar de mañana no llegó al almacén; el cómo va en el log y
// en fabrica_estado.ultima_tanda),
// 2 = argumentos o configuración que impiden empezar.
// ──────────────────────────────────────────────────────────────

import { existsSync, mkdirSync, readFileSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { hostname } from "node:os"
import { dirname, join, resolve } from "node:path"
import { almacenDesdeEnv, configDe } from "@/lib/fabrica/almacen"
import { baseTandaReal } from "@/lib/fabrica/base-tanda"
import { revisarVideo } from "@/lib/fabrica/calidad-medir"
import { pedirConAnthropic, tomasDelMotor } from "@/lib/fabrica/guionista"
import { puertoIdeasSupabase } from "@/lib/fabrica/ideas"
import { adaptadores, avisosDeConfiguracion, ctxReal } from "@/lib/fabrica/registro-redes"
import { renderConProceso, renderListo, SCRIPT_RENDER } from "@/lib/fabrica/render-proceso"
import { ejecutarTanda, resumenEnTexto, type Disco, type TandaPuertos } from "@/lib/fabrica/tanda"
import {
  almacenDeMentira,
  baseTandaEnMemoria,
  calidadDeMentira,
  ctxSinRed,
  discoEnMemoria,
  iaDeMentira,
  ideasEnMemoria,
  memoriaNueva,
  renderDeMentira,
  subidasDeMentira,
} from "@/lib/fabrica/tanda-falsos"
import { diaBolivia, sumarDias } from "@/lib/fabrica/tipos"
import { crearVozFalsa } from "@/lib/fabrica/voz/falso"
import { leerRegistro, RUTA_REGISTRO } from "@/lib/fabrica/voz/registro"
import { proveedorDesdeEnv } from "@/lib/fabrica/voz/voces"
import { getAdminClient } from "@/lib/supabase-admin"

interface Args {
  seco: boolean
  renderReal: boolean
  carpeta: string | null
  esperar: number | null
  dia: string | null
}

function args(): Args | string {
  const a = process.argv.slice(2)
  const o: Args = { seco: false, renderReal: false, carpeta: null, esperar: null, dia: null }
  for (let i = 0; i < a.length; i++) {
    const x = a[i]
    if (x === "--seco") o.seco = true
    else if (x === "--render-real") o.renderReal = true
    else if (x === "--carpeta") o.carpeta = a[++i] ?? null
    else if (x === "--esperar") {
      const n = Number(a[++i])
      if (!Number.isFinite(n) || n < 0 || n > 150) return `--esperar ${a[i]}: van minutos entre 0 y 150 (la VM se apaga a los 180)`
      o.esperar = n
    } else if (x === "--dia") {
      o.dia = a[++i] ?? null
      if (!o.dia || !/^\d{4}-\d{2}-\d{2}$/.test(o.dia)) return `--dia ${o.dia ?? ""}: va AAAA-MM-DD`
    } else return `opción desconocida: ${x}`
  }
  if (o.renderReal && !o.seco) return "--render-real es para el modo --seco (de verdad, el render siempre es el real)"
  return o
}

const log = (m: string) => console.log(`${new Date().toISOString()} ${m}`)

/** Los archivos de trabajo en disco: <carpeta>/<id>/{episodio.json, voz-n.wav, voz.json, video.mp4}. */
function discoReal(raiz: string): Disco {
  mkdirSync(raiz, { recursive: true })
  return {
    carpetaDe: (id) => join(raiz, id),
    async escribir(ruta, datos) {
      await mkdir(dirname(ruta), { recursive: true })
      await writeFile(ruta, datos)
    },
    async leer(ruta) {
      return new Uint8Array(await readFile(ruta))
    },
    async existe(ruta) {
      return existsSync(ruta)
    },
  }
}

function renderReal(env: NodeJS.ProcessEnv) {
  const script = resolve(SCRIPT_RENDER)
  const leerFuente = () => readFileSync(script, "utf8")
  return {
    render: renderConProceso({
      leerFuente,
      existe: async (r) => existsSync(r),
      url: env.FABRICA_RENDER_URL?.trim() || "http://localhost:3110",
      calidad: env.FABRICA_RENDER_CALIDAD?.trim() || "media",
      script,
      log,
    }),
    renderListo: () => renderListo({ leerFuente, script: SCRIPT_RENDER }),
  }
}

async function main(): Promise<number> {
  const o = args()
  if (typeof o === "string") {
    console.error(`${o}\nUso: npx tsx scripts/fabrica/tanda.ts [--seco [--render-real]] [--carpeta <dir>] [--esperar <min>] [--dia AAAA-MM-DD]`)
    return 2
  }
  const env = process.env
  const dueno = `tanda:${hostname()}:${process.pid}`
  const esperaEnv = Number(env.FABRICA_TANDA_ESPERA_MIN ?? "0")
  const esperaAprobacionMin = o.esperar ?? (Number.isFinite(esperaEnv) && esperaEnv >= 0 ? Math.min(150, esperaEnv) : 0)
  const tomas = await tomasDelMotor()
  const ahora = () => new Date()
  const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

  let p: TandaPuertos
  if (o.seco) {
    // En seco el día de salida es mañana, a cualquier hora: si no, antes del mediodía sería una retoma sin ideas.
    const m = memoriaNueva(ahora())
    const disco = o.carpeta || o.renderReal ? discoReal(resolve(o.carpeta ?? env.FABRICA_TANDA_CARPETA ?? "fabrica-seco")) : discoEnMemoria()
    const almacen = almacenDeMentira()
    const real = o.renderReal ? renderReal(env) : null
    const reloj = () => (m.ahora = new Date())
    p = {
      base: baseTandaEnMemoria(m),
      ideas: ideasEnMemoria(m),
      pedirIA: iaDeMentira().pedir,
      voz: { proveedor: crearVozFalsa(), como: "voz falsa (seco)", falta: [] },
      registroVoces: leerRegistro(RUTA_REGISTRO).registro,
      render: real?.render ?? renderDeMentira(disco),
      renderListo: real?.renderListo,
      calidad: o.renderReal ? (archivo, ep, renderer) => revisarVideo(archivo, ep, { env, tomas, renderer }) : calidadDeMentira(disco),
      almacen,
      adaptadores: subidasDeMentira(reloj),
      ctx: ctxSinRed(reloj, almacen, log),
      disco,
      tomas,
      ahora: reloj,
      dormir: async () => {},
      log,
      dueno,
      seco: true,
      esperaAprobacionMin: 0,
      diaSalida: o.dia ?? sumarDias(diaBolivia(ahora()), 1),
    }
  } else {
    const base = baseTandaReal()
    const db = getAdminClient()
    if (!base || !db) {
      console.error("No se puede empezar: falta SUPABASE_SERVICE_ROLE_KEY (o NEXT_PUBLIC_SUPABASE_URL). Para ensayar sin base: --seco")
      return 2
    }
    if (!env.FABRICA_ANTHROPIC_KEY?.trim()) log("[fabrica/tanda] AVISO: falta FABRICA_ANTHROPIC_KEY: los guiones no se van a escribir (las ideas quedan para otra corrida)")
    for (const a of avisosDeConfiguracion(env)) log(`[fabrica/tanda] AVISO: ${a}`)
    const reg = leerRegistro(resolve(RUTA_REGISTRO))
    for (const e of reg.errores) log(`[fabrica/tanda] voces.json: ${e}`)
    const almacenConfig = configDe(env)
    const almacen = almacenDesdeEnv(env, { log })
    const real = renderReal(env)
    p = {
      base,
      ideas: puertoIdeasSupabase(db),
      pedirIA: pedirConAnthropic(),
      voz: proveedorDesdeEnv(env, { fetch, log }),
      registroVoces: reg.registro,
      render: real.render,
      renderListo: real.renderListo,
      calidad: (archivo, ep, renderer) => revisarVideo(archivo, ep, { env, tomas, renderer }),
      almacen,
      almacenFalta: almacenConfig.ok ? undefined : almacenConfig.faltan,
      adaptadores: adaptadores(env, log),
      ctx: ctxReal(env, { almacen, log }),
      disco: discoReal(resolve(o.carpeta ?? env.FABRICA_TANDA_CARPETA ?? "fabrica-trabajo")),
      tomas,
      ahora,
      dormir,
      log,
      dueno,
      seco: false,
      esperaAprobacionMin,
      diaSalida: o.dia ?? undefined,
    }
  }

  const r = await ejecutarTanda(p)
  console.log(`\n${resumenEnTexto(r)}`)
  return r.resultado === "cortada" || r.resultado === "error" || r.resultado === "incompleta" ? 1 : 0
}

main()
  .then((codigo) => process.exit(codigo))
  .catch((e) => {
    console.error(`[fabrica/tanda] error que no se esperaba: ${(e as Error)?.stack ?? e}`)
    process.exit(1)
  })
