"use client"

// ──────────────────────────────────────────────────────────────
// Noticia de última hora: llega a toda la casa, cada residente reacciona en
// voz alta y va adonde le parece. Las reacciones las escribe la IA; si no
// responde, cada uno usa la suya del guion (campo `noticia` de su ficha).
// ──────────────────────────────────────────────────────────────

import { useState } from "react"
import { conPrime } from "@/components/prime-mark"
import { BotonFuerte, Campo, FOCO, Modal, Rotulo } from "./base"

// Propuestas de juego, claramente ficción. Nada que se lea como un hecho real
// de PRIME o de una persona viva, y nada con helicópteros (por Kobe).
export const PROPUESTAS_NOTICIA = [
  "Se cayó internet en toda la casa",
  "La bolsa sube un 10 % en una hora",
  "Un periodista pregunta quién manda aquí",
  "Se corta la luz en el subsuelo",
  "Un inversor quiere visitar la casa mañana",
]

export function DarNoticia({ onDar, onCerrar }: { onDar: (texto: string) => void; onCerrar: () => void }) {
  const [texto, setTexto] = useState("")
  return (
    <Modal titulo="Noticia de última hora" onCerrar={onCerrar}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onDar(texto.trim() || PROPUESTAS_NOTICIA[0])
        }}
      >
        <Rotulo className="mb-2 mt-1">Qué pasó</Rotulo>
        <Campo valor={texto} onCambio={setTexto} etiqueta="La noticia" placeholder="Escribe lo que acaba de pasar" max={200} />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PROPUESTAS_NOTICIA.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTexto(t)}
              aria-pressed={texto === t}
              className={`rounded-full border px-3 py-1.5 text-left text-[12px] font-semibold transition-colors ${FOCO} ${
                texto === t ? "border-white bg-white text-black" : "border-white/12 text-white/75 hover:border-white/30 hover:text-white"
              }`}
            >
              {conPrime(t, false)}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11.5px] text-white/45">Todos la escuchan, reaccionan y van adonde les parece.</p>
        <div className="mt-5 flex justify-end">
          <BotonFuerte tipo="submit">Dar la noticia</BotonFuerte>
        </div>
      </form>
    </Modal>
  )
}
