"use client"

import { useState } from "react"
import { Trophy, Send, Flame } from "lucide-react"

// WhatsApp de Kev (Bolivia +591). Las postulaciones caen directo acá.
const WHATSAPP_KEV = "59174234380"

// === EL RANKING ===
// Editá esta lista a medida que la gente vende. { user, sales } (USD).
// Empezamos todos en 0; cuando alguien venda, subile el monto y reordenа.
type Seller = { user: string; sales: number }
const SELLERS: Seller[] = [
  // Ejemplo de formato (agregar reales a medida que vendan):
  // { user: "@marco_prime", sales: 980 },
]

// Tier según ventas acumuladas (USD).
function tierOf(sales: number): { t: string; cls: string } {
  if (sales >= 500) return { t: "S", cls: "bg-gold text-background" }
  if (sales >= 200) return { t: "A", cls: "bg-gold/70 text-background" }
  if (sales >= 50) return { t: "B", cls: "bg-foreground/40 text-background" }
  return { t: "C", cls: "bg-foreground/20 text-foreground/70" }
}

const initials = (u: string) => u.replace(/[@._]/g, "").slice(0, 2).toUpperCase()

const PODIUM_STYLE = [
  { medal: "🥇", ring: "ring-[color:var(--gold)]", text: "text-[color:var(--gold)]", h: "h-24" },
  { medal: "🥈", ring: "ring-slate-300", text: "text-slate-300", h: "h-16" },
  { medal: "🥉", ring: "ring-amber-600", text: "text-amber-600", h: "h-14" },
]

function Podium({ top }: { top: Seller[] }) {
  // Orden visual: 2° · 1° · 3°
  const order = [top[1], top[0], top[2]]
  const idxMap = [1, 0, 2]
  return (
    <div className="flex items-end justify-center gap-3 md:gap-5">
      {order.map((s, i) => {
        const place = idxMap[i]
        const st = PODIUM_STYLE[place]
        const isFirst = place === 0
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-2 max-w-[33%]">
            <div className="text-2xl md:text-3xl">{st.medal}</div>
            <div
              className={`rounded-full bg-gradient-to-br from-card to-background ring-2 ${st.ring} flex items-center justify-center font-display font-extrabold text-foreground/80 ${
                isFirst ? "w-20 h-20 md:w-24 md:h-24 text-2xl" : "w-16 h-16 md:w-20 md:h-20 text-xl"
              }`}
            >
              {s ? initials(s.user) : "—"}
            </div>
            <div className="text-center leading-tight">
              <div className="font-display font-bold text-sm md:text-base truncate max-w-[110px]">
                {s ? s.user : "Libre"}
              </div>
              <div className={`font-display font-extrabold number-display ${st.text}`}>
                ${s ? s.sales.toLocaleString("en-US") : "0"}
              </div>
            </div>
            <div
              className={`w-full ${st.h} rounded-t-lg border-t-2 flex items-start justify-center pt-1.5 font-display font-extrabold ${st.text}`}
              style={{ borderColor: "currentColor", background: "linear-gradient(180deg, color-mix(in srgb, currentColor 18%, transparent), transparent)" }}
            >
              {place + 1}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  textarea,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  textarea?: boolean
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-1.5">
        {label}
      </span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className="w-full rounded-xl border border-border bg-card/40 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-gold transition-colors resize-none"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-border bg-card/40 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-gold transition-colors"
        />
      )}
    </label>
  )
}

export function SellerRanking() {
  const ranked = [...SELLERS].sort((a, b) => b.sales - a.sales)
  const top = ranked.slice(0, 3)
  const rest = ranked.slice(3)
  const hasSellers = ranked.length > 0

  const [f, setF] = useState({
    nombre: "",
    usuario: "",
    lugar: "",
    experiencia: "",
    porque: "",
    horas: "",
    meta: "",
  })
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }))

  const submit = () => {
    const msg =
      `🏁 *NUEVA POSTULACIÓN — Vender con KEV PROJECT GTA*\n\n` +
      `👤 *Nombre:* ${f.nombre || "-"}\n` +
      `📱 *Usuario:* ${f.usuario || "-"}\n` +
      `📍 *País/ciudad:* ${f.lugar || "-"}\n` +
      `💼 *Experiencia vendiendo:* ${f.experiencia || "-"}\n` +
      `🔥 *Por qué quiere entrar:* ${f.porque || "-"}\n` +
      `⏱️ *Horas por día:* ${f.horas || "-"}\n` +
      `🎯 *Cuánto quiere ganar/mes:* ${f.meta || "-"}`
    window.open(`https://wa.me/${WHATSAPP_KEV}?text=${encodeURIComponent(msg)}`, "_blank")
  }

  const canSend = f.nombre.trim() && f.usuario.trim()

  return (
    <div className="space-y-8">
      <p className="text-sm md:text-base text-muted-foreground -mt-2">
        El equipo que vende conmigo, <b className="text-foreground">en vivo</b>. El que más factura, arriba.{" "}
        <b className="text-azul">Cada venta suma.</b>
      </p>

      {/* PODIO / TABLA */}
      {hasSellers ? (
        <>
          <Podium top={top} />
          {rest.length > 0 && (
            <div className="flex flex-col gap-2.5">
              {rest.map((s, i) => {
                const tier = tierOf(s.sales)
                const max = top[0]?.sales || 1
                const w = Math.max((s.sales / max) * 100, 2)
                return (
                  <div
                    key={s.user}
                    className="flex items-center gap-3 md:gap-4 rounded-2xl border border-border bg-card/40 px-4 py-3.5"
                  >
                    <div className="w-7 text-center font-display font-extrabold text-muted-foreground/60 number-display">
                      {i + 4}
                    </div>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-card to-background border border-border flex items-center justify-center text-xs font-extrabold text-azul">
                      {initials(s.user)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-display font-bold text-sm md:text-base truncate">{s.user}</div>
                      <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                        Vendedor · el reto
                      </div>
                    </div>
                    <span
                      className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-display font-extrabold text-sm ${tier.cls}`}
                    >
                      {tier.t}
                    </span>
                    <div className="text-right min-w-[92px]">
                      <div className="font-display font-extrabold number-display">
                        ${s.sales.toLocaleString("en-US")}
                      </div>
                      <div className="h-1.5 w-full bg-foreground/10 rounded-full overflow-hidden mt-1">
                        <div className="h-full rounded-full" style={{ width: `${w}%`, background: "linear-gradient(90deg,var(--azul,#63b8f5),#a9d8ff)" }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      ) : (
        // ESTADO VACÍO — motivador
        <div className="rounded-2xl border border-dashed border-border bg-card/30 px-6 py-10 text-center">
          <Trophy className="w-9 h-9 mx-auto text-azul mb-3" />
          <div className="font-display font-extrabold text-xl md:text-2xl">El puesto #1 está libre</div>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
            Todavía nadie factura. El primero que venda arranca en la cima del ranking, con su usuario a la vista de todos.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-azul font-semibold">
            <Flame className="w-3.5 h-3.5" /> Sé el primero
          </div>
        </div>
      )}

      {/* FORMULARIO → WHATSAPP */}
      <div className="rounded-2xl border border-gold/25 bg-gradient-to-b from-gold/10 to-transparent p-6 md:p-7">
        <div className="text-center mb-6">
          <div className="section-eyebrow text-azul">¿Querés entrar al ranking?</div>
          <h3 className="mt-2 leading-tight">
            <span className="font-display font-extrabold text-2xl md:text-3xl">Postulate para </span>
            <span className="font-serif-display italic text-2xl md:text-3xl text-azul">vender conmigo</span>
          </h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            Respondé estas preguntas. Llegan directo a mi WhatsApp. Yo decido quién entra.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tu nombre" value={f.nombre} onChange={set("nombre")} placeholder="¿Cómo te llamás?" />
          <Field label="Tu usuario (para el ranking)" value={f.usuario} onChange={set("usuario")} placeholder="@tu_usuario" />
          <Field label="País y ciudad" value={f.lugar} onChange={set("lugar")} placeholder="¿Desde dónde vendés?" />
          <Field label="¿Cuántas horas por día?" value={f.horas} onChange={set("horas")} placeholder="Sé honesto…" />
          <div className="sm:col-span-2">
            <Field label="¿Vendiste algo antes? ¿Qué?" value={f.experiencia} onChange={set("experiencia")} placeholder="Contame tu experiencia…" textarea />
          </div>
          <div className="sm:col-span-2">
            <Field label="¿Por qué querés trabajar conmigo?" value={f.porque} onChange={set("porque")} placeholder="Tu motivación real…" textarea />
          </div>
          <div className="sm:col-span-2">
            <Field label="¿Cuánto querés ganar por mes?" value={f.meta} onChange={set("meta")} placeholder="En dólares…" />
          </div>
        </div>

        <button
          onClick={submit}
          disabled={!canSend}
          className="mt-6 w-full flex items-center justify-center gap-2.5 rounded-xl bg-[#25d366] text-[#05130a] font-display font-extrabold text-base md:text-lg py-4 disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-105 transition"
        >
          <Send className="w-5 h-5" /> Enviar postulación por WhatsApp
        </button>
        <p className="text-center text-[11px] text-muted-foreground/70 mt-3">
          Tus respuestas se arman en un mensaje y se envían a Kev directamente. {!canSend && "Completá al menos tu nombre y usuario."}
        </p>
      </div>
    </div>
  )
}
