"use client"

import { useState } from "react"
import { Trophy, Send, Flame, Clapperboard } from "lucide-react"

// WhatsApp de Kev (Bolivia +591). Las postulaciones caen directo acá.
const WHATSAPP_KEV = "59174234380"

// === EL RANKING (vendedores) ===
// Editá esta lista a medida que la gente vende. { user, sales } (USD).
// Empezamos todos en 0; cuando alguien venda, subile el monto y reordená.
type Seller = { user: string; sales: number }
const SELLERS: Seller[] = [
  // Ejemplo de formato (agregar reales a medida que vendan):
  // { user: "@marco_prime", sales: 980 },
]

// === ROLES para postularse ===
type FieldDef = { key: string; label: string; placeholder: string; textarea?: boolean }
type RoleKey = "vendedor" | "contenido"
const ROLES: Record<
  RoleKey,
  { label: string; Icon: typeof Trophy; heading: string; msgTitle: string; fields: FieldDef[] }
> = {
  vendedor: {
    label: "Vender PRIME",
    Icon: Trophy,
    heading: "vender conmigo",
    msgTitle: "VENDEDOR — Vender con KEV PROJECT GTA",
    fields: [
      { key: "nombre", label: "Tu nombre", placeholder: "¿Cómo te llamás?" },
      { key: "usuario", label: "Tu usuario (para el ranking)", placeholder: "@tu_usuario" },
      { key: "lugar", label: "País y ciudad", placeholder: "¿Desde dónde vendés?" },
      { key: "horas", label: "¿Cuántas horas por día?", placeholder: "Sé honesto…" },
      { key: "experiencia", label: "¿Vendiste algo antes? ¿Qué?", placeholder: "Contame tu experiencia…", textarea: true },
      { key: "porque", label: "¿Por qué querés trabajar conmigo?", placeholder: "Tu motivación real…", textarea: true },
      { key: "meta", label: "¿Cuánto querés ganar por mes?", placeholder: "En dólares…" },
    ],
  },
  contenido: {
    label: "Crear contenido",
    Icon: Clapperboard,
    heading: "crear contenido",
    msgTitle: "CONTENIDO — Fábrica de contenido KEV PROJECT GTA",
    fields: [
      { key: "nombre", label: "Tu nombre", placeholder: "¿Cómo te llamás?" },
      { key: "usuario", label: "Tu usuario / link a tu contenido", placeholder: "@usuario o link" },
      { key: "lugar", label: "País y ciudad", placeholder: "¿Desde dónde creás?" },
      { key: "horas", label: "¿Cuántas horas por día?", placeholder: "Sé honesto…" },
      { key: "tipo", label: "¿Qué tipo de contenido hacés?", placeholder: "Edición, guiones, viral, diseño, faceless…", textarea: true },
      { key: "ia", label: "¿Usás IA para crear? ¿Cuáles?", placeholder: "CapCut, ChatGPT, ElevenLabs…" },
      { key: "porque", label: "¿Por qué querés entrar a la fábrica de contenido?", placeholder: "Tu motivación real…", textarea: true },
    ],
  },
}

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
  def,
  value,
  onChange,
}: {
  def: FieldDef
  value: string
  onChange: (v: string) => void
}) {
  const cls =
    "w-full rounded-xl border border-border bg-card/40 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-gold transition-colors"
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-1.5">
        {def.label}
      </span>
      {def.textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={def.placeholder} rows={2} className={`${cls} resize-none`} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={def.placeholder} className={cls} />
      )}
    </label>
  )
}

export function SellerRanking() {
  const ranked = [...SELLERS].sort((a, b) => b.sales - a.sales)
  const top = ranked.slice(0, 3)
  const rest = ranked.slice(3)
  const hasSellers = ranked.length > 0

  const [role, setRole] = useState<RoleKey>("vendedor")
  const [values, setValues] = useState<Record<string, string>>({})
  const set = (k: string) => (v: string) => setValues((p) => ({ ...p, [k]: v }))

  const cfg = ROLES[role]
  const canSend = (values.nombre || "").trim() && (values.usuario || "").trim()

  const submit = () => {
    const lines = cfg.fields.map((f) => `*${f.label.replace(/\s*\?$/, "")}:* ${(values[f.key] || "").trim() || "-"}`).join("\n")
    const msg = `🏁 *NUEVA POSTULACIÓN*\n_${cfg.msgTitle}_\n\n${lines}`
    window.open(`https://wa.me/${WHATSAPP_KEV}?text=${encodeURIComponent(msg)}`, "_blank")
  }

  return (
    <div className="space-y-8">
      <p className="text-sm md:text-base text-muted-foreground -mt-2">
        El equipo que vende conmigo, <b className="text-foreground">en vivo</b>. El que más factura, arriba.{" "}
        <b className="text-azul">Cada venta suma.</b>
      </p>

      {/* PODIO / TABLA (vendedores) */}
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
                  <div key={s.user} className="flex items-center gap-3 md:gap-4 rounded-2xl border border-border bg-card/40 px-4 py-3.5">
                    <div className="w-7 text-center font-display font-extrabold text-muted-foreground/60 number-display">{i + 4}</div>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-card to-background border border-border flex items-center justify-center text-xs font-extrabold text-azul">
                      {initials(s.user)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-display font-bold text-sm md:text-base truncate">{s.user}</div>
                      <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Vendedor · el reto</div>
                    </div>
                    <span className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-display font-extrabold text-sm ${tier.cls}`}>{tier.t}</span>
                    <div className="text-right min-w-[92px]">
                      <div className="font-display font-extrabold number-display">${s.sales.toLocaleString("en-US")}</div>
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

      {/* POSTULACIÓN por rol */}
      <div className="rounded-2xl border border-gold/25 bg-gradient-to-b from-gold/10 to-transparent p-6 md:p-7">
        <div className="text-center mb-5">
          <div className="section-eyebrow text-azul">Sumate al equipo</div>
          <h3 className="mt-2 leading-tight">
            <span className="font-display font-extrabold text-2xl md:text-3xl">Postulate para </span>
            <span className="font-serif-display italic text-2xl md:text-3xl text-azul">{cfg.heading}</span>
          </h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">Elegí tu rol. Llega directo a mi WhatsApp. Yo decido quién entra.</p>
        </div>

        {/* Selector de rol */}
        <div className="grid grid-cols-2 gap-2.5 mb-6">
          {(Object.keys(ROLES) as RoleKey[]).map((rk) => {
            const R = ROLES[rk]
            const active = role === rk
            return (
              <button
                key={rk}
                onClick={() => setRole(rk)}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition-colors ${
                  active ? "border-gold bg-gold/15 text-foreground" : "border-border bg-card/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                <R.Icon className="w-4 h-4" /> {R.label}
              </button>
            )
          })}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {cfg.fields.map((f) => (
            <div key={f.key} className={f.textarea ? "sm:col-span-2" : ""}>
              <Field def={f} value={values[f.key] || ""} onChange={set(f.key)} />
            </div>
          ))}
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
