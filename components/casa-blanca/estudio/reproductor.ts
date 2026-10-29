// ──────────────────────────────────────────────────────────────
// EL REPRODUCTOR DEL ESTUDIO: filma un Episodio con la escena 3D y la
// simulación de la web, cuadro por cuadro.
//
// El estudio es dueño del reloj: nunca llama a escena.iniciar() (el bucle
// propio del motor). Cada paso avanza la simulación y la escena exactamente
// `dt` segundos de video y compone el cuadro en el canvas de salida. Así:
// - render=1 (headless): un cuadro por llamada, 1/fps cada uno, sin rAF:
//   mismo episodio = mismos cuadros.
// - en vivo: el mismo paso, con el dt que pasó de verdad.
//
// Cortes: cada plano empieza con un corte seco. El motor lo hace en el acto
// (opción `corte`: nivel y pose sin fundido ni viaje), y una toma fija más
// corta que su plano se queda en su última pose (`sostener`). Los cuadros que
// no se ven (la apertura tapada, los anteriores a --desde) avanzan con
// depurar.avanzar: todo igual, sin dibujar.
// ──────────────────────────────────────────────────────────────

import { crearEscena, type EscenaMotor } from "../escena/motor"
import { Simulacion } from "../motor/simulacion"
import { ESPECIALES, PERSONAJES } from "../datos/personajes"
import { LUGAR } from "../lugares"
import { encuadreDe } from "../navegacion"
import type { Calidad, Personaje } from "../tipos"
import { componer, type Capas, type Recursos } from "./compositor"
import type { Episodio, Formato, Plano, Visor } from "./guion"
import {
  armarLinea,
  codigoDeTiempo,
  lineaActiva,
  lugarDelPlano,
  minutosDe,
  momentoEn,
  nombreDeCamara,
  numerosDeCamara,
  ocultosDelVideo,
  opacidad,
  pulsoDeMano,
  rotuloDeCamara,
  tamanoDeSalida,
  textoFinal as textoDelGuion,
  ESTRENO_SIN_CALENDARIO,
  instanteDelEstreno,
  type Estreno,
  visorDe,
  type LineaTiempo,
} from "./linea"

/** Misma semilla = misma historia (la simulación no usa otro azar). */
export const SEMILLA_ESTUDIO = 20261028

const PJ: Record<string, Personaje> = Object.fromEntries(PERSONAJES.map((p) => [p.id, p]))
const IDS = PERSONAJES.map((p) => p.id)

export interface OpcionesEstudio {
  ep: Episodio
  formato: Formato
  /** Visor forzado para todo el episodio (null = el del guion). */
  visor: Visor | null
  calidad: Calidad
  recursos: Recursos
  /** Alto de salida en píxeles (vista previa: 720). Sin él, 1080. El ancho sale del formato. */
  alto?: number
  /** Cuadros por segundo (vista previa: 24). Sin él, los del guion (30). */
  fps?: number
  /**
   * Cuándo sale el video (su entrada del CALENDARIO). La escena muestra ese día
   * (el "DÍA N DEL RETO" de la Sala de Control) y {DIAS_AL_RECORD} cuenta desde
   * él. Sin él, ESTRENO_SIN_CALENDARIO: nunca el reloj de la máquina.
   */
  estreno?: Estreno
}

export interface Estudio {
  ancho: number
  alto: number
  fps: number
  cuadros: number
  linea: LineaTiempo
  /** Avanza hasta el cuadro i (desde el último dibujado) y lo compone. Cuadros seguidos = pasos de 1/fps. */
  cuadro(i: number): void
  /**
   * En vivo: salta al cuadro i en UN paso (dt = lo que pasó de verdad, hasta
   * 0,25 s). Si la máquina no llega a 30 fps, el video no se frena: salta.
   */
  vivo(i: number): void
  /** Último cuadro compuesto (-1 = ninguno). */
  actual(): number
  setVisor(v: Visor | null): void
  destruir(): void
}

/** Lo que hace falta para que el estudio arranque (y que el canvas de la escena mida W×H). */
export function crearEstudio(contenedor: HTMLElement, salida: HTMLCanvasElement, op: OpcionesEstudio): Estudio {
  const { ep, recursos } = op
  const estreno = op.estreno ?? ESTRENO_SIN_CALENDARIO
  const ahora = instanteDelEstreno(estreno)
  if (!Number.isFinite(ahora)) throw new Error(`fecha de estreno inválida: ${estreno.fecha} ${estreno.hora}`)
  const textoFinal = (t: string) => textoDelGuion(t, estreno.fecha)
  const { ancho: W, alto: H } = tamanoDeSalida(op.formato, op.alto)
  const linea = armarLinea(ep, op.fps ?? ep.fps)
  const fps = linea.fps
  let visorForzado = op.visor

  salida.width = W
  salida.height = H
  const ctx = salida.getContext("2d", { alpha: false })
  if (!ctx) throw new Error("el navegador no da un contexto 2D para el canvas de salida")

  // El canvas de la escena mide exactamente la salida, en CSS y en píxeles (pixelRatio 1).
  const lienzo = document.createElement("canvas")
  lienzo.style.width = `${W}px`
  lienzo.style.height = `${H}px`
  lienzo.style.display = "block"
  contenedor.appendChild(lienzo)
  const escena: EscenaMotor = crearEscena(lienzo, { personajes: PERSONAJES, calidad: op.calidad, pixelRatio: 1, letreros: false, ahora })
  escena.redimensionar()

  const primera = ep.planos[0]?.hora
  const sim = new Simulacion(PERSONAJES, ESPECIALES, {
    dia: 1,
    minutos: primera ? minutosDe(primera) : 17 * 60 + 30,
    semilla: SEMILLA_ESTUDIO,
  })

  // Una persona real que el guion no pone no sale de fondo (linea.ts, ocultosDelVideo).
  const ocultos = ocultosDelVideo(ep, PERSONAJES)
  const nombresToma = new Map(escena.tomas().map((t) => [t.id, t.nombre]))
  const numeros = numerosDeCamara(ep)
  let plano = -1
  let actual = -1
  let camaraTexto = ""

  const pasarAEscena = () => {
    escena.setHora(sim.reloj.minutos / 60)
    const lista: Parameters<EscenaMotor["actualizarPersonajes"]>[0] = []
    for (const id of IDS) {
      const e = sim.pj[id]
      if (e) lista.push({ id, pos: e.pos, rumbo: e.rumbo, estado: e.estado, visible: e.visible && !ocultos.has(id), velocidad: e.velocidad, planta: e.planta })
    }
    escena.actualizarPersonajes(lista)
  }

  const dondeEsta = (id: string) => sim.pj[id]?.lugarId ?? sim.pj[id]?.destinoId ?? null

  /** El corte seco: hora, quiénes están, maqueta y cámara, todo en el acto. */
  const prepararPlano = (i: number) => {
    const p: Plano = ep.planos[i]
    const c = p.camara
    if (p.hora) sim.saltarA(minutosDe(p.hora))
    const lugar = lugarDelPlano(c, dondeEsta)
    if (p.reunir?.length && lugar && LUGAR[lugar]) sim.reunirYa(lugar, p.reunir, p.titulo ? textoFinal(p.titulo) : undefined)
    pasarAEscena()
    camaraTexto = rotuloDeCamara(
      numeros[i],
      nombreDeCamara(c, lugar, { toma: (id) => nombresToma.get(id), personaje: (id) => PJ[id]?.corto }),
    )

    const corte = { corte: true }
    escena.modoMaqueta(false, corte)
    if (c.tipo === "toma") {
      // Como aplicarToma de la página viva: primero a quién, después la toma.
      if (c.personaje) escena.modoCamara("seguir", c.personaje, corte)
      escena.modoCamara("cine", c.toma, { corte: true, sostener: true })
    } else if (c.tipo === "seguir") {
      // techos: bajo la Columnata, la cámara mira entre las columnas (no el techo).
      // choques: en una sala cerrada, la cámara no queda detrás de una pared.
      escena.modoCamara("seguir", c.personaje, { corte: true, techos: true, choques: true })
    } else {
      const e = encuadreDe(c.lugar)
      if (e) escena.encuadrar(e.centro, e.distancia, c.lugar, corte)
    }
    if (p.maqueta !== undefined) escena.modoMaqueta(p.maqueta, corte)
    plano = i
  }

  /** Llega al segundo del cuadro i avanzando `dt` (simulación y escena). */
  const avanzar = (i: number, dt: number, dibujar = true) => {
    const t = i / fps
    const m = momentoEn(linea, t)
    if (m.tramo.indice !== plano) prepararPlano(m.tramo.indice)
    sim.avanzar(dt, t * 1000)
    pasarAEscena()
    // Lo que no se ve (la apertura tapada del todo hasta 0,4 s antes del final, y
    // los cuadros salteados) avanza igual pero sin dibujar: por software dibujar
    // cuesta segundos por cuadro, y el estado queda idéntico al del video entero.
    if (dibujar && !(m.fase === "apertura" && t <= linea.apertura - 0.4)) escena.depurar.cuadro(dt)
    else escena.depurar.avanzar(dt)
    actual = i
    return m
  }

  /** Un paso completo: avanza y compone el cuadro en la salida. */
  const paso = (i: number, dt: number) => {
    const m = avanzar(i, dt)
    ctx.save()
    componer(ctx, lienzo, capasDe(m.fase, m.tramo.indice, m.local, m.t), recursos)
    ctx.restore()
  }

  const capasDe = (fase: "apertura" | "plano" | "cierre", i: number, local: number, t: number): Capas => {
    const p = ep.planos[i]
    const visor = visorDe(ep, p, visorForzado)
    const pulso = visor === "camara" ? pulsoDeMano(t, H) : null
    const capas: Capas = {
      t,
      fps,
      visor,
      velo: 0,
      pulso,
      titulo: null,
      rotulo: null,
      dialogo: null,
      camara: visor === "camara" ? camaraTexto : null,
      codigo: visor === "camara" ? codigoDeTiempo(t, fps) : null,
      apertura: null,
      cierre: null,
      ficcion: fase === "plano",
    }
    if (fase === "apertura") {
      // El logo desde el cuadro 0 (la miniatura del video es la marca); en los
      // últimos 0,4 s se va y aparece la escena.
      const a = linea.apertura
      capas.velo = Math.min(1, Math.max(0, (a - t) / 0.4))
      capas.apertura = { alfa: Math.min(1, Math.max(0, (a - 0.05 - t) / 0.35)), subtitulo: ep.titulo, avance: Math.min(1, t / a) }
      return capas
    }
    if (fase === "cierre") {
      const tc = t - (linea.duracion - linea.cierre)
      capas.velo = Math.min(0.9, (tc / 0.5) * 0.9)
      capas.cierre = { alfa: Math.min(1, Math.max(0, (tc - 0.2) / 0.4)), negro: Math.max(0, (tc - (linea.cierre - 0.35)) / 0.35) }
      return capas
    }
    // Siguiendo a alguien, el seguido está al centro del cuadro: el título va arriba (salvo que el guion diga otra cosa).
    const arriba = p.tituloEn ? p.tituloEn === "arriba" : p.camara.tipo === "seguir"
    if (p.titulo) capas.titulo = { texto: textoFinal(p.titulo), alfa: opacidad(local, 0.1, p.dur - 0.1, 0.3), arriba }
    if (p.rotulo) capas.rotulo = { texto: textoFinal(p.rotulo), alfa: opacidad(local, 0.25, p.dur - 0.1, 0.3) }
    const l = lineaActiva(p, local)
    if (l) {
      const quien = PJ[l.linea.quien]
      const s = escena.pantallaDe(l.linea.quien)
      let cabeza: { x: number; y: number } | null = s && s.visible ? { x: s.x, y: s.y } : null
      if (cabeza && pulso) {
        // La burbuja se mueve con la imagen: mismo temblor que la escena.
        const dx = cabeza.x - W / 2
        const dy = cabeza.y - H / 2
        const cs = Math.cos(pulso.giro)
        const sn = Math.sin(pulso.giro)
        cabeza = {
          x: W / 2 + pulso.dx + (dx * cs - dy * sn) * pulso.escala,
          y: H / 2 + pulso.dy + (dx * sn + dy * cs) * pulso.escala,
        }
      }
      capas.dialogo = {
        nombre: quien?.corto ?? l.linea.quien,
        color: quien?.color ?? "#ffffff",
        texto: textoFinal(l.linea.texto),
        cita: !!l.linea.cita,
        alfa: opacidad(local, l.desde, l.hasta, 0.12),
        cabeza,
      }
    }
    return capas
  }

  // Los shaders se compilan aquí (dt 0: no mueve nada).
  escena.depurar.cuadro(0)

  return {
    ancho: W,
    alto: H,
    fps,
    cuadros: linea.cuadros,
    linea,
    cuadro(i: number) {
      if (!Number.isInteger(i) || i < 0 || i >= linea.cuadros) throw new Error(`cuadro ${i} fuera de 0…${linea.cuadros - 1}`)
      if (i <= actual) throw new Error(`el cuadro ${i} ya pasó (el último fue ${actual}): el estudio solo avanza`)
      // Cuadros salteados: se recorren igual, de a 1/fps y sin dibujar, para que el resultado sea idéntico.
      for (let k = actual + 1; k < i; k++) avanzar(k, 1 / fps, false)
      paso(i, 1 / fps)
    },
    vivo(i: number) {
      if (i <= actual || i >= linea.cuadros) return
      paso(i, Math.min(0.25, (i - Math.max(0, actual)) / fps))
    },
    actual: () => actual,
    setVisor(v) {
      visorForzado = v
    },
    destruir() {
      escena.destruir()
      lienzo.remove()
    },
  }
}
