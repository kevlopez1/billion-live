"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { PenLine, Loader2, Check, ArrowUpRight } from "lucide-react"
import { BODY_PATH, CELL, SLOTS, SUELO, VIEW_H, VIEW_W, type Slot } from "@/lib/car-grid"
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

  const cargar = () =>
    fetch("/api/pixels", { cache: "no-store" })
      .then((r) => r.json())
      .then(setEst)
      .catch(() => {})

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
      {/* ── El auto ── */}
      <div className="rounded-3xl border border-border bg-card/40 p-4 md:p-7">
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full h-auto" role="img"
          aria-label="El Mercedes del reto, formado por píxeles comprados">
          {/* Línea de suelo: asienta el auto */}
          <line x1={30} y1={SUELO} x2={VIEW_W - 30} y2={SUELO} stroke="var(--foreground)" strokeWidth={1} opacity={0.15} />

          {/* Ruedas (detrás del cuerpo) */}
          {SLOTS.filter((s) => s.id.startsWith("rueda")).map((s) => {
            const dueño = est?.slots[s.id]
            return (
              <g key={s.id} onClick={() => !dueño && setCompra({ kind: "slot", slot: s })}
                className={dueño ? "" : "cursor-pointer"}>
                <circle cx={s.cx} cy={s.cy} r={s.r} fill="var(--kev-primary)" opacity={0.85} />
                <circle cx={s.cx} cy={s.cy} r={s.r} fill="none" stroke="var(--gold)"
                  strokeWidth={dueño ? 3 : 1.5} strokeDasharray={dueño ? undefined : "5 5"}
                  opacity={dueño ? 1 : 0.5} />
                <circle cx={s.cx} cy={s.cy} r={s.r * 0.44} fill="var(--background)" />
                <text x={s.cx} y={s.cy + 4} textAnchor="middle" fontSize={dueño ? 15 : 13}
                  fontWeight={700} fill={dueño ? "var(--gold)" : "var(--muted-foreground)"}>
                  {dueño ? dueño.name.slice(0, 9) : `$${s.price}`}
                </text>
              </g>
            )
          })}

          {/* Cuerpo vacío: la silueta tenue que se va llenando */}
          <path d={BODY_PATH} fill="var(--muted)" opacity={0.35} />

          {/* Píxeles vendidos: se encienden dentro del cuerpo */}
          <g>
            {est?.cells.map((c) => (
              <rect key={`${c.x}-${c.y}`} x={c.x * CELL} y={c.y * CELL} width={CELL - 0.6} height={CELL - 0.6}
                rx={1} fill="var(--gold)" />
            ))}
          </g>

          {/* Contorno del auto por encima */}
          <path d={BODY_PATH} fill="none" stroke="var(--foreground)" strokeWidth={2.5} opacity={0.55}
            strokeLinejoin="round" />

          {/* Capó: espacio premium */}
          {SLOTS.filter((s) => s.id === "puerta").map((s) => {
            const dueño = est?.slots[s.id]
            return (
              <g key={s.id} onClick={() => !dueño && setCompra({ kind: "slot", slot: s })}
                className={dueño ? "" : "cursor-pointer"}>
                <circle cx={s.cx} cy={s.cy} r={s.r} fill="var(--background)" opacity={dueño ? 0.92 : 0.75} />
                <circle cx={s.cx} cy={s.cy} r={s.r} fill="none" stroke="var(--gold)"
                  strokeWidth={dueño ? 3 : 1.5} strokeDasharray={dueño ? undefined : "5 5"} />
                <text x={s.cx} y={s.cy + 5} textAnchor="middle" fontSize={dueño ? 15 : 13} fontWeight={700}
                  fill={dueño ? "var(--gold)" : "var(--muted-foreground)"}>
                  {dueño ? dueño.name.slice(0, 10) : `Puerta $${s.price}`}
                </text>
              </g>
            )
          })}
        </svg>

        {/* Progreso real */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[11px] md:text-xs text-muted-foreground">
          <span>
            <b className="text-foreground">{est?.sold_pixels ?? 0}</b> de {est?.total_pixels ?? 0} píxeles encendidos
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
      {!compra && est?.configured === false && (
        <div className="mt-5 rounded-3xl border border-border bg-card/40 px-5 py-6 text-center">
          <div className="font-display text-lg font-bold tracking-tight">Muy pronto</div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Los lugares en el auto se abren en unos días. Mientras tanto, mirá cómo se va armando.
          </p>
        </div>
      )}

      {!compra && est?.configured !== false && (
        <div className="mt-5 rounded-3xl border border-border bg-card/40 px-5 py-6 md:px-7">
          <h4 className="font-display text-lg font-bold tracking-tight md:text-xl">Poné tu nombre en el auto</h4>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Cada píxel cuesta ${est?.pixel_price ?? 10} y se asigna solo, de la trompa hacia atrás. El auto se va
            armando en vivo con cada compra.
          </p>

          <div className="mt-4 flex flex-wrap gap-2.5">
            {PACKS.map((q) => (
              <button key={q} onClick={() => setCompra({ kind: "pixel", qty: q })}
                className="lift rounded-2xl border border-border bg-background/60 px-4 py-3 text-left hover:border-gold/50">
                <div className="font-display text-base font-bold">
                  {q} {q === 1 ? "píxel" : "píxeles"}
                </div>
                <div className="text-xs text-muted-foreground">${q * (est?.pixel_price ?? 10)}</div>
              </button>
            ))}
          </div>

          <div className="mt-5 text-[11px] font-bold uppercase tracking-[0.16em] text-gold">Los 3 lugares del auto</div>
          <div className="mt-2 flex flex-wrap gap-2.5">
            {SLOTS.map((s) => {
              const tomado = !!est?.slots[s.id]
              return (
                <button key={s.id} disabled={tomado} onClick={() => setCompra({ kind: "slot", slot: s })}
                  className={`rounded-2xl border px-4 py-3 text-left ${
                    tomado
                      ? "cursor-not-allowed border-border bg-muted/40 opacity-60"
                      : "lift border-gold/40 bg-gold/[0.06] hover:border-gold"
                  }`}>
                  <div className="font-display text-base font-bold">{s.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {tomado ? `Tomado · ${est?.slots[s.id].name}` : `$${s.price} · tu logo o marca`}
                  </div>
                </button>
              )
            })}
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
                  `Hola Kev, reservé mi lugar en el Auto de Píxeles. Código: ${listo.code} — $${listo.price}. ¿Cómo pago?`,
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
                    ? `${compra.qty} ${compra.qty === 1 ? "píxel" : "píxeles"}`
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
        Tu píxel es un lugar simbólico y publicitario en el auto del reto. No es una inversión, no da propiedad
        sobre el vehículo ni derecho a ganancias, y no es reembolsable. El lugar se enciende cuando el pago está
        confirmado.
      </p>
    </div>
  )
}
