"use client"

// El estudio usa WebGL: solo existe en el navegador (ssr: false), como ui/Cargador.tsx.
import dynamic from "next/dynamic"

const Estudio = dynamic(() => import("./Estudio"), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-black" aria-busy="true" aria-label="Cargando el estudio" />,
})

export function CargadorEstudio() {
  return <Estudio />
}
