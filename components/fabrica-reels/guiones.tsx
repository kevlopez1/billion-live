"use client"

import { useState } from "react"
import type { Guion } from "@/lib/fabrica-reels"
import { conPrime } from "@/components/prime-mark"
import s from "./fabrica.module.css"

// ──────────────────────────────────────────────────────────────
// GUIONES, DIBUJADOS COMO LÍNEA DE TIEMPO
//
// Arriba, una barra con cada escena del ancho de su duración (se lee el
// ritmo de un vistazo). Abajo, escena por escena: el segundo, lo que se ve
// en pantalla y lo que dice Kev. En modo edición, todo es un campo.
// ──────────────────────────────────────────────────────────────

const tramo = (seg: string) => {
  const [a, b] = seg.split(/[–-]/).map((x) => parseFloat(x.replace(",", ".")))
  return Number.isFinite(a) && Number.isFinite(b) && b > a ? { a, b } : null
}

function Barra({ escenas }: { escenas: string[][] }) {
  const tramos = escenas.map((e) => tramo(e[0] ?? ""))
  const total = Math.max(0, ...tramos.map((t) => t?.b ?? 0))
  if (!total || tramos.some((t) => !t)) return null
  return (
    <div className={s.barraGuion} aria-hidden="true">
      {tramos.map((t, i) => (
        <div key={i} className={s.barraTramo} style={{ flexGrow: t!.b - t!.a }}>
          <span>{i + 1}</span>
        </div>
      ))}
      <span className={s.barraTotal}>{total} s</span>
    </div>
  )
}

export function Guiones({ guiones, editando, poner }: { guiones: Guion[]; editando: boolean; poner: (g: Guion[]) => void }) {
  const cambiar = (i: number, c: Partial<Guion>) => poner(guiones.map((g, j) => (j === i ? { ...g, ...c } : g)))
  // Grupos (series) en el orden en que aparecen; los guiones sin serie van en «Otros».
  const serieDe = (g: Guion) => g.serie?.trim() || "Otros"
  const series = [...new Set(guiones.map(serieDe))]
  const [serie, setSerie] = useState("")
  const abierta = series.includes(serie) ? serie : series[0]

  return (
    <div className={s.guiones}>
      {series.length > 1 && (
        <div className={s.subPestanas} role="tablist" aria-label="Series de guiones">
          {series.map((x) => (
            <button key={x} role="tab" aria-selected={x === abierta} className={x === abierta ? s.subPestanaActiva : s.subPestana} onClick={() => setSerie(x)}>
              {x} <span className={s.subCuenta}>{guiones.filter((g) => serieDe(g) === x).length}</span>
            </button>
          ))}
        </div>
      )}
      {guiones.map((g, i) => serieDe(g) !== abierta ? null : (
        <article key={i} className={s.guion}>
          {editando ? (
            <div className={s.guionEdit}>
              <input className={s.campo} value={g.serie ?? ""} placeholder="Serie (ej.: Personajes, Con música)" onChange={(e) => cambiar(i, { serie: e.target.value })} aria-label="Serie" />
              <input className={s.campo} value={g.titulo} onChange={(e) => cambiar(i, { titulo: e.target.value })} aria-label="Título del guion" />
              <input className={s.campo} value={g.estado} onChange={(e) => cambiar(i, { estado: e.target.value })} aria-label="Estado" />
              <input className={s.campo} value={g.datos} onChange={(e) => cambiar(i, { datos: e.target.value })} aria-label="Datos" />
            </div>
          ) : (
            <header className={s.guionCabeza}>
              <span className={s.guionEstado}>{g.estado}</span>
              <h3>{g.titulo}</h3>
              <span className={s.datos}>{g.datos}</span>
            </header>
          )}

          <Barra escenas={g.escenas} />

          <ol className={s.escenas}>
            {g.escenas.map((e, j) => (
              <li key={j} className={s.escena}>
                <span className={s.escenaNum}>{j + 1}</span>
                {editando ? (
                  <div className={s.escenaEdit}>
                    {["Segundos", "En pantalla", "Kev dice"].map((nombre, k) => (
                      <textarea key={k} className={s.campo} rows={k === 0 ? 1 : 2} value={e[k] ?? ""} aria-label={`${nombre}, escena ${j + 1}`}
                        onChange={(ev) => cambiar(i, { escenas: g.escenas.map((x, a) => (a === j ? [0, 1, 2].map((b) => (b === k ? ev.target.value : x[b] ?? "")) : x)) })} />
                    ))}
                    <button className={s.botonChico} onClick={() => cambiar(i, { escenas: g.escenas.filter((_, a) => a !== j) })}>Borrar escena</button>
                  </div>
                ) : (
                  <>
                    <span className={s.escenaSeg}>{e[0]} s</span>
                    <div className={s.escenaPantalla}>{e[1]}</div>
                    {/^\(.*\)$/.test((e[2] ?? "").trim()) || !(e[2] ?? "").trim()
                      ? <p className={s.escenaSinVoz}>{e[2] || "(sin voz)"}</p>
                      : <p className={s.escenaDice}>«{conPrime(e[2] ?? "", false)}»</p>}
                  </>
                )}
              </li>
            ))}
          </ol>
          {editando && <div><button className={s.botonChico} onClick={() => cambiar(i, { escenas: [...g.escenas, ["", "", ""]] })}>+ Escena</button></div>}

          {editando ? (
            <textarea className={s.campo} rows={4} value={g.notas.join("\n")} onChange={(e) => cambiar(i, { notas: e.target.value.split("\n") })} aria-label="Notas, una por línea" />
          ) : (
            g.notas.length > 0 && <ul className={s.puntos}>{g.notas.filter(Boolean).map((n, k) => <li key={k}>{n}</li>)}</ul>
          )}
          {editando && <div><button className={s.botonChico} onClick={() => poner(guiones.filter((_, j) => j !== i))}>Borrar guion</button></div>}
        </article>
      ))}
      {editando && (
        <div>
          <button className={s.botonChico} onClick={() => poner([...guiones, { serie: abierta === "Otros" ? undefined : abierta, titulo: "Nuevo guion", estado: "Borrador", datos: "", escenas: [["0–2", "", ""]], notas: [] }])}>+ Guion</button>
        </div>
      )}
    </div>
  )
}
