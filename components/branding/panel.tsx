"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  AlertTriangle, Check, Clapperboard, Cloud, CloudOff, Compass, Loader2, Lock,
  Pencil, Radio, Scissors, Shirt, Sparkles, Target, TrendingUp, User, X,
} from "lucide-react"
import { Indice, type Entrada } from "@/components/branding/indice"
import { Plegable } from "@/components/branding/plegable"
import { Agregar, Campo, Fila, ListaTextos } from "@/components/branding/campos"
import { Tema } from "@/components/branding/tema"
import { PrimeMark } from "@/components/prime-mark"
import {
  CONTENIDO_BASE, ESTADOS, ETIQUETA_ESTADO,
  type Contenido, type Estado,
} from "@/lib/branding"

const SECCIONES: Entrada[] = [
  { id: "personaje", nombre: "El personaje" },
  { id: "norte", nombre: "El norte" },
  { id: "formatos", nombre: "Los formatos" },
  { id: "edicion", nombre: "La edición" },
  { id: "distribucion", nombre: "Distribución" },
  { id: "produccion", nombre: "Producción" },
  { id: "cola", nombre: "En cola" },
  { id: "hoy", nombre: "Qué funciona hoy" },
  { id: "futuro", nombre: "Hacia 2028" },
]

const COLOR_ESTADO: Record<Estado, string> = {
  usamos: "border-gold/45 bg-gold/[0.08] text-foreground",
  pendiente: "border-border bg-card/50 text-muted-foreground",
  no: "border-border/70 bg-transparent text-muted-foreground/80",
}

type Guardado = "limpio" | "sucio" | "guardando" | "ok" | "error"

export function Panel() {
  const [doc, setDoc] = useState<Contenido>(CONTENIDO_BASE)
  const [cargando, setCargando] = useState(true)
  const [configurado, setConfigurado] = useState<boolean | null>(null)
  const [actualizado, setActualizado] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)
  const [clave, setClave] = useState("")
  const [pidiendoClave, setPidiendoClave] = useState(false)
  const [estado, setEstado] = useState<Guardado>("limpio")
  const [mensaje, setMensaje] = useState("")
  const original = useRef<string>("")

  // ── Carga ──
  useEffect(() => {
    let vivo = true
    fetch("/api/branding", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!vivo) return
        if (d?.contenido) {
          setDoc(d.contenido)
          original.current = JSON.stringify(d.contenido)
        }
        setConfigurado(Boolean(d?.configurado))
        setActualizado(d?.actualizado ?? null)
      })
      .catch(() => {
        // Sin red se sigue con la semilla: el manual se lee igual.
        if (vivo) setConfigurado(false)
      })
      .finally(() => vivo && setCargando(false))
    return () => {
      vivo = false
    }
  }, [])

  // Cambiar algo marca el documento como sucio. Se compara el JSON entero
  // en vez de llevar un flag por campo: son decenas de campos y un flag
  // olvidado es un cambio que se pierde sin avisar.
  const editar = useCallback((fn: (d: Contenido) => Contenido) => {
    setDoc((d) => {
      const nuevo = fn(structuredClone(d))
      setEstado(JSON.stringify(nuevo) === original.current ? "limpio" : "sucio")
      return nuevo
    })
  }, [])

  // Avisa antes de cerrar con cambios sin guardar.
  useEffect(() => {
    if (estado !== "sucio") return
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", h)
    return () => window.removeEventListener("beforeunload", h)
  }, [estado])

  const guardar = async () => {
    if (!clave) {
      setPidiendoClave(true)
      return
    }
    setEstado("guardando")
    setMensaje("")
    try {
      const r = await fetch("/api/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${clave}` },
        body: JSON.stringify({ contenido: doc }),
      })
      const j = await r.json()
      if (!r.ok) {
        setEstado("error")
        setMensaje(j.error || "No se pudo guardar.")
        if (r.status === 401) setPidiendoClave(true)
        return
      }
      original.current = JSON.stringify(doc)
      setActualizado(j.actualizado ?? new Date().toISOString())
      setConfigurado(true)
      setEstado("ok")
      setMensaje("")
      setTimeout(() => setEstado((e) => (e === "ok" ? "limpio" : e)), 2500)
    } catch {
      setEstado("error")
      setMensaje("Error de red. No se guardó nada.")
    }
  }

  const descartar = () => {
    if (estado === "sucio" && !confirm("Se pierden los cambios sin guardar. ¿Seguro?")) return
    setDoc(JSON.parse(original.current || JSON.stringify(CONTENIDO_BASE)))
    setEstado("limpio")
    setEditando(false)
    setMensaje("")
  }

  const Titulo = ({ id, icono: Icono, children, numero }: { id: string; icono: React.ElementType; children: React.ReactNode; numero?: string }) => (
    <div id={id} className="mb-5 flex scroll-mt-28 items-center gap-2.5 border-b border-border pb-3 pt-2">
      <Icono className="h-4 w-4 shrink-0 text-gold" strokeWidth={1.75} />
      <h2 className="font-display text-lg font-bold tracking-tight md:text-xl">{children}</h2>
      {numero && <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">{numero}</span>}
    </div>
  )

  const enUso = doc.redes.filter((r) => r.estado === "usamos").length

  return (
    <>
      {/* ── Barra de estado y acciones ── */}
      <div className="sticky top-0 z-40 -mx-5 mb-6 border-b border-border bg-background px-5 py-2.5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2">
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {cargando ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> Cargando…</>
            ) : configurado ? (
              <><Cloud className="h-3 w-3 text-gold" /> En la base</>
            ) : (
              <><CloudOff className="h-3 w-3" /> Solo lectura</>
            )}
          </span>

          {estado === "sucio" && (
            <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-semibold text-gold">Sin guardar</span>
          )}
          {estado === "ok" && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-gold"><Check className="h-3 w-3" /> Guardado</span>
          )}

          <div className="ml-auto flex items-center gap-2">
            <Tema />
            {!editando ? (
              <button
                onClick={() => setEditando(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-[12.5px] font-semibold transition-colors hover:border-gold hover:text-gold"
              >
                <Pencil className="h-3.5 w-3.5" /> Editar
              </button>
            ) : (
              <>
                <button
                  onClick={descartar}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" /> Salir
                </button>
                <button
                  onClick={guardar}
                  disabled={estado === "guardando" || estado === "limpio"}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-foreground px-3.5 py-1.5 text-[12.5px] font-semibold text-background transition-opacity disabled:opacity-40"
                >
                  {estado === "guardando" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Guardar
                </button>
              </>
            )}
          </div>
        </div>

        {pidiendoClave && (
          <div className="mx-auto mt-2.5 flex max-w-6xl flex-wrap items-center gap-2">
            <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              type="password"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { setPidiendoClave(false); guardar() } }}
              placeholder="Clave de administrador"
              autoFocus
              className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-1.5 text-[13px] outline-none focus:border-gold"
            />
            <button
              onClick={() => { setPidiendoClave(false); guardar() }}
              className="shrink-0 rounded-xl bg-foreground px-3.5 py-1.5 text-[12.5px] font-semibold text-background"
            >
              Entrar
            </button>
          </div>
        )}

        {mensaje && (
          <p className="mx-auto mt-2 flex max-w-6xl items-start gap-1.5 text-[12px] text-rojo">
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" /> {mensaje}
          </p>
        )}
      </div>

      {configurado === false && !cargando && (
        <div className="mb-6 rounded-2xl border border-gold/40 bg-gold/[0.06] px-4 py-3.5">
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            <b className="text-foreground">La base todavía no está lista.</b> Se está leyendo el contenido semilla del
            código. Para que el panel guarde de verdad, hay que correr{" "}
            <code className="rounded bg-foreground/10 px-1 py-0.5 text-[12px]">supabase/branding.sql</code> en el SQL
            Editor de Supabase. Mientras tanto se puede leer todo, pero no guardar.
          </p>
        </div>
      )}

      <div className="lg:flex lg:gap-10">
        <Indice entradas={SECCIONES} />

        <div className="min-w-0 flex-1 space-y-12 md:space-y-14">
          {/* ── El personaje ── */}
          <section>
            <Titulo id="personaje" icono={User}>El personaje</Titulo>
            <Campo
              valor={doc.personaje.nombre}
              onChange={(v) => editar((d) => ({ ...d, personaje: { ...d.personaje, nombre: v } }))}
              editando={editando}
              className="mb-4 font-display text-xl font-bold tracking-tight"
              placeholder="Nombre"
            />
            <div className="grid gap-3 sm:grid-cols-3">
              {([
                ["Fortalezas", "fortalezas"],
                ["Debilidades", "debilidades"],
                ["Oportunidades", "oportunidades"],
              ] as const).map(([rotulo, llave]) => (
                <div key={llave} className="rounded-2xl border border-border bg-card/40 px-4 py-4">
                  <div className="mb-2.5 text-[10px] font-display font-bold uppercase tracking-[0.16em] text-gold">{rotulo}</div>
                  <ListaTextos
                    items={doc.personaje[llave]}
                    onChange={(v) => editar((d) => ({ ...d, personaje: { ...d.personaje, [llave]: v } }))}
                    editando={editando}
                    placeholder={rotulo.slice(0, -1)}
                    textoAgregar="Agregar"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* ── El norte ── */}
          <section>
            <Titulo id="norte" icono={Compass} numero={`${doc.norte.length} principios`}>El norte</Titulo>
            <p className="mb-5 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
              Lo que se toma en cuenta siempre. Si un video no responde a esto, no se publica.
            </p>
            <div className="space-y-3">
              {doc.norte.map((p, i) => (
                <div key={i} className="rounded-2xl border border-border bg-card/40 px-4 py-4 md:px-5">
                  <Fila
                    editando={editando}
                    onBorrar={() => editar((d) => ({ ...d, norte: d.norte.filter((_, j) => j !== i) }))}
                  >
                    <div className="flex gap-3">
                      <span className="mt-0.5 shrink-0 font-display text-sm font-bold tabular-nums text-gold">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <Campo
                          valor={p.titulo}
                          onChange={(v) => editar((d) => { d.norte[i].titulo = v; return d })}
                          editando={editando}
                          className="font-display text-[15px] font-semibold tracking-tight md:text-base"
                          placeholder="Título del principio"
                        />
                        <Campo
                          valor={p.cuerpo}
                          onChange={(v) => editar((d) => { d.norte[i].cuerpo = v; return d })}
                          editando={editando}
                          multilinea
                          className="text-[13.5px] leading-relaxed text-muted-foreground"
                          placeholder="Qué significa"
                        />
                        {(editando || p.detalle.length > 0) && (
                          <div className="pt-1.5">
                            {editando ? (
                              <ListaTextos
                                items={p.detalle}
                                onChange={(v) => editar((d) => { d.norte[i].detalle = v; return d })}
                                editando
                                placeholder="Detalle"
                                textoAgregar="Agregar detalle"
                              />
                            ) : (
                              <ul className="flex flex-wrap gap-1.5">
                                {p.detalle.map((x, k) => (
                                  <li key={k} className="rounded-lg border border-border bg-background/50 px-2.5 py-1.5 text-[12.5px] leading-snug text-muted-foreground">
                                    {x}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </Fila>
                </div>
              ))}
            </div>
            {editando && (
              <Agregar
                onClick={() => editar((d) => ({ ...d, norte: [...d.norte, { titulo: "", cuerpo: "", detalle: [] }] }))}
                texto="Agregar principio"
              />
            )}
          </section>

          {/* ── Los formatos ── */}
          <section>
            <Titulo id="formatos" icono={Clapperboard} numero={`${doc.formatos.length} formatos`}>Los formatos</Titulo>
            <p className="mb-5 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
              La estructura puede variar, pero el objetivo no: posicionar las ambiciones reales y construir el apego a
              la novela del personaje. Toca uno para ver sus pasos.
            </p>
            <div className="space-y-2.5">
              {doc.formatos.map((f, i) => (
                <Fila
                  key={f.id || i}
                  editando={editando}
                  onBorrar={() => editar((d) => ({ ...d, formatos: d.formatos.filter((_, j) => j !== i) }))}
                >
                  <Plegable
                    titulo={f.nombre || "Formato sin nombre"}
                    subtitulo={f.para}
                    etiqueta={String(i + 1).padStart(2, "0")}
                    abiertoPorDefecto={editando}
                  >
                    {editando && (
                      <div className="mb-4 space-y-2">
                        <Campo valor={f.nombre} onChange={(v) => editar((d) => { d.formatos[i].nombre = v; return d })} editando className="font-display text-[15px] font-semibold" placeholder="Nombre del formato" />
                        <Campo valor={f.para} onChange={(v) => editar((d) => { d.formatos[i].para = v; return d })} editando multilinea className="text-[13px] text-muted-foreground" placeholder="Para qué sirve" />
                      </div>
                    )}
                    <ol className="space-y-3.5">
                      {f.beats.map((b, k) => (
                        <li key={k}>
                          <Fila
                            editando={editando}
                            onBorrar={() => editar((d) => { d.formatos[i].beats.splice(k, 1); return d })}
                          >
                            <div className="flex gap-3">
                              <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-[10px] font-bold tabular-nums text-muted-foreground">
                                {k + 1}
                              </span>
                              <div className="min-w-0 flex-1 space-y-1.5">
                                <Campo
                                  valor={b.paso}
                                  onChange={(v) => editar((d) => { d.formatos[i].beats[k].paso = v; return d })}
                                  editando={editando}
                                  className="text-[13.5px] font-medium leading-snug text-foreground"
                                  placeholder="El paso"
                                />
                                {(editando || b.ejemplo) && (
                                  <div className={editando ? "" : "border-l-2 border-gold/40 pl-3"}>
                                    <Campo
                                      valor={b.ejemplo ?? ""}
                                      onChange={(v) => editar((d) => { d.formatos[i].beats[k].ejemplo = v; return d })}
                                      editando={editando}
                                      multilinea
                                      className={
                                        editando
                                          ? "font-serif-display text-[13.5px] italic text-muted-foreground"
                                          : "font-serif-display text-[14px] italic leading-relaxed text-muted-foreground"
                                      }
                                      placeholder="Guion de ejemplo (opcional)"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </Fila>
                        </li>
                      ))}
                    </ol>
                    {editando && (
                      <Agregar
                        onClick={() => editar((d) => { d.formatos[i].beats.push({ paso: "", ejemplo: "" }); return d })}
                        texto="Agregar paso"
                      />
                    )}
                  </Plegable>
                </Fila>
              ))}
            </div>
            {editando && (
              <Agregar
                onClick={() =>
                  editar((d) => ({
                    ...d,
                    formatos: [...d.formatos, { id: `f${d.formatos.length + 1}`, nombre: "", para: "", beats: [{ paso: "" }] }],
                  }))
                }
                texto="Agregar formato"
              />
            )}
          </section>

          {/* ── La edición ── */}
          <section>
            <Titulo id="edicion" icono={Scissors} numero={`${doc.edicion.bloques.length} bloques`}>La edición</Titulo>

            <div className="mb-5 rounded-2xl border border-gold/40 bg-gold/[0.05] px-4 py-4 md:px-5">
              <div className="mb-1.5 text-[10px] font-display font-bold uppercase tracking-[0.16em] text-gold">
                La regla madre
              </div>
              <Campo
                valor={doc.edicion.regla}
                onChange={(v) => editar((d) => ({ ...d, edicion: { ...d.edicion, regla: v } }))}
                editando={editando}
                multilinea
                className="font-serif-display text-[15px] italic leading-relaxed text-foreground md:text-base"
                placeholder="La regla que manda sobre todas las demás"
              />
            </div>

            <div className="space-y-2.5">
              {doc.edicion.bloques.map((b, i) => (
                <Fila
                  key={i}
                  editando={editando}
                  onBorrar={() =>
                    editar((d) => ({ ...d, edicion: { ...d.edicion, bloques: d.edicion.bloques.filter((_, j) => j !== i) } }))
                  }
                >
                  <Plegable
                    titulo={b.titulo || "Bloque sin nombre"}
                    subtitulo={b.nota}
                    etiqueta={b.reglas.length === 0 && !editando ? "—" : String(b.reglas.length)}
                    abiertoPorDefecto={editando || b.reglas.length > 0}
                  >
                    {editando && (
                      <div className="mb-3 space-y-2">
                        <Campo
                          valor={b.titulo}
                          onChange={(v) => editar((d) => { d.edicion.bloques[i].titulo = v; return d })}
                          editando
                          className="font-display text-[15px] font-semibold"
                          placeholder="Nombre del bloque"
                        />
                        <Campo
                          valor={b.nota}
                          onChange={(v) => editar((d) => { d.edicion.bloques[i].nota = v; return d })}
                          editando
                          multilinea
                          className="text-[13px] text-muted-foreground"
                          placeholder="Por qué importa este bloque"
                        />
                      </div>
                    )}
                    <ListaTextos
                      items={b.reglas}
                      onChange={(v) => editar((d) => { d.edicion.bloques[i].reglas = v; return d })}
                      editando={editando}
                      placeholder="La regla, en una frase"
                      textoAgregar="Agregar regla"
                    />
                  </Plegable>
                </Fila>
              ))}
            </div>
            {editando && (
              <Agregar
                onClick={() =>
                  editar((d) => ({
                    ...d,
                    edicion: { ...d.edicion, bloques: [...d.edicion.bloques, { titulo: "", nota: "", reglas: [] }] },
                  }))
                }
                texto="Agregar bloque"
              />
            )}

            <div className="mt-4 rounded-2xl border border-rojo/35 bg-rojo/[0.04] px-4 py-4">
              <div className="mb-2 text-[10px] font-display font-bold uppercase tracking-[0.16em] text-rojo">
                Lo que nunca
              </div>
              <ListaTextos
                items={doc.edicion.nunca}
                onChange={(v) => editar((d) => ({ ...d, edicion: { ...d.edicion, nunca: v } }))}
                editando={editando}
                placeholder="Lo que no se hace, nunca"
                textoAgregar="Agregar prohibición"
              />
            </div>
          </section>

          {/* ── Distribución ── */}
          <section>
            <Titulo id="distribucion" icono={Radio} numero={`${enUso} de ${doc.redes.length} en uso`}>Distribución</Titulo>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {doc.redes.map((r, i) => (
                <Fila
                  key={i}
                  editando={editando}
                  onBorrar={() => editar((d) => ({ ...d, redes: d.redes.filter((_, j) => j !== i) }))}
                >
                  <div className={`rounded-xl border px-3.5 py-3 ${COLOR_ESTADO[r.estado]}`}>
                    <div className="flex items-baseline justify-between gap-3">
                      <Campo
                        valor={r.nombre}
                        onChange={(v) => editar((d) => { d.redes[i].nombre = v; return d })}
                        editando={editando}
                        as="span"
                        className="font-display text-[14px] font-semibold tracking-tight"
                        placeholder="Red"
                      />
                      {editando ? (
                        <select
                          value={r.estado}
                          onChange={(e) => editar((d) => { d.redes[i].estado = e.target.value as Estado; return d })}
                          className="shrink-0 rounded-lg border border-gold/35 bg-background px-1.5 py-1 text-[11px] outline-none"
                        >
                          {ESTADOS.map((e) => (
                            <option key={e} value={e}>{ETIQUETA_ESTADO[e]}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="shrink-0 text-[10px] uppercase tracking-[0.12em] opacity-70">
                          {ETIQUETA_ESTADO[r.estado]}
                        </span>
                      )}
                    </div>
                    {(editando || r.nota) && (
                      <Campo
                        valor={r.nota ?? ""}
                        onChange={(v) => editar((d) => { d.redes[i].nota = v; return d })}
                        editando={editando}
                        className="mt-1 text-[12px] leading-snug opacity-75"
                        placeholder="Nota (opcional)"
                      />
                    )}
                  </div>
                </Fila>
              ))}
            </div>
            {editando && (
              <Agregar
                onClick={() => editar((d) => ({ ...d, redes: [...d.redes, { nombre: "", estado: "pendiente" }] }))}
                texto="Agregar red"
              />
            )}
          </section>

          {/* ── Producción ── */}
          <section>
            <Titulo id="produccion" icono={Shirt}>Producción</Titulo>
            <div className="grid gap-3 sm:grid-cols-2">
              {([["Personaje", "personaje"], ["Equipo", "equipo"]] as const).map(([rotulo, llave]) => (
                <div key={llave} className="rounded-2xl border border-border bg-card/40 px-4 py-4">
                  <div className="mb-2.5 text-[10px] font-display font-bold uppercase tracking-[0.16em] text-gold">{rotulo}</div>
                  <ListaTextos
                    items={doc.produccion[llave]}
                    onChange={(v) => editar((d) => ({ ...d, produccion: { ...d.produccion, [llave]: v } }))}
                    editando={editando}
                    placeholder={rotulo}
                    textoAgregar="Agregar"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* ── En cola ── */}
          <section>
            <Titulo id="cola" icono={Target} numero={`${doc.enCola.length} videos`}>En cola</Titulo>
            <div className="space-y-2.5">
              {doc.enCola.map((v, i) => (
                <Fila
                  key={i}
                  editando={editando}
                  onBorrar={() => editar((d) => ({ ...d, enCola: d.enCola.filter((_, j) => j !== i) }))}
                >
                  <div className="flex items-start gap-3 rounded-2xl border border-border bg-card/40 px-4 py-3.5">
                    <span className="mt-0.5 shrink-0 font-display text-sm font-bold tabular-nums text-gold">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <Campo
                        valor={v.titulo}
                        onChange={(x) => editar((d) => { d.enCola[i].titulo = x; return d })}
                        editando={editando}
                        className="font-display text-[15px] font-semibold tracking-tight"
                        placeholder="Título del video"
                      />
                      {editando ? (
                        <Campo
                          valor={v.formato}
                          onChange={(x) => editar((d) => { d.enCola[i].formato = x; return d })}
                          editando
                          className="text-[12px] text-muted-foreground"
                          placeholder="Formato"
                        />
                      ) : (
                        <div className="text-[12px] text-muted-foreground">Formato · {v.formato}</div>
                      )}
                    </div>
                  </div>
                </Fila>
              ))}
            </div>
            {editando && (
              <Agregar
                onClick={() => editar((d) => ({ ...d, enCola: [...d.enCola, { titulo: "", formato: "" }] }))}
                texto="Agregar video"
              />
            )}

            <div className="mt-4 rounded-2xl border border-dashed border-border px-4 py-4">
              <div className="mb-2 text-[10px] font-display font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Pendientes
              </div>
              <ListaTextos
                items={doc.pendientes}
                onChange={(v) => editar((d) => ({ ...d, pendientes: v }))}
                editando={editando}
                placeholder="Pendiente"
                textoAgregar="Agregar pendiente"
              />
            </div>
          </section>

          {/* ── Hoy y futuro ── */}
          {([
            ["hoy", "Qué funciona hoy", "2026", Sparkles, "hoy"],
            ["futuro", "Hacia dónde va", "2028", TrendingUp, "futuro"],
          ] as const).map(([id, titulo, anio, Icono, llave]) => (
            <section key={id}>
              <Titulo id={id} icono={Icono} numero={anio}>{titulo}</Titulo>
              {id === "futuro" && (
                <p className="mb-5 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
                  Qué buscará el consumidor, y por lo tanto hacia dónde tiene que mirar{" "}
                  <PrimeMark className="text-[0.9em]" />.
                </p>
              )}
              <div className="space-y-2.5">
                {doc[llave].map((l, i) => (
                  <Fila
                    key={i}
                    editando={editando}
                    onBorrar={() => editar((d) => ({ ...d, [llave]: d[llave].filter((_, j) => j !== i) }))}
                  >
                    <Plegable titulo={l.titulo || "Sin título"} abiertoPorDefecto={editando}>
                      <div className="space-y-2">
                        {editando && (
                          <Campo
                            valor={l.titulo}
                            onChange={(v) => editar((d) => { d[llave][i].titulo = v; return d })}
                            editando
                            className="font-display text-[15px] font-semibold"
                            placeholder="Título"
                          />
                        )}
                        <Campo
                          valor={l.cuerpo}
                          onChange={(v) => editar((d) => { d[llave][i].cuerpo = v; return d })}
                          editando={editando}
                          multilinea
                          className="text-[13.5px] leading-relaxed text-muted-foreground"
                          placeholder="Qué significa"
                        />
                      </div>
                    </Plegable>
                  </Fila>
                ))}
              </div>
              {editando && (
                <Agregar
                  onClick={() => editar((d) => ({ ...d, [llave]: [...d[llave], { titulo: "", cuerpo: "" }] }))}
                  texto="Agregar lectura"
                />
              )}
            </section>
          ))}

          <p className="border-t border-border pt-6 text-[12px] leading-relaxed text-muted-foreground/70">
            {actualizado
              ? `Última edición guardada: ${new Date(actualizado).toLocaleString("es-BO", { dateStyle: "long", timeStyle: "short" })}.`
              : "Todavía no se ha guardado ninguna edición: se está leyendo el contenido del código."}{" "}
            Cada guardado deja copia del anterior en el historial.
          </p>
        </div>
      </div>
    </>
  )
}
