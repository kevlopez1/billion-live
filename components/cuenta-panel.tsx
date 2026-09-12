"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowUpRight, Check, Loader2, LogIn, Mail, UserPlus } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { EV, track } from "@/lib/track"

// ──────────────────────────────────────────────────────────────
// Crear cuenta / entrar, desde la misma home.
// Reemplaza el formulario de "Avisame cuando pase": en vez de juntar correos
// sueltos, ahora hay una cuenta con la que se puede construir algo después.
// ──────────────────────────────────────────────────────────────

type Modo = "registro" | "entrar" | "recuperar"

export function CuentaPanel() {
  const { perfil, cargando, faltaVerificar, registrar, entrar, recuperar } = useAuth()
  const [modo, setModo] = useState<Modo>("registro")
  const [nombre, setNombre] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [novedades, setNovedades] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [listo, setListo] = useState<string | null>(null)
  const [website, setWebsite] = useState("") // honeypot

  // ── Ya tiene sesión ──
  if (!cargando && perfil) {
    return (
      <div className="rounded-3xl border border-border bg-card/40 px-5 py-6 md:px-7">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold/15">
            <Check className="h-5 w-5 text-gold" />
          </span>
          <div className="min-w-0">
            <div className="font-display text-base font-bold tracking-tight md:text-lg">
              Estás adentro{perfil.nombre ? `, ${perfil.nombre.split(" ")[0]}` : ""}
            </div>
            <div className="truncate text-xs text-muted-foreground">{perfil.email}</div>
          </div>
        </div>
        {faltaVerificar && (
          <p className="mt-3 rounded-2xl border border-gold/40 bg-gold/[0.07] px-4 py-3 text-xs text-muted-foreground">
            Te falta confirmar el correo. Buscá el mensaje en tu bandeja (o en spam) para no perderte los avisos.
          </p>
        )}
        <Link href="/cuenta"
          className="lift mt-4 inline-flex items-center gap-2 rounded-2xl bg-foreground px-5 py-3 font-display text-sm font-semibold text-background">
          Ver mi cuenta <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    )
  }

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (enviando) return
    if (website.trim() !== "") return // bot

    if (modo !== "recuperar" && password.length < 8) {
      return toast.error("La contraseña necesita al menos 8 caracteres.")
    }
    if (modo === "registro" && !nombre.trim()) {
      return toast.error("Poné tu nombre.")
    }

    setEnviando(true)
    try {
      const r =
        modo === "registro"
          ? await registrar({ email, password, nombre, novedades })
          : modo === "entrar"
            ? await entrar(email, password)
            : await recuperar(email)

      if (!r.ok) return toast.error(r.error)

      track(modo === "registro" ? EV.CUENTA_CREADA : modo === "entrar" ? EV.CUENTA_ENTRO : EV.CUENTA_RECUPERAR)
      if (r.aviso) setListo(r.aviso)
      else toast.success(modo === "registro" ? "Cuenta creada." : "Bienvenido de vuelta.")
      setPassword("")
    } finally {
      setEnviando(false)
    }
  }

  if (listo) {
    return (
      <div className="rounded-3xl border border-gold/40 bg-card/60 px-5 py-7 text-center md:px-7">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold/15">
          <Mail className="h-6 w-6 text-gold" />
        </div>
        <h4 className="mt-3 font-display text-xl font-bold tracking-tight">Revisá tu correo</h4>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{listo}</p>
        <button onClick={() => { setListo(null); setModo("entrar") }}
          className="mt-4 text-xs text-muted-foreground underline">
          Volver
        </button>
      </div>
    )
  }

  const titulo =
    modo === "registro" ? "Creá tu cuenta" : modo === "entrar" ? "Entrá a tu cuenta" : "Recuperar la contraseña"
  const bajada =
    modo === "registro"
      ? "Te aviso cada vez que cierro algo o pasa algo grande en el reto. Sin vueltas y te podés borrar cuando quieras."
      : modo === "entrar"
        ? "Con tu correo y tu contraseña."
        : "Te mando un enlace para poner una contraseña nueva."

  return (
    <div className="rounded-3xl border border-border bg-card/40 px-5 py-6 md:px-7">
      <h4 className="font-display text-lg font-bold tracking-tight md:text-xl">{titulo}</h4>
      <p className="mt-1.5 text-sm text-muted-foreground">{bajada}</p>

      <form onSubmit={enviar} className="mt-4 space-y-2.5">
        {/* Honeypot: invisible para una persona, irresistible para un bot */}
        <input type="text" name="website" value={website} onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />

        {modo === "registro" && (
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60}
            placeholder="Tu nombre *" autoComplete="name"
            className="w-full rounded-2xl border border-border bg-background/60 px-4 py-3 text-sm outline-none focus:border-gold/60" />
        )}

        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" maxLength={120}
          placeholder="Tu correo *" autoComplete="email" required
          className="w-full rounded-2xl border border-border bg-background/60 px-4 py-3 text-sm outline-none focus:border-gold/60" />

        {modo !== "recuperar" && (
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password"
            placeholder="Tu contraseña * (mínimo 8)" minLength={8} required
            autoComplete={modo === "registro" ? "new-password" : "current-password"}
            className="w-full rounded-2xl border border-border bg-background/60 px-4 py-3 text-sm outline-none focus:border-gold/60" />
        )}

        {modo === "registro" && (
          <label className="flex cursor-pointer items-start gap-2.5 px-1 pt-1 text-xs text-muted-foreground">
            <input type="checkbox" checked={novedades} onChange={(e) => setNovedades(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--gold)]" />
            <span>
              Quiero que me avisen las novedades del reto por correo. Me puedo dar de baja en un clic desde mi
              cuenta.
            </span>
          </label>
        )}

        <button type="submit" disabled={enviando}
          className="lift flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground px-6 py-3.5 font-display font-semibold text-background disabled:opacity-60">
          {enviando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : modo === "registro" ? (
            <><UserPlus className="h-4 w-4" /> Crear mi cuenta</>
          ) : modo === "entrar" ? (
            <><LogIn className="h-4 w-4" /> Entrar</>
          ) : (
            <><Mail className="h-4 w-4" /> Mandame el enlace</>
          )}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {modo !== "registro" && (
          <button onClick={() => setModo("registro")} className="underline">Crear una cuenta</button>
        )}
        {modo !== "entrar" && (
          <button onClick={() => setModo("entrar")} className="underline">Ya tengo cuenta</button>
        )}
        {modo === "entrar" && (
          <button onClick={() => setModo("recuperar")} className="underline">Olvidé la contraseña</button>
        )}
      </div>
    </div>
  )
}
