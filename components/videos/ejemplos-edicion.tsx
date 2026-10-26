// ──────────────────────────────────────────────────────────────
// EJEMPLOS VISUALES DE LA EDICIÓN
//
// Cada regla de "La edición" se entiende más rápido viéndola que leyéndola.
// Aquí cada bloque trae su ejemplo: pantallas de celular armadas con fotos
// reales del reto (el billete de $10, el comprobante del 9 de octubre, Kev de
// noche). Nada inventado: los números son los del contador.
//
// Se eligen por el título del bloque. Si Kev renombra o agrega un bloque sin
// ejemplo, simplemente no aparece: no se rompe nada.
// ──────────────────────────────────────────────────────────────

import type { ReactNode } from "react"

const FOTO = "/images/kev-10-dolares.jpg"
const RETRATO = "/images/kev-avatar-origen.jpg"
const COMPROBANTE = "/images/comprobantes/ach-bnb-5100.jpg"

/** Un celular vertical (9:16) con algo adentro. */
function Celular({ children, pie, mal }: { children: ReactNode; pie: string; mal?: boolean }) {
  return (
    <figure className="w-[132px] shrink-0">
      <div className={`relative aspect-[9/16] overflow-hidden rounded-[18px] border-[3px] bg-black ${mal ? "border-rojo/60" : "border-foreground/80"}`}>
        {children}
      </div>
      <figcaption className={`mt-1.5 text-center text-[11px] font-semibold leading-tight ${mal ? "text-rojo" : "text-kev-success"}`}>
        {mal ? "✕ " : "✓ "}{pie}
      </figcaption>
    </figure>
  )
}

const Foto = ({ src, pos = "center 20%", className = "" }: { src: string; pos?: string; className?: string }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={src} alt="" className={`absolute inset-0 h-full w-full object-cover ${className}`} style={{ objectPosition: pos }} />
)

const Rotulo = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <span className={`absolute left-1.5 right-1.5 text-center font-display font-extrabold uppercase leading-[0.95] text-white drop-shadow-[0_2px_4px_rgba(0,0,0,.9)] ${className}`}>
    {children}
  </span>
)

/** Línea de tiempo de un video: qué pasa en cada segundo. */
function Tiempo({ tramos }: { tramos: { de: number; a: number; texto: string; color: string }[] }) {
  const total = Math.max(...tramos.map((t) => t.a))
  return (
    <div className="mt-3">
      <div className="flex h-6 overflow-hidden rounded-md text-[10px] font-semibold text-white">
        {tramos.map((t, i) => (
          <div key={i} className={`flex items-center justify-center px-1 ${t.color}`} style={{ width: `${((t.a - t.de) / total) * 100}%` }}>
            <span className="truncate">{t.texto}</span>
          </div>
        ))}
      </div>
      <div className="mt-0.5 flex justify-between text-[10px] tabular-nums text-muted-foreground">
        <span>0 s</span><span>{total} s</span>
      </div>
    </div>
  )
}

const EJEMPLOS: { clave: string; render: () => ReactNode }[] = [
  {
    clave: "tres primeros",
    render: () => (
      <>
        <div className="flex gap-3">
          <Celular mal pie="Abre saludando">
            <Foto src={FOTO} className="opacity-70" />
            <Rotulo className="bottom-6 text-[13px] normal-case">Hola, ¿cómo están? Soy Kevin y hoy…</Rotulo>
          </Celular>
          <Celular pie="El primer fotograma ya engancha">
            <Foto src={FOTO} />
            <Rotulo className="top-5 text-[17px]">Voy a vender robots humanoides</Rotulo>
            <Rotulo className="bottom-5 text-[11px] text-sky-300">De $10 a un Mansory · día 119</Rotulo>
          </Celular>
        </div>
        <Tiempo tramos={[
          { de: 0, a: 3, texto: "Gancho", color: "bg-rojo" },
          { de: 3, a: 8, texto: "Quién soy + reto", color: "bg-gold" },
          { de: 8, a: 30, texto: "Desarrollo", color: "bg-foreground/50" },
        ]} />
      </>
    ),
  },
  {
    clave: "pruebas",
    render: () => (
      <div className="flex gap-3">
        <Celular mal pie="Lo dice sin mostrar">
          <Foto src={FOTO} className="opacity-70" />
          <Rotulo className="bottom-6 text-[12px] normal-case">“Me pagaron un montón esta semana”</Rotulo>
        </Celular>
        <Celular pie="El número, con su comprobante">
          <Foto src={FOTO} className="opacity-40" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={COMPROBANTE} alt="" className="absolute left-2 right-2 top-8 rotate-[-3deg] rounded border-2 border-white shadow-lg" />
          <Rotulo className="bottom-5 text-[15px] text-sky-300">Bs 5.100 · 9 oct</Rotulo>
        </Celular>
      </div>
    ),
  },
  {
    clave: "ritmo",
    render: () => (
      <>
        <div className="flex gap-3">
          <Celular pie="Zoom lento al decir el número">
            <Foto src={FOTO} className="animate-[zoomLento_4s_ease-in-out_infinite_alternate]" />
            <Rotulo className="top-5 text-[20px] text-sky-300">$7.346</Rotulo>
          </Celular>
          <Celular pie="Cambio de toma cada 2–3 s">
            <Foto src={RETRATO} pos="center 30%" />
            <Rotulo className="bottom-5 text-[11px]">Toma 2 · otro ángulo</Rotulo>
          </Celular>
        </div>
        <Tiempo tramos={[
          { de: 0, a: 3, texto: "Toma 1", color: "bg-foreground/70" },
          { de: 3, a: 5, texto: "Zoom", color: "bg-gold" },
          { de: 5, a: 8, texto: "Toma 2", color: "bg-foreground/50" },
          { de: 8, a: 10, texto: "Prueba", color: "bg-rojo" },
          { de: 10, a: 13, texto: "Toma 3", color: "bg-foreground/70" },
        ]} />
        <style>{`@keyframes zoomLento{from{transform:scale(1)}to{transform:scale(1.15)}}`}</style>
      </>
    ),
  },
  {
    clave: "imagen",
    render: () => (
      <div className="flex items-start gap-3">
        <Celular pie="Autoridad: lentes, ropa oscura, noche">
          <Foto src={RETRATO} pos="center 30%" />
        </Celular>
        <div className="space-y-1.5 pt-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Paleta del reto</p>
          {[
            ["#8fc7e8", "Celeste · el dinero"],
            ["#f0584a", "Rojo · lo que marca Kev"],
            ["#05080c", "Noche · el fondo"],
            ["#ffffff", "Blanco · el texto"],
          ].map(([c, t]) => (
            <div key={c} className="flex items-center gap-2 text-[12px]">
              <span className="h-5 w-5 rounded-md border" style={{ background: c }} />{t}
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    clave: "personaje",
    render: () => (
      <div className="flex items-start gap-3">
        <Celular pie="Seguro, mirando a cámara">
          <Foto src={FOTO} />
          <span className="absolute left-[46%] top-[17%] h-7 w-12 rounded-full border-2 border-sky-300" />
          <span className="absolute left-[8%] top-[28%] h-9 w-9 rounded-full border-2 border-sky-300" />
          <span className="absolute left-[40%] top-[36%] h-5 w-5 rounded-full border-2 border-sky-300" />
        </Celular>
        <ul className="space-y-2 pt-6 text-[12px]">
          <li><b className="text-sky-500">1</b> · Mirada a cámara, sin leer</li>
          <li><b className="text-sky-500">2</b> · Las manos muestran la prueba</li>
          <li><b className="text-sky-500">3</b> · Micrófono de solapa: voz clara</li>
        </ul>
      </div>
    ),
  },
  {
    clave: "texto",
    render: () => (
      <div className="flex gap-3">
        <Celular pie="Propuesta: igual que la imagen diaria">
          <Foto src={FOTO} pos="center 30%" className="opacity-80" />
          <span className="absolute left-0 right-0 top-3 text-center text-[8px] font-bold tracking-[0.2em] text-rojo">DÍA N.º 119</span>
          <Rotulo className="top-7 text-[8px] font-light">Empecé con $10. Hoy llevo</Rotulo>
          <Rotulo className="top-[46px] text-[26px] text-sky-300">$7.346</Rotulo>
        </Celular>
        <Celular pie="Subtítulo: 2 líneas, abajo">
          <Foto src={RETRATO} pos="center 30%" />
          <span className="absolute bottom-10 left-2 right-2 rounded bg-black/70 px-1 py-0.5 text-center text-[10px] font-bold leading-tight text-white">
            cada peso tiene <span className="text-sky-300">su comprobante</span>
          </span>
        </Celular>
      </div>
    ),
  },
  {
    clave: "sonido",
    render: () => (
      <div>
        <svg viewBox="0 0 300 50" className="h-12 w-full max-w-[300px]" aria-hidden>
          {Array.from({ length: 60 }, (_, i) => {
            const h = 6 + Math.abs(Math.sin(i * 0.55) * 18) + (i % 7 === 0 ? 14 : 0)
            const voz = i < 42
            return <rect key={i} x={i * 5} y={25 - h / 2} width="3" height={h} rx="1.5" className={voz ? "fill-sky-500" : "fill-foreground/35"} />
          })}
        </svg>
        <div className="mt-1 flex gap-4 text-[11px] text-muted-foreground">
          <span><b className="text-sky-500">■</b> La voz manda, siempre clara</span>
          <span><b className="text-foreground/35">■</b> La música, abajo</span>
        </div>
      </div>
    ),
  },
]

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

/** El ejemplo visual de un bloque de la edición, si tiene uno. */
export function EjemploEdicion({ titulo }: { titulo: string }) {
  const t = sinTildes(titulo)
  const e = EJEMPLOS.find((x) => t.includes(x.clave))
  if (!e) return null
  return <div className="mt-4 border-t pt-4">{e.render()}</div>
}

// ──────────────────────────────────────────────────────────────
// GUÍA PARA EDITORES
//
// Lo que un editor nuevo necesita saber antes de tocar el primer video, en
// tarjetas que se entienden mirando. Sale de lo ya decidido en el reto:
// 20–40 s, gancho en el primer segundo, subtítulos, pruebas reales y los
// datos de terceros tapados en la imagen.
// ──────────────────────────────────────────────────────────────

function Tarjeta({ n, titulo, nota, children }: { n: number; titulo: string; nota: string; children: ReactNode }) {
  return (
    <section className="rounded-[14px] border bg-card/40 p-4">
      <h4 className="flex items-baseline gap-2 text-sm font-semibold">
        <span className="font-display text-xs font-bold tabular-nums text-gold">{String(n).padStart(2, "0")}</span>
        {titulo}
      </h4>
      <p className="mt-1 text-xs text-muted-foreground">{nota}</p>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export function GuiaEditores() {
  return (
    <div className="mt-6">
      <h3 className="text-base font-semibold">Guía para editores</h3>
      <p className="mt-1 text-xs text-muted-foreground">Lo básico antes de editar el primer capítulo. Se lee en 2 minutos.</p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Tarjeta n={1} titulo="Formato y zonas seguras" nota="Todo vertical. Lo importante nunca va donde la app pone sus botones.">
          <div className="flex items-start gap-4">
            <div className="relative aspect-[9/16] w-[132px] shrink-0 overflow-hidden rounded-[18px] border-[3px] border-foreground/80 bg-black">
              <Foto src={FOTO} className="opacity-60" />
              <div className="absolute inset-x-0 top-0 h-[11%] bg-rojo/45" />
              <div className="absolute inset-x-0 bottom-0 h-[22%] bg-rojo/45" />
              <div className="absolute bottom-[22%] right-0 top-[40%] w-[13%] bg-rojo/45" />
              <div className="absolute inset-x-[6%] bottom-[23%] top-[12%] rounded border-2 border-dashed border-sky-300" />
            </div>
            <ul className="space-y-1.5 text-[12px]">
              <li><b>1080 × 1920</b> · 9:16 · 30 fps</li>
              <li><span className="text-rojo">■</span> Rojo: lo tapan los botones</li>
              <li><span className="text-sky-500">▢</span> Celeste: textos y pruebas aquí</li>
              <li>Exportar en MP4 (H.264)</li>
            </ul>
          </div>
        </Tarjeta>

        <Tarjeta n={2} titulo="Un capítulo, segundo a segundo" nota="Ideal: 20 a 40 segundos. Solo los capítulos grandes llegan a 60.">
          <Tiempo tramos={[
            { de: 0, a: 3, texto: "Gancho", color: "bg-rojo" },
            { de: 3, a: 7, texto: "Día + marcador", color: "bg-gold" },
            { de: 7, a: 24, texto: "Estructura + prueba", color: "bg-foreground/55" },
            { de: 24, a: 29, texto: "CTA", color: "bg-sky-600" },
            { de: 29, a: 32, texto: "Cierre", color: "bg-foreground/80" },
          ]} />
          <p className="mt-2 text-[12px]">El cierre siempre igual: <b>«Esto recién empieza.»</b> Es la firma del capítulo.</p>
        </Tarjeta>

        <Tarjeta n={3} titulo="Subtítulos" nota="Casi todos miran sin sonido. Sin subtítulos, el video no existe para ellos.">
          <div className="flex gap-3">
            <Celular mal pie="Párrafo entero">
              <Foto src={RETRATO} pos="center 30%" />
              <span className="absolute bottom-8 left-1.5 right-1.5 text-center text-[7px] leading-tight text-white">y entonces lo que pasó fue que el cliente me pagó en bolivianos y cuando lo cambié a dólares me di cuenta de que</span>
            </Celular>
            <Celular pie="2 líneas, la clave en celeste">
              <Foto src={RETRATO} pos="center 30%" />
              <span className="absolute bottom-10 left-2 right-2 rounded bg-black/70 px-1 py-0.5 text-center text-[11px] font-bold leading-tight text-white">
                me quedaron <span className="text-sky-300">$431</span>
              </span>
            </Celular>
          </div>
        </Tarjeta>

        <Tarjeta n={4} titulo="Datos de terceros: siempre tapados" nota="Nombre, cuenta o teléfono de un cliente se tapan con barra sólida en la imagen. Nunca con desenfoque.">
          <div className="flex gap-3">
            <figure className="w-[150px]">
              <div className="relative overflow-hidden rounded-md border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={COMPROBANTE} alt="" className="w-full" />
              </div>
              <figcaption className="mt-1.5 text-[11px] font-semibold text-kev-success">✓ Barra sólida: el dato no existe en el archivo</figcaption>
            </figure>
            <ul className="space-y-1.5 pt-1 text-[12px]">
              <li><span className="text-rojo">✕</span> Desenfoque: se puede revertir</li>
              <li><span className="text-rojo">✕</span> Emoji encima: se ve el borde</li>
              <li><span className="text-kev-success">✓</span> Barra negra sólida, opaca</li>
            </ul>
          </div>
        </Tarjeta>

        <Tarjeta n={5} titulo="Nombre del archivo" nota="Así cualquiera sabe qué es sin abrirlo.">
          <code className="block rounded-md bg-foreground/[0.05] px-3 py-2 text-[13px]">dia-119_nunca-vas-a-llegar_v2.mp4</code>
          <ul className="mt-2 space-y-1 text-[12px] text-muted-foreground">
            <li><b className="text-foreground">dia-119</b> · el día del reto</li>
            <li><b className="text-foreground">nunca-vas-a-llegar</b> · el título corto</li>
            <li><b className="text-foreground">v2</b> · la versión; nunca «final-final»</li>
          </ul>
        </Tarjeta>

        <Tarjeta n={6} titulo="Antes de entregar" nota="Si falla uno, no se entrega.">
          <ul className="space-y-1.5 text-[12.5px]">
            {[
              "El gancho entra en el primer segundo",
              "El día y el monto coinciden con kevproject.world",
              "Cada número que se dice se muestra en pantalla",
              "Datos de terceros tapados con barra sólida",
              "Subtítulos revisados: sin errores y en español neutro",
              "Nada importante en las zonas rojas",
              "Termina con el CTA y con «Esto recién empieza.»",
            ].map((x) => (
              <li key={x} className="flex gap-2"><span className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border border-foreground/40" />{x}</li>
            ))}
          </ul>
        </Tarjeta>
      </div>
    </div>
  )
}
