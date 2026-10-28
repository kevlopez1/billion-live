"use client"

// ──────────────────────────────────────────────────────────────
// El HUD fijo, estilo GTA V: la marca arriba a la izquierda, el dinero real
// arriba a la derecha (RECAUDADO, nunca un número escrito aquí), los
// subtítulos abajo al centro y la botonera abajo.
// ──────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, type ReactNode } from "react"
import { Box, ChevronDown, ChevronUp, Clock, Crosshair, Film, Gavel, Info, Map as IconoMapa, MoreHorizontal, Newspaper, Pause, Play, Plane, Target, Users } from "lucide-react"
import { CHALLENGE_TARGET, RECAUDADO } from "@/lib/contador"
import { NOMBRE_NIVEL, type NivelId } from "../tipos"
import { NIVEL_CONTENIDO, NIVEL_CORTO, ORDEN_NIVELES, nivelVecino, profundidad } from "../navegacion"
import { Boton, FOCO, VIDRIO } from "./base"
import { franja, relojTexto, usd } from "./formato"

export const AVISO_FICCION =
  "Ficción interactiva. Los diálogos los escribe una IA o un guion a partir de lo que se sabe de cada personaje; no son declaraciones reales. Las frases marcadas «cita» sí son citas o paráfrasis de textos conocidos."

export function Marca({ nivel, compacto }: { nivel: NivelId; compacto: boolean }) {
  const [info, setInfo] = useState(false)
  return (
    <div className="pointer-events-auto relative max-w-[60vw]">
      <div className="flex items-center gap-2">
        <h1 className="cb-cond cb-sombra text-[15px] font-bold uppercase leading-[0.95] tracking-[0.16em] text-white md:text-[21px]">
          La Casa Blanca{compacto ? <br /> : " "}Project
        </h1>
        <button
          type="button"
          onClick={() => setInfo((v) => !v)}
          aria-label="Qué es ficción en esta página"
          aria-expanded={info}
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/25 bg-black/30 text-white/80 backdrop-blur hover:bg-white/15 hover:text-white ${FOCO}`}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="cb-sombra mt-1 text-[11px] font-semibold text-white/70 md:text-[12px]">{NOMBRE_NIVEL[nivel]}</p>
      {info && (
        <div role="note" className={`cb-entra absolute left-0 top-full z-50 mt-2 w-[min(340px,86vw)] rounded-[16px] p-4 text-[12.5px] leading-relaxed text-white/85 ${VIDRIO} bg-[rgba(9,11,15,0.86)]`}>
          {AVISO_FICCION}
        </div>
      )}
    </div>
  )
}

export function Dinero({ dia, minutos, compacto }: { dia: number; minutos: number; compacto: boolean }) {
  return (
    <div className="pointer-events-none text-right" aria-live="off">
      <div className={`cb-cond cb-dinero font-bold leading-none tabular-nums ${compacto ? "text-[30px]" : "text-[48px]"}`} aria-label={`Recaudado: ${usd(RECAUDADO)} de ${usd(CHALLENGE_TARGET)}`}>
        {usd(RECAUDADO)}
      </div>
      <div className="cb-cond cb-sombra mt-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/80 md:text-[14px]">de {usd(CHALLENGE_TARGET)}</div>
      <div className="cb-cond cb-sombra mt-1.5 text-[13px] font-semibold tabular-nums tracking-[0.06em] text-white md:text-[16px]">
        {relojTexto(dia, minutos)}
        {!compacto && <span className="ml-2 text-white/60">{franja(minutos)}</span>}
      </div>
    </div>
  )
}

export interface Subtitulo {
  clave: number
  nombre: string
  color: string
  texto: string
  cita?: boolean
  guion?: boolean
}

export function Subtitulos({ sub, grande = false }: { sub: Subtitulo | null; grande?: boolean }) {
  if (!sub) return null
  return (
    <p
      key={sub.clave}
      className={`cb-sub cb-entra-suave mx-auto max-w-[min(920px,92vw)] text-center font-semibold leading-snug text-white ${
        grande ? "text-[19px] md:text-[24px]" : "text-[14px] md:text-[18px]"
      }`}
      aria-live="polite"
    >
      <span style={{ color: sub.color }} className="font-extrabold">
        {sub.nombre}:
      </span>{" "}
      {sub.texto}
      {sub.cita && <span className="ml-2 align-middle text-[0.62em] font-bold uppercase tracking-[0.14em] text-amber-200/90">cita</span>}
    </p>
  )
}

/** Aviso de juego arriba al centro ("Última hora", avisos de la simulación). */
export function Notificacion({ titulo, texto }: { titulo: string; texto: ReactNode }) {
  return (
    <div className={`cb-entra pointer-events-none mx-auto w-fit max-w-[min(560px,92vw)] rounded-[16px] px-5 py-3 text-center ${VIDRIO}`} role="status">
      <div className="cb-cond text-[11px] font-bold uppercase tracking-[0.28em] text-amber-300">{titulo}</div>
      <div className="mt-0.5 text-[13.5px] font-semibold text-white">{texto}</div>
    </div>
  )
}

type ModoUi = "dron" | "seguir" | "cine"

const CAMARAS: Array<{ id: ModoUi | "maqueta"; nombre: string; ayuda: string; Icono: typeof Plane }> = [
  { id: "dron", nombre: "Dron", ayuda: "Dron: vista libre. Arrastra para girar, pellizca o usa la rueda para acercar", Icono: Plane },
  { id: "seguir", nombre: "Seguir", ayuda: "Seguir: la cámara va detrás de un residente", Icono: Crosshair },
  { id: "cine", nombre: "Cine", ayuda: "Cine: tomas automáticas, listas para grabar", Icono: Film },
  { id: "maqueta", nombre: "Maqueta", ayuda: "Maqueta: efecto de miniatura", Icono: Box },
]

const VELOCIDADES = [1, 4, 15]

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={titulo} className="flex shrink-0 items-center gap-0.5">
      {children}
    </div>
  )
}

const Separador = () => <span className="mx-1 h-6 w-px shrink-0 bg-white/12" aria-hidden />

export interface PropsDock {
  nivel: NivelId
  onNivel: (n: NivelId) => void
  /** El modo del motor ("dron", "seguir", "cine", "nivel"…); se marca el botón que coincida. */
  camara: string
  maqueta: boolean
  onCamara: (m: ModoUi | "maqueta") => void
  hayMaqueta: boolean
  pausa: boolean
  velocidad: number
  onPausa: () => void
  onVelocidad: (v: number) => void
  onMapa: () => void
  /** El mapa está abierto (el botón se marca). */
  mapaAbierto?: boolean
  onPersonajes: () => void
  onConsejo: () => void
  onNoticia: () => void
  onGrabar: () => void
  onObjetivos: () => void
  compacto: boolean
}

function PuntoGrabar() {
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0 items-center justify-center" aria-hidden>
      <span className="absolute h-2.5 w-2.5 rounded-full bg-red-500 motion-safe:animate-ping motion-safe:opacity-60" />
      <span className="relative h-2 w-2 rounded-full bg-red-500" />
    </span>
  )
}

/** "Dron" vale también para la vista libre de un nivel bajo tierra (modo "nivel" del motor). */
const camaraActiva = (p: PropsDock, id: ModoUi | "maqueta") =>
  id === "maqueta" ? p.maqueta : !p.maqueta && (p.camara === id || (id === "dron" && p.camara === "nivel"))

/** Cierra un menú desplegable al tocar afuera o con Escape. */
function useCerrarAfuera(abierto: boolean, cerrar: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cerrar()
    }
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar()
    }
    window.addEventListener("pointerdown", fuera)
    window.addEventListener("keydown", tecla)
    return () => {
      window.removeEventListener("pointerdown", fuera)
      window.removeEventListener("keydown", tecla)
    }
  }, [abierto, cerrar])
  return ref
}

/** La lista de los cinco niveles, de arriba hacia abajo, para el menú del selector. */
function MenuNiveles({ actual, onElegir }: { actual: NivelId; onElegir: (n: NivelId) => void }) {
  return (
    <div role="menu" aria-label="Niveles" className="flex flex-col gap-0.5">
      {ORDEN_NIVELES.map((n) => {
        const activo = n === actual
        return (
          <button
            key={n}
            type="button"
            role="menuitemradio"
            aria-checked={activo}
            onClick={() => onElegir(n)}
            className={`flex min-h-11 w-full items-center gap-3 rounded-[14px] px-3 text-left transition-colors ${FOCO} ${
              activo ? "bg-white text-black" : "text-white hover:bg-white/[0.08]"
            }`}
          >
            <span className={`cb-cond w-11 shrink-0 text-right text-[12px] font-bold tabular-nums ${activo ? "text-black/55" : "text-white/45"}`}>{profundidad(n)}</span>
            <span className="min-w-0">
              <span className="block text-[13px] font-bold leading-tight">{NIVEL_CORTO[n]}</span>
              <span className={`block truncate text-[11px] leading-tight ${activo ? "text-black/60" : "text-white/50"}`}>{NIVEL_CONTENIDO[n]}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * El selector de nivel: flecha arriba, el nombre del nivel actual (abre la
 * lista) y flecha abajo. `ancho`: en celular ocupa toda la fila.
 */
function SelectorNivel({ nivel, onNivel, ancho = false }: { nivel: NivelId; onNivel: (n: NivelId) => void; ancho?: boolean }) {
  const [abierto, setAbierto] = useState(false)
  const ref = useCerrarAfuera(abierto, () => setAbierto(false))
  const arriba = nivelVecino(nivel, -1)
  const abajo = nivelVecino(nivel, 1)
  const flecha = "grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/85 transition-colors hover:bg-white/[0.12] hover:text-white disabled:opacity-25 disabled:hover:bg-transparent"
  return (
    <div ref={ref} className={`relative flex items-center gap-0.5 ${ancho ? "w-full" : ""}`}>
      {abierto && (
        <div className={`cb-entra absolute bottom-full left-0 z-10 mb-3 w-[min(300px,calc(100vw-24px))] rounded-[20px] p-1.5 ${VIDRIO} bg-[rgba(9,11,15,0.9)]`}>
          <MenuNiveles
            actual={nivel}
            onElegir={(n) => {
              setAbierto(false)
              onNivel(n)
            }}
          />
        </div>
      )}
      <button type="button" onClick={() => arriba && onNivel(arriba)} disabled={!arriba} aria-label={arriba ? `Subir a ${NOMBRE_NIVEL[arriba]}` : "Ya estás en la superficie"} title={arriba ? `Subir: ${NIVEL_CORTO[arriba]}` : undefined} className={`${flecha} ${FOCO}`}>
        <ChevronUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label={`Nivel: ${NOMBRE_NIVEL[nivel]}. Cambiar de nivel`}
        title="Cambiar de nivel"
        className={`flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-full px-2.5 text-left transition-colors hover:bg-white/[0.1] ${FOCO} ${abierto ? "bg-white/[0.12]" : ""} ${ancho ? "justify-center" : "max-w-[230px]"}`}
      >
        <span className="cb-cond shrink-0 rounded-full bg-white/[0.12] px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-white/75">{profundidad(nivel)}</span>
        <span className="min-w-0 leading-none">
          <span className="block truncate text-[13px] font-extrabold text-white">{NIVEL_CORTO[nivel]}</span>
          <span className="mt-0.5 block truncate text-[10.5px] font-semibold text-white/55">{NIVEL_CONTENIDO[nivel]}</span>
        </span>
      </button>
      <button type="button" onClick={() => abajo && onNivel(abajo)} disabled={!abajo} aria-label={abajo ? `Bajar a ${NOMBRE_NIVEL[abajo]}` : "Ya estás en el nivel más profundo"} title={abajo ? `Bajar: ${NIVEL_CORTO[abajo]}` : undefined} className={`${flecha} ${FOCO}`}>
        <ChevronDown className="h-4 w-4" />
      </button>
    </div>
  )
}

/** El botón del mapa: el más visible de la botonera. */
function BotonMapa({ onClick, abierto }: { onClick: () => void; abierto?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={abierto || undefined}
      aria-label="Mapa: dónde está cada lugar y cómo llegar"
      title="Mapa: dónde está cada lugar y cómo llegar"
      className={`inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-extrabold tracking-[0.01em] transition-colors ${FOCO} ${
        abierto ? "bg-white text-black" : "bg-[#e3b866] text-[#17130c] shadow-[0_0_22px_-6px_rgba(227,184,102,0.9)] hover:bg-[#f0c97c]"
      }`}
    >
      <IconoMapa className="h-4 w-4 shrink-0" />
      Mapa
    </button>
  )
}

export function Dock(props: PropsDock) {
  if (props.compacto) return <DockCompacto {...props} />
  const ic = "h-3.5 w-3.5 shrink-0"
  const camarasVisibles = CAMARAS.filter((c) => c.id !== "maqueta" || props.hayMaqueta)
  // Las acciones llevan nombre desde 1360 px; más angosto, solo el ícono (el nombre queda en title y aria-label).
  const nombre = "hidden min-[1360px]:inline"
  return (
    <nav aria-label="Controles" className={`pointer-events-auto flex max-w-full items-center rounded-full px-1.5 py-1.5 ${VIDRIO}`}>
      <SelectorNivel nivel={props.nivel} onNivel={props.onNivel} />
      <Separador />
      <BotonMapa onClick={props.onMapa} abierto={props.mapaAbierto} />
      <Separador />
      <Grupo titulo="Cámara">
        {camarasVisibles.map((c) => (
          <Boton key={c.id} activo={camaraActiva(props, c.id)} onClick={() => props.onCamara(c.id)} etiqueta={c.ayuda} className="px-2.5">
            <c.Icono className={ic} />
            {c.nombre}
          </Boton>
        ))}
      </Grupo>
      <Separador />
      <MenuTiempo {...props} />
      <Separador />
      <Grupo titulo="Acciones">
        <Boton onClick={props.onPersonajes} etiqueta="Personajes: dónde está cada uno">
          <Users className={ic} />
          <span className={nombre}>Personajes</span>
        </Boton>
        <Boton onClick={props.onConsejo} etiqueta="Convocar al consejo">
          <Gavel className={ic} />
          <span className={nombre}>Consejo</span>
        </Boton>
        <Boton onClick={props.onNoticia} etiqueta="Dar una noticia">
          <Newspaper className={ic} />
          <span className={nombre}>Noticia</span>
        </Boton>
        <Boton onClick={props.onGrabar} etiqueta="Modo grabación 9:16" className="text-white">
          <PuntoGrabar />
          <span className={nombre}>Grabar</span>
        </Boton>
      </Grupo>
    </nav>
  )
}

/** Tiempo: un botón con la velocidad actual que abre pausa y velocidades. */
function MenuTiempo(props: PropsDock) {
  const [abierto, setAbierto] = useState(false)
  const ref = useCerrarAfuera(abierto, () => setAbierto(false))
  const ic = "h-3.5 w-3.5 shrink-0"
  return (
    <div ref={ref} className="relative">
      {abierto && (
        <div role="menu" aria-label="Tiempo" className={`cb-entra absolute bottom-full left-1/2 z-10 mb-3 flex -translate-x-1/2 gap-1 rounded-full p-1.5 ${VIDRIO} bg-[rgba(9,11,15,0.9)]`}>
          <Boton activo={props.pausa} onClick={props.onPausa} etiqueta={props.pausa ? "Reanudar el tiempo" : "Pausar el tiempo"} className="px-2.5">
            {props.pausa ? <Play className={ic} /> : <Pause className={ic} />}
          </Boton>
          {VELOCIDADES.map((v) => (
            <Boton key={v} activo={!props.pausa && props.velocidad === v} onClick={() => props.onVelocidad(v)} etiqueta={`Velocidad ${v}×`} className="cb-cond px-3 text-[13px]">
              {v}×
            </Boton>
          ))}
        </div>
      )}
      <Boton onClick={() => setAbierto((v) => !v)} activo={abierto} etiqueta={props.pausa ? "Tiempo en pausa: cambiar" : `Tiempo a ${props.velocidad}×: cambiar`} className="cb-cond px-2.5 text-[13px]">
        {props.pausa ? <Pause className={ic} /> : <Clock className={ic} />}
        {props.pausa ? "Pausa" : `${props.velocidad}×`}
      </Boton>
    </div>
  )
}

/**
 * En celular: arriba el selector de nivel a lo ancho; abajo Mapa, cámara,
 * personajes y "Más" (tiempo, objetivos, consejo, noticia y grabar).
 */
function DockCompacto(props: PropsDock) {
  const [menu, setMenu] = useState<"camara" | "mas" | null>(null)
  const ref = useCerrarAfuera(menu !== null, () => setMenu(null))
  const ic = "h-4 w-4 shrink-0"
  const cam = CAMARAS.find((c) => camaraActiva(props, c.id)) ?? CAMARAS[0]
  const cerrarY = (fn: () => void) => () => {
    fn()
    setMenu(null)
  }
  const alternar = (m: "camara" | "mas") => setMenu((x) => (x === m ? null : m))
  const fila = "flex w-full items-center rounded-full px-1 py-1"
  const item = "w-full justify-start px-4 text-[13px]"

  return (
    <div ref={ref} className="pointer-events-auto relative flex w-full max-w-[440px] flex-col gap-1.5">
      {menu && (
        <div className={`cb-entra absolute bottom-full left-0 right-0 mb-2 rounded-[22px] p-1.5 ${VIDRIO} bg-[rgba(9,11,15,0.9)]`} role="menu">
          {menu === "camara" &&
            CAMARAS.filter((c) => c.id !== "maqueta" || props.hayMaqueta).map((c) => (
              <Boton key={c.id} activo={c.id === cam.id} onClick={cerrarY(() => props.onCamara(c.id))} className={`${item} min-h-11`}>
                <c.Icono className={ic} />
                <span className="flex min-w-0 flex-col items-start leading-tight">
                  <span className="font-bold">{c.nombre}</span>
                  <span className="truncate text-[11px] font-medium opacity-60">{c.ayuda.split(": ")[1]}</span>
                </span>
              </Boton>
            ))}
          {menu === "mas" && (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between gap-1 px-2 py-1">
                <span className="text-[12px] font-semibold text-white/55">Tiempo</span>
                <div className="flex gap-1">
                  <Boton activo={props.pausa} onClick={props.onPausa} etiqueta={props.pausa ? "Reanudar el tiempo" : "Pausar el tiempo"} className="px-3">
                    {props.pausa ? <Play className={ic} /> : <Pause className={ic} />}
                  </Boton>
                  {VELOCIDADES.map((v) => (
                    <Boton key={v} activo={!props.pausa && props.velocidad === v} onClick={() => props.onVelocidad(v)} etiqueta={`Velocidad ${v}×`} className="cb-cond px-3 text-[14px]">
                      {v}×
                    </Boton>
                  ))}
                </div>
              </div>
              <Boton onClick={cerrarY(props.onObjetivos)} className={item}>
                <Target className={ic} /> Objetivos y lo que está en marcha
              </Boton>
              <Boton onClick={cerrarY(props.onConsejo)} className={item}>
                <Gavel className={ic} /> Convocar al consejo
              </Boton>
              <Boton onClick={cerrarY(props.onNoticia)} className={item}>
                <Newspaper className={ic} /> Dar una noticia
              </Boton>
              <Boton onClick={cerrarY(props.onGrabar)} className={item}>
                <PuntoGrabar /> Grabar (9:16)
              </Boton>
            </div>
          )}
        </div>
      )}
      <div className={`${fila} ${VIDRIO}`}>
        <SelectorNivel nivel={props.nivel} onNivel={props.onNivel} ancho />
      </div>
      <nav aria-label="Controles" className={`${fila} justify-between gap-1 ${VIDRIO}`}>
        <BotonMapa onClick={props.onMapa} abierto={props.mapaAbierto} />
        <Boton onClick={() => alternar("camara")} activo={menu === "camara"} etiqueta={`Cámara: ${cam.nombre}. Cambiar`} className="px-3 text-[12.5px]">
          <cam.Icono className={ic} />
          {cam.nombre}
          <ChevronUp className="h-3 w-3 opacity-60" />
        </Boton>
        <Boton onClick={props.onPersonajes} etiqueta="Personajes: dónde está cada uno" className="px-3 text-[12.5px]">
          <Users className={ic} />
          Personajes
        </Boton>
        <Boton onClick={() => alternar("mas")} activo={menu === "mas"} etiqueta="Más: tiempo, objetivos, consejo, noticia y grabar" className="px-2.5">
          <MoreHorizontal className={ic} />
        </Boton>
      </nav>
    </div>
  )
}
