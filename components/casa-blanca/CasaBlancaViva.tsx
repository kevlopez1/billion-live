"use client"

// ──────────────────────────────────────────────────────────────
// LA CASA BLANCA PROJECT — la página viva.
//
// Une las tres piezas: la escena 3D (escena/motor), la simulación
// (motor/simulacion) y el HUD (ui/). El bucle es simple: en cada cuadro la
// simulación avanza y la escena recibe la hora y dónde está cada uno. Lo que
// cambia sesenta veces por segundo (etiquetas, burbujas, radar) no pasa por
// React; el resto sí.
//
// Todo lo que se muestra de un personaje, un departamento o un objetivo sale
// de datos/: aquí no hay nada escrito a mano de nadie en particular.
// ──────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { leerClave } from "@/lib/clave"
import { CHALLENGE_TARGET, RECAUDADO } from "@/lib/contador"
import type { Escena, ModoCamara, Toque } from "./escena/contrato"
import { crearEscena } from "./escena/motor"
import { Simulacion, type EventoSim } from "./motor/simulacion"
import { ESPECIALES, PERSONAJES } from "./datos/personajes"
import { DEPARTAMENTOS, OBJETIVOS, agentesDe, progresoObjetivo } from "./datos/empresa"
import { LUGAR } from "./lugares"
import { NOMBRE_EDIFICIO, PLANTA, cuartoDeLugar, plantaDeLugar, type PlantaId } from "./plantas"
import { dondeEsta, encuadreDe } from "./navegacion"
import type { Departamento, Entregable, EstadoPuesto, NivelId, Objetivo, Personaje } from "./tipos"
import { leerEstado, motivoSinIa, pedir, type EstadoServidor } from "./ui/api"
import { Hoja } from "./ui/base"
import { ConvocarConsejo, TranscripcionConsejo, type SesionConsejo } from "./ui/Consejo"
import { Estilos } from "./ui/Estilos"
import { crearEtiquetaPuesto, crearEtiquetas, type DatoEtiqueta } from "./ui/etiquetas"
import { Ficha, type MensajeChat } from "./ui/Ficha"
import { recortar, relojTexto } from "./ui/formato"
import { ControlesGrabacion, MarcaGrabacion, TOMAS, type Toma } from "./ui/Grabacion"
import { detectarTema } from "./ui/guion"
import { AVISO_FICCION, Dinero, Dock, Marca, Notificacion, Subtitulos, type Subtitulo } from "./ui/Hud"
import { Intro } from "./ui/Intro"
import { useCompacto, useLatido } from "./ui/latido"
import { DarNoticia } from "./ui/Noticia"
import { ColumnaObjetivos, ListaEnMarcha, ListaObjetivos, type EnMarcha } from "./ui/Objetivos"
import { PanelDepartamento, type ResultadoTrabajo } from "./ui/PanelDepartamento"
import { PanelLugar } from "./ui/PanelLugar"
import { BarraPlanta } from "./ui/Plantas"
import { Mapa } from "./ui/Mapa"
import { Radar, type DatosRadar } from "./ui/Radar"
import { Selector } from "./ui/Selector"

// ── Índices de los datos (una vez por carga) ──────────────────
const PJ: Record<string, Personaje> = Object.fromEntries(PERSONAJES.map((p) => [p.id, p]))
const DEP: Record<string, Departamento> = Object.fromEntries(DEPARTAMENTOS.map((d) => [d.id, d]))
const DEP_POR_LUGAR: Record<string, Departamento> = Object.fromEntries(DEPARTAMENTOS.map((d) => [d.lugarId, d]))
const OBJ: Record<string, Objetivo> = Object.fromEntries(OBJETIVOS.map((o) => [o.id, o]))
const COLOR_CELDA: Record<string, string> = Object.fromEntries(DEPARTAMENTOS.map((d) => [d.lugarId, d.color]))
const IDS = PERSONAJES.map((p) => p.id)

/** El mundo arranca a las 17:30: la hora dorada. */
const INICIO = { dia: 1, minutos: 17 * 60 + 30 }
const CLAVE_GUARDADO = "casa-blanca-sim-v1"

/** Lo que la interfaz usa de la escena además del contrato, si el motor lo trae. */
// (El motor de hoy los trae todos: EscenaMotor en escena/motor.ts. Se usan
// como opcionales para que la página no se rompa si alguno cambia.)
type EscenaPlus = Escena & {
  modoMaqueta?: (on: boolean) => void
  /** Las tomas del modo grabación; `modoCamara("cine", id)` fija una. */
  tomas?: () => ReadonlyArray<Toma>
  /** El modo de cámara actual (puede cambiarlo el motor solo, p. ej. al terminar la intro). */
  camara?: () => ModoCamara
  /** Hover sobre la escena (personaje, puesto o lugar bajo el cursor), si el motor lo ofrece. */
  alPasar?: (fn: (t: Toque | null, x: number, y: number) => void) => void
  /** Muestra un lugar entero (por el ascensor si está en otro nivel; una sala con planta, por dentro). */
  encuadrar?: (centro: { x: number; y: number; z: number }, distancia: number, lugarId?: string, opciones?: { subir?: number }) => void
  /** Entra a una planta de un edificio o, con null, sale. */
  mostrarPlanta?: (p: PlantaId | null) => void
  /** La planta abierta (null = afuera). */
  planta?: () => PlantaId | null
}

type ModoCam = ModoCamara

type Panel =
  | { tipo: "ficha"; id: string }
  | { tipo: "dep"; id: string; puesto?: number }
  | { tipo: "lugar"; id: string }
  | { tipo: "selector" }
  | { tipo: "consejo" }
  | { tipo: "transcripcion" }
  | { tipo: "noticia" }
  | { tipo: "objetivos" }
  | { tipo: "mapa" }

type RespuestaConversacion = { lineas?: Array<{ id: string; texto: string }>; resumen?: string; afinidad?: Array<{ a: string; b: string; delta: number }> }
type RespuestaNoticia = { reacciones?: Array<{ id: string; texto: string; lugarId: string }> }
type RespuestaTrabajar = { entregables?: Entregable[]; aviso?: string; fallidas?: Array<{ titulo: string; error: string }> }

function guardar(sim: Simulacion) {
  try {
    localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(sim.serializar()))
  } catch {}
}

function cargarGuardado(sim: Simulacion) {
  try {
    const crudo = localStorage.getItem(CLAVE_GUARDADO)
    if (crudo) sim.cargar(JSON.parse(crudo))
  } catch {
    // Un guardado de otra versión no debe romper la página: se descarta.
    try {
      localStorage.removeItem(CLAVE_GUARDADO)
    } catch {}
  }
}

/** Cuánto dura en pantalla una línea: lo que se tarda en leerla, con tope. */
const duracionLectura = (t: string) => Math.min(9000, 2200 + t.length * 55)

/** Quién está trabajando en su departamento ahora mismo (estado real de la simulación). */
function calcularEnMarcha(sim: Simulacion, trabajando: Record<string, number[]>): EnMarcha[] {
  const r: EnMarcha[] = []
  for (const d of DEPARTAMENTOS) {
    const lider = PJ[d.liderId]
    if (trabajando[d.id]) {
      r.push({ dep: d, lider, motivo: "kev", actividad: "" })
      continue
    }
    // El líder o cualquiera del departamento (las IA trabajan en el de otro).
    const quien = PERSONAJES.find((p) => p.departamentoId === d.id && sim.pj[p.id]?.lugarId === d.lugarId && sim.pj[p.id]?.estado !== "duerme")
    if (quien) r.push({ dep: d, lider: quien, motivo: "lider", actividad: sim.pj[quien.id]?.actividad || "en su puesto" })
  }
  return r
}

/**
 * El progreso de un objetivo (datos/empresa). El Mercedes, con RECAUDADO: el
 * mismo número del HUD, para que la pantalla no diga dos cosas distintas.
 */
function progresoDe(o: Objetivo, entregables: Entregable[]): { valor: number; texto: string } {
  const p = progresoObjetivo(o.id, entregables, RECAUDADO)
  return { valor: p.meta > 0 ? p.valor / p.meta : 0, texto: o.metrica === "recaudado" ? `${p.texto} · contador real del reto` : p.texto }
}

// ── Piezas del HUD que se re-dibujan solas ────────────────────
function Reloj({ sim, compacto }: { sim: Simulacion; compacto: boolean }) {
  useLatido(250)
  return <Dinero dia={sim.reloj.dia} minutos={sim.reloj.minutos} compacto={compacto} />
}

function Columna(props: {
  sim: Simulacion
  trabajando: Record<string, number[]>
  entregables: Entregable[]
  onDep: (id: string) => void
}) {
  useLatido(2000)
  return (
    <ColumnaObjetivos
      objetivos={OBJETIVOS}
      progreso={(o) => progresoDe(o, props.entregables)}
      enMarcha={calcularEnMarcha(props.sim, props.trabajando)}
      recientes={props.entregables}
      deptos={DEP}
      onDep={props.onDep}
    />
  )
}

function ObjetivosMovil(props: { sim: Simulacion; trabajando: Record<string, number[]>; entregables: Entregable[]; onDep: (id: string) => void; onCerrar: () => void }) {
  useLatido(2000)
  return (
    <Hoja titulo="Objetivos" onCerrar={props.onCerrar}>
      <ListaObjetivos objetivos={OBJETIVOS} progreso={(o) => progresoDe(o, props.entregables)} />
      <div className="mt-6 border-t border-white/[0.07] pt-4">
        <ListaEnMarcha enMarcha={calcularEnMarcha(props.sim, props.trabajando)} recientes={props.entregables} deptos={DEP} onDep={props.onDep} />
      </div>
    </Hoja>
  )
}

export default function CasaBlancaViva() {
  const escenarioRef = useRef<HTMLDivElement>(null)
  const capaRef = useRef<HTMLDivElement>(null)

  const [mundo, setMundo] = useState<{ escena: EscenaPlus; sim: Simulacion } | null>(null)
  const [fase, setFase] = useState<"cargando" | "intro" | "juego" | "error">("cargando")
  const [saliendoIntro, setSaliendoIntro] = useState(false)
  const [nivel, setNivel] = useState<NivelId>("superficie")
  const [planta, setPlanta] = useState<PlantaId | null>(null)
  const adentro = planta ? `${NOMBRE_EDIFICIO[PLANTA[planta].edificio]} · ${PLANTA[planta].nombre}` : null
  const [camara, setCamara] = useState<ModoCam>("dron")
  const [maqueta, setMaqueta] = useState(false)
  const [velocidad, setVelocidad] = useState(1)
  const [pausa, setPausa] = useState(false)
  const [seleccionado, setSeleccionado] = useState<string | null>(null)
  const [panel, setPanel] = useState<Panel | null>(null)
  const [sub, setSub] = useState<Subtitulo | null>(null)
  const [aviso, setAviso] = useState<{ clave: number; titulo: string; texto: string } | null>(null)
  const [estado, setEstado] = useState<EstadoServidor | null>(null)
  const [retratos, setRetratos] = useState<Record<string, string>>({})
  const [trabajando, setTrabajando] = useState<Record<string, number[]>>({})
  const [grabando, setGrabando] = useState(false)
  const [toma, setToma] = useState<string>(TOMAS[0].id)
  const [tomas, setTomas] = useState<ReadonlyArray<Toma>>(TOMAS)
  const [sesion, setSesion] = useState<SesionConsejo | null>(null)
  const [chats, setChats] = useState<Record<string, MensajeChat[]>>({})
  const compacto = useCompacto()
  const compactoRef = useRef(compacto)
  compactoRef.current = compacto

  // Refs con el último valor, para el bucle y los callbacks del motor (que se registran una vez).
  const mundoRef = useRef(mundo)
  mundoRef.current = mundo
  const faseRef = useRef(fase)
  faseRef.current = fase
  const seleccionadoRef = useRef(seleccionado)
  seleccionadoRef.current = seleccionado
  const grabandoRef = useRef(grabando)
  grabandoRef.current = grabando
  const maquetaRef = useRef(maqueta)
  maquetaRef.current = maqueta
  const camaraRef = useRef(camara)
  camaraRef.current = camara
  const sesionRef = useRef(sesion)
  sesionRef.current = sesion
  const vivoRef = useRef(false)

  // Temporizadores propios: se limpian todos al desmontar.
  const timers = useRef(new Set<number>())
  const programar = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id)
      if (vivoRef.current) fn()
    }, ms)
    timers.current.add(id)
    return id
  }, [])
  const cancelar = useCallback((id: number | null) => {
    if (id == null) return
    window.clearTimeout(id)
    timers.current.delete(id)
  }, [])

  // ── Subtítulos, avisos y burbujas ─────────────────────────────
  const subTimer = useRef<number | null>(null)
  const subN = useRef(0)
  const mostrarSub = useCallback(
    (s: Omit<Subtitulo, "clave">) => {
      cancelar(subTimer.current)
      setSub({ ...s, clave: ++subN.current })
      subTimer.current = programar(() => setSub(null), duracionLectura(s.texto))
    },
    [programar, cancelar],
  )

  const avisoTimer = useRef<number | null>(null)
  const avisoN = useRef(0)
  const ultimoAviso = useRef(0)
  const mostrarAviso = useCallback(
    (titulo: string, texto: string, ms = 4500, forzar = true) => {
      const ahora = performance.now()
      // Los avisos sueltos de la simulación no se pisan entre sí; los de la persona, sí.
      if (!forzar && ahora - ultimoAviso.current < 7000) return
      ultimoAviso.current = ahora
      cancelar(avisoTimer.current)
      setAviso({ clave: ++avisoN.current, titulo, texto })
      avisoTimer.current = programar(() => setAviso(null), ms)
    },
    [programar, cancelar],
  )

  /** Un personaje dice algo: burbuja en la escena y subtítulo abajo. */
  const decir = useCallback(
    (id: string, texto: string, extra: { cita?: boolean; guion?: boolean; subtitulo?: boolean } = {}) => {
      const m = mundoRef.current
      const p = PJ[id]
      if (!m || !p) return
      const e = m.sim.pj[id]
      if (e) e.burbuja = { texto: recortar(texto, 150), hasta: performance.now() + duracionLectura(texto), tipo: "dice" }
      if (extra.subtitulo !== false) mostrarSub({ nombre: p.corto, color: p.color, texto, cita: extra.cita, guion: extra.guion })
    },
    [mostrarSub],
  )

  /** ¿Se ve a este personaje desde donde está la cámara? Para no subtitular conversaciones lejanas. */
  const seVe = useCallback((id: string) => {
    const m = mundoRef.current
    if (!m) return false
    if (id === seleccionadoRef.current) return true
    const e = m.sim.pj[id]
    if (!e || !e.visible || e.nivel !== m.escena.nivel()) return false
    const s = m.escena.pantallaDe(id)
    if (!s?.visible) return false
    const c = m.escena.camaraEnPlanta()
    return Math.hypot(e.pos.x - c.x, e.pos.z - c.z) < 130
  }, [])

  // ── Eventos de la simulación ──────────────────────────────────
  const alEvento = useRef<(e: EventoSim) => void>(() => {})
  alEvento.current = (e: EventoSim) => {
    const m = mundoRef.current
    if (!m) return
    if (e.tipo === "linea") {
      const p = PJ[e.linea.id]
      if (!p) return
      const s = sesionRef.current
      if (s && e.conv.id === s.convId) {
        setSesion((x) =>
          x && x.convId === e.conv.id ? { ...x, estado: "en-curso", lineas: [...x.lineas, { id: e.linea.id, texto: e.linea.texto, cita: e.linea.cita }] } : x,
        )
        mostrarSub({ nombre: p.corto, color: p.color, texto: e.linea.texto, cita: e.linea.cita })
        return
      }
      if (faseRef.current === "juego" && seVe(p.id)) mostrarSub({ nombre: p.corto, color: p.color, texto: e.linea.texto, cita: e.linea.cita })
    } else if (e.tipo === "aviso") {
      if (faseRef.current === "juego" && !grabandoRef.current) mostrarAviso("La casa", e.texto, 4200, false)
    }
  }

  const alToque = useRef<(t: Toque) => void>(() => {})
  alToque.current = (t: Toque) => {
    if (faseRef.current !== "juego" || grabandoRef.current) return
    if (t.tipo === "personaje" && PJ[t.id]) {
      setSeleccionado(t.id)
      setPanel({ tipo: "ficha", id: t.id })
    } else if (t.tipo === "puesto" && DEP[t.id]) {
      setPanel({ tipo: "dep", id: t.id, puesto: t.puesto })
    } else if (t.tipo === "lugar") {
      const d = DEP_POR_LUGAR[t.id] ?? DEP[t.id]
      if (d) setPanel({ tipo: "dep", id: d.id })
      else if (LUGAR[t.id]) setPanel({ tipo: "lugar", id: t.id })
      // El pabellón del ascensor abre el mapa: desde ahí se elige a qué nivel bajar.
      else if (t.id === "ascensor") setPanel({ tipo: "mapa" })
    }
  }

  // ── Crear el mundo (y destruirlo sin dejar nada: StrictMode crea dos veces) ──
  useEffect(() => {
    const escenario = escenarioRef.current
    const capa = capaRef.current
    if (!escenario || !capa) return
    vivoRef.current = true
    let vivo = true

    // Un canvas nuevo por montaje: un contexto WebGL destruido no se reusa.
    const canvas = document.createElement("canvas")
    canvas.setAttribute("role", "img")
    canvas.setAttribute("aria-label", "La Casa Blanca en 3D, con sus residentes y los departamentos del subsuelo")
    canvas.tabIndex = 0
    canvas.style.position = "absolute"
    canvas.style.inset = "0"
    escenario.prepend(canvas)

    let escena: EscenaPlus
    let sim: Simulacion
    try {
      // ?calidad=baja|media|alta fija la calidad (equipos lentos, pruebas, grabación).
      const pedida = new URLSearchParams(window.location.search).get("calidad")
      const calidad = pedida === "baja" || pedida === "media" || pedida === "alta" ? pedida : undefined
      escena = crearEscena(canvas, { personajes: PERSONAJES, calidad }) as EscenaPlus
      sim = new Simulacion(PERSONAJES, ESPECIALES, INICIO)
    } catch (err) {
      console.error("[casa-blanca] no se pudo crear el mundo:", err)
      canvas.remove()
      setFase("error")
      return () => {
        vivoRef.current = false
      }
    }
    cargarGuardado(sim)
    setVelocidad(sim.reloj.velocidad || 1)
    setPausa(!!sim.reloj.pausa)

    const etiquetas = crearEtiquetas(capa, PERSONAJES, (id) => alToque.current({ tipo: "personaje", id }))
    const reel = crearEtiquetaPuesto(capa)
    const quitar = sim.on((e) => alEvento.current(e))
    escena.alTocar((t) => alToque.current(t))
    // Solo en desarrollo: la simulación a mano, para pruebas (como __casaBlancaEscena en el motor).
    if (process.env.NODE_ENV !== "production") (window as unknown as Record<string, unknown>).__casaBlancaSim = sim
    escena.iniciar()
    setMundo({ escena, sim })
    setFase("intro")

    // La intro: al terminar (o al saltarla) entra el HUD. Con tope por si el motor no resuelve.
    let terminada = false
    const timersLocales: number[] = []
    const terminarIntro = () => {
      if (!vivo || terminada) return
      terminada = true
      setSaliendoIntro(true)
      timersLocales.push(
        window.setTimeout(() => {
          if (!vivo) return
          setFase("juego")
          setSaliendoIntro(false)
        }, 750),
        window.setTimeout(() => {
          escena
            .retratos()
            .then((r) => vivo && setRetratos(r))
            .catch((err) => console.warn("[casa-blanca] sin retratos:", err))
        }, 900),
      )
    }
    escena.intro().then(terminarIntro, terminarIntro)
    timersLocales.push(window.setTimeout(terminarIntro, 22_000))

    // El bucle.
    let raf = 0
    let ultimo = performance.now()
    let ultNivel = 0
    let horaGuardada = sim.reloj.dia * 24 + Math.floor(sim.reloj.minutos / 60)
    const tick = (ahora: number) => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(0.1, Math.max(0, (ahora - ultimo) / 1000))
      ultimo = ahora
      try {
        sim.avanzar(dt, ahora)
      } catch (err) {
        console.error("[casa-blanca] la simulación falló en este cuadro:", err)
      }
      escena.setHora(sim.reloj.minutos / 60)

      const lista: Parameters<Escena["actualizarPersonajes"]>[0] = []
      for (const id of IDS) {
        const e = sim.pj[id]
        if (e) lista.push({ id, pos: e.pos, rumbo: e.rumbo, estado: e.estado, visible: e.visible, velocidad: e.velocidad, planta: e.planta })
      }
      escena.actualizarPersonajes(lista)

      // Etiquetas y burbujas: solo los del nivel que se ve y en pantalla.
      const cam = escena.camaraEnPlanta()
      const nv = escena.nivel()
      const datos: DatoEtiqueta[] = []
      for (const id of IDS) {
        const e = sim.pj[id]
        // A quien se sigue y está adentro se lo ve en rayos X: su etiqueta también.
        const adentro = !!e && !e.visible && id === seleccionadoRef.current && camaraRef.current === "seguir"
        if (!e || (!e.visible && !adentro) || e.nivel !== nv) continue
        const s = escena.pantallaDe(id)
        if (!s || !s.visible) continue
        const b = e.burbuja && e.burbuja.hasta > ahora ? e.burbuja : null
        datos.push({
          id,
          x: s.x,
          y: s.y,
          dist: Math.hypot(e.pos.x - cam.x, e.pos.z - cam.z),
          actividad: adentro ? `${e.actividad} · adentro` : e.actividad,
          burbuja: b ? { texto: b.texto, tipo: b.tipo } : null,
        })
      }
      etiquetas.actualizar(datos, {
        seleccionado: seleccionadoRef.current,
        soloBurbujas: grabandoRef.current,
        oculto: faseRef.current !== "juego",
      })

      if (ahora - ultNivel > 300) {
        // El motor puede cambiar nivel y cámara por su cuenta (intro, tomas, fundidos): la botonera lo refleja.
        ultNivel = ahora
        setNivel((n) => (n === nv ? n : nv))
        const pl = escena.planta?.() ?? null
        setPlanta((x) => (x === pl ? x : pl))
        const modo = escena.camara?.()
        if (modo && modo !== "intro") setCamara((c) => (c === modo ? c : modo))
      }
      const h = sim.reloj.dia * 24 + Math.floor(sim.reloj.minutos / 60)
      if (h !== horaGuardada) {
        horaGuardada = h
        guardar(sim)
      }
    }
    raf = requestAnimationFrame(tick)

    const alOcultar = () => {
      if (document.visibilityState === "hidden") guardar(sim)
    }
    const alRedimensionar = () => escena.redimensionar()
    document.addEventListener("visibilitychange", alOcultar)
    window.addEventListener("resize", alRedimensionar)

    return () => {
      vivo = false
      vivoRef.current = false
      cancelAnimationFrame(raf)
      for (const t of timersLocales) window.clearTimeout(t)
      for (const t of timers.current) window.clearTimeout(t)
      timers.current.clear()
      document.removeEventListener("visibilitychange", alOcultar)
      window.removeEventListener("resize", alRedimensionar)
      quitar()
      guardar(sim)
      etiquetas.destruir()
      reel.destruir()
      escena.destruir()
      canvas.remove()
      setMundo(null)
    }
  }, [])

  // ── Estado del servidor (entregables, progreso) ───────────────
  const refrescar = useCallback(async () => {
    const e = await leerEstado(leerClave())
    if (e && vivoRef.current) setEstado(e)
  }, [])
  useEffect(() => {
    void refrescar()
    const t = window.setInterval(() => void refrescar(), 60_000)
    return () => window.clearInterval(t)
  }, [refrescar])

  // ── Pensamientos del día (la conciencia del servidor) ─────────
  // De vez en cuando, alguien quieto y a la vista piensa lo que escribió en su
  // reflexión de hoy. Es la misma burbuja "piensa" de la simulación: no pisa
  // otra burbuja ni una conversación, y cada uno repite su pensamiento como
  // mucho cada 4 minutos.
  const concienciasRef = useRef(estado?.conciencias)
  concienciasRef.current = estado?.conciencias
  useEffect(() => {
    if (!mundo) return
    const ultimo: Record<string, number> = {}
    const recordados = new Set<string>()
    const t = window.setInterval(() => {
      const cs = concienciasRef.current
      if (!cs || faseRef.current !== "juego" || Math.random() > 0.6) return
      const ahora = performance.now()
      const nv = mundo.escena.nivel()
      const libres = Object.keys(cs).filter((id) => {
        const e = mundo.sim.pj[id]
        return (
          !!PJ[id] && !!cs[id]?.pensamiento && !!e && e.visible && e.nivel === nv && !e.burbuja && !e.conversacionId &&
          e.estado !== "duerme" && e.estado !== "ascensor" && ahora - (ultimo[id] ?? -Infinity) > 240_000 && !!mundo.escena.pantallaDe(id)?.visible
        )
      })
      if (!libres.length) return
      const id = libres[Math.floor(Math.random() * libres.length)]
      const texto = cs[id].pensamiento
      mundo.sim.pj[id].burbuja = { texto: recortar(texto, 150), hasta: ahora + duracionLectura(texto), tipo: "piensa" }
      ultimo[id] = ahora
      if (!recordados.has(id)) {
        recordados.add(id)
        mundo.sim.recordar(id, `Pensó: «${recortar(texto, 90)}»`)
      }
    }, 15_000)
    return () => window.clearInterval(t)
  }, [mundo])

  const entregables = useMemo(
    () => [...(estado?.entregables ?? [])].sort((a, b) => Date.parse(b.creado) - Date.parse(a.creado)),
    [estado],
  )

  // Los 100 puestos de cada departamento: entregado (hay entregable guardado), trabajando (pedido en curso) o libre.
  const estadosPuestos = useMemo(() => {
    const r: Record<string, EstadoPuesto[]> = {}
    for (const d of DEPARTAMENTOS) {
      const arr = new Array<EstadoPuesto>(100).fill("libre")
      for (const i of estado?.progreso[d.id]?.puestos ?? []) if (i >= 0 && i < 100) arr[i] = "entregado"
      for (const i of trabajando[d.id] ?? []) if (i >= 0 && i < 100) arr[i] = "trabajando"
      r[d.id] = arr
    }
    return r
  }, [estado, trabajando])
  const estadosPuestosRef = useRef(estadosPuestos)
  estadosPuestosRef.current = estadosPuestos
  useEffect(() => {
    if (!mundo) return
    for (const d of DEPARTAMENTOS) mundo.escena.marcarPuestos(d.id, estadosPuestos[d.id])
  }, [mundo, estadosPuestos])

  // ── Acciones del HUD ──────────────────────────────────────────
  const cerrarPanel = useCallback(() => setPanel(null), [])

  const apagarMaqueta = useCallback(() => {
    if (!maquetaRef.current) return
    mundoRef.current?.escena.modoMaqueta?.(false)
    setMaqueta(false)
  }, [])

  const irANivel = useCallback((n: NivelId) => {
    const m = mundoRef.current
    if (!m) return
    m.escena.mostrarNivel(n)
    setNivel(n)
  }, [])

  const seguir = useCallback(
    (id: string) => {
      const m = mundoRef.current
      if (!m || !PJ[id]) return
      setSeleccionado(id)
      // Si está en otro nivel, la cámara de seguir cambia de nivel sola (con fundido).
      apagarMaqueta()
      m.escena.modoCamara("seguir", id)
      setCamara("seguir")
    },
    [apagarMaqueta],
  )

  /** El más cercano a la cámara en el nivel que se ve, para "Seguir" sin nadie elegido. */
  const masCercano = useCallback(() => {
    const m = mundoRef.current
    if (!m) return null
    const c = m.escena.camaraEnPlanta()
    const nv = m.escena.nivel()
    let mejor: string | null = null
    let dmin = Infinity
    for (const id of IDS) {
      const e = m.sim.pj[id]
      if (!e || !e.visible || e.nivel !== nv) continue
      const d = Math.hypot(e.pos.x - c.x, e.pos.z - c.z)
      if (d < dmin) {
        dmin = d
        mejor = id
      }
    }
    return mejor ?? IDS.find((id) => m.sim.pj[id]?.visible) ?? IDS[0] ?? null
  }, [])

  const camaraA = useCallback(
    (modo: ModoCam | "maqueta") => {
      const m = mundoRef.current
      if (!m) return
      if (modo === "maqueta") {
        const on = !maquetaRef.current
        m.escena.modoMaqueta?.(on)
        setMaqueta(on)
        return
      }
      apagarMaqueta()
      if (modo === "seguir") {
        const id = seleccionadoRef.current ?? masCercano()
        if (id) seguir(id)
        return
      }
      m.escena.modoCamara(modo)
      setCamara(modo)
    },
    [apagarMaqueta, masCercano, seguir],
  )

  const cambiarPausa = useCallback(() => {
    const m = mundoRef.current
    if (!m) return
    m.sim.reloj.pausa = !m.sim.reloj.pausa
    setPausa(m.sim.reloj.pausa)
  }, [])
  const cambiarVelocidad = useCallback((v: number) => {
    const m = mundoRef.current
    if (!m) return
    m.sim.reloj.velocidad = v
    m.sim.reloj.pausa = false
    setVelocidad(v)
    setPausa(false)
  }, [])

  const elegirDelSelector = useCallback(
    (id: string) => {
      seguir(id)
      setPanel({ tipo: "ficha", id })
    },
    [seguir],
  )

  /** Del mapa: la cámara va al lugar (por el ascensor si está en otro nivel) y se abre su panel. */
  const irALugar = useCallback(
    (lugarId: string) => {
      const m = mundoRef.current
      const e = encuadreDe(lugarId)
      if (!m || !e) return
      apagarMaqueta()
      // En celular el panel tapa la mitad de abajo: el lugar se encuadra más arriba.
      if (m.escena.encuadrar) m.escena.encuadrar(e.centro, e.distancia, lugarId, compactoRef.current ? { subir: 0.42 } : undefined)
      else m.escena.enfocar(e.centro, e.distancia)
      setNivel(e.nivel)
      // La barra de plantas cambia en el acto (si no, marca la anterior hasta el próximo tick).
      const sala = cuartoDeLugar(lugarId)
      if (sala && m.escena.encuadrar) {
        setPlanta(sala.planta)
        setCamara("dron")
      }
      const d = DEP_POR_LUGAR[lugarId]
      setPanel(d ? { tipo: "dep", id: d.id } : LUGAR[lugarId] ? { tipo: "lugar", id: lugarId } : null)
    },
    [apagarMaqueta],
  )

  /** Entrar a una planta (o, con null, salir del edificio). */
  const irAPlanta = useCallback((p: PlantaId | null) => {
    const m = mundoRef.current
    if (!m?.escena.mostrarPlanta) return
    apagarMaqueta()
    m.escena.mostrarPlanta(p)
    setCamara("dron")
    setPlanta(p)
  }, [apagarMaqueta])

  /** "Ir" de un residente: la cámara lo sigue; si está dentro de un edificio, se avisa (desde afuera no se ve). */
  const irConPersonaje = useCallback(
    (id: string) => {
      const m = mundoRef.current
      const p = PJ[id]
      if (!m || !p) return
      seguir(id)
      setPanel(null)
      const e = m.sim.pj[id]
      if (e) {
        const d = dondeEsta(e)
        mostrarAviso(p.corto, d.dentro ? `${d.texto}: desde afuera no se ve` : d.texto, 4500)
      }
    },
    [seguir, mostrarAviso],
  )

  const abrirDep = useCallback((id: string) => setPanel({ tipo: "dep", id }), [])
  const abrirFicha = useCallback((id: string) => {
    setSeleccionado(id)
    setPanel({ tipo: "ficha", id })
  }, [])

  const guardarChat = useCallback((id: string, h: MensajeChat[]) => setChats((c) => ({ ...c, [id]: h })), [])

  // ── Consejo ───────────────────────────────────────────────────
  const convocar = useCallback(
    async (tema: string, ids: string[]) => {
      const m = mundoRef.current
      if (!m) return
      const conv = m.sim.reunir("sala-guerra", ids, tema)
      // enfocar() baja de nivel con su propio fundido: no hace falta mostrarNivel antes.
      const sala = LUGAR["sala-guerra"]
      if (sala) {
        m.escena.enfocar({ x: (sala.x0 + sala.x1) / 2, y: sala.y, z: (sala.z0 + sala.z1) / 2 }, 46)
        setNivel(sala.nivel)
      }
      setSesion({ convId: conv.id, tema, ids, lineas: [], estado: "escribiendo", guion: false })
      setPanel({ tipo: "transcripcion" })
      mostrarAviso("Consejo convocado", tema, 5000)

      // Contexto real para la IA: la hora, lo que recuerda cada uno y cómo se llevan.
      const recuerdos: Record<string, string[]> = {}
      const afinidad: Record<string, number> = {}
      for (const id of ids) {
        const e = m.sim.pj[id]
        if (!e) continue
        recuerdos[id] = e.memoria.slice(0, 3).map((x) => x.texto.slice(0, 200))
        for (const otro of ids) if (otro > id && typeof e.afinidad[otro] === "number") afinidad[`${id}|${otro}`] = e.afinidad[otro]
      }
      const r = await pedir<RespuestaConversacion>(
        { accion: "consejo", tema, ids, contexto: { hora: relojTexto(m.sim.reloj.dia, m.sim.reloj.minutos).slice(0, 20), lugar: "sala-guerra", recuerdos, afinidad } },
        { clave: leerClave() },
      )
      if (!vivoRef.current || sesionRef.current?.convId !== conv.id) return
      const lineas = r.ok ? (r.datos.lineas ?? []).filter((l) => ids.includes(l.id) && l.texto) : []
      if (lineas.length >= 2 && r.ok) {
        // Llegaron todas: se agregan y se cierra; la sala termina cuando se digan.
        m.sim.agregarLineas(conv.id, lineas.map((l) => ({ id: l.id, texto: l.texto })))
        m.sim.cerrar(conv.id, r.datos.resumen, r.datos.afinidad)
        setSesion((x) => (x && x.convId === conv.id ? { ...x, estado: "en-curso" } : x))
        return
      }
      // Plan B: debaten con su guion.
      m.sim.cerrar(conv.id)
      const g = m.sim.conversarGuion("sala-guerra", ids, detectarTema(tema) ?? undefined)
      setSesion({ convId: g.id, tema, ids, lineas: [], estado: "en-curso", guion: true, nota: motivoSinIa(r.ok ? 500 : r.status) })
    },
    [mostrarAviso],
  )

  // La sesión termina cuando la simulación saca la conversación de su lista
  // (ya se dijeron todas las líneas). Mientras la IA escribe, sigue abierta.
  const convIdSesion = sesion && sesion.estado !== "terminado" ? sesion.convId : null
  useEffect(() => {
    if (!mundo || !convIdSesion) return
    const t = window.setInterval(() => {
      if (!mundo.sim.conversaciones.some((x) => x.id === convIdSesion)) {
        setSesion((x) => (x && x.convId === convIdSesion ? { ...x, estado: "terminado" } : x))
      }
    }, 1000)
    return () => window.clearInterval(t)
  }, [mundo, convIdSesion])

  // ── Noticia ───────────────────────────────────────────────────
  const darNoticia = useCallback(
    async (texto: string) => {
      const m = mundoRef.current
      if (!m) return
      setPanel(null)
      mostrarAviso("Última hora", texto, 9000)
      const dondeEsta: Record<string, string> = {}
      for (const id of IDS) {
        const e = m.sim.pj[id]
        dondeEsta[id] = (e?.lugarId ? LUGAR[e.lugarId]?.nombre ?? e.lugarId : "de camino").slice(0, 80)
      }
      const r = await pedir<RespuestaNoticia>({ accion: "noticia", noticia: texto, contexto: { dondeEsta } }, { clave: leerClave() })
      if (!vivoRef.current) return
      const ia = r.ok ? (r.datos.reacciones ?? []).filter((x) => PJ[x.id] && x.texto) : []
      const guion = ia.length === 0
      const reacciones = guion ? PERSONAJES.map((p) => ({ id: p.id, texto: p.noticia[0], lugarId: p.noticia[1] })) : ia
      if (guion) mostrarAviso("Guion", motivoSinIa(r.ok ? 500 : r.status), 4000)
      reacciones.forEach((x, i) => {
        programar(() => {
          const mm = mundoRef.current
          if (!mm) return
          decir(x.id, x.texto, { guion, subtitulo: seVe(x.id) })
          mm.sim.recordar(x.id, `Noticia: «${recortar(texto, 60)}». Dijo: «${recortar(x.texto, 80)}»`)
          if (LUGAR[x.lugarId]) programar(() => mundoRef.current?.sim.irA(x.id, x.lugarId, "Reacciona a la noticia"), 1600)
        }, 900 + i * 850)
      })
    },
    [decir, mostrarAviso, programar, seVe],
  )

  // ── Trabajar (solo Kev) ───────────────────────────────────────
  const trabajar = useCallback(
    async (depId: string, objetivoId: string, clave: string): Promise<ResultadoTrabajo> => {
      const m = mundoRef.current
      const dep = DEP[depId]
      if (!dep) return { ok: false, status: 400, error: "Departamento desconocido." }
      // Mientras el servidor trabaja, se encienden los puestos de los roles de las tareas.
      const estados = estadosPuestosRef.current[depId] ?? []
      const agentes = agentesDe(depId)
      const tareas = dep.tareas.filter((t) => t.objetivoId === objetivoId)
      const elegidos: number[] = []
      for (const t of tareas.slice(0, 6)) {
        const a = agentes.find((x) => x.rol === t.rol && estados[x.puesto] === "libre" && !elegidos.includes(x.puesto))
        if (a) elegidos.push(a.puesto)
      }
      for (let i = 0; elegidos.length < Math.max(3, Math.min(6, tareas.length)) && i < 100; i++) {
        if (estados[i] === "libre" && !elegidos.includes(i)) elegidos.push(i)
      }
      setTrabajando((x) => ({ ...x, [depId]: elegidos }))
      m?.sim.irA(dep.liderId, dep.lugarId, "Dirige el trabajo")
      mostrarAviso("A trabajar", `${dep.nombre} · ${OBJ[objetivoId]?.titulo ?? objetivoId}`, 5000)

      const r = await pedir<RespuestaTrabajar>({ accion: "trabajar", departamentoId: depId, objetivoId }, { clave })
      if (!vivoRef.current) return { ok: false, status: 0, error: "" }
      setTrabajando((x) => {
        const y = { ...x }
        delete y[depId]
        return y
      })
      if (!r.ok) return { ok: false, status: r.status, error: r.error }
      const nuevos = r.datos.entregables ?? []
      setEstado((s) => {
        const base: EstadoServidor = s ?? { entregables: [], progreso: {}, recaudado: RECAUDADO, meta: CHALLENGE_TARGET }
        const prev = base.progreso[depId] ?? { entregados: 0, puestos: [] }
        return {
          ...base,
          entregables: [...nuevos, ...base.entregables.filter((e) => !nuevos.some((n) => n.id === e.id))],
          progreso: {
            ...base.progreso,
            [depId]: { entregados: prev.entregados + nuevos.length, puestos: [...new Set([...prev.puestos, ...nuevos.map((e) => e.puesto)])] },
          },
        }
      })
      if (nuevos.length) mostrarAviso("Entregado", `${dep.nombre}: ${recortar(nuevos[0].titulo, 70)}`, 5000)
      void refrescar()
      const fallidas = r.datos.fallidas?.length ?? 0
      return { ok: true, cuantos: nuevos.length, aviso: [r.datos.aviso, fallidas ? `${fallidas} tarea${fallidas === 1 ? "" : "s"} no salieron.` : ""].filter(Boolean).join(" ") }
    },
    [mostrarAviso, refrescar],
  )

  // ── Grabación ─────────────────────────────────────────────────
  // Cada toma es del motor (escena.tomas()): la interfaz solo elige cuál.
  const aplicarToma = useCallback(
    (id: string) => {
      const m = mundoRef.current
      if (!m) return
      setToma(id)
      // El modo maqueta manual se apaga: la toma "maqueta" lo prende por su cuenta.
      if (maquetaRef.current) {
        m.escena.modoMaqueta?.(false)
        setMaqueta(false)
      }
      if (id === "seguir") {
        // Primero se elige a quién (el elegido o el más cercano) y después se fija la toma.
        const quien = seleccionadoRef.current ?? masCercano()
        if (quien) {
          setSeleccionado(quien)
          m.escena.modoCamara("seguir", quien)
        }
      }
      m.escena.modoCamara("cine", id)
      setCamara("cine")
    },
    [masCercano],
  )

  const entrarGrabacion = useCallback(() => {
    const m = mundoRef.current
    const lista = m?.escena.tomas?.()
    if (lista?.length) setTomas(lista)
    setPanel(null)
    setGrabando(true)
    aplicarToma(lista?.some((t) => t.id === toma) ? toma : (lista?.[0]?.id ?? toma))
  }, [aplicarToma, toma])

  const salirGrabacion = useCallback(() => {
    setGrabando(false)
    const m = mundoRef.current
    if (!m) return
    m.escena.modoCamara("dron")
    setCamara("dron")
  }, [])

  // Al cambiar el cuadro (9:16 o pantalla completa), la escena se ajusta al tamaño nuevo.
  useEffect(() => {
    if (!mundo) return
    let a = 0
    const b = requestAnimationFrame(() => {
      a = requestAnimationFrame(() => mundo.escena.redimensionar())
    })
    return () => {
      cancelAnimationFrame(b)
      cancelAnimationFrame(a)
    }
  }, [mundo, grabando, compacto])

  const saltarIntro = useCallback(() => mundoRef.current?.escena.saltarIntro(), [])

  // ── Radar ─────────────────────────────────────────────────────
  const datosRadar = useCallback((): DatosRadar | null => {
    const m = mundoRef.current
    if (!m) return null
    const sel = seleccionadoRef.current
    const seguido = camaraRef.current === "seguir" && sel ? m.sim.pj[sel] : undefined
    return {
      cam: m.escena.camaraEnPlanta(),
      centro: seguido ? { x: seguido.pos.x, z: seguido.pos.z } : undefined,
      nivel: m.escena.nivel(),
      puntos: PERSONAJES.map((p) => {
        const e = m.sim.pj[p.id]
        return { id: p.id, x: e?.pos.x ?? 0, z: e?.pos.z ?? 0, color: p.color, nivel: e?.nivel ?? "superficie", visible: !!e?.visible }
      }),
      seleccionado: seleccionadoRef.current,
      colorCelda: COLOR_CELDA,
    }
  }, [])

  // ── Dibujo ────────────────────────────────────────────────────
  const enJuego = fase === "juego" && !!mundo
  const hayMaqueta = !!mundo?.escena.modoMaqueta
  const panelLateral = !!panel && !["consejo", "noticia"].includes(panel.tipo)

  const estiloEscenario: CSSProperties =
    grabando && !compacto
      ? { top: 0, bottom: 0, left: "50%", width: "min(100vw, calc(100dvh * 9 / 16))", transform: "translateX(-50%)" }
      : { inset: 0 }

  const pj = panel?.tipo === "ficha" ? PJ[panel.id] : undefined
  const dep = panel?.tipo === "dep" ? DEP[panel.id] : undefined
  const lugar = panel?.tipo === "lugar" ? LUGAR[panel.id] : undefined

  return (
    <div className="cb-raiz fixed inset-0 select-none overflow-hidden bg-black text-white">
      <Estilos />

      {/* El escenario: el canvas lo pone el efecto; encima, la capa de etiquetas. */}
      <div ref={escenarioRef} className="cb-escena absolute overflow-hidden" style={estiloEscenario}>
        <div ref={capaRef} className="pointer-events-none absolute inset-0 z-10 overflow-hidden" />
        {/* Viñeta suave para que el HUD se lea sobre cualquier cielo. */}
        {!grabando && <div className="pointer-events-none absolute inset-0 z-[5] bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.42)_100%)]" aria-hidden />}
        {grabando && <MarcaGrabacion />}
        {grabando && (
          <div className="pointer-events-none absolute inset-x-0 bottom-[11%] z-20 px-5">
            <Subtitulos sub={sub} grande />
          </div>
        )}
      </div>

      {fase === "intro" && <Intro onSaltar={saltarIntro} saliendo={saliendoIntro} residentes={PERSONAJES.length} departamentos={DEPARTAMENTOS.length} />}

      {fase === "error" && (
        <div className="absolute inset-0 grid place-items-center px-6 text-center">
          <div className="max-w-md">
            <h1 className="cb-cond text-[28px] font-bold uppercase tracking-[0.12em]">La Casa Blanca Project</h1>
            <p className="mt-3 text-[14px] text-white/70">Este navegador no pudo abrir el 3D. Inténtalo en Chrome, Safari o Edge actualizados, o en otro dispositivo.</p>
            <p className="mt-4 text-[11.5px] leading-relaxed text-white/40">{AVISO_FICCION}</p>
          </div>
        </div>
      )}

      {enJuego && !grabando && (
        <div className="pointer-events-none absolute inset-0 z-20">
          <div className="cb-hud-arriba absolute inset-x-0 top-0 flex items-start justify-between gap-3 px-4 pt-[max(14px,env(safe-area-inset-top))] md:px-7 md:pt-6">
            <Marca nivel={nivel} compacto={compacto} adentro={adentro} />
            <Reloj sim={mundo.sim} compacto={compacto} />
          </div>

          {planta && nivel === "superficie" && (
            <div className="absolute inset-x-0 top-[calc(max(14px,env(safe-area-inset-top))+96px)] flex justify-center px-3 md:top-6">
              <BarraPlanta planta={planta} onPlanta={(p) => irAPlanta(p)} onSalir={() => irAPlanta(null)} />
            </div>
          )}

          {aviso && (
            <div key={aviso.clave} className="absolute inset-x-0 top-[96px] px-4 md:top-7">
              <Notificacion titulo={aviso.titulo} texto={aviso.texto} />
            </div>
          )}

          {!compacto && !panelLateral && (
            <div className="cb-hud-der absolute bottom-[100px] right-7 top-[168px] flex flex-col">
              <Columna sim={mundo.sim} trabajando={trabajando} entregables={entregables} onDep={abrirDep} />
            </div>
          )}

          <div className="cb-hud-izq absolute bottom-[calc(max(10px,env(safe-area-inset-bottom))+106px)] left-3 md:bottom-7 md:left-7">
            <div className="rounded-full p-[3px] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.9)] bg-black/40">
              <Radar fuente={datosRadar} tam={compacto ? 104 : 172} etiqueta="Radar: la cámara al centro, el norte arriba y un punto por residente" />
            </div>
          </div>

          <div
            className="absolute inset-x-0 bottom-[calc(max(10px,env(safe-area-inset-bottom))+224px)] px-4 md:bottom-[96px] md:left-[220px]"
            style={!compacto ? { right: panelLateral ? 470 : 350 } : undefined}
          >
            <Subtitulos sub={sub} />
          </div>

          <div className="cb-hud-abajo absolute inset-x-2 bottom-[max(10px,env(safe-area-inset-bottom))] flex justify-center md:bottom-7 md:left-[220px] md:right-7">
            <Dock
              nivel={nivel}
              adentro={adentro}
              onNivel={irANivel}
              camara={camara}
              maqueta={maqueta}
              hayMaqueta={hayMaqueta}
              onCamara={camaraA}
              pausa={pausa}
              velocidad={velocidad}
              onPausa={cambiarPausa}
              onVelocidad={cambiarVelocidad}
              onMapa={() => setPanel((p) => (p?.tipo === "mapa" ? null : { tipo: "mapa" }))}
              mapaAbierto={panel?.tipo === "mapa"}
              onPersonajes={() => setPanel({ tipo: "selector" })}
              onConsejo={() => setPanel(sesion && sesion.estado !== "terminado" ? { tipo: "transcripcion" } : { tipo: "consejo" })}
              onNoticia={() => setPanel({ tipo: "noticia" })}
              onGrabar={entrarGrabacion}
              onObjetivos={() => setPanel({ tipo: "objetivos" })}
              compacto={compacto}
            />
          </div>
        </div>
      )}

      {enJuego && grabando && <ControlesGrabacion tomas={tomas} toma={toma} onToma={aplicarToma} onSalir={salirGrabacion} compacto={compacto} />}

      {/* Paneles */}
      {enJuego && !grabando && (
        <div className="select-text">
          {pj && (
            <Ficha
              key={pj.id}
              p={pj}
              retrato={retratos[pj.id]}
              dep={DEP[pj.departamentoId]}
              sim={mundo.sim}
              personajes={PJ}
              historial={chats[pj.id] ?? []}
              setHistorial={guardarChat}
              decir={decir}
              onSeguir={seguir}
              onDep={abrirDep}
              onCerrar={cerrarPanel}
            />
          )}
          {dep && panel?.tipo === "dep" && (
            <PanelDepartamento
              key={`${dep.id}-${panel.puesto ?? ""}`}
              dep={dep}
              lider={PJ[dep.liderId]}
              retrato={retratos[dep.liderId]}
              agentes={agentesDe(dep.id)}
              estados={estadosPuestos[dep.id]}
              entregables={entregables.filter((e) => e.departamentoId === dep.id)}
              objetivos={OBJETIVOS}
              puestoInicial={panel.puesto}
              trabajando={!!trabajando[dep.id]}
              onTrabajar={(o, k) => trabajar(dep.id, o, k)}
              onLider={abrirFicha}
              onCerrar={cerrarPanel}
            />
          )}
          {lugar && (
            <PanelLugar
              lugar={lugar}
              sim={mundo.sim}
              personajes={PJ}
              retratos={retratos}
              onPersonaje={abrirFicha}
              onCerrar={cerrarPanel}
              entrar={(() => {
                const pl = plantaDeLugar(lugar.id)
                if (!pl) return undefined
                if (cuartoDeLugar(lugar.id)) return { texto: planta === pl ? "Ver la sala" : "Entrar", onEntrar: () => irALugar(lugar.id) }
                return planta === pl ? undefined : { texto: "Entrar a la Residencia", onEntrar: () => irAPlanta(pl) }
              })()}
            />
          )}
          {panel?.tipo === "mapa" && (
            <Mapa
              nivel={nivel}
              sim={mundo.sim}
              personajes={PERSONAJES}
              deptos={DEP}
              retratos={retratos}
              onIrLugar={irALugar}
              onIrPersonaje={irConPersonaje}
              onNivel={(n) => {
                irANivel(n)
                setPanel(null)
              }}
              onCerrar={cerrarPanel}
            />
          )}
          {panel?.tipo === "selector" && (
            <Selector personajes={PERSONAJES} retratos={retratos} deptos={DEP} seleccionado={seleccionado} sim={mundo.sim} onElegir={elegirDelSelector} onIr={irConPersonaje} onCerrar={cerrarPanel} />
          )}
          {panel?.tipo === "consejo" && <ConvocarConsejo personajes={PERSONAJES} onConvocar={(t, ids) => void convocar(t, ids)} onCerrar={cerrarPanel} />}
          {panel?.tipo === "transcripcion" && sesion && <TranscripcionConsejo sesion={sesion} personajes={PJ} retratos={retratos} onCerrar={cerrarPanel} />}
          {panel?.tipo === "noticia" && <DarNoticia onDar={(t) => void darNoticia(t)} onCerrar={cerrarPanel} />}
          {panel?.tipo === "objetivos" && (
            <ObjetivosMovil sim={mundo.sim} trabajando={trabajando} entregables={entregables} onDep={abrirDep} onCerrar={cerrarPanel} />
          )}
        </div>
      )}
    </div>
  )
}
