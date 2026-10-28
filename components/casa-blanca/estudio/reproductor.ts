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
// Cortes: cada plano empieza con un corte seco. Las tomas del motor entran con
// un fundido a negro (≈0,6 s) y los lugares, con un viaje de cámara: esos
// tramos se corren ANTES de mostrar el plano ("preparación"), con la
// simulación quieta, y no salen en el video.
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
  opacidad,
  pulsoDeMano,
  rotuloDeCamara,
  textoFinal,
  visorDe,
  type LineaTiempo,
} from "./linea"

export const TAMANO: Record<Formato, { ancho: number; alto: number }> = {
  "16:9": { ancho: 1920, alto: 1080 },
  "4:3": { ancho: 1440, alto: 1080 },
}

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
  /**
   * Vista previa: al saltar cuadros, la escena no los dibuja (la simulación sí
   * avanza). Llega en segundos a cualquier punto, pero el cuadro no es idéntico
   * al del video entero. Nunca para el video final.
   */
  atajo?: boolean
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
  const { ancho: W, alto: H } = TAMANO[op.formato]
  const linea = armarLinea(ep)
  const fps = linea.fps
  let visorForzado = op.visor

  salida.width = W
  salida.height = H
  const ctx = salida.getContext("2d", { alpha: false })
  if (!ctx) throw new Error("el navegador no da un contexto 2D para el canvas de salida")

  // El canvas de la escena mide exactamente la salida (en CSS y en píxeles: devicePixelRatio = 1 lo fija Estudio.tsx).
  const lienzo = document.createElement("canvas")
  lienzo.style.width = `${W}px`
  lienzo.style.height = `${H}px`
  lienzo.style.display = "block"
  contenedor.appendChild(lienzo)
  const escena: EscenaMotor = crearEscena(lienzo, { personajes: PERSONAJES, calidad: op.calidad })
  escena.redimensionar()

  const primera = ep.planos[0]?.hora
  const sim = new Simulacion(PERSONAJES, ESPECIALES, {
    dia: 1,
    minutos: primera ? minutosDe(primera) : 17 * 60 + 30,
    semilla: SEMILLA_ESTUDIO,
  })

  const nombresToma = new Map(escena.tomas().map((t) => [t.id, t.nombre]))
  const numeros = numerosDeCamara(ep)
  let plano = -1
  let actual = -1
  let camaraTexto = ""
  let dtTapado = 0

  const pasarAEscena = () => {
    escena.setHora(sim.reloj.minutos / 60)
    const lista: Parameters<EscenaMotor["actualizarPersonajes"]>[0] = []
    for (const id of IDS) {
      const e = sim.pj[id]
      if (e) lista.push({ id, pos: e.pos, rumbo: e.rumbo, estado: e.estado, visible: e.visible, velocidad: e.velocidad })
    }
    escena.actualizarPersonajes(lista)
  }

  const dondeEsta = (id: string) => sim.pj[id]?.lugarId ?? sim.pj[id]?.destinoId ?? null

  /** El corte: hora, quiénes están, maqueta y cámara; después, la preparación fuera de cuadro. */
  const prepararPlano = (i: number) => {
    // Lo que quedó sin dibujar del plano anterior no pasa al nuevo (hay un corte).
    dtTapado = 0
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

    escena.modoMaqueta(false)
    const pasos: number[] = []
    if (c.tipo === "toma") {
      // Como aplicarToma de la página viva: primero a quién, después la toma.
      if (c.personaje) escena.modoCamara("seguir", c.personaje)
      escena.modoCamara("cine", c.toma)
      pasos.push(0.25, 0.4) // sale el fundido (y arranca la toma) · entra
    } else if (c.tipo === "seguir") {
      escena.modoCamara("seguir", c.personaje)
      pasos.push(0.25, 0.4) // si está en otro nivel, la cámara baja con un fundido
    } else {
      const e = encuadreDe(c.lugar)
      if (e) {
        const otroNivel = e.nivel !== escena.nivel()
        if (escena.encuadrar) escena.encuadrar(e.centro, e.distancia, c.lugar)
        else escena.enfocar(e.centro, e.distancia)
        // Un viaje por el ascensor dura hasta 3,9 s; el encuadre en el mismo nivel, 1,1 s.
        pasos.push(otroNivel ? 4.2 : 1.2)
      }
    }
    for (const dt of pasos) escena.depurar.cuadro(dt)
    if (p.maqueta !== undefined) {
      escena.modoMaqueta(p.maqueta)
      // El tilt-shift entra suave (5/s): se deja entrar fuera de cuadro.
      if (p.maqueta) escena.depurar.cuadro(0.9)
    }
    plano = i
  }

  /** Llega al segundo del cuadro i avanzando `dt` (simulación y escena). */
  const avanzar = (i: number, dt: number) => {
    const t = i / fps
    const m = momentoEn(linea, t)
    if (m.tramo.indice !== plano) prepararPlano(m.tramo.indice)
    sim.avanzar(dt, t * 1000)
    pasarAEscena()
    // En la apertura la escena está tapada del todo hasta 0,4 s antes del final:
    // no se dibuja (por software cuesta segundos por cuadro); su tiempo se suma al
    // primer cuadro que sí se ve. Siempre igual, así que el video sigue siendo repetible.
    if ((m.fase === "apertura" && t <= linea.apertura - 0.4) || saltando) dtTapado += dt
    else {
      // En el atajo, un salto largo se recorta: la toma no llega a su final (que la reiniciaría con un fundido).
      escena.depurar.cuadro(dt + (op.atajo ? Math.min(dtTapado, 2) : dtTapado))
      dtTapado = 0
    }
    actual = i
    return m
  }
  let saltando = false

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
      // Negro con el nombre; la escena aparece en los últimos 0,4 s.
      const a = linea.apertura
      capas.velo = Math.min(1, Math.max(0, (a - t) / 0.4))
      capas.apertura = { alfa: opacidad(t, 0, a - 0.05, 0.3), subtitulo: ep.titulo }
      return capas
    }
    if (fase === "cierre") {
      const tc = t - (linea.duracion - linea.cierre)
      capas.velo = Math.min(0.9, (tc / 0.5) * 0.9)
      capas.cierre = { alfa: Math.min(1, Math.max(0, (tc - 0.2) / 0.4)), negro: Math.max(0, (tc - (linea.cierre - 0.35)) / 0.35) }
      return capas
    }
    if (p.titulo) capas.titulo = { texto: textoFinal(p.titulo), alfa: opacidad(local, 0.1, p.dur - 0.1, 0.3) }
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
      // Cuadros salteados: se recorren igual, de a 1/fps, para que el resultado sea idéntico.
      saltando = !!op.atajo
      for (let k = actual + 1; k < i; k++) avanzar(k, 1 / fps)
      saltando = false
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
