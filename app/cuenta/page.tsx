"use client"

import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { ArrowLeft, Bell, BellOff, Loader2, LogOut, Mail, ShieldCheck } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { CuentaPanel } from "@/components/cuenta-panel"
import { EV, track } from "@/lib/track"

export default function CuentaPage() {
  const { perfil, cargando, faltaVerificar, salir, cambiarNovedades } = useAuth()
  const [guardando, setGuardando] = useState(false)

  const alternar = async () => {
    if (!perfil || guardando) return
    setGuardando(true)
    const quiere = !perfil.novedades
    const r = await cambiarNovedades(quiere)
    setGuardando(false)
    if (!r.ok) return toast.error(r.error)
    if (!quiere) track(EV.CUENTA_BAJA_NOVEDADES)
    toast.success(quiere ? "Listo, te aviso las novedades." : "Listo, no te mando más correos.")
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg px-5 py-10 md:py-16">
      <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Volver al reto
      </Link>

      <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight md:text-4xl">Tu cuenta</h1>

      {cargando ? (
        <div className="mt-8 flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !perfil ? (
        <div className="mt-6">
          <CuentaPanel />
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <div className="rounded-3xl border border-border bg-card/40 px-5 py-5">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-gold">Quién sos</div>
            <div className="mt-1.5 font-display text-xl font-bold tracking-tight">{perfil.nombre || "Sin nombre"}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Mail className="h-3.5 w-3.5" /> {perfil.email}
            </div>
            {faltaVerificar && (
              <p className="mt-3 rounded-2xl border border-gold/40 bg-gold/[0.07] px-4 py-3 text-xs text-muted-foreground">
                Te falta confirmar el correo. Hasta que lo hagas no te llegan las novedades — buscá el mensaje en
                tu bandeja o en spam.
              </p>
            )}
          </div>

          <div className="rounded-3xl border border-border bg-card/40 px-5 py-5">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-gold">Novedades por correo</div>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Te aviso cuando cierro algo o pasa algo grande en el reto. Nada más.
            </p>
            <button onClick={alternar} disabled={guardando}
              className={`lift mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 font-display text-sm font-semibold disabled:opacity-60 ${
                perfil.novedades
                  ? "border border-border bg-background/60"
                  : "bg-foreground text-background"
              }`}>
              {guardando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : perfil.novedades ? (
                <><BellOff className="h-4 w-4" /> Darme de baja</>
              ) : (
                <><Bell className="h-4 w-4" /> Quiero las novedades</>
              )}
            </button>
            <p className="mt-2.5 text-center text-[11px] text-muted-foreground">
              {perfil.novedades ? "Ahora mismo te llegan." : "Ahora mismo no te llega nada."}
            </p>
          </div>

          <button onClick={salir}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border px-5 py-3.5 font-display text-sm font-semibold text-muted-foreground hover:text-foreground">
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </button>

          <p className="flex items-start gap-2 pt-2 text-[11px] leading-relaxed text-muted-foreground/80">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-kev-primary" />
            Tu correo es solo para las novedades del reto. No se vende, no se comparte y no se usa para nada más.
          </p>
        </div>
      )}
    </main>
  )
}
