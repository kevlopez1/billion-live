"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { PenLine, Loader2, Check, ArrowUpRight } from "lucide-react"
import {
  BODY_PATH,
  CELL,
  PIXEL_PRICE,
  SLOTS,
  SUELO,
  TOTAL_PIXELS,
  TOTAL_VALUE,
  VIDRIO_PATH,
  VIEW_H,
  VIEW_W,
  type Slot,
} from "@/lib/car-grid"
import { EV, track } from "@/lib/track"

// WhatsApp de Kev para pagar (el mismo de las firmas).
const WA_KEV = "59174234380"

type Celda = { x: number; y: number; name: string }
type Estado = {
  configured: boolean
  cells: Celda[]
  slots: Record<string, { name: string; link: string | null }>
  total_pixels: number
  total_value: number
  pixel_price: number
  sold_pixels: number
  sold_usd: number
}

type Compra = { kind: "pixel"; qty: number } | { kind: "slot"; slot: Slot }

const PACKS = [1, 5, 10, 25]

export function AutoPixeles() {
  const [est, setEst] = useState<Estado | null>(null)
  const [compra, setCompra] = useState<Compra | null>(null)
  const [name, setName] = useState("")
  const [message, setMessage] = useState("")
  const [link, setLink] = useState("")
  const [whatsapp, setWhatsapp] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [listo, setListo] = useState<{ code: string; price: number } | null>(null)
  // Qué parte está resaltada. En el celular el auto es chico: el que manda es
  // el listado de tarjetas de abajo, y tocar una prende la zona en el dibujo.
  const [mirando, setMirando] = useState<string | null>(null)

  // Estado seguro: lo que se muestra si la API no responde o responde otra cosa.
  // Sin esto, un {error} del servidor dejaba a `est` sin `cells`/`slots` y el
  // render tiraba una excepción que se llevaba TODA la web puesta.
  const VACIO: Estado = {
    configured: false,
    cells: [],
    slots: {},
    total_pixels: TOTAL_PIXELS,
    total_value: TOTAL_VALUE,
    pixel_price: PIXEL_PRICE,
    sold_pixels: 0,
    sold_usd: 0,
  }

  const normalizar = (d: unknown): Estado => {
    const o = (d ?? {}) as Partial<Estado>
    return {
      configured: o.configured === true,
      cells: Array.isArray(o.cells) ? o.cells : [],
      slots: o.slots && typeof o.slots === "object" ? o.slots : {},
      total_pixels: typeof o.total_pixels === "number" ? o.total_pixels : TOTAL_PIXELS,
      total_value: typeof o.total_value === "number" ? o.total_value : TOTAL_VALUE,
      pixel_price: typeof o.pixel_price === "number" ? o.pixel_price : PIXEL_PRICE,
      sold_pixels: typeof o.sold_pixels === "number" ? o.sold_pixels : 0,
      sold_usd: typeof o.sold_usd === "number" ? o.sold_usd : 0,
    }
  }

  const cargar = () =>
    fetch("/api/pixels", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setEst(normalizar(d)))
      .catch(() => setEst(VACIO))

  useEffect(() => {
    cargar()
  }, [])

  const precio = compra ? (compra.kind === "pixel" ? compra.qty * (est?.pixel_price ?? 10) : compra.slot.price) : 0

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (enviando || !compra) return
    if (!name.trim()) return toast.error("Poné tu nombre o el de tu marca.")
    setEnviando(true)
    try {
      const res = await fetch("/api/pixels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: compra.kind,
          qty: compra.kind === "pixel" ? compra.qty : undefined,
          slot_id: compra.kind === "slot" ? compra.slot.id : undefined,
          name,
          message,
          link,
          whatsapp,
        }),
      })
      const data = await res.json()
      if (!res.ok) return toast.error(data.error ?? "No se pudo reservar.")
      track(EV.PIXEL_RESERVA, { tipo: compra.kind, monto: data.price })
      setListo({ code: data.code, price: data.price })
      cargar()
    } catch {
      toast.error("Falló la conexión. Probá de nuevo.")
    } finally {
      setEnviando(false)
    }
  }

  const cerrar = () => {
    setCompra(null)
    setListo(null)
    setName("")
    setMessage("")
    setLink("")
    setWhatsapp("")
  }

  const pct = est && est.total_pixels ? (est.sold_pixels / est.total_pixels) * 100 : 0

  return (
    <div>
      {/* ── El auto ──
          El arte va en ESTE bloque y en ningún otro: el día que entre un render
          en vez del vector, se cambia acá adentro y las zonas, los precios y la
          compra siguen funcionando igual. */}
      <div className="rounded-3xl border border-border bg-card/40 p-3 md:p-7">
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full h-auto" role="img"
          aria-label="El Mercedes del reto, con las partes que se pueden comprar">
          <defs>
            <clipPath id="carroceria">
              <path d={BODY_PATH} />
            </clipPath>
          </defs>

          {/* El suelo asienta el auto: sin esto parece que flota */}
          <line x1={30} y1={SUELO} x2={VIEW_W - 30} y2={SUELO}
            stroke="var(--foreground)" strokeWidth={1} opacity={0.16} />

          {/* Ruedas: van detrás del cuerpo para que el arco las recorte */}
          {SLOTS.filter((s) => s.forma.tipo === "circulo").map((s) => {
            const f = s.forma as { tipo: "circulo"; cx: number; cy: number; r: number }
            const dueño = est?.slots?.[s.id]
            const activa = mirando === s.id
            return (
              <g key={s.id} onClick={() => setMirando(activa ? null : s.id)} className="cursor-pointer">
                {/* El neumático va en negro FIJO, no en un token del tema: una
                    goma es negra con luz y con sombra, y con var(--kev-primary)
                    quedaban dos platos blancos en el tema oscuro. */}
                <circle cx={f.cx} cy={f.cy} r={f.r} fill="#151a24" />
                <circle cx={f.cx} cy={f.cy} r={f.r} fill="none" stroke="var(--gold)"
                  strokeWidth={dueño || activa ? 3 : 1.5}
                  strokeDasharray={dueño ? undefined : "7 5"}
                  opacity={dueño || activa ? 1 : 0.55} />
                <circle cx={f.cx} cy={f.cy} r={f.r * 0.52} fill="var(--gold)"
                  opacity={dueño ? 0.32 : 0.16} />
                <circle cx={f.cx} cy={f.cy} r={f.r * 0.52} fill="none" stroke="var(--gold)"
                  strokeWidth={1} opacity={0.4} />
              </g>
            )
          })}

          {/* Carrocería vacía: la silueta tenue que se va llenando */}
          <path d={BODY_PATH} fill="var(--muted)" opacity={0.75} />

          <g clipPath="url(#carroceria)">
            {/* Las firmas de $10, encendidas de la trompa hacia atrás */}
            {(est?.cells ?? []).map((c) => (
              <rect key={`${c.x}-${c.y}`} x={c.x * CELL} y={c.y * CELL}
                width={CELL - 0.7} height={CELL - 0.7} rx={1} fill="var(--gold)" opacity={0.95} />
            ))}

            {/* Las partes con nombre. Recortadas contra la silueta: una región
                rectangular simple sigue exactamente la forma del auto. */}
            {SLOTS.filter((s) => s.forma.tipo === "zona").map((s) => {
              const f = s.forma as { tipo: "zona"; x: number; y: number; w: number; h: number }
              const dueño = est?.slots?.[s.id]
              const activa = mirando === s.id
              return (
                <g key={s.id} onClick={() => setMirando(activa ? null : s.id)} className="cursor-pointer">
                  <rect x={f.x} y={f.y} width={f.w} height={f.h} rx={3} fill="var(--gold)"
                    opacity={dueño ? 0.5 : activa ? 0.3 : 0.12} />
                  <rect x={f.x} y={f.y} width={f.w} height={f.h} rx={3} fill="none" stroke="var(--gold)"
                    strokeWidth={dueño || activa ? 2.5 : 1.4}
                    strokeDasharray={dueño ? undefined : "7 5"}
                    opacity={dueño || activa ? 1 : 0.6} />
                </g>
              )
            })}
          </g>

          {/* El vidrio no se vende: se dibuja encima para que se lea "auto" */}
          <path d={VIDRIO_PATH} fill="var(--foreground)" opacity={0.28} />

          {/* Contorno por encima de todo */}
          <path d={BODY_PATH} fill="none" stroke="var(--foreground)" strokeWidth={2.5}
            opacity={0.55} strokeLinejoin="round" />

          {/* Los números. Van FUERA del recorte y arriba de todo: en un celular
              el auto mide ~350 px, así que un número es lo único que se lee.
              El nombre de la parte y el precio viven en las tarjetas de abajo. */}
          {SLOTS.map((s) => {
            const dueño = est?.slots?.[s.id]
            const activa = mirando === s.id
            return (
              <g key={`n-${s.id}`} onClick={() => setMirando(activa ? null : s.id)} className="cursor-pointer">
                <circle cx={s.mx} cy={s.my} r={15}
                  fill={dueño || activa ? "var(--gold)" : "var(--background)"}
                  stroke="var(--gold)" strokeWidth={2} />
                <text x={s.mx} y={s.my + 5.5} textAnchor="middle" fontSize={16} fontWeight={800}
                  fill={dueño || activa ? "var(--background)" : "var(--gold)"}>
                  {s.n}
                </text>
              </g>
            )
          })}
        </svg>

        {/* Progreso real */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[11px] md:text-xs text-muted-foreground">
          <span>
            <b className="text-foreground">{est?.sold_pixels ?? 0}</b> de {est?.total_pixels ?? 0} firmas encendidas
          </span>
          <span>
            Recaudado acá: <b className="text-foreground">${(est?.sold_usd ?? 0).toLocaleString("en-US")}</b> de $
            {(est?.total_value ?? 0).toLocaleString("en-US")}
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-gold transition-[width] duration-700" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* ── Comprar ── */}
      {!compra && est !== null && !est.configured && (
        <div className="mt-5 rounded-3xl border border-border bg-card/40 px-5 py-6 text-center">
          <div className="font-display text-lg font-bold tracking-tight">Muy pronto</div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Las partes del auto se abren en unos días. Mientras tanto, mirá cómo se va armando.
          </p>
        </div>
      )}

      {!compra && est?.configured === true && (
        <div className="mt-5 space-y-5">
          {/* Las partes, de la más cara a la más barata: el precio sale de
              cuánto se VE, como el patrocinio de un auto de carrera. */}
          <div className="rounded-3xl border border-border bg-card/40 px-4 py-5 md:px-7 md:py-6">
            <h4 className="font-display text-lg font-bold tracking-tight md:text-xl">Elegí tu parte del auto</h4>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Cada parte vale según cuánto se ve. Hay una sola de cada una: cuando se toma, se toma.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              {SLOTS.map((s) => {
                const dueño = est?.slots?.[s.id]
                return (
                  <button key={s.id} disabled={!!dueño}
                    onClick={() => setCompra({ kind: "slot", slot: s })}
                    onMouseEnter={() => setMirando(s.id)}
                    onMouseLeave={() => setMirando(null)}
                    onFocus={() => setMirando(s.id)}
                    className={`rounded-2xl border px-3.5 py-3 text-left transition-colors ${
                      dueño
                        ? "cursor-not-allowed border-border bg-muted/40 opacity-70"
                        : "lift border-gold/40 bg-gold/[0.06] hover:border-gold"
                    }`}>
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-gold">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[10px] text-background">
                        {s.n}
                      </span>
                      {s.label}
                    </div>
                    <div className="mt-1 font-display text-xl font-extrabold tracking-tight">${s.price}</div>
                    <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                      {dueño ? `Tomado · ${dueño.name}` : s.nota}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* La firma de $10: el producto masivo, el que sostiene la promesa. */}
          <div className="rounded-3xl border border-border bg-card/40 px-4 py-5 md:px-7 md:py-6">
            <h4 className="font-display text-lg font-bold tracking-tight md:text-xl">
              O firmá la carrocería por ${est?.pixel_price ?? 10}
            </h4>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Tu firma se enciende sola, de la trompa hacia atrás. No elegís el lugar: el auto se va armando en
              orden con cada persona que entra.
            </p>

            <div className="mt-4 flex flex-wrap gap-2.5">
              {PACKS.map((q) => (
                <button key={q} onClick={() => setCompra({ kind: "pixel", qty: q })}
                  className="lift rounded-2xl border border-border bg-background/60 px-4 py-3 text-left hover:border-gold/50">
                  <div className="font-display text-base font-bold">
                    {q} {q === 1 ? "firma" : "firmas"}
                  </div>
                  <div className="text-xs text-muted-foreground">${q * (est?.pixel_price ?? 10)}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Formulario / código ── */}
      {compra && (
        <div className="mt-5 rounded-3xl border border-gold/40 bg-card/60 px-5 py-6 md:px-7">
          {listo ? (
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold/15">
                <Check className="h-6 w-6 text-gold" />
              </div>
              <h4 className="mt-3 font-display text-xl font-bold tracking-tight">Reservado</h4>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                Tu lugar queda guardado. Mandame el código por WhatsApp para pagar los{" "}
                <b className="text-foreground">${listo.price}</b> y lo enciendo en el auto.
              </p>
              <div className="mx-auto mt-4 w-fit rounded-2xl border border-border bg-background/70 px-6 py-3 font-mono text-xl font-bold tracking-widest">
                {listo.code}
              </div>
              <a href={`https://wa.me/${WA_KEV}?text=${encodeURIComponent(
                  `Hola Kev, reservé mi lugar en el auto del reto. Código: ${listo.code} — $${listo.price}. ¿Cómo pago?`,
                )}`}
                target="_blank" rel="noopener noreferrer"
                onClick={() => track(EV.PIXEL_PAGAR, { monto: listo.price })}
                className="lift mt-5 inline-flex items-center gap-2 rounded-2xl bg-foreground px-6 py-3.5 font-display font-semibold text-background">
                Pagar por WhatsApp <ArrowUpRight className="h-4 w-4" />
              </a>
              <button onClick={cerrar} className="mt-3 block w-full text-xs text-muted-foreground underline">
                Volver al auto
              </button>
            </div>
          ) : (
            <form onSubmit={enviar}>
              <div className="flex items-baseline justify-between gap-3">
                <h4 className="font-display text-lg font-bold tracking-tight">
                  {compra.kind === "pixel"
                    ? `${compra.qty} ${compra.qty === 1 ? "firma" : "firmas"}`
                    : compra.slot.label}
                </h4>
                <span className="font-display text-2xl font-extrabold text-gold">${precio}</span>
              </div>

              <div className="mt-4 space-y-2.5">
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40}
                  placeholder="Tu nombre o tu marca *"
                  className="w-full rounded-xl border border-border bg-background/70 px-4 py-3 text-sm outline-none focus:border-gold/60" />
                {compra.kind === "slot" && (
                  <input value={link} onChange={(e) => setLink(e.target.value)} maxLength={200}
                    placeholder="Link de tu marca (opcional)"
                    className="w-full rounded-xl border border-border bg-background/70 px-4 py-3 text-sm outline-none focus:border-gold/60" />
                )}
                <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} maxLength={30}
                  placeholder="Tu WhatsApp (para coordinar el pago)"
                  className="w-full rounded-xl border border-border bg-background/70 px-4 py-3 text-sm outline-none focus:border-gold/60" />
                <input value={message} onChange={(e) => setMessage(e.target.value)} maxLength={140}
                  placeholder="Un mensaje (opcional)"
                  className="w-full rounded-xl border border-border bg-background/70 px-4 py-3 text-sm outline-none focus:border-gold/60" />
                {/* honeypot */}
                <input tabIndex={-1} autoComplete="off" name="website" onChange={() => {}}
                  className="absolute left-[-9999px] h-0 w-0 opacity-0" aria-hidden />
              </div>

              <div className="mt-4 flex gap-2.5">
                <button type="submit" disabled={enviando}
                  className="lift flex flex-1 items-center justify-center gap-2 rounded-2xl bg-foreground px-5 py-3.5 font-display font-semibold text-background disabled:opacity-60">
                  {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
                  Reservar mi lugar
                </button>
                <button type="button" onClick={cerrar}
                  className="rounded-2xl border border-border px-5 py-3.5 text-sm text-muted-foreground">
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ── Aviso honesto (protege el proyecto y al comprador) ── */}
      <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground/80">
        Tu lugar en el auto es simbólico y publicitario. No es una inversión, no da propiedad
        sobre el vehículo ni derecho a ganancias, y no es reembolsable. El lugar se enciende cuando el pago está
        confirmado.
      </p>
    </div>
  )
}
