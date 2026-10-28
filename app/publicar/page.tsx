"use client"

import { useRef, useState } from "react"
import { AlertTriangle, CalendarDays, Check, ExternalLink, Loader2, Lock, RefreshCw, Send } from "lucide-react"

// ──────────────────────────────────────────────────────────────
// /publicar — una pieza, Instagram y Facebook a la vez, en la cuenta de Kev o
// en la de La Casa Blanca Project.
//
// La clave no se guarda: vive en memoria mientras la pestaña está abierta,
// igual que en /control. Los tokens de Meta nunca pasan por aquí: viven en
// Vercel y los usa el servidor.
// ──────────────────────────────────────────────────────────────

type Resultado = { ok: true; id: string; enlace?: string } | { ok: false; error: string; pendiente?: string }
type Red = "ig" | "fb"
type Cuenta = "kev" | "casa-blanca"
type Entrada = {
  id: string
  fecha: string
  hora: string
  titulo: string
  formato: string
  segundos: number
  redes: string[]
  pilar: string
  texto: string
  url: string
}

const RED = { ig: "Instagram", fb: "Facebook" } as const
const CUENTA: Record<Cuenta, string> = { kev: "Kev", "casa-blanca": "La Casa Blanca Project" }
// Cada vuelta espera hasta 45 s en el servidor: 8 vueltas ≈ 6 minutos.
const VUELTAS = 8
// Tras un corte de red, el pedido anterior sigue corriendo en el servidor
// (hasta 55 s). Se espera a que termine: dos a la vez sobre el mismo reel
// podrían publicarlo dos veces.
const ESPERA_TRAS_CORTE_MS = 55_000
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** "2026-10-30" → "jue 30 oct". La fecha es un día, no un instante: va en UTC. */
const dia = (f: string) =>
  new Date(`${f}T12:00:00Z`).toLocaleDateString("es-BO", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
/** Hoy en Bolivia (UTC−4), como "2026-10-30". */
const hoyBolivia = () => new Date(Date.now() - 4 * 3_600_000).toISOString().slice(0, 10)
const duracion = (s: number) => (s >= 60 ? `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s` : `${s} s`)

export default function PublicarPage() {
  const [clave, setClave] = useState("")
  const [cuenta, setCuenta] = useState<Cuenta>("kev")
  const [tipo, setTipo] = useState<"video" | "foto">("video")
  const [url, setUrl] = useState("")
  const [texto, setTexto] = useState("")
  const [destinos, setDestinos] = useState<Record<Red, boolean>>({ ig: true, fb: true })
  const [estado, setEstado] = useState<"quieto" | "enviando" | "procesando" | "listo" | "error">("quieto")
  const [error, setError] = useState("")
  const [resultado, setResultado] = useState<Partial<Record<Red, Resultado>>>({})
  // La cuenta en la que se publicó lo que muestra `resultado`: "Revisar de nuevo"
  // va a ESA cuenta, no a la que esté elegida ahora.
  const [cuentaResultado, setCuentaResultado] = useState<Cuenta>("kev")
  // Sube con cada cambio de cuenta: una respuesta que llega después de cambiar
  // pertenece a la otra cuenta y no se escribe en esta pantalla.
  const vez = useRef(0)

  const [cal, setCal] = useState<{ estado: "nada" | "cargando" | "listo" | "error"; entradas: Entrada[]; falta: string | null; error: string }>(
    { estado: "nada", entradas: [], falta: null, error: "" },
  )
  const [elegido, setElegido] = useState<string | null>(null)

  const ocupado = estado === "enviando" || estado === "procesando"
  // Con un reel en proceso no se publica otro (saldría repetido cuando termine
  // el primero) ni se cambia de cuenta (el reel es de la cuenta en que se pidió).
  const hayPendiente = Object.values(resultado).some((r) => r && !r.ok && r.pendiente)
  const cabeceras = { "Content-Type": "application/json", authorization: `Bearer ${clave}` }

  const cargarCalendario = async (c: Cuenta) => {
    if (!clave) return
    const v = vez.current
    setCal((x) => ({ ...x, estado: "cargando", error: "" }))
    try {
      const r = await fetch(`/api/publicar?cuenta=${c}`, { headers: cabeceras, cache: "no-store" })
      const j = await r.json().catch(() => ({}))
      if (v !== vez.current) return
      if (!r.ok) {
        setCal({ estado: "error", entradas: [], falta: null, error: j.error || "No se pudo leer el calendario." })
        return
      }
      setCal({ estado: "listo", entradas: j.calendario ?? [], falta: j.falta ?? null, error: "" })
    } catch {
      if (v !== vez.current) return
      setCal({ estado: "error", entradas: [], falta: null, error: "Error de red. Revisa tu conexión." })
    }
  }

  const cambiarCuenta = (c: Cuenta) => {
    // Con algo publicándose o en proceso no se cambia: el botón ya está apagado.
    if (c === cuenta || ocupado || hayPendiente) return
    vez.current++
    setCuenta(c)
    setResultado({})
    setError("")
    setEstado("quieto")
    // Lo escrito para una cuenta no pasa a la otra.
    setUrl("")
    setTexto("")
    setDestinos({ ig: true, fb: true })
    setElegido(null)
    setCal({ estado: "nada", entradas: [], falta: null, error: "" })
    if (c === "casa-blanca") cargarCalendario(c)
  }

  const elegir = (e: Entrada) => {
    setElegido(e.id)
    setTipo("video")
    setUrl(e.url)
    setTexto(e.texto)
    // Las redes son las del calendario. Si no va a ninguna de las dos, quedan
    // apagadas y Publicar también, hasta que Kev marque una a mano.
    setDestinos({ ig: e.redes.includes("instagram"), fb: e.redes.includes("facebook") })
  }

  // Un reel que Instagram sigue procesando: se vuelve a mirar hasta que sale.
  const seguir = async (contenedor: string, c: Cuenta) => {
    const v = vez.current
    setEstado("procesando")
    for (let i = 0; i < VUELTAS; i++) {
      try {
        const r = await fetch("/api/publicar", {
          method: "POST",
          headers: cabeceras,
          body: JSON.stringify({ accion: "continuar", cuenta: c, contenedor }),
        })
        const j = await r.json().catch(() => ({}))
        if (v !== vez.current) return
        const ig: Resultado | undefined = j.resultado?.ig
        if (!ig) {
          setEstado("error")
          setError(j.error || "No se pudo revisar el video en Instagram.")
          return
        }
        setResultado((x) => ({ ...x, ig }))
        if (ig.ok || !ig.pendiente) {
          setEstado(ig.ok ? "listo" : "error")
          return
        }
      } catch {
        // Un corte de red no cambia lo que pasa en Meta: se vuelve a mirar,
        // pero después de que termine el pedido que se cortó.
        await dormir(ESPERA_TRAS_CORTE_MS)
        if (v !== vez.current) return
      }
    }
    setEstado("listo")
  }

  const enviar = async () => {
    const v = vez.current
    const c = cuenta
    setEstado("enviando")
    setError("")
    setResultado({})
    setCuentaResultado(c)
    try {
      const r = await fetch("/api/publicar", {
        method: "POST",
        headers: cabeceras,
        body: JSON.stringify({
          cuenta: c,
          tipo,
          url,
          texto,
          destinos: (Object.keys(destinos) as Red[]).filter((d) => destinos[d]),
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (v !== vez.current) return
      const res: Partial<Record<Red, Resultado>> = j.resultado ?? {}
      setResultado(res)
      if (!r.ok && !j.resultado) {
        setEstado("error")
        setError(j.error || "No se pudo publicar.")
        return
      }
      const ig = res.ig
      if (ig && !ig.ok && ig.pendiente) return seguir(ig.pendiente, c)
      setEstado(r.ok ? "listo" : "error")
    } catch {
      if (v !== vez.current) return
      setEstado("error")
      setError("Error de red. Revisa tu conexión.")
    }
  }

  const listo = clave && url && (destinos.ig || destinos.fb) && !ocupado && !hayPendiente
  // 16 px: en el teléfono, iOS hace zoom en campos más chicos.
  const campo =
    "w-full rounded-lg border border-border bg-foreground/[0.04] px-4 py-2.5 text-base outline-none transition-colors focus:border-foreground/30"
  const etiqueta = "mb-1.5 block text-[11px] uppercase tracking-wider text-muted-foreground"
  const opcion = (activo: boolean) =>
    `flex-1 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
      activo ? "border-foreground/40 bg-foreground/[0.07] font-semibold" : "border-border text-muted-foreground"
    }`
  const hoy = hoyBolivia()

  return (
    <div className="flex min-h-screen items-start justify-center overflow-x-hidden bg-background px-4 py-6 text-foreground sm:items-center sm:p-6">
      <div className="glass-card w-full min-w-0 max-w-md p-5 sm:p-7">
        <div className="mb-1 flex items-center gap-2 text-muted-foreground">
          <Lock className="h-3.5 w-3.5" strokeWidth={1.5} />
          <span className="text-[11px] uppercase tracking-[0.18em]">Privado</span>
        </div>
        <h1 className="mb-6 text-xl font-medium tracking-tight">Publicar</h1>

        <label className={etiqueta}>Clave</label>
        <input
          type="password"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          onBlur={() => cuenta === "casa-blanca" && cal.estado !== "listo" && cargarCalendario(cuenta)}
          placeholder="ADMIN_SECRET"
          className={`${campo} mb-4`}
        />

        <span className={etiqueta}>Cuenta</span>
        <div className="mb-4 flex gap-2">
          {(["kev", "casa-blanca"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => cambiarCuenta(c)}
              aria-pressed={cuenta === c}
              disabled={cuenta !== c && (ocupado || hayPendiente)}
              className={`${opcion(cuenta === c)} disabled:opacity-40`}
            >
              {CUENTA[c]}
            </button>
          ))}
        </div>
        {(ocupado || hayPendiente) && (
          <p className="-mt-2 mb-4 text-[11.5px] leading-snug text-muted-foreground">
            Para cambiar de cuenta, espera a que termine lo que se publica en {CUENTA[cuentaResultado]}.
          </p>
        )}

        {cuenta === "casa-blanca" && (
          <div className="mb-5 rounded-lg border border-border p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" /> Calendario
              </span>
              <button
                type="button"
                onClick={() => cargarCalendario(cuenta)}
                disabled={!clave || cal.estado === "cargando"}
                className="flex items-center gap-1 text-[12px] text-muted-foreground underline disabled:no-underline disabled:opacity-40"
              >
                <RefreshCw className={`h-3 w-3 ${cal.estado === "cargando" ? "animate-spin" : ""}`} /> Cargar
              </button>
            </div>

            {!clave && <p className="text-[12.5px] text-muted-foreground">Escribe la clave para ver el calendario.</p>}
            {cal.estado === "error" && <p className="text-[12.5px] text-destructive">{cal.error}</p>}
            {cal.falta && (
              <p className="mb-2 flex items-start gap-1.5 text-[12.5px] text-destructive">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Cuenta sin conectar: falta {cal.falta} en Vercel.
              </p>
            )}
            {cal.estado === "listo" && cal.entradas.length === 0 && (
              <p className="text-[12.5px] text-muted-foreground">Todavía no hay videos en el calendario.</p>
            )}

            {cal.entradas.length > 0 && (
              <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
                {cal.entradas.map((e) => {
                  const pasado = e.fecha < hoy
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => elegir(e)}
                        aria-pressed={elegido === e.id}
                        className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                          elegido === e.id ? "border-foreground/40 bg-foreground/[0.07]" : "border-border"
                        } ${pasado ? "opacity-55" : ""}`}
                      >
                        <span className="block text-[11.5px] text-muted-foreground">
                          {dia(e.fecha)} · {e.hora}
                          {e.fecha === hoy && <span className="ml-1.5 font-semibold text-foreground">hoy</span>}
                        </span>
                        <span className="block break-words text-sm font-medium">{e.titulo}</span>
                        <span className="block text-[11.5px] text-muted-foreground">
                          {e.formato} · {duracion(e.segundos)}
                          {!e.redes.includes("instagram") && !e.redes.includes("facebook") && " · no va a Instagram ni Facebook"}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            <p className="mt-2.5 text-[11.5px] leading-snug text-muted-foreground">
              Meta descarga el video desde <span className="break-all">kevproject.world/casa-blanca/videos/</span>: el archivo
              tiene que estar publicado en la web antes de tocar Publicar.
            </p>
          </div>
        )}

        <span className={etiqueta}>Qué es</span>
        <div className="mb-4 flex gap-2">
          {(["video", "foto"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTipo(t)} aria-pressed={tipo === t} className={opcion(tipo === t)}>
              {t === "video" ? "Video (reel)" : "Foto"}
            </button>
          ))}
        </div>

        <label className={etiqueta}>Dirección pública del archivo</label>
        <input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            setElegido(null)
          }}
          placeholder="https://…"
          inputMode="url"
          className={`${campo} mb-1.5`}
        />
        <p className="mb-4 text-[11.5px] leading-snug text-muted-foreground">
          Meta va a buscar el archivo a esa dirección: tiene que abrirse sin iniciar sesión.
          {/^https:\/\//i.test(url) && (
            <>
              {" "}
              <a href={url} target="_blank" rel="noopener" className="inline-flex items-center gap-0.5 underline">
                Comprobar <ExternalLink className="h-3 w-3" />
              </a>
            </>
          )}
        </p>

        <label className={etiqueta}>
          Texto <span className="normal-case tracking-normal">· {texto.length}/2.200</span>
        </label>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={5} maxLength={2200} className={`${campo} mb-4 resize-y`} />

        <span className={etiqueta}>Dónde</span>
        <div className="mb-6 flex gap-4">
          {(["ig", "fb"] as const).map((d) => (
            <label key={d} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={destinos[d]} onChange={(e) => setDestinos((x) => ({ ...x, [d]: e.target.checked }))} />
              {RED[d]}
            </label>
          ))}
        </div>

        <button
          type="button"
          onClick={enviar}
          disabled={!listo}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-foreground py-3 text-sm font-medium text-background transition-opacity disabled:opacity-40"
        >
          {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {estado === "enviando"
            ? tipo === "video"
              ? "Publicando · un video tarda hasta un minuto"
              : "Publicando…"
            : estado === "procesando"
              ? "Instagram procesa el video…"
              : `Publicar en ${CUENTA[cuenta]}`}
        </button>

        {error && (
          <p className="mt-4 flex items-start gap-2 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </p>
        )}

        {(Object.keys(resultado) as Red[]).map((d) => {
          const r = resultado[d]
          if (!r) return null
          const pendiente = !r.ok && r.pendiente
          return (
            <div
              key={d}
              className={`mt-3 rounded-lg border px-3 py-2.5 text-sm ${
                r.ok ? "border-kev-success/40" : pendiente ? "border-border" : "border-destructive/40"
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                {r.ok ? (
                  <Check className="h-4 w-4 text-kev-success" />
                ) : pendiente ? (
                  <Loader2 className={`h-4 w-4 ${estado === "procesando" ? "animate-spin" : ""}`} />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                )}
                {RED[d]}: {r.ok ? "publicado" : pendiente ? "en proceso" : "no salió"}
              </div>
              {r.ok && r.enlace && (
                <a href={r.enlace} target="_blank" rel="noopener" className="mt-1 inline-flex items-center gap-1 text-[12.5px] text-muted-foreground underline">
                  Ver la publicación <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {!r.ok && <p className="mt-1 break-words text-[12.5px] text-muted-foreground">{r.error}</p>}
              {pendiente && estado !== "procesando" && (
                <button
                  type="button"
                  onClick={() => seguir(r.pendiente!, cuentaResultado)}
                  className="mt-2 inline-flex items-center gap-1 text-[12.5px] underline"
                >
                  <RefreshCw className="h-3 w-3" /> Revisar de nuevo
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
