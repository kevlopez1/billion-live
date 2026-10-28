"use client"

// ──────────────────────────────────────────────────────────────
// El HUD fijo, estilo GTA V: la marca arriba a la izquierda, el dinero real
// arriba a la derecha (RECAUDADO, nunca un número escrito aquí), los
// subtítulos abajo al centro y la botonera abajo.
// ──────────────────────────────────────────────────────────────

import { useState, type ReactNode } from "react"
import { Box, Crosshair, Film, Info, Newspaper, Pause, Play, Plane, Target, Users, Gavel } from "lucide-react"
import { CHALLENGE_TARGET, RECAUDADO } from "@/lib/contador"
import { NOMBRE_NIVEL, type NivelId } from "../tipos"
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

const NIVELES: Array<{ id: NivelId; corto: string; largo: string }> = [
  { id: "superficie", corto: "Sup.", largo: "Superficie" },
  { id: "n1", corto: "S1", largo: "Subsuelo 1" },
  { id: "n2", corto: "S2", largo: "Subsuelo 2" },
  { id: "n3", corto: "S3", largo: "Subsuelo 3" },
]

const CAMARAS: Array<{ id: ModoUi | "maqueta"; nombre: string; etiqueta: string; Icono: typeof Plane }> = [
  { id: "dron", nombre: "Dron", etiqueta: "Cámara dron", Icono: Plane },
  { id: "seguir", nombre: "Seguir", etiqueta: "Seguir al personaje elegido", Icono: Crosshair },
  { id: "cine", nombre: "Cine", etiqueta: "Cámara de cine", Icono: Film },
  { id: "maqueta", nombre: "Maqueta", etiqueta: "Modo maqueta", Icono: Box },
]

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
  camara: ModoUi
  maqueta: boolean
  onCamara: (m: ModoUi | "maqueta") => void
  hayMaqueta: boolean
  pausa: boolean
  velocidad: number
  onPausa: () => void
  onVelocidad: (v: number) => void
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

export function Dock(props: PropsDock) {
  if (props.compacto) return <DockCompacto {...props} />
  // En pantallas medianas la cámara va en iconos; los títulos (title/aria) siempre están.
  const medio = "hidden min-[1400px]:inline"
  const ic = "h-3.5 w-3.5 shrink-0"
  const camarasVisibles = CAMARAS.filter((c) => c.id !== "maqueta" || props.hayMaqueta)
  const activa = (id: ModoUi | "maqueta") => (id === "maqueta" ? props.maqueta : props.camara === id && !props.maqueta)
  return (
    <nav aria-label="Controles" className={`pointer-events-auto flex max-w-full items-center overflow-x-auto rounded-full px-1.5 py-1.5 [scrollbar-width:none] ${VIDRIO}`}>
      <Grupo titulo="Nivel">
        {NIVELES.map((n) => (
          <Boton key={n.id} activo={props.nivel === n.id} onClick={() => props.onNivel(n.id)} etiqueta={NOMBRE_NIVEL[n.id]} className="px-2.5">
            {n.id === "superficie" ? (
              <>
                <span className="min-[1400px]:hidden">{n.corto}</span>
                <span className="hidden min-[1400px]:inline">{n.largo}</span>
              </>
            ) : (
              n.corto
            )}
          </Boton>
        ))}
      </Grupo>
      <Separador />
      <Grupo titulo="Cámara">
        {camarasVisibles.map((c) => (
          <Boton key={c.id} activo={activa(c.id)} onClick={() => props.onCamara(c.id)} etiqueta={c.etiqueta}>
            <c.Icono className={ic} />
            <span className={medio}>{c.nombre}</span>
          </Boton>
        ))}
      </Grupo>
      <Separador />
      <Grupo titulo="Tiempo">
        <Boton activo={props.pausa} onClick={props.onPausa} etiqueta={props.pausa ? "Reanudar el tiempo" : "Pausar el tiempo"} className="px-2.5">
          {props.pausa ? <Play className={ic} /> : <Pause className={ic} />}
        </Boton>
        {[1, 4, 15].map((v) => (
          <Boton key={v} activo={!props.pausa && props.velocidad === v} onClick={() => props.onVelocidad(v)} etiqueta={`Velocidad ${v}×`} className="cb-cond px-2.5 text-[13px]">
            {v}×
          </Boton>
        ))}
      </Grupo>
      <Separador />
      <Grupo titulo="Acciones">
        <Boton onClick={props.onPersonajes} etiqueta="Elegir personaje">
          <Users className={ic} />
          Personajes
        </Boton>
        <Boton onClick={props.onConsejo} etiqueta="Convocar al consejo">
          <Gavel className={ic} />
          Consejo
        </Boton>
        <Boton onClick={props.onNoticia} etiqueta="Dar una noticia">
          <Newspaper className={ic} />
          Noticia
        </Boton>
        <Boton onClick={props.onGrabar} etiqueta="Modo grabación 9:16" className="text-white">
          <PuntoGrabar />
          Grabar
        </Boton>
      </Grupo>
    </nav>
  )
}

/**
 * En celular, nivel, cámara y tiempo son menús que se abren hacia arriba:
 * así toda la botonera entra en 360 px sin scroll horizontal.
 */
function DockCompacto(props: PropsDock) {
  const [menu, setMenu] = useState<"nivel" | "camara" | "tiempo" | null>(null)
  const ic = "h-4 w-4 shrink-0"
  const cam = props.maqueta ? CAMARAS[3] : CAMARAS.find((c) => c.id === props.camara) ?? CAMARAS[0]
  const nivelCorto = NIVELES.find((n) => n.id === props.nivel)?.corto ?? "Sup."
  const cerrarY = (fn: () => void) => () => {
    fn()
    setMenu(null)
  }
  const alternar = (m: "nivel" | "camara" | "tiempo") => setMenu((x) => (x === m ? null : m))

  return (
    <div className="pointer-events-auto relative w-full max-w-[420px]">
      {menu && (
        <div className={`cb-entra absolute bottom-full left-0 right-0 mb-2 rounded-[22px] p-1.5 ${VIDRIO} bg-[rgba(9,11,15,0.86)]`} role="menu">
          {menu === "nivel" &&
            NIVELES.map((n) => (
              <Boton key={n.id} activo={props.nivel === n.id} onClick={cerrarY(() => props.onNivel(n.id))} className="w-full justify-start px-4">
                {NOMBRE_NIVEL[n.id]}
              </Boton>
            ))}
          {menu === "camara" &&
            CAMARAS.filter((c) => c.id !== "maqueta" || props.hayMaqueta).map((c) => (
              <Boton key={c.id} activo={c.id === cam.id} onClick={cerrarY(() => props.onCamara(c.id))} className="w-full justify-start px-4">
                <c.Icono className={ic} /> {c.nombre}
              </Boton>
            ))}
          {menu === "tiempo" && (
            <div className="grid grid-cols-4 gap-1">
              <Boton activo={props.pausa} onClick={cerrarY(props.onPausa)} etiqueta={props.pausa ? "Reanudar el tiempo" : "Pausar el tiempo"}>
                {props.pausa ? <Play className={ic} /> : <Pause className={ic} />}
              </Boton>
              {[1, 4, 15].map((v) => (
                <Boton key={v} activo={!props.pausa && props.velocidad === v} onClick={cerrarY(() => props.onVelocidad(v))} etiqueta={`Velocidad ${v}×`} className="cb-cond text-[14px]">
                  {v}×
                </Boton>
              ))}
            </div>
          )}
        </div>
      )}
      <nav aria-label="Controles" className={`flex w-full items-center justify-between rounded-full px-1 py-1 ${VIDRIO}`}>
        <Boton onClick={() => alternar("nivel")} activo={menu === "nivel"} etiqueta={`Nivel: ${NOMBRE_NIVEL[props.nivel]}`} className="cb-cond px-2.5 text-[13px]">
          {nivelCorto}
        </Boton>
        <Boton onClick={() => alternar("camara")} activo={menu === "camara"} etiqueta={`Cámara: ${cam.nombre}`} className="px-2.5">
          <cam.Icono className={ic} />
        </Boton>
        <Boton onClick={() => alternar("tiempo")} activo={menu === "tiempo"} etiqueta={props.pausa ? "Tiempo en pausa" : `Velocidad ${props.velocidad}×`} className="cb-cond px-2.5 text-[13px]">
          {props.pausa ? <Pause className={ic} /> : `${props.velocidad}×`}
        </Boton>
        <span className="mx-0.5 h-6 w-px shrink-0 bg-white/12" aria-hidden />
        <Boton onClick={props.onPersonajes} etiqueta="Elegir personaje" className="px-2.5">
          <Users className={ic} />
        </Boton>
        <Boton onClick={props.onObjetivos} etiqueta="Objetivos y lo que está en marcha" className="px-2.5">
          <Target className={ic} />
        </Boton>
        <Boton onClick={props.onConsejo} etiqueta="Convocar al consejo" className="px-2.5">
          <Gavel className={ic} />
        </Boton>
        <Boton onClick={props.onNoticia} etiqueta="Dar una noticia" className="px-2.5">
          <Newspaper className={ic} />
        </Boton>
        <Boton onClick={props.onGrabar} etiqueta="Modo grabación 9:16" className="px-2.5">
          <PuntoGrabar />
        </Boton>
      </nav>
    </div>
  )
}
