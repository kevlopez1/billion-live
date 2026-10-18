import type { Metadata } from "next"
import { ArrowLeft, Clapperboard, Compass, Radio, Shirt, Sparkles, Target, TrendingUp, User } from "lucide-react"
import { Indice, type Entrada } from "@/components/branding/indice"
import { Plegable } from "@/components/branding/plegable"
import { PrimeMark } from "@/components/prime-mark"
import { Volver } from "@/components/volver"
import {
  EL_NORTE, EN_COLA, ETIQUETA_ESTADO, FORMATOS, HACIA_2028, HOY_2026,
  META, PENDIENTES, PERSONAJE, PRODUCCION, REDES, type Estado,
} from "@/lib/branding"

// ──────────────────────────────────────────────────────────────
// EL MANUAL DE MARCA Y CONTENIDO
//
// noindex y sin enlace desde ninguna parte del sitio: aquí está el método
// con el que se construye el contenido, y eso no es material público. Ojo:
// noindex NO es privado — quien tenga la dirección entra. Si hace falta de
// verdad, va detrás de una clave como /control.
//
// Todo el contenido vive en lib/branding.ts. Esta página solo lo dibuja.
// ──────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "Branding y contenido",
  robots: { index: false, follow: false, nocache: true },
}

const SECCIONES: Entrada[] = [
  { id: "personaje", nombre: "El personaje" },
  { id: "norte", nombre: "El norte" },
  { id: "formatos", nombre: "Los formatos" },
  { id: "distribucion", nombre: "Distribución" },
  { id: "produccion", nombre: "Producción" },
  { id: "cola", nombre: "En cola" },
  { id: "hoy", nombre: "Qué funciona hoy" },
  { id: "futuro", nombre: "Hacia 2028" },
]

const COLOR_ESTADO: Record<Estado, string> = {
  usamos: "border-gold/45 bg-gold/[0.08] text-foreground",
  pendiente: "border-border bg-card/50 text-muted-foreground",
  no: "border-border/70 bg-transparent text-muted-foreground/80",
}

function Titulo({ id, icono: Icono, children, numero }: { id: string; icono: React.ElementType; children: React.ReactNode; numero?: string }) {
  return (
    <div id={id} className="scroll-mt-24 pt-2">
      <div className="mb-5 flex items-center gap-2.5 border-b border-border pb-3">
        <Icono className="h-4 w-4 shrink-0 text-gold" strokeWidth={1.75} />
        <h2 className="font-display text-lg font-bold tracking-tight md:text-xl">{children}</h2>
        {numero && <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">{numero}</span>}
      </div>
    </div>
  )
}

function Ficha({ titulo, items }: { titulo: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 px-4 py-4">
      <div className="text-[10px] font-display font-bold uppercase tracking-[0.16em] text-gold">{titulo}</div>
      <ul className="mt-2.5 space-y-1.5">
        {items.map((x) => (
          <li key={x} className="flex gap-2 text-[13.5px] leading-snug text-muted-foreground">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
            {x}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function BrandingPage() {
  const enUso = REDES.filter((r) => r.estado === "usamos").length

  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-5 py-8 md:py-12">
      <Volver className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Volver al reto
      </Volver>

      <header className="mt-6 max-w-2xl">
        <div className="text-[11px] font-display font-bold uppercase tracking-[0.2em] text-gold">{META.proyecto}</div>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight md:text-5xl">{META.titulo}</h1>
        <p className="mt-2 font-serif-display text-base italic text-muted-foreground md:text-lg">{META.bajada}</p>
        <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
          Documento interno. No está enlazado desde el sitio ni lo indexa Google.
        </p>
      </header>

      {/* En el celular todo va apilado: con `flex` desde el inicio, la barra
          del índice se volvía una columna y aplastaba el texto a cuatro
          palabras por línea. La fila solo existe en pantalla grande. */}
      <div className="mt-8 md:mt-10 lg:flex lg:gap-10">
        <Indice entradas={SECCIONES} />

        <div className="min-w-0 flex-1 space-y-12 md:space-y-14">
          {/* ── El personaje ── */}
          <section>
            <Titulo id="personaje" icono={User}>El personaje</Titulo>
            <p className="mb-4 font-display text-xl font-bold tracking-tight">{PERSONAJE.nombre}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Ficha titulo="Fortalezas" items={PERSONAJE.fortalezas} />
              <Ficha titulo="Debilidades" items={PERSONAJE.debilidades} />
              <Ficha titulo="Oportunidades" items={PERSONAJE.oportunidades} />
            </div>
          </section>

          {/* ── El norte ── */}
          <section>
            <Titulo id="norte" icono={Compass} numero={`${EL_NORTE.length} principios`}>El norte</Titulo>
            <p className="mb-5 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
              Lo que se toma en cuenta siempre. Si un video no responde a esto, no se publica.
            </p>
            <div className="space-y-3">
              {EL_NORTE.map((p) => (
                <div key={p.n} className="rounded-2xl border border-border bg-card/40 px-4 py-4 md:px-5">
                  <div className="flex gap-3">
                    <span className="mt-0.5 shrink-0 font-display text-sm font-bold tabular-nums text-gold">
                      {String(p.n).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-display text-[15px] font-semibold tracking-tight md:text-base">{p.titulo}</h3>
                      <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">{p.cuerpo}</p>
                      {p.detalle && (
                        <ul className="mt-3 flex flex-wrap gap-1.5">
                          {p.detalle.map((d) => (
                            <li
                              key={d}
                              className="rounded-lg border border-border bg-background/50 px-2.5 py-1.5 text-[12.5px] leading-snug text-muted-foreground"
                            >
                              {d}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Los formatos ── */}
          <section>
            <Titulo id="formatos" icono={Clapperboard} numero={`${FORMATOS.length} formatos`}>Los formatos</Titulo>
            <p className="mb-5 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
              La estructura puede variar, pero el objetivo no: posicionar las ambiciones reales y construir el apego a
              la novela del personaje. Toca uno para ver sus pasos.
            </p>
            <div className="space-y-2.5">
              {FORMATOS.map((f) => (
                <div key={f.id} id={f.id} className="scroll-mt-24">
                  <Plegable titulo={f.nombre} subtitulo={f.para} etiqueta={String(f.n).padStart(2, "0")}>
                    <ol className="space-y-3.5">
                      {f.beats.map((b, i) => (
                        <li key={i} className="flex gap-3">
                          <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-[10px] font-bold tabular-nums text-muted-foreground">
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="text-[13.5px] font-medium leading-snug text-foreground">{b.paso}</div>
                            {b.ejemplo && (
                              <p className="mt-1.5 border-l-2 border-gold/40 pl-3 font-serif-display text-[14px] italic leading-relaxed text-muted-foreground">
                                «{b.ejemplo}»
                              </p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </Plegable>
                </div>
              ))}
            </div>
          </section>

          {/* ── Distribución ── */}
          <section>
            <Titulo id="distribucion" icono={Radio} numero={`${enUso} de ${REDES.length} en uso`}>Distribución</Titulo>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {REDES.map((r) => (
                <div key={r.nombre} className={`rounded-xl border px-3.5 py-3 ${COLOR_ESTADO[r.estado]}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-display text-[14px] font-semibold tracking-tight">{r.nombre}</span>
                    <span className="shrink-0 text-[10px] uppercase tracking-[0.12em] opacity-70">
                      {ETIQUETA_ESTADO[r.estado]}
                    </span>
                  </div>
                  {r.nota && <p className="mt-1 text-[12px] leading-snug opacity-75">{r.nota}</p>}
                </div>
              ))}
            </div>
          </section>

          {/* ── Producción ── */}
          <section>
            <Titulo id="produccion" icono={Shirt}>Producción</Titulo>
            <div className="grid gap-3 sm:grid-cols-2">
              <Ficha titulo="Personaje" items={PRODUCCION.personaje} />
              {PRODUCCION.equipo.length > 0 ? (
                <Ficha titulo="Equipo" items={PRODUCCION.equipo} />
              ) : (
                <div className="rounded-2xl border border-dashed border-border px-4 py-4">
                  <div className="text-[10px] font-display font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    Equipo
                  </div>
                  <p className="mt-2 text-[13px] leading-snug text-muted-foreground/70">
                    Sin definir. Se agrega en <code className="text-[12px]">lib/branding.ts</code>.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* ── En cola ── */}
          <section>
            <Titulo id="cola" icono={Target} numero={`${EN_COLA.length} videos`}>En cola</Titulo>
            <div className="space-y-2.5">
              {EN_COLA.map((v) => (
                <div key={v.n} className="flex items-start gap-3 rounded-2xl border border-border bg-card/40 px-4 py-3.5">
                  <span className="mt-0.5 shrink-0 font-display text-sm font-bold tabular-nums text-gold">
                    {String(v.n).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <div className="font-display text-[15px] font-semibold tracking-tight">{v.titulo}</div>
                    <div className="mt-0.5 text-[12px] text-muted-foreground">Formato · {v.formato}</div>
                  </div>
                </div>
              ))}
            </div>
            {PENDIENTES.length > 0 && (
              <div className="mt-4 rounded-2xl border border-dashed border-border px-4 py-4">
                <div className="text-[10px] font-display font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Pendientes
                </div>
                <ul className="mt-2 space-y-1.5">
                  {PENDIENTES.map((x) => (
                    <li key={x} className="flex gap-2 text-[13.5px] leading-snug text-muted-foreground">
                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
                      {x}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* ── Hoy ── */}
          <section>
            <Titulo id="hoy" icono={Sparkles} numero="2026">Qué funciona hoy</Titulo>
            <div className="space-y-2.5">
              {HOY_2026.map((l) => (
                <Plegable key={l.titulo} titulo={l.titulo}>
                  <p className="text-[13.5px] leading-relaxed text-muted-foreground">{l.cuerpo}</p>
                </Plegable>
              ))}
            </div>
          </section>

          {/* ── 2028 ── */}
          <section>
            <Titulo id="futuro" icono={TrendingUp} numero="2028">Hacia dónde va</Titulo>
            <p className="mb-5 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
              Qué buscará el consumidor, y por lo tanto hacia dónde tiene que mirar <PrimeMark className="text-[0.9em]" />.
            </p>
            <div className="space-y-2.5">
              {HACIA_2028.map((l) => (
                <Plegable key={l.titulo} titulo={l.titulo}>
                  <p className="text-[13.5px] leading-relaxed text-muted-foreground">{l.cuerpo}</p>
                </Plegable>
              ))}
            </div>
          </section>

          <p className="border-t border-border pt-6 text-[12px] leading-relaxed text-muted-foreground/70">
            Para cambiar cualquier cosa de esta página se edita <code>lib/branding.ts</code>. Un principio, un formato,
            una red o un video en cola es un objeto más en su lista.
          </p>
        </div>
      </div>
    </main>
  )
}
