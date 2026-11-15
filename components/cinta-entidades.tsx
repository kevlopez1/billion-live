import { COMPROBANTES } from "@/lib/comprobantes"

// Los bancos y medios por los que entró plata real, en una cinta que corre.
// Sale de los comprobantes: no se escribe a mano.
// "Empresa" y "Efectivo" no son entidades: de ahí se toma el banco que sigue.
const ENTIDADES = [
  ...new Set(
    COMPROBANTES.map((c) => {
      const [a, b] = c.bank.split(" · ")
      return (a === "Empresa" || a === "Efectivo") && b ? b : a
    }).filter((e) => !e.startsWith("Transferencia") && !e.startsWith("cliente")),
  ),
]

export function CintaEntidades() {
  const fila = ENTIDADES.map((e) => (
    <span key={e} className="px-5 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
      {e}
    </span>
  ))
  return (
    <div
      className="relative mt-6 overflow-hidden"
      style={{ maskImage: "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)" }}
      aria-label={`Pagos recibidos por ${ENTIDADES.join(", ")}`}
    >
      <div className="ticker-track" aria-hidden>
        <span className="inline-flex">{fila}</span>
        <span className="inline-flex">{fila}</span>
      </div>
    </div>
  )
}
