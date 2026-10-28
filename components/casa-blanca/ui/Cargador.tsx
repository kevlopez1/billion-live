"use client"

// ──────────────────────────────────────────────────────────────
// La escena 3D solo existe en el navegador (WebGL), así que se carga con
// ssr: false. Next no permite ssr: false desde un componente de servidor:
// por eso este puente de cliente entre page.tsx y CasaBlancaViva.
// ──────────────────────────────────────────────────────────────

import dynamic from "next/dynamic"

function Negro() {
  return (
    <div className="fixed inset-0 grid place-items-center bg-black" aria-busy="true" aria-label="Cargando La Casa Blanca Project">
      <span className="cb-cargando text-[11px] font-semibold uppercase tracking-[0.5em] text-white/35">La Casa Blanca Project</span>
      <style>{`.cb-cargando{animation:cbCarga 1.6s ease-in-out infinite}@keyframes cbCarga{0%,100%{opacity:.25}50%{opacity:.8}}@media (prefers-reduced-motion: reduce){.cb-cargando{animation:none}}`}</style>
    </div>
  )
}

const CasaBlancaViva = dynamic(() => import("../CasaBlancaViva"), { ssr: false, loading: Negro })

export function Cargador() {
  return <CasaBlancaViva />
}
