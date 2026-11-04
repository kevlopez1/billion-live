"use client"

import { useEffect, useState } from "react"
import s from "./fabrica.module.css"

// ──────────────────────────────────────────────────────────────
// MÉTRICAS DE LAS CUENTAS
//
// Lee /fabrica/metricas.json, que arma el script herramientas/metricas.js del
// repo de edición (Instagram y Facebook por la Graph API, TikTok desde el
// perfil público). Solo se muestra lo que trajo el script: nada se calcula
// ni se inventa acá.
// ──────────────────────────────────────────────────────────────

type Video = {
  titulo: string
  url: string
  fecha?: string
  vistas: number | null
  likes?: number | null
  comentarios?: number | null
  compartidos?: number | null
  fijado?: boolean
}
type Cuenta = { red: string; cuenta: string; seguidores: number | null; likesTotales?: number | null; videos: Video[] }
type Datos = { canal: string; actualizado: string; cuentas: Cuenta[] }

const num = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("es-BO"))

export function Metricas() {
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState(false)
  const [abierta, setAbierta] = useState(0)

  useEffect(() => {
    fetch("/fabrica/metricas.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setDatos)
      .catch(() => setError(true))
  }, [])

  if (error) return <p className={s.estado}>Todavía no hay métricas cargadas.</p>
  if (!datos) return <p className={s.estado}>Cargando…</p>

  const cuenta = datos.cuentas[abierta]
  const videos = cuenta ? [...cuenta.videos].sort((a, b) => (b.vistas ?? -1) - (a.vistas ?? -1)) : []
  const conLikes = videos.some((v) => v.likes != null)
  const fecha = new Date(datos.actualizado).toLocaleString("es-BO", { dateStyle: "medium", timeStyle: "short" })

  return (
    <div className={s.metricas}>
      <p className={s.estado}>Actualizado: {fecha}</p>

      <div className={s.cifras}>
        {datos.cuentas.map((c, i) => (
          <button key={c.red + c.cuenta} className={i === abierta ? s.cifraActiva : s.cifra} onClick={() => setAbierta(i)}>
            <span className={s.cifraRed}>{c.red}</span>
            <span className={s.cifraNumero}>{num(c.seguidores)}</span>
            <span className={s.cifraCuenta}>seguidores · {c.cuenta}</span>
            {c.likesTotales != null && <span className={s.cifraCuenta}>{num(c.likesTotales)} likes en total</span>}
          </button>
        ))}
      </div>

      {cuenta && videos.length > 0 && (
        <div className={s.tablaCont}>
          <table className={`${s.tabla} ${s.tablaMet}`}>
            <thead>
              <tr>
                <th>Video</th>
                <th>Vistas</th>
                {conLikes && <th>Likes</th>}
                {conLikes && <th>Coment.</th>}
                {conLikes && <th>Compart.</th>}
              </tr>
            </thead>
            <tbody>
              {videos.map((v) => (
                <tr key={v.url}>
                  <td>
                    <div className={s.celdaVideo}>
                      <a href={v.url} target="_blank" rel="noreferrer">{v.titulo || "Sin texto"}</a>
                      {(v.fecha || v.fijado) && <span className={s.notaFecha}>{[v.fecha, v.fijado && "anclado"].filter(Boolean).join(" · ")}</span>}
                    </div>
                  </td>
                  <td>{num(v.vistas)}</td>
                  {conLikes && <td>{num(v.likes)}</td>}
                  {conLikes && <td>{num(v.comentarios)}</td>}
                  {conLikes && <td>{num(v.compartidos)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {cuenta && videos.length === 0 && <p className={s.estado}>Esta cuenta no tiene videos con datos todavía.</p>}
    </div>
  )
}
