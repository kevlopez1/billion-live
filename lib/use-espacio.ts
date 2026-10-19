"use client"

import { useCallback, useEffect, useRef, useState } from "react"

// ──────────────────────────────────────────────────────────────
// EL ESPACIO PRIVADO DE TRABAJO, EN UN SOLO LUGAR
//
// Clave, autoguardado, copia en el navegador y aviso de estado. Lo usan
// /kevlopez_proyectos y /preguntas, y antes vivía entero dentro del primero.
// Copiarlo para la segunda página habría dejado dos autoguardados que se
// arreglan por separado: el día que uno pierda trabajo, el otro lo sigue
// perdiendo.
//
// Dos cuidados que no se negocian:
//  1. Nada se pierde. Cada cambio se copia al navegador al instante y se
//     manda a la base con retraso. Si la base no está lista o no hay red, el
//     trabajo queda en el navegador y la barra lo dice.
//  2. La clave vive solo en sessionStorage: se borra al cerrar la pestaña.
// ──────────────────────────────────────────────────────────────

export type EstadoEspacio = "limpio" | "sucio" | "guardando" | "ok" | "error"

type Opciones<T> = {
  /** Ruta de la API. Pide clave para leer y para escribir. */
  ruta: string
  /** Prefijo de las claves de almacenamiento. Distinto por página. */
  llave: string
  /** Comprueba la forma de lo que viene de la base o del navegador. */
  valido: (x: unknown) => x is T
}

export function useEspacio<T>({ ruta, llave, valido }: Opciones<T>) {
  const K_CLAVE = `${llave}-clave`
  const K_LOCAL = `${llave}-doc`

  const [clave, setClave] = useState<string | null>(null)
  const [entrada, setEntrada] = useState("")
  const [error, setError] = useState("")
  const [cargando, setCargando] = useState(true)
  const [doc, setDoc] = useState<T | null>(null)
  const [estado, setEstado] = useState<EstadoEspacio>("limpio")
  const [mensaje, setMensaje] = useState("")
  const [nube, setNube] = useState<boolean | null>(null)

  const sucio = useRef(false)
  const version = useRef(0)
  const docRef = useRef<T | null>(null)
  docRef.current = doc

  const leerLocal = useCallback((): { doc: T; sync: boolean } | null => {
    try {
      const t = localStorage.getItem(K_LOCAL)
      if (!t) return null
      const o = JSON.parse(t)
      return valido(o?.doc) ? { doc: o.doc, sync: !!o.sync } : null
    } catch {
      return null
    }
  }, [K_LOCAL, valido])

  const escribirLocal = useCallback((d: T, sync: boolean) => {
    try {
      localStorage.setItem(K_LOCAL, JSON.stringify({ doc: d, sync }))
    } catch {
      // Almacenamiento lleno o bloqueado: la base sigue siendo el respaldo.
    }
  }, [K_LOCAL])

  // ── Entrada ──
  const entrar = useCallback(async (k: string, silencioso = false) => {
    setCargando(true)
    setError("")
    try {
      const r = await fetch(ruta, { headers: { authorization: `Bearer ${k}` }, cache: "no-store" })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        try { sessionStorage.removeItem(K_CLAVE) } catch {}
        if (!silencioso) setError(d?.error || "No se pudo entrar. Inténtalo de nuevo.")
        setClave(null)
        return
      }
      try { sessionStorage.setItem(K_CLAVE, k) } catch {}
      setNube(!!d.configurado)
      const local = leerLocal()
      // Lo que quedó sin mandar en este navegador manda sobre lo de la base.
      if (local && !local.sync) {
        setDoc(local.doc)
        sucio.current = true
        setEstado("sucio")
      } else if (valido(d.contenido)) {
        setDoc(d.contenido)
        escribirLocal(d.contenido, true)
      }
      setClave(k)
    } catch {
      if (!silencioso) setError("Error de red. Revisa tu conexión.")
    } finally {
      setCargando(false)
    }
  }, [ruta, K_CLAVE, leerLocal, escribirLocal, valido])

  useEffect(() => {
    let guardada: string | null = null
    try { guardada = sessionStorage.getItem(K_CLAVE) } catch {}
    if (guardada) entrar(guardada, true)
    else setCargando(false)
  }, [entrar, K_CLAVE])

  // ── Cambios y autoguardado ──
  const cambiar = useCallback((f: (d: T) => T) => {
    setDoc((prev) => {
      if (prev === null) return prev
      const sig = f(prev)
      if (sig === prev) return prev
      version.current++
      sucio.current = true
      escribirLocal(sig, false)
      return sig
    })
    setEstado("sucio")
  }, [escribirLocal])

  const guardar = useCallback(async () => {
    const d = docRef.current
    if (d === null || !clave || !sucio.current) return
    const v = version.current
    setEstado("guardando")
    try {
      const r = await fetch(ruta, {
        method: "PUT",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${clave}` },
        body: JSON.stringify({ contenido: d }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setEstado("error")
        setMensaje(j?.error || "No se pudo guardar.")
        return
      }
      // Si se escribió algo mientras viajaba, sigue pendiente: no se marca limpio.
      if (v === version.current) {
        sucio.current = false
        escribirLocal(d, true)
        setEstado("ok")
        setNube(true)
      } else {
        setEstado("sucio")
      }
    } catch {
      setEstado("error")
      setMensaje("Sin conexión. Lo escrito queda guardado en este navegador.")
    }
  }, [clave, ruta, escribirLocal])

  useEffect(() => {
    if (!sucio.current || !clave) return
    const t = setTimeout(guardar, 1200)
    return () => clearTimeout(t)
  }, [doc, clave, guardar])

  // Al cerrar la pestaña con algo sin mandar, se intenta un último envío.
  useEffect(() => {
    if (!clave) return
    const alSalir = () => {
      const d = docRef.current
      if (d === null || !sucio.current) return
      try {
        fetch(ruta, {
          method: "PUT",
          keepalive: true,
          headers: { "Content-Type": "application/json", authorization: `Bearer ${clave}` },
          body: JSON.stringify({ contenido: d }),
        })
      } catch {}
    }
    window.addEventListener("pagehide", alSalir)
    return () => window.removeEventListener("pagehide", alSalir)
  }, [clave, ruta])

  const estadoTexto =
    estado === "guardando" ? "Guardando…"
    : estado === "sucio" ? "Sin guardar"
    : estado === "error" ? mensaje
    : nube === false ? "Solo en este navegador"
    : "Guardado"

  return { clave, entrada, setEntrada, error, cargando, doc, cambiar, estado, estadoTexto, entrar, nube, guardar }
}
