"use client"

import { useMemo, useState } from "react"
import { Check, Copy, FileCheck2, Search } from "lucide-react"
import { COMPROBANTES, monto, TOTAL_BS } from "@/lib/comprobantes"

// ──────────────────────────────────────────────────────────────
// LA BÓVEDA DE PRUEBAS
//
// La regla de edición dice: "si se menciona un número, se muestra". Eso solo
// se cumple si la prueba se encuentra en segundos mientras se edita; si hay
// que ir a buscarla a una carpeta, no se pone.
//
// No es una copia de nada: son LOS MISMOS comprobantes de /comprobantes
// (lib/comprobantes.ts), ya censurados en la imagen. Aquí se ven como
// material de producción en vez de como página pública: se buscan por banco,
// monto o fecha, y se copia la ruta para soltarla en la edición.
// ──────────────────────────────────────────────────────────────

export function Pruebas() {
  const [busca, setBusca] = useState("")
  const [copiado, setCopiado] = useState<string | null>(null)

  const encontrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return COMPROBANTES
    return COMPROBANTES.filter((c) =>
      [c.bank, c.date, String(c.bs), monto(c.bs)].join(" ").toLowerCase().includes(q),
    )
  }, [busca])

  const copiar = async (src: string) => {
    try {
      await navigator.clipboard.writeText(src)
      setCopiado(src)
      setTimeout(() => setCopiado((x) => (x === src ? null : x)), 1600)
    } catch {
      // Sin permiso de portapapeles no se finge que se copió: se selecciona
      // la ruta para que se pueda copiar a mano.
      const el = document.getElementById(`ruta-${src}`)
      if (el) {
        const r = document.createRange()
        r.selectNodeContents(el)
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(r)
      }
    }
  }

  return (
    <section>
      <div id="pruebas" className="mb-5 flex scroll-mt-28 items-center gap-2.5 border-b border-border pb-3 pt-2">
        <FileCheck2 className="h-4 w-4 shrink-0 text-gold" strokeWidth={1.75} />
        <h2 className="font-display text-lg font-bold tracking-tight md:text-xl">La bóveda de pruebas</h2>
        <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {COMPROBANTES.length} · {monto(TOTAL_BS)}
        </span>
      </div>

      <p className="mb-4 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
        La regla dice que si se menciona un número, se muestra. Esto es para cumplirla
        sin frenar la edición: busca el comprobante y copia la ruta. Son los mismos de
        la página pública, ya censurados en la imagen.
      </p>

      <label className="mb-3 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Busca por banco, monto o fecha — «ganadero», «5100», «oct»"
          className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
        />
        {busca && (
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {encontrados.length}
          </span>
        )}
      </label>

      {encontrados.length === 0 ? (
        <p className="rounded-xl border border-border bg-card/40 px-3.5 py-3 text-[13px] text-muted-foreground">
          Ningún comprobante coincide con «{busca}».
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {encontrados.map((c) => (
            <li key={c.src} className="flex items-center gap-3 rounded-xl border border-border bg-card/40 p-2">
              {/* Sin optimizar, igual que el resto del sitio. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.src}
                alt={`Comprobante de ${monto(c.bs)} · ${c.bank} · ${c.date}`}
                className="h-14 w-14 shrink-0 rounded-lg border border-border object-cover"
                loading="lazy"
              />
              <div className="min-w-0 flex-1">
                <div className="font-display text-[14px] font-bold tabular-nums tracking-tight">{monto(c.bs)}</div>
                <div className="truncate text-[11.5px] text-muted-foreground">{c.bank}</div>
                <div className="text-[11px] text-muted-foreground/70">{c.date}</div>
                <code id={`ruta-${c.src}`} className="sr-only">{c.src}</code>
              </div>
              <button
                type="button"
                onClick={() => copiar(c.src)}
                aria-label={`Copiar la ruta del comprobante de ${monto(c.bs)}`}
                className="shrink-0 rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:border-gold hover:text-gold"
              >
                {copiado === c.src ? <Check className="h-3.5 w-3.5 text-gold" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
