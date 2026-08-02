"use client"

import Image from "next/image"

// WhatsApp del empleado AI de PRIME (número real).
const PRIME_WA = "59172258926"
const PRIME_MSG = encodeURIComponent(
  "Hola, vengo del reto Kev Project GTA y quiero conocer a mi empleado AI de PRIME.",
)
const PRIME_WA_URL = `https://wa.me/${PRIME_WA}?text=${PRIME_MSG}`
const PRIME_WEB = "https://primebusiness.live"
const PRIME_MERCADO = "https://www.primebusiness.live/mercado-2030#sistema"

// Alitas Mansory del logo (idénticas al intro).
function Wing({ flip = false }: { flip?: boolean }) {
  return (
    <span className={`flex flex-col gap-[3px] ${flip ? "items-start" : "items-end"}`}>
      <i className="block h-[1.5px] w-[9px] bg-gold" />
      <i className="block h-[1.5px] w-4 bg-gold" />
      <i className="block h-[1.5px] w-[9px] bg-gold" />
    </span>
  )
}

// Hub / linktree: primera pantalla del link. Conecta el reto con PRIME.
export function Hub({ onEnter }: { onEnter: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[70] overflow-y-auto"
      style={{
        background:
          "linear-gradient(to bottom, rgba(252,253,254,0) 0%, rgba(252,253,254,0) 20%, rgba(252,253,254,0.92) 60%, #fcfdfe 80%), radial-gradient(130% 70% at 50% -6%, #fdfdfc 0%, #cfe4f5 55%, #a8cdea 100%)",
      }}
    >
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col items-center px-6 py-10 text-center text-foreground">
        {/* Logo lockup */}
        <div className="mb-5 flex items-center gap-3">
          <Wing />
          <span className="font-serif-display text-[15px] uppercase tracking-[0.3em] text-foreground">
            Kev Project GTA
          </span>
          <Wing flip />
        </div>

        {/* Avatar */}
        <Image
          src="/images/kev-avatar.jpg"
          alt="Kev López"
          width={108}
          height={108}
          priority
          className="mb-3.5 rounded-full border-2 border-white object-cover shadow-[0_6px_22px_rgba(40,60,90,0.18)]"
        />

        <h1 className="font-display text-[26px] font-extrabold tracking-tight">Kev López</h1>
        <p className="mt-0.5 font-serif-display text-[17px] italic text-muted-foreground">
          De $10 a un Mercedes, desde Bolivia
        </p>
        <p className="mt-2 text-xs font-medium tracking-wide text-gold">@kev.project.gta</p>

        {/* Botones */}
        <div className="mt-7 flex w-full flex-col gap-3.5">
          {/* Empleado AI → WhatsApp de PRIME */}
          <a
            href={PRIME_WA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="lift relative flex flex-col items-center justify-center rounded-2xl px-5 py-4 text-center"
            style={{ background: "#25d366", boxShadow: "0 8px 22px rgba(37,211,102,0.32)" }}
          >
            <span className="font-display text-base font-semibold" style={{ color: "#06341c" }}>
              Hablar con mi empleado AI
            </span>
            <span className="mt-0.5 text-xs" style={{ color: "#0a5c30" }}>
              PRIME · te responde al instante
            </span>
            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-lg" style={{ color: "#0a5c30" }}>
              →
            </span>
          </a>

          {/* Ver la web del reto → entra al sitio */}
          <button
            onClick={onEnter}
            className="lift relative flex flex-col items-center justify-center rounded-2xl bg-foreground px-5 py-4 text-center shadow-[0_8px_20px_rgba(40,55,80,0.28)]"
          >
            <span className="font-display text-base font-semibold text-background">Ver la web del reto</span>
            <span className="mt-0.5 text-xs text-background/70">El contador y los comprobantes, en vivo</span>
            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-lg text-background/70">→</span>
          </button>

          {/* Conocer PRIME → primebusiness.live */}
          <a
            href={PRIME_WEB}
            target="_blank"
            rel="noopener noreferrer"
            className="lift relative flex flex-col items-center justify-center rounded-2xl border border-border bg-card/70 px-5 py-4 text-center shadow-[0_2px_10px_rgba(40,60,90,0.05)]"
          >
            <Image src="/images/prime-wordmark.png" alt="PRIME" width={110} height={26} className="h-[26px] w-auto" />
            <span className="mt-1 text-xs text-muted-foreground">Empleados de AI para tu empresa</span>
            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">→</span>
          </a>

          {/* PRIME · Mercado 2030 (acceso exclusivo) */}
          <a
            href={PRIME_MERCADO}
            target="_blank"
            rel="noopener noreferrer"
            className="lift relative flex flex-col items-center justify-center rounded-2xl border border-gold/50 bg-gold/[0.05] px-5 py-4 text-center"
          >
            <span className="font-display text-base font-semibold text-foreground">PRIME solo para inversores</span>
            <span className="mt-0.5 text-xs text-muted-foreground">Mercado 2030 · el sistema</span>
            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-lg text-gold">→</span>
          </a>
        </div>

        <p className="mt-7 text-[10px] font-medium uppercase tracking-[0.4em] text-muted-foreground">
          El auto es la carnada · el imperio es la meta
        </p>
      </div>
    </div>
  )
}
