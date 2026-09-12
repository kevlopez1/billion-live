import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, ArrowUpRight, Building2, CalendarDays, Receipt, ShieldCheck } from "lucide-react"
import { Comprobantes } from "@/components/comprobantes"
import { CANTIDAD, DESDE, ENTIDADES, HASTA, TOTAL_BS } from "@/lib/comprobantes"
import { SITE_URL } from "@/lib/site"

// ──────────────────────────────────────────────────────────────
// LA PÁGINA DE LAS PRUEBAS
//
// Vive en el MISMO dominio, no en uno aparte, a propósito:
//  1. Un dominio nuevo arranca de cero en Google, y toda la autoridad que
//     gane esta página se la lleva kevproject.world si vive acá.
//  2. Mandar a alguien a OTRO dominio a ver "pruebas de pago" es justo el
//     patrón de las estafas. La prueba vale porque está en el sitio del reto.
// Si igual se quiere un subdominio (comprobantes.kevproject.world), se apunta
// a esta misma ruta desde Vercel sin tocar una línea de código.
// ──────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "Los comprobantes",
  description: `Las ${CANTIDAD} pruebas de pago que financian el reto: Bs ${TOTAL_BS.toLocaleString("es-BO")} cobrados a clientes reales de PRIME entre ${DESDE} y ${HASTA}. Todo verificable, con los datos personales censurados.`,
  alternates: { canonical: `${SITE_URL}/comprobantes` },
  openGraph: {
    type: "article",
    url: `${SITE_URL}/comprobantes`,
    title: "Los comprobantes | KEV PROJECT GTA",
    description: `Bs ${TOTAL_BS.toLocaleString("es-BO")} en ${CANTIDAD} pagos reales de clientes de PRIME. La plata del reto, con recibo.`,
  },
}

function Dato({ icono, valor, sub }: { icono: React.ReactNode; valor: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 px-4 py-4 text-center">
      <div className="flex justify-center text-kev-primary">{icono}</div>
      <div className="mt-1.5 font-display text-xl font-extrabold tracking-tight md:text-2xl">{valor}</div>
      <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{sub}</div>
    </div>
  )
}

export default function ComprobantesPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl px-5 py-10 md:py-16">
      <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Volver al reto
      </Link>

      {/* Encabezado */}
      <div className="mt-6 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-kev-primary/40 bg-kev-primary/[0.07] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-kev-primary">
          <ShieldCheck className="h-3.5 w-3.5" /> Todo verificable
        </div>
        <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">
          Los comprobantes
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground md:text-base">
          Todo el mundo muestra el auto. Acá está la factura. Cada peso que mueve el contador entró por un pago
          real de un <b className="text-foreground">cliente de PRIME</b>, y acá está el recibo de cada uno.
        </p>
      </div>

      {/* Los números de un vistazo */}
      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Dato icono={<Receipt className="h-4 w-4" />} valor={`Bs ${TOTAL_BS.toLocaleString("es-BO")}`} sub="cobrado a clientes" />
        <Dato icono={<ShieldCheck className="h-4 w-4" />} valor={String(CANTIDAD)} sub="pagos con comprobante" />
        <Dato icono={<Building2 className="h-4 w-4" />} valor={String(ENTIDADES)} sub="bancos y medios distintos" />
        <Dato icono={<CalendarDays className="h-4 w-4" />} valor={HASTA.split(" ").slice(1).join(" ")} sub={`el último · desde ${DESDE}`} />
      </div>

      {/* La grilla entera */}
      <div className="mt-9">
        <Comprobantes />
      </div>

      {/* Qué NO prueba esto: decirlo primero es lo que lo hace creíble */}
      <div className="mt-8 rounded-3xl border border-border bg-card/40 px-5 py-5 md:px-7">
        <h2 className="font-display text-base font-bold tracking-tight md:text-lg">Cómo leer esto</h2>
        <ul className="mt-2.5 space-y-2 text-sm leading-relaxed text-muted-foreground">
          <li>
            <b className="text-foreground">Son ingresos, no ganancia.</b> Es lo que entró por servicios de PRIME,
            antes de costos e impuestos.
          </li>
          <li>
            <b className="text-foreground">Están en bolivianos.</b> El contador del reto los convierte a dólares al
            tipo de cambio del día en que entró cada pago, no al de hoy.
          </li>
          <li>
            <b className="text-foreground">Los datos de terceros van tapados en la imagen misma</b>, no con un
            filtro encima: el archivo que se descarga nunca tiene el dato.
          </li>
        </ul>
      </div>

      {/* La página vende: quien llegó hasta acá ya vio la prueba */}
      <div className="mt-4 rounded-3xl border border-kev-primary/40 bg-kev-primary/[0.06] px-5 py-6 text-center md:px-7">
        <h2 className="font-display text-lg font-bold tracking-tight md:text-xl">
          Esta plata sale de un negocio que existe
        </h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
          PRIME les arma empleados de IA a empresas. Los de arriba son sus clientes.
        </p>
        <a
          href="https://primebusiness.live"
          target="_blank"
          rel="noopener noreferrer"
          className="lift mt-4 inline-flex items-center gap-2 rounded-2xl bg-foreground px-6 py-3.5 font-display text-sm font-semibold text-background"
        >
          Quiero uno para mi empresa <ArrowUpRight className="h-4 w-4" />
        </a>
      </div>

      <Link href="/" className="mt-8 block text-center text-xs text-muted-foreground underline">
        Volver al reto
      </Link>
    </main>
  )
}
