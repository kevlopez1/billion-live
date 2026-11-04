"use client"

import { useEffect, useState } from "react"
import { Ordenable } from "@/components/branding/ordenable"
import { conPrime } from "@/components/prime-mark"
import { guardarClave, leerClave } from "@/lib/clave"
import { FABRICA_BASE, type ContenidoFabrica, type Referente, type Seccion } from "@/lib/fabrica-reels"
import { Diagrama } from "./diagrama"
import s from "./fabrica.module.css"

// ──────────────────────────────────────────────────────────────
// /fabrica — se lee sin clave. Con la clave de Kev se edita todo: el texto,
// el orden de las secciones (arrastrando), los pasos del flujo y las notas.
// Nada se guarda solo: el botón Guardar manda el documento entero, como en
// /branding, y la versión anterior queda en el historial.
// ──────────────────────────────────────────────────────────────

const mover = <T,>(arr: T[], desde: number, hasta: number) => {
  const c = [...arr]
  const [x] = c.splice(desde, 1)
  c.splice(hasta, 0, x)
  return c
}

export function Fabrica() {
  const [doc, setDoc] = useState<ContenidoFabrica>(FABRICA_BASE)
  const [editando, setEditando] = useState(false)
  const [clave, setClave] = useState("")
  const [pidiendoClave, setPidiendoClave] = useState(false)
  const [cambios, setCambios] = useState(false)
  const [estado, setEstado] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [avisoSalir, setAvisoSalir] = useState(false)

  const cargar = () =>
    fetch("/api/fabrica-reels", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d?.contenido && setDoc(d.contenido))
      .catch(() => {})

  useEffect(() => {
    setClave(leerClave() ?? "")
    cargar()
  }, [])

  // Sin guardar, avisar antes de cerrar la pestaña.
  useEffect(() => {
    if (!cambios) return
    const f = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", f)
    return () => window.removeEventListener("beforeunload", f)
  }, [cambios])

  const cambiar = (f: (d: ContenidoFabrica) => ContenidoFabrica) => {
    setDoc((d) => f(structuredClone(d)))
    setCambios(true)
  }
  const cambiarSeccion = (i: number, f: (x: Seccion) => Seccion) =>
    cambiar((d) => ({ ...d, secciones: d.secciones.map((x, j) => (j === i ? f(x) : x)) }))

  const entrar = () => {
    if (!clave) { setPidiendoClave(true); return }
    setEditando(true)
  }

  const guardar = async () => {
    if (!clave) { setPidiendoClave(true); return }
    setGuardando(true)
    setEstado("Guardando…")
    try {
      const r = await fetch("/api/fabrica-reels", {
        method: "PUT",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${clave}` },
        body: JSON.stringify({ contenido: doc }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setEstado(d.error || "No se pudo guardar."); return }
      setCambios(false)
      setEstado("Guardado.")
    } catch {
      setEstado("Sin conexión. Inténtalo de nuevo.")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <main className={s.pagina}>
      <div className={s.contenedor}>
        <header className={s.cabecera}>
          <div className={s.fila}>
            <span className={s.etiqueta}>Kev Project GTA · de $10 a un Mercedes Mansory</span>
            {!editando && <button className={s.botonChico} onClick={entrar}>Editar</button>}
          </div>
          {editando ? (
            <>
              <input className={s.campo} value={doc.titulo} onChange={(e) => cambiar((d) => ({ ...d, titulo: e.target.value }))} aria-label="Título" />
              <textarea className={s.campo} value={doc.bajada} onChange={(e) => cambiar((d) => ({ ...d, bajada: e.target.value }))} aria-label="Bajada" />
            </>
          ) : (
            <>
              <h1 className={s.titulo}>{doc.titulo}</h1>
              <p className={s.bajada}>{doc.bajada}</p>
            </>
          )}
        </header>

        {pidiendoClave && (
          <form
            className={s.fila}
            onSubmit={(e) => { e.preventDefault(); if (clave) { guardarClave(clave); setPidiendoClave(false); setEditando(true) } }}
          >
            <input id="clave-fabrica" type="password" className={s.campo} style={{ flex: 1 }} placeholder="Tu clave — se pide una sola vez en este dispositivo" value={clave} onChange={(e) => setClave(e.target.value)} />
            <button className={s.botonClaro} type="submit">Entrar</button>
          </form>
        )}

        {editando && (
          <div className={s.barra}>
            <button className={s.botonClaro} onClick={guardar} disabled={guardando || !cambios}>Guardar</button>
            <button
              className={s.boton}
              onClick={() => {
                if (cambios && !avisoSalir) { setAvisoSalir(true); setEstado("Tienes cambios sin guardar. Pulsa de nuevo para salir y descartarlos."); return }
                if (cambios) { cargar(); setCambios(false) }
                setAvisoSalir(false); setEditando(false); setEstado("")
              }}
            >Salir de edición</button>
            <span className={s.estado}>{estado || (cambios ? "Hay cambios sin guardar." : "Arrastra ⋮⋮ para mover las secciones.")}</span>
          </div>
        )}

        {editando ? (
          <Ordenable items={doc.secciones} clave={(x) => x.id} mover={(a, b) => cambiar((d) => ({ ...d, secciones: mover(d.secciones, a, b) }))} nombre="sección">
            {(sec, i) => <SeccionVista sec={sec} i={i} doc={doc} editando cambiar={cambiar} cambiarSeccion={cambiarSeccion} />}
          </Ordenable>
        ) : (
          doc.secciones.map((sec, i) => <SeccionVista key={sec.id} sec={sec} i={i} doc={doc} editando={false} cambiar={cambiar} cambiarSeccion={cambiarSeccion} />)
        )}
      </div>
    </main>
  )
}

type PropsSeccion = {
  sec: Seccion
  i: number
  doc: ContenidoFabrica
  editando: boolean
  cambiar: (f: (d: ContenidoFabrica) => ContenidoFabrica) => void
  cambiarSeccion: (i: number, f: (x: Seccion) => Seccion) => void
}

function SeccionVista({ sec, i, doc, editando, cambiar, cambiarSeccion }: PropsSeccion) {
  return (
    <section className={s.seccion} aria-labelledby={`s-${sec.id}`}>
      {editando ? (
        <div className={s.editable}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <input className={s.campo} value={sec.etiqueta} onChange={(e) => cambiarSeccion(i, (x) => ({ ...x, etiqueta: e.target.value }))} aria-label="Etiqueta de la sección" />
            <input className={s.campo} value={sec.titulo} onChange={(e) => cambiarSeccion(i, (x) => ({ ...x, titulo: e.target.value }))} aria-label="Título de la sección" />
          </div>
        </div>
      ) : (
        <>
          <span className={s.etiqueta}>{sec.etiqueta}</span>
          <h2 id={`s-${sec.id}`} className={s.h2}>{sec.titulo}</h2>
        </>
      )}

      {sec.tipo === "flujo" && <Flujo doc={doc} editando={editando} cambiar={cambiar} />}
      {sec.tipo === "lista" && <Lista items={sec.items} editando={editando} poner={(items) => cambiarSeccion(i, (x) => ({ ...x, items } as Seccion))} />}
      {sec.tipo === "referentes" && <Referentes refs={sec.refs} editando={editando} poner={(refs) => cambiarSeccion(i, (x) => ({ ...x, refs } as Seccion))} />}
      {sec.tipo === "tabla" && <Tabla columnas={sec.columnas} filas={sec.filas} editando={editando} poner={(filas) => cambiarSeccion(i, (x) => ({ ...x, filas } as Seccion))} />}
      {sec.tipo === "notas" && <Notas doc={doc} editando={editando} cambiar={cambiar} />}
    </section>
  )
}

function Flujo({ doc, editando, cambiar }: { doc: ContenidoFabrica; editando: boolean; cambiar: PropsSeccion["cambiar"] }) {
  return (
    <>
      <Diagrama pasos={doc.pasos} retornos={doc.retornos} />
      {editando && (
        <div className={s.pasosEdit}>
          <span className={s.etiqueta}>Pasos</span>
          {doc.pasos.map((p, i) => (
            <div key={i} className={s.pasoEdit}>
              <input className={s.campo} value={p.titulo} onChange={(e) => cambiar((d) => { d.pasos[i].titulo = e.target.value; return d })} aria-label={`Título del paso ${i + 1}`} />
              <input className={s.campo} value={p.detalle} onChange={(e) => cambiar((d) => { d.pasos[i].detalle = e.target.value; return d })} aria-label={`Detalle del paso ${i + 1}`} />
              <button className={s.botonChico} disabled={i === 0} onClick={() => cambiar((d) => ({ ...d, pasos: mover(d.pasos, i, i - 1) }))} aria-label="Subir paso">↑</button>
              <button className={s.botonChico} onClick={() => cambiar((d) => ({ ...d, pasos: d.pasos.filter((_, j) => j !== i), retornos: d.retornos.filter((r) => r.desde !== i && r.hasta !== i).map((r) => ({ ...r, desde: r.desde > i ? r.desde - 1 : r.desde, hasta: r.hasta > i ? r.hasta - 1 : r.hasta })) }))} aria-label="Borrar paso">✕</button>
            </div>
          ))}
          <div><button className={s.botonChico} onClick={() => cambiar((d) => ({ ...d, pasos: [...d.pasos, { titulo: `${d.pasos.length + 1} · Nuevo paso`, detalle: "Detalle" }] }))}>+ Paso</button></div>

          <span className={s.etiqueta}>Flechas que vuelven (número de paso: desde → hasta)</span>
          {doc.retornos.map((r, i) => (
            <div key={i} className={s.retornoEdit}>
              <input className={s.campo} type="number" min={1} max={doc.pasos.length} value={r.desde + 1} onChange={(e) => cambiar((d) => { d.retornos[i].desde = Math.max(0, Math.min(d.pasos.length - 1, Number(e.target.value) - 1)); return d })} aria-label="Desde el paso" />
              <input className={s.campo} type="number" min={1} max={doc.pasos.length} value={r.hasta + 1} onChange={(e) => cambiar((d) => { d.retornos[i].hasta = Math.max(0, Math.min(d.pasos.length - 1, Number(e.target.value) - 1)); return d })} aria-label="Hasta el paso" />
              <input className={s.campo} value={r.etiqueta} onChange={(e) => cambiar((d) => { d.retornos[i].etiqueta = e.target.value; return d })} aria-label="Etiqueta de la flecha" />
              <button className={s.botonChico} onClick={() => cambiar((d) => { d.retornos[i].punteado = !d.retornos[i].punteado; return d })}>{r.punteado ? "Punteada" : "Sólida"}</button>
              <button className={s.botonChico} onClick={() => cambiar((d) => ({ ...d, retornos: d.retornos.filter((_, j) => j !== i) }))} aria-label="Borrar flecha">✕</button>
            </div>
          ))}
          <div><button className={s.botonChico} onClick={() => cambiar((d) => ({ ...d, retornos: [...d.retornos, { desde: d.pasos.length - 1, hasta: 0, etiqueta: "vuelve" }] }))}>+ Flecha</button></div>
        </div>
      )}
    </>
  )
}

function Lista({ items, editando, poner }: { items: string[]; editando: boolean; poner: (x: string[]) => void }) {
  if (!editando) {
    return <ol className={s.lista}>{items.map((t, i) => <li key={i}>{conPrime(t, false)}</li>)}</ol>
  }
  return (
    <>
      <Ordenable items={items} clave={(_, i) => String(i)} mover={(a, b) => poner(mover(items, a, b))} nombre="punto">
        {(t, i) => (
          <div className={s.editable}>
            <textarea className={s.campo} rows={1} value={t} onChange={(e) => poner(items.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`Punto ${i + 1}`} />
            <button className={s.botonChico} onClick={() => poner(items.filter((_, j) => j !== i))} aria-label="Borrar punto">✕</button>
          </div>
        )}
      </Ordenable>
      <div><button className={s.botonChico} onClick={() => poner([...items, ""])}>+ Punto</button></div>
    </>
  )
}

function Referentes({ refs, editando, poner }: { refs: Referente[]; editando: boolean; poner: (x: Referente[]) => void }) {
  const cambiar = (i: number, cambio: Partial<Referente>) => poner(refs.map((r, j) => (j === i ? { ...r, ...cambio } : r)))
  const vista = (r: Referente, i: number) => (
    <article key={i} className={`${s.ref} ${r.ancho ? s.ancho : ""}`}>
      {r.imagenes.length > 0 && (
        <div className={s.capturas}>{r.imagenes.map((src) => <img key={src} src={src} alt={`Captura de ${r.nombre}`} loading="lazy" />)}</div>
      )}
      <div className={s.notasRef}>
        {editando ? (
          <>
            <input className={s.campo} value={r.nombre} onChange={(e) => cambiar(i, { nombre: e.target.value })} aria-label="Nombre" />
            <input className={s.campo} value={r.url} onChange={(e) => cambiar(i, { url: e.target.value })} aria-label="Link" />
            <input className={s.campo} value={r.datos} onChange={(e) => cambiar(i, { datos: e.target.value })} aria-label="Datos" />
            <textarea className={s.campo} rows={4} value={r.puntos.join("\n")} onChange={(e) => cambiar(i, { puntos: e.target.value.split("\n") })} aria-label="Qué funciona, un punto por línea" />
            <textarea className={s.campo} rows={2} value={r.paraKev} onChange={(e) => cambiar(i, { paraKev: e.target.value })} aria-label="Para Kev" />
            <textarea className={s.campo} rows={2} value={r.imagenes.join("\n")} onChange={(e) => cambiar(i, { imagenes: e.target.value.split("\n").filter(Boolean) })} aria-label="Imágenes, una ruta por línea" />
            <div><button className={s.botonChico} onClick={() => poner(refs.filter((_, j) => j !== i))}>Borrar referente</button></div>
          </>
        ) : (
          <>
            <h3><a href={r.url} target="_blank" rel="noopener noreferrer">{r.nombre} ↗</a></h3>
            <span className={s.datos}>{r.datos}</span>
            <ul className={s.puntos}>{r.puntos.filter(Boolean).map((p, j) => <li key={j}>{conPrime(p, false)}</li>)}</ul>
            {r.paraKev && <p className={s.paraKev}><b>Para Kev</b>{conPrime(r.paraKev, false)}</p>}
          </>
        )}
      </div>
    </article>
  )
  if (!editando) return <div className={s.refs}>{refs.map(vista)}</div>
  return (
    <>
      <Ordenable items={refs} clave={(_, i) => String(i)} mover={(a, b) => poner(mover(refs, a, b))} nombre="referente">
        {(r, i) => vista(r, i)}
      </Ordenable>
      <div><button className={s.botonChico} onClick={() => poner([...refs, { nombre: "Nuevo referente", url: "", datos: "", imagenes: [], puntos: [], paraKev: "" }])}>+ Referente</button></div>
    </>
  )
}

function Tabla({ columnas, filas, editando, poner }: { columnas: string[]; filas: string[][]; editando: boolean; poner: (x: string[][]) => void }) {
  return (
    <div className={s.tablaCont}>
      <table className={s.tabla}>
        <thead><tr>{columnas.map((c) => <th key={c}>{c}</th>)}{editando && <th />}</tr></thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i}>
              {f.map((celda, j) => (
                <td key={j}>
                  {editando ? (
                    <input className={s.campo} value={celda} onChange={(e) => poner(filas.map((x, a) => (a === i ? x.map((y, b) => (b === j ? e.target.value : y)) : x)))} aria-label={`${columnas[j]} fila ${i + 1}`} />
                  ) : celda}
                </td>
              ))}
              {editando && <td><button className={s.botonChico} onClick={() => poner(filas.filter((_, a) => a !== i))} aria-label="Borrar fila">✕</button></td>}
            </tr>
          ))}
        </tbody>
      </table>
      {editando && <div style={{ marginTop: 8 }}><button className={s.botonChico} onClick={() => poner([...filas, columnas.map(() => "")])}>+ Fila</button></div>}
    </div>
  )
}

function Notas({ doc, editando, cambiar }: { doc: ContenidoFabrica; editando: boolean; cambiar: PropsSeccion["cambiar"] }) {
  const [nueva, setNueva] = useState("")
  const fecha = (iso: string) => {
    try { return new Date(iso).toLocaleDateString("es-BO", { day: "numeric", month: "short", year: "numeric" }) } catch { return iso }
  }
  return (
    <div className={s.notas}>
      {editando && (
        <form className={s.editable} onSubmit={(e) => {
          e.preventDefault()
          const t = nueva.trim()
          if (!t) return
          cambiar((d) => ({ ...d, notas: [{ id: `${Date.now()}`, texto: t, fecha: new Date().toISOString() }, ...d.notas] }))
          setNueva("")
        }}>
          <textarea id="nota-nueva" className={s.campo} rows={3} placeholder="Escribe una nota…" value={nueva} onChange={(e) => setNueva(e.target.value)} />
          <button className={s.botonClaro} type="submit">Agregar</button>
        </form>
      )}
      {doc.notas.length === 0 && <p className={s.estado}>Todavía no hay notas.{editando ? "" : " Entra a Editar para escribir la primera."}</p>}
      {doc.notas.map((n, i) => (
        <div key={n.id} className={s.nota}>
          <span className={s.notaFecha}>{fecha(n.fecha)}</span>
          {editando ? (
            <div className={s.editable}>
              <textarea className={s.campo} rows={3} value={n.texto} onChange={(e) => cambiar((d) => { d.notas[i].texto = e.target.value; return d })} aria-label="Nota" />
              <button className={s.botonChico} onClick={() => cambiar((d) => ({ ...d, notas: d.notas.filter((_, j) => j !== i) }))} aria-label="Borrar nota">✕</button>
            </div>
          ) : conPrime(n.texto, false)}
        </div>
      ))}
    </div>
  )
}
