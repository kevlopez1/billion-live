"use client"

// ──────────────────────────────────────────────────────────────
// LA OFICINA — la entrada en 3D a /branding.
//
// Un penthouse de noche: escritorios en ronda alrededor de quien mira, uno por
// sección del manual (más la sala de edición y las preguntas), un ventanal
// redondo con la ciudad y, sobre el primer escritorio, el marcador del reto con
// el número real del contador. En semicírculo no entraban: con 13 escritorios
// los de las puntas quedaban fuera de la pantalla y en el celular se leían
// chiquitos.
//
// Es una ENTRADA, no la herramienta: se toca un escritorio y la cámara vuela
// hasta él y abre esa sección en la vista de trabajo de siempre. Debajo hay
// botones con los mismos destinos: sirven sin WebGL, con teclado y para quien
// no quiere esperar a que cargue el 3D.
// ──────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"

export type Destino = { id: string; nombre: string; detalle?: string }

const CELESTE = "#8fc7e8"
const ROJO = "#f0584a"
const NOCHE = 0x05080c

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-BO")

/** La fuente de la web (next/font le pone un nombre propio a Manrope). */
const fuente = () => (typeof document !== "undefined" ? getComputedStyle(document.body).fontFamily : "sans-serif")

function textura(w: number, h: number, pintar: (c: CanvasRenderingContext2D) => void) {
  const cv = document.createElement("canvas")
  cv.width = w
  cv.height = h
  const c = cv.getContext("2d")!
  pintar(c)
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** La pantalla de un escritorio: el nombre de la sección, grande y legible. */
function pantalla(d: Destino, encendida: boolean) {
  const F = fuente()
  return textura(640, 384, (c) => {
    c.fillStyle = encendida ? "#0c1a26" : "#070b11"
    c.fillRect(0, 0, 640, 384)
    c.strokeStyle = encendida ? CELESTE : "rgba(143,199,232,.35)"
    c.lineWidth = encendida ? 10 : 6
    c.strokeRect(8, 8, 624, 368)
    c.fillStyle = encendida ? ROJO : "rgba(240,88,74,.7)"
    c.font = `800 30px ${F}`
    c.fillText((d.detalle ?? "SECCIÓN").toUpperCase(), 40, 78)
    c.fillStyle = "#ffffff"
    c.font = `800 64px ${F}`
    // El nombre en hasta dos líneas: «Guiones e ideas» no entra en una.
    const palabras = d.nombre.split(" ")
    const lineas: string[] = []
    let l = ""
    for (const p of palabras) {
      const prueba = l ? `${l} ${p}` : p
      if (c.measureText(prueba).width > 560 && l) { lineas.push(l); l = p } else l = prueba
    }
    lineas.push(l)
    lineas.slice(0, 2).forEach((x, i) => c.fillText(x, 40, 190 + i * 76))
    c.fillStyle = encendida ? CELESTE : "rgba(143,199,232,.55)"
    c.font = `700 26px ${F}`
    c.fillText(encendida ? "TOCA PARA ENTRAR →" : "kevproject.world", 40, 344)
  })
}

/** La ciudad detrás del ventanal: edificios con ventanas prendidas al azar. */
function ciudad() {
  return textura(2048, 512, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 512)
    g.addColorStop(0, "#03050a")
    g.addColorStop(1, "#0b1624")
    c.fillStyle = g
    c.fillRect(0, 0, 2048, 512)
    let x = 0
    let semilla = 7
    const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647)
    while (x < 2048) {
      const w = 40 + azar() * 90
      const h = 120 + azar() * 330
      c.fillStyle = `rgb(${8 + azar() * 10},${12 + azar() * 12},${20 + azar() * 16})`
      c.fillRect(x, 512 - h, w, h)
      for (let yy = 512 - h + 10; yy < 500; yy += 14) {
        for (let xx = x + 6; xx < x + w - 6; xx += 11) {
          if (azar() < 0.32) {
            c.fillStyle = azar() < 0.85 ? "rgba(255,214,150,.75)" : "rgba(143,199,232,.85)"
            c.fillRect(xx, yy, 5, 7)
          }
        }
      }
      x += w + 4
    }
  })
}

/** El marcador del reto en la pared, como la imagen diaria. */
function marcador(dia: number | null, monto: number | null) {
  const F = fuente()
  return textura(1280, 480, (c) => {
    c.fillStyle = "#04070b"
    c.fillRect(0, 0, 1280, 480)
    c.textAlign = "center"
    c.fillStyle = ROJO
    c.font = `800 40px ${F}`
    c.fillText(dia ? `DÍA N.º ${dia}` : "KEV PROJECT GTA", 640, 86)
    c.fillStyle = "#ffffff"
    c.font = `300 54px ${F}`
    c.fillText("EMPECÉ CON $10. HOY LLEVO", 640, 168)
    c.fillStyle = CELESTE
    c.font = `900 210px ${F}`
    c.fillText(monto != null ? fmt(monto) : "…", 640, 378)
    c.fillStyle = "rgba(255,255,255,.6)"
    c.font = `700 30px ${F}`
    c.fillText("DE $450.000 · UN MERCEDES MANSORY", 640, 440)
  })
}

export default function Oficina3D({
  destinos,
  onEntrar,
}: {
  destinos: Destino[]
  onEntrar: (id: string) => void
}) {
  const caja = useRef<HTMLDivElement>(null)
  const [sinWebGL, setSinWebGL] = useState(false)
  const [encima, setEncima] = useState<string | null>(null)
  const entrar = useRef(onEntrar)
  entrar.current = onEntrar
  // Las flechas y los botones de abajo giran la sala desde afuera del efecto.
  const girar = useRef<(paso: number) => void>(() => {})
  const apuntar = useRef<(id: string) => void>(() => {})

  useEffect(() => {
    const el = caja.current
    if (!el || destinos.length === 0) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" })
    } catch {
      setSinWebGL(true)
      return
    }
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    el.appendChild(renderer.domElement)
    renderer.domElement.style.touchAction = "none"

    const escena = new THREE.Scene()
    escena.background = new THREE.Color(NOCHE)
    escena.fog = new THREE.Fog(NOCHE, 12, 30)
    const camara = new THREE.PerspectiveCamera(50, 1, 0.1, 80)
    const desechar: { dispose(): void }[] = []
    const guardar = <T extends { dispose(): void }>(x: T) => (desechar.push(x), x)

    // ── Luz ──
    escena.add(new THREE.HemisphereLight(0x8fc7e8, 0x05080c, 0.55))
    const clave = new THREE.DirectionalLight(0xffffff, 0.6)
    clave.position.set(4, 9, 6)
    escena.add(clave)
    const neon = new THREE.PointLight(0xf0584a, 18, 14, 2)
    neon.position.set(0, 4.6, -9.2)
    escena.add(neon)
    const azul = new THREE.PointLight(0x8fc7e8, 30, 14, 2)
    azul.position.set(0, 3.4, 0)
    escena.add(azul)

    // ── Piso: oscuro, con la grilla celeste de la marca ──
    const piso = new THREE.Mesh(
      guardar(new THREE.PlaneGeometry(60, 60)),
      guardar(new THREE.MeshStandardMaterial({ color: 0x0a0f16, roughness: 0.35, metalness: 0.6 })),
    )
    piso.rotation.x = -Math.PI / 2
    escena.add(piso)
    const grilla = new THREE.GridHelper(40, 40, 0x8fc7e8, 0x8fc7e8)
    ;(grilla.material as THREE.Material).transparent = true
    ;(grilla.material as THREE.Material).opacity = 0.07
    grilla.position.y = 0.002
    escena.add(grilla)

    // ── El ventanal con la ciudad, todo alrededor ──
    const tCiudad = guardar(ciudad())
    tCiudad.wrapS = THREE.RepeatWrapping
    tCiudad.repeat.x = 3
    const vidrio = new THREE.Mesh(
      guardar(new THREE.CylinderGeometry(13, 13, 9, 96, 1, true)),
      guardar(new THREE.MeshBasicMaterial({ map: tCiudad, side: THREE.BackSide })),
    )
    vidrio.position.y = 4.5
    escena.add(vidrio)
    const marco = guardar(new THREE.MeshStandardMaterial({ color: 0x121821, roughness: 0.5, metalness: 0.8 }))
    const barraGeo = guardar(new THREE.BoxGeometry(0.12, 9, 0.12))
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2
      const barra = new THREE.Mesh(barraGeo, marco)
      barra.position.set(Math.sin(a) * 12.9, 4.5, -Math.cos(a) * 12.9)
      escena.add(barra)
    }

    // ── El marcador del reto, colgado frente al ventanal ──
    const telaMarcador = guardar(new THREE.MeshBasicMaterial({ map: guardar(marcador(null, null)) }))
    const tablero = new THREE.Mesh(guardar(new THREE.PlaneGeometry(8, 3)), telaMarcador)
    tablero.position.set(0, 4.7, -10.4)
    escena.add(tablero)
    const borde = new THREE.Mesh(
      guardar(new THREE.PlaneGeometry(8.25, 3.25)),
      guardar(new THREE.MeshBasicMaterial({ color: 0xf0584a })),
    )
    borde.position.set(0, 4.7, -10.42)
    escena.add(borde)
    fetch("/api/contador", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j) return
        telaMarcador.map?.dispose()
        telaMarcador.map = guardar(marcador(Number(j.dia) || null, Number(j.monto) || null))
        telaMarcador.needsUpdate = true
      })
      .catch(() => {})

    // ── Los escritorios, en ronda ──
    const madera = guardar(new THREE.MeshStandardMaterial({ color: 0x2b3746, roughness: 0.4, metalness: 0.5 }))
    const metal = guardar(new THREE.MeshStandardMaterial({ color: 0x18202a, roughness: 0.3, metalness: 0.8 }))
    const n = destinos.length
    const paso = (Math.PI * 2) / n
    // Que las mesas (2,1 de ancho) no se toquen, y que no queden lejos si son pocas.
    const R = Math.max(5, (2.5 * n) / (Math.PI * 2))
    type Puesto = { id: string; grupo: THREE.Group; tela: THREE.MeshBasicMaterial; apagada: THREE.Texture; prendida: THREE.Texture; frente: THREE.Vector3 }
    const puestos: Puesto[] = []
    const tocables: THREE.Object3D[] = []

    destinos.forEach((d, i) => {
      const a = i * paso
      const g = new THREE.Group()
      g.position.set(Math.sin(a) * R, 0, -Math.cos(a) * R + 1.5)
      g.rotation.y = -a
      g.userData.id = d.id

      const mesa = new THREE.Mesh(guardar(new THREE.BoxGeometry(2.1, 0.08, 1)), madera)
      mesa.position.y = 0.95
      g.add(mesa)
      for (const sx of [-0.95, 0.95]) {
        const pata = new THREE.Mesh(guardar(new THREE.BoxGeometry(0.06, 0.95, 0.9)), metal)
        pata.position.set(sx, 0.475, 0)
        g.add(pata)
      }
      const pie = new THREE.Mesh(guardar(new THREE.BoxGeometry(0.12, 0.42, 0.12)), metal)
      pie.position.set(0, 1.2, -0.25)
      g.add(pie)

      const apagada = guardar(pantalla(d, false))
      const prendida = guardar(pantalla(d, true))
      const tela = guardar(new THREE.MeshBasicMaterial({ map: apagada }))
      const monitor = new THREE.Mesh(guardar(new THREE.BoxGeometry(1.75, 1.05, 0.05)), metal)
      monitor.position.set(0, 1.92, -0.28)
      monitor.rotation.x = -0.08
      const vidrioPantalla = new THREE.Mesh(guardar(new THREE.PlaneGeometry(1.66, 0.98)), tela)
      vidrioPantalla.position.z = 0.03
      monitor.add(vidrioPantalla)
      g.add(monitor)

      // Una franja de luz en el borde de la mesa: el acento rojo del marcador.
      const tira = new THREE.Mesh(
        guardar(new THREE.BoxGeometry(2.1, 0.02, 0.02)),
        guardar(new THREE.MeshBasicMaterial({ color: d.id === "videos" ? 0xf0584a : 0x8fc7e8 })),
      )
      tira.position.set(0, 0.92, 0.51)
      g.add(tira)

      escena.add(g)
      const frente = new THREE.Vector3(0, 1.95, 1.7).applyMatrix4(new THREE.Matrix4().makeRotationY(-a)).add(g.position)
      puestos.push({ id: d.id, grupo: g, tela, apagada, prendida, frente })
      g.traverse((o) => { o.userData.id = d.id; tocables.push(o) })
    })

    // Un aro de luz en el piso, por delante de las mesas.
    const aro = new THREE.Mesh(
      guardar(new THREE.RingGeometry(R - 1.05, R - 1.0, 128)),
      guardar(new THREE.MeshBasicMaterial({ color: 0x8fc7e8, transparent: true, opacity: 0.5 })),
    )
    aro.rotation.x = -Math.PI / 2
    aro.position.y = 0.01
    escena.add(aro)

    // ── Cámara: de pie en el centro de la oficina, girando ──
    const base = new THREE.Vector3(0, 2.35, 0)
    const mirar = new THREE.Vector3(0, 1.75, -10)
    let giro = 0
    let giroObjetivo = 0
    // Al soltar, la sala se acomoda de frente al escritorio más cercano.
    const encajar = () => { giroObjetivo = Math.round(giroObjetivo / paso) * paso }
    const indiceDe = (g: number) => (((Math.round(g / paso) % n) + n) % n)
    girar.current = (k: number) => { if (!vuelo) giroObjetivo = (Math.round(giroObjetivo / paso) + k) * paso }
    apuntar.current = (id: string) => {
      const i = puestos.findIndex((p) => p.id === id)
      if (i < 0 || vuelo) return
      // El camino corto: de 12 a 0 es un paso, no doce.
      const actual = Math.round(giroObjetivo / paso)
      let d = (i - actual) % n
      if (d > n / 2) d -= n
      if (d < -n / 2) d += n
      giroObjetivo = (actual + d) * paso
    }
    let rueda = 0
    let vuelo: { desde: THREE.Vector3; hasta: THREE.Vector3; mDesde: THREE.Vector3; mHasta: THREE.Vector3; t0: number; id: string } | null = null

    const medir = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      renderer.setSize(w, h, false)
      renderer.domElement.style.width = "100%"
      renderer.domElement.style.height = "100%"
      camara.aspect = w / h
      // En el celular (vertical) se abre el lente para que entren más escritorios.
      camara.fov = w < h ? 70 : 58
      camara.updateProjectionMatrix()
    }
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)

    // ── Tocar y arrastrar ──
    const ray = new THREE.Raycaster()
    const punto = new THREE.Vector2()
    let abajo: { x: number; g: number; movio: boolean } | null = null
    let prendidoId: string | null = null
    let ratonEncima = false

    const quien = (cx: number, cy: number) => {
      const r = renderer.domElement.getBoundingClientRect()
      punto.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(punto, camara)
      const hit = ray.intersectObjects(tocables, false)[0]
      return (hit?.object.userData.id as string | undefined) ?? null
    }
    const prender = (id: string | null) => {
      if (id === prendidoId) return
      prendidoId = id
      setEncima(id)
      renderer.domElement.style.cursor = id ? "pointer" : "grab"
      for (const p of puestos) {
        p.tela.map = p.id === id ? p.prendida : p.apagada
        p.tela.needsUpdate = true
      }
    }
    const volarA = (id: string) => {
      const p = puestos.find((x) => x.id === id)
      if (!p || vuelo) return
      prender(id)
      vuelo = {
        desde: camara.position.clone(),
        hasta: p.frente.clone(),
        mDesde: mirar.clone(),
        mHasta: new THREE.Vector3(0, 1.9, -0.28).applyMatrix4(p.grupo.matrixWorld),
        t0: performance.now(),
        id,
      }
    }

    const onDown = (e: PointerEvent) => {
      abajo = { x: e.clientX, g: giroObjetivo, movio: false }
      renderer.domElement.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      if (abajo) {
        const dx = e.clientX - abajo.x
        if (Math.abs(dx) > 6) abajo.movio = true
        giroObjetivo = abajo.g - dx * 0.005
      } else if (e.pointerType === "mouse") {
        const id = quien(e.clientX, e.clientY)
        ratonEncima = id !== null
        if (id) prender(id)
      }
    }
    const onUp = (e: PointerEvent) => {
      if (abajo && !abajo.movio) {
        const id = quien(e.clientX, e.clientY)
        if (id) volarA(id)
      } else if (abajo) encajar()
      abajo = null
    }
    const onWheel = (e: WheelEvent) => {
      giroObjetivo += e.deltaY * 0.0015 + e.deltaX * 0.0015
      clearTimeout(rueda)
      rueda = window.setTimeout(encajar, 180)
    }
    const lienzo = renderer.domElement
    lienzo.addEventListener("pointerdown", onDown)
    lienzo.addEventListener("pointermove", onMove)
    lienzo.addEventListener("pointerup", onUp)
    lienzo.addEventListener("wheel", onWheel, { passive: true })
    lienzo.style.cursor = "grab"

    // ── El bucle ──
    let raf = 0
    const suave = (t: number) => 1 - Math.pow(1 - t, 3)
    let antes = performance.now()
    const cuadro = (ahora: number) => {
      raf = requestAnimationFrame(cuadro)
      if (vuelo) {
        const t = Math.min(1, (ahora - vuelo.t0) / (quieto ? 1 : 900))
        const k = suave(t)
        camara.position.lerpVectors(vuelo.desde, vuelo.hasta, k)
        mirar.lerpVectors(vuelo.mDesde, vuelo.mHasta, k)
        camara.lookAt(mirar)
        if (t >= 1) {
          const id = vuelo.id
          vuelo = null
          entrar.current(id)
        }
      } else {
        // Un vaivén lento mientras nadie toca: la oficina se siente viva.
        const deriva = quieto || abajo ? 0 : Math.sin(ahora / 5200) * 0.025
        // Por tiempo, no por cuadro: en un celular lento a 20 cuadros por
        // segundo la sala tiene que llegar igual de rápido al escritorio.
        const dt = Math.min(0.1, (ahora - antes) / 1000)
        giro += (giroObjetivo + deriva - giro) * (quieto ? 1 : 1 - Math.exp(-dt * 7))
        const y = Math.sin(ahora / 2600) * (quieto ? 0 : 0.03)
        camara.position.set(base.x, base.y + y, base.z)
        mirar.set(Math.sin(giro) * 10, 1.75, -Math.cos(giro) * 10)
        camara.lookAt(mirar)
        // En el celular no hay "pasar el mouse": se prende el que está de frente.
        if (!ratonEncima) prender(puestos[indiceDe(giroObjetivo)].id)
      }
      antes = ahora
      neon.intensity = 16 + Math.sin(ahora / 700) * (quieto ? 0 : 2)
      renderer.render(escena, camara)
    }
    raf = requestAnimationFrame(cuadro)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(rueda)
      girar.current = () => {}
      apuntar.current = () => {}
      ro.disconnect()
      lienzo.removeEventListener("pointerdown", onDown)
      lienzo.removeEventListener("pointermove", onMove)
      lienzo.removeEventListener("pointerup", onUp)
      lienzo.removeEventListener("wheel", onWheel)
      desechar.forEach((x) => x.dispose())
      grilla.geometry.dispose()
      ;(grilla.material as THREE.Material).dispose()
      renderer.dispose()
      lienzo.remove()
    }
    // Los destinos cambian solo si cambia el orden del manual: se rearma la sala.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destinos.map((d) => d.id + d.nombre).join("|")])

  const nombreEncima = destinos.find((d) => d.id === encima)?.nombre

  return (
    <div className="relative h-full min-h-[480px] w-full overflow-hidden bg-[#05080c] text-white">
      {!sinWebGL && <div ref={caja} className="absolute inset-0" />}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#f0584a]">La oficina</p>
          <p className="mt-1 text-sm text-white/70">
            {sinWebGL ? "Este dispositivo no muestra 3D. Entra por aquí abajo." : nombreEncima ? `Entrar a ${nombreEncima}` : "Arrastra para mirar · toca un escritorio"}
          </p>
        </div>
      </div>

      {!sinWebGL && (["‹", "›"] as const).map((f, k) => (
        <button
          key={f}
          type="button"
          onClick={() => girar.current(k ? 1 : -1)}
          aria-label={k ? "Siguiente escritorio" : "Escritorio anterior"}
          className={`absolute top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/45 text-2xl font-bold leading-none text-white/85 backdrop-blur-md transition-colors hover:border-white/60 hover:text-white ${k ? "right-3" : "left-3"}`}
        >
          {f}
        </button>
      ))}

      {/* Los mismos destinos en botones: sin WebGL, con teclado o con apuro. */}
      <nav aria-label="Secciones de la oficina" className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-4 pb-4 pt-10">
        <div className="flex gap-2 overflow-x-auto">
          {destinos.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => onEntrar(d.id)}
              onMouseEnter={() => apuntar.current(d.id)}
              onFocus={() => apuntar.current(d.id)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold backdrop-blur transition-colors ${encima === d.id ? "border-[#8fc7e8] bg-[#8fc7e8] text-black" : "border-white/25 bg-black/40 text-white/85 hover:border-white/60"}`}
            >
              {d.nombre}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
