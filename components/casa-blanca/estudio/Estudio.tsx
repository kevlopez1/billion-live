"use client"

// ──────────────────────────────────────────────────────────────
// EL ESTUDIO — /casa-blanca/estudio
//
// Filma un episodio del calendario (episodios.ts) en horizontal, 16:9
// (1920×1080) o 4:3 (1440×1080), como una cámara que graba dentro de la
// casa. Dos modos con el mismo código (reproductor.ts):
//
// - En vivo (por defecto): se reproduce en tiempo real, con una barra de
//   controles FUERA del cuadro. "Grabar" reinicia el episodio y graba el
//   canvas de salida con MediaRecorder (mp4 si el navegador puede, si no
//   webm); al terminar, se descarga. Así Kev graba en su PC a calidad completa.
// - ?render=1: sin requestAnimationFrame. Expone window.__estudio para que
//   scripts/casa-blanca-render.mjs pida cada cuadro y lo pase a ffmpeg.
// ──────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { PERSONAJES } from "../datos/personajes"
import { LUGAR } from "../lugares"
import { TOMAS_CINE } from "../escena/motor"
import type { Calidad } from "../tipos"
import type { Recursos } from "./compositor"
import { CALENDARIO } from "./episodios"
import { guionValido, type Episodio, type Formato, type Visor } from "./guion"
import { armarLinea, avisosDelEpisodio } from "./linea"
import { MUESTRA } from "./muestra"
import { TAMANO, crearEstudio, type Estudio as Motor } from "./reproductor"

interface InfoListo {
  ancho: number
  alto: number
  fps: number
  cuadros: number
  duracion: number
  ep: string
  formato: Formato
  avisos: string[]
  /** Cambia en cada montaje: si el script ve otra, la página se recargó a mitad del render. */
  sesion: string
}

interface ApiEstudio {
  listo: Promise<InfoListo>
  cuadro(i: number): Promise<void>
  salida: HTMLCanvasElement
}

declare global {
  interface Window {
    __estudio?: ApiEstudio
  }
}

const EPISODIOS: Episodio[] = [...CALENDARIO.map((e) => e.episodio), MUESTRA]

function buscarEpisodio(id: string | null): Episodio | null {
  if (!id) return CALENDARIO[0]?.episodio ?? MUESTRA
  return EPISODIOS.find((e) => e.id === id) ?? null
}

interface Params {
  ep: string | null
  formato: Formato | null
  visor: Visor | null
  calidad: Calidad
  render: boolean
  /** ?atajo=1 (solo vista previa): saltar cuadros sin dibujarlos. */
  atajo: boolean
}

function leerParams(): Params {
  const q = new URLSearchParams(window.location.search)
  const f = q.get("formato")?.replace(" ", "+")
  const formato: Formato | null = f === "16:9" || f === "16x9" ? "16:9" : f === "4:3" || f === "4x3" ? "4:3" : null
  const v = q.get("visor")
  const c = q.get("calidad")
  return {
    ep: q.get("ep"),
    formato,
    visor: v === "cine" || v === "camara" ? v : null,
    calidad: c === "baja" || c === "media" || c === "alta" ? c : "alta",
    render: q.get("render") === "1",
    atajo: q.get("atajo") === "1",
  }
}

/** La salida mide exactamente W×H: un píxel CSS = un píxel de video. */
function fijarPixelRatio() {
  try {
    Object.defineProperty(window, "devicePixelRatio", { get: () => 1, configurable: true })
  } catch {
    // Si el navegador no deja, el motor renderiza a más resolución y el compositor la reduce.
  }
}

async function cargarRecursos(raiz: HTMLElement): Promise<Recursos> {
  const css = getComputedStyle(raiz)
  const cond = css.getPropertyValue("--font-condensada").trim() || "'Barlow Condensed'"
  const manrope = css.getPropertyValue("--font-manrope").trim() || "Manrope"
  const cargas: Promise<unknown>[] = []
  for (const w of ["600", "700", "800"]) {
    cargas.push(document.fonts.load(`${w} 40px ${cond}`), document.fonts.load(`${w} 40px ${manrope}`))
  }
  const logo = new Image()
  logo.src = "/logos/prime-wordmark.png"
  cargas.push(logo.decode().catch(() => console.warn("[estudio] no cargó el logo de PRIME")))
  await Promise.all(cargas.map((p) => p.catch(() => null)))
  await document.fonts.ready
  return {
    fuentes: { cond: `${cond}, system-ui, sans-serif`, texto: `${manrope}, system-ui, sans-serif` },
    logoPrime: logo.naturalWidth ? logo : null,
  }
}

/** 75,4 → "1:15". */
const reloj = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms))

function tipoDeVideo(): { mime: string; ext: "mp4" | "webm" } {
  const opciones: Array<[string, "mp4" | "webm"]> = [
    ["video/mp4;codecs=avc1.640028", "mp4"],
    ["video/mp4;codecs=avc1", "mp4"],
    ["video/mp4", "mp4"],
    ["video/webm;codecs=vp9", "webm"],
    ["video/webm;codecs=vp8", "webm"],
    ["video/webm", "webm"],
  ]
  for (const [mime, ext] of opciones) if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime)) return { mime, ext }
  return { mime: "", ext: "webm" }
}

type Fase = "cargando" | "listo" | "reproduce" | "termino" | "error"

export default function Estudio() {
  const params = useMemo(() => (typeof window === "undefined" ? null : leerParams()), [])
  const [epId, setEpId] = useState<string | null>(params?.ep ?? null)
  const ep = useMemo(() => buscarEpisodio(epId), [epId])
  const [formato, setFormato] = useState<Formato | null>(params?.formato ?? null)
  const [visor, setVisor] = useState<Visor | null>(params?.visor ?? null)
  const [clave, setClave] = useState(0)
  const [fase, setFase] = useState<Fase>("cargando")
  const [error, setError] = useState<string | null>(null)
  const [avisos, setAvisos] = useState<string[]>([])
  const [tiempo, setTiempo] = useState(0)
  const [grabando, setGrabando] = useState(false)
  const render = !!params?.render
  const calidad = params?.calidad ?? "alta"
  const fmt: Formato = formato ?? ep?.formato ?? "16:9"

  const raizRef = useRef<HTMLDivElement>(null)
  const ocultoRef = useRef<HTMLDivElement>(null)
  const salidaRef = useRef<HTMLCanvasElement>(null)
  const motorRef = useRef<Motor | null>(null)
  const grabarAlListo = useRef(false)
  const visorRef = useRef(visor)
  visorRef.current = visor

  // La URL refleja lo elegido (para compartir el enlace exacto).
  useEffect(() => {
    if (render) return
    const q = new URLSearchParams(window.location.search)
    if (ep) q.set("ep", ep.id)
    if (formato) q.set("formato", formato)
    else q.delete("formato")
    if (visor) q.set("visor", visor)
    else q.delete("visor")
    window.history.replaceState(null, "", `${window.location.pathname}?${q.toString()}`)
  }, [ep, formato, visor, render])

  // Arma el estudio: escena, simulación y compositor (de nuevo en cada reinicio: mismo inicio = mismo video).
  useEffect(() => {
    const salida = salidaRef.current
    const oculto = ocultoRef.current
    const raiz = raizRef.current
    if (!salida || !oculto || !raiz) return
    let vivo = true
    let raf = 0
    let grabador: MediaRecorder | null = null
    let resolver: (i: InfoListo) => void = () => {}
    let rechazar: (e: Error) => void = () => {}
    const listo = new Promise<InfoListo>((a, b) => {
      resolver = a
      rechazar = b
    })
    listo.catch(() => {})
    if (render) {
      window.__estudio = {
        listo,
        salida,
        cuadro: async (i: number) => {
          const m = motorRef.current
          if (!m) throw new Error("el estudio todavía no está listo")
          m.cuadro(i)
        },
      }
    }
    setFase("cargando")
    setError(null)

    const fallar = (msg: string) => {
      if (!vivo) return
      setError(msg)
      setFase("error")
      rechazar(new Error(msg))
    }

    ;(async () => {
      if (!ep) return fallar(`No existe el episodio "${epId}". Hay: ${EPISODIOS.map((e) => e.id).join(", ")}.`)
      const errores = guionValido(ep, {
        personajes: new Set(PERSONAJES.map((p) => p.id)),
        lugares: new Set(Object.keys(LUGAR)),
        tomas: new Set(TOMAS_CINE.map((t) => t.id)),
      })
      if (errores.length) return fallar(`El guion de "${ep.id}" tiene errores:\n· ${errores.join("\n· ")}`)
      const av = avisosDelEpisodio(ep, TOMAS_CINE)
      setAvisos(av)
      fijarPixelRatio()
      const recursos = await cargarRecursos(raiz)
      if (!vivo) return
      let motor: Motor
      try {
        motor = crearEstudio(oculto, salida, { ep, formato: fmt, visor: visorRef.current, calidad, recursos, atajo: !!params?.atajo })
      } catch (e) {
        console.error("[estudio] no se pudo crear:", e)
        return fallar(`No se pudo crear la escena: ${e instanceof Error ? e.message : String(e)}`)
      }
      motorRef.current = motor
      // Que el ResizeObserver del motor mida el canvas ANTES del primer cuadro (no en medio del video).
      await espera(120)
      // En vivo se ve el primer cuadro enseguida; en render=1 lo pide el script.
      if (!render) motor.cuadro(0)
      if (!vivo) return
      const info: InfoListo = { ancho: motor.ancho, alto: motor.alto, fps: motor.fps, cuadros: motor.cuadros, duracion: motor.linea.duracion, ep: ep.id, formato: fmt, avisos: av, sesion: `${Date.now().toString(36)}-${clave}` }
      resolver(info)
      setFase("listo")
      if (render) return

      // En vivo: tiempo real, con su propio rAF.
      const grabar = grabarAlListo.current
      grabarAlListo.current = false
      if (grabar) {
        const { mime, ext } = tipoDeVideo()
        const flujo = salida.captureStream(motor.fps)
        const partes: Blob[] = []
        grabador = new MediaRecorder(flujo, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 16_000_000 })
        grabador.ondataavailable = (e) => e.data.size && partes.push(e.data)
        grabador.onstop = () => {
          const blob = new Blob(partes, { type: mime || "video/webm" })
          const a = document.createElement("a")
          a.href = URL.createObjectURL(blob)
          a.download = `${ep.id}-${fmt.replace(":", "x")}.${ext}`
          document.body.appendChild(a)
          a.click()
          a.remove()
          setTimeout(() => URL.revokeObjectURL(a.href), 60_000)
          if (vivo) setGrabando(false)
        }
        grabador.start(1000)
      }
      const t0 = performance.now() - 1000 / motor.fps
      let ultimoEstado = 0
      setFase("reproduce")
      const bucle = (ahora: number) => {
        if (!vivo) return
        const t = (ahora - t0) / 1000
        const i = Math.min(motor.cuadros - 1, Math.floor(t * motor.fps))
        try {
          motor.vivo(i)
        } catch (e) {
          console.error("[estudio] falló un cuadro:", e)
        }
        if (ahora - ultimoEstado > 200) {
          ultimoEstado = ahora
          setTiempo(i / motor.fps)
        }
        if (i >= motor.cuadros - 1) {
          setTiempo(motor.linea.duracion)
          setFase("termino")
          if (grabador && grabador.state !== "inactive") grabador.stop()
          return
        }
        raf = requestAnimationFrame(bucle)
      }
      raf = requestAnimationFrame(bucle)
    })().catch((e) => fallar(e instanceof Error ? e.message : String(e)))

    return () => {
      vivo = false
      cancelAnimationFrame(raf)
      if (grabador && grabador.state !== "inactive") {
        grabador.onstop = null
        grabador.stop()
      }
      motorRef.current?.destruir()
      motorRef.current = null
      if (render && window.__estudio?.listo === listo) delete window.__estudio
    }
    // visor se aplica en caliente (abajo); el resto reinicia el estudio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ep, fmt, calidad, clave, render])

  useEffect(() => {
    motorRef.current?.setVisor(visor)
  }, [visor])

  const reiniciar = useCallback(() => setClave((c) => c + 1), [])
  const grabar = useCallback(() => {
    grabarAlListo.current = true
    setGrabando(true)
    setClave((c) => c + 1)
  }, [])

  const { ancho, alto } = TAMANO[fmt]
  const duracion = useMemo(() => (ep ? armarLinea(ep).duracion : 0), [ep])
  const fps = ep?.fps ?? 30

  return (
    <div ref={raizRef} className="flex h-full w-full flex-col bg-black text-white" style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif" }}>
      {/* La escena 3D renderiza aquí, fuera de la vista, al tamaño exacto de salida. */}
      <div ref={ocultoRef} aria-hidden="true" className="pointer-events-none fixed left-0 top-0 h-0 w-0 overflow-hidden" />
      <div className="relative grid min-h-0 flex-1 place-items-center">
        <canvas
          ref={salidaRef}
          width={ancho}
          height={alto}
          className="absolute inset-0 block h-full w-full object-contain"
          role="img"
          aria-label={ep ? `${ep.titulo}, en ${fmt}` : "Estudio"}
        />
        {fase === "cargando" && <p className="absolute text-[12px] font-semibold uppercase tracking-[0.4em] text-white/45">Preparando la escena…</p>}
        {fase === "error" && error && <pre className="absolute max-w-[min(720px,92vw)] whitespace-pre-wrap rounded-xl bg-red-950/80 p-4 text-[13px] text-red-100">{error}</pre>}
      </div>
      {!render && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-white/10 px-4 py-3 text-[13px]">
          <button type="button" onClick={reiniciar} disabled={grabando} className="rounded-lg bg-white px-3 py-1.5 font-bold text-black disabled:opacity-40">
            {fase === "reproduce" ? "Reiniciar" : "Reproducir"}
          </button>
          <Grupo
            valor={fmt}
            opciones={[
              ["16:9", "16:9"],
              ["4:3", "4:3"],
            ]}
            alElegir={(v) => setFormato(v as Formato)}
            bloqueado={grabando}
          />
          <Grupo
            valor={visor ?? (ep?.visor || "cine")}
            opciones={[
              ["cine", "Cine"],
              ["camara", "Cámara"],
            ]}
            alElegir={(v) => setVisor(v as Visor)}
            bloqueado={grabando}
          />
          {EPISODIOS.length > 1 && (
            <select
              value={ep?.id ?? ""}
              onChange={(e) => setEpId(e.target.value)}
              disabled={grabando}
              className="rounded-lg border border-white/15 bg-black px-2 py-1.5 text-[16px] md:text-[13px]"
              aria-label="Episodio"
            >
              {EPISODIOS.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.titulo}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={grabar}
            disabled={grabando || fase === "cargando" || fase === "error"}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 font-bold text-white disabled:opacity-50"
          >
            <span className={`h-2.5 w-2.5 rounded-full bg-white ${grabando ? "animate-pulse" : ""}`} />
            {grabando ? "Grabando…" : "Grabar"}
          </button>
          <span className="ml-auto tabular-nums text-white/60">
            {reloj(tiempo)} / {reloj(duracion)} · {ancho}×{alto} · {fps} fps
          </span>
          {avisos.length > 0 && (
            <details className="basis-full text-[12px] text-amber-200/80">
              <summary className="cursor-pointer">{avisos.length === 1 ? "1 aviso" : `${avisos.length} avisos`} del guion</summary>
              <ul className="mt-1 list-disc pl-5">
                {avisos.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

function Grupo({ valor, opciones, alElegir, bloqueado }: { valor: string; opciones: Array<[string, string]>; alElegir: (v: string) => void; bloqueado: boolean }) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-white/15">
      {opciones.map(([v, nombre]) => (
        <button
          key={v}
          type="button"
          onClick={() => alElegir(v)}
          disabled={bloqueado}
          aria-pressed={valor === v}
          className={`px-3 py-1.5 font-semibold disabled:opacity-40 ${valor === v ? "bg-white/90 text-black" : "text-white/75 hover:bg-white/10"}`}
        >
          {nombre}
        </button>
      ))}
    </div>
  )
}
