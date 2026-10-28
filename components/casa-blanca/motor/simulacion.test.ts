// ──────────────────────────────────────────────────────────────
// Prueba de la simulación, sin frameworks ni dependencias:
//   npx -y tsx components/casa-blanca/motor/simulacion.test.ts
// Sale con código 1 si algo falla.
//
// Usa cuatro personajes DE PRUEBA (no los de datos/personajes.ts) con horarios
// que pasan por la superficie, un interior, el ascensor y el subsuelo.
// ──────────────────────────────────────────────────────────────

import { LUGAR } from "../lugares"
import type { EntradaHorario, Especiales, EstadoCuerpo, NivelId, Personaje } from "../tipos"
import { Simulacion, escritorioDe, type Conversacion, type EventoSim, type LineaConv } from "./simulacion"

let fallas = 0
let pasaron = 0
function ok(cond: unknown, msg: string) {
  if (cond) pasaron++
  else {
    fallas++
    console.error(`  FALLA: ${msg}`)
  }
}
function seccion(t: string) {
  console.log(`\n· ${t}`)
}

function pj(id: string, departamentoId: string, real: Personaje["real"], horario: EntradaHorario[]): Personaje {
  return {
    id,
    nombre: `Prueba ${id}`,
    corto: id.toUpperCase(),
    color: "#888888",
    epoca: "prueba",
    rol: "prueba",
    departamentoId,
    real,
    bio: "Personaje de prueba.",
    voz: "Neutra.",
    rasgos: ["uno", "dos", "tres"],
    apariencia: {
      piel: "#c8a080",
      altura: 1.8,
      complexion: "medio",
      pelo: { estilo: "corto", color: "#222222" },
      ropa: { tipo: "traje", color: "#222222" },
      accesorios: [],
    },
    horario,
    temas: {
      poder: [`${id}: el poder se gana.`],
      dinero: [`${id}: el dinero es una herramienta.`, { t: `${id}: una cita conocida.`, c: true }],
      futuro: [`${id}: el futuro se construye hoy.`],
      fe: [`${id}: la fe mueve.`],
      comida: [`${id}: hay que comer bien.`],
      deporte: [`${id}: entrenar es pensar.`],
      disciplina: [`${id}: disciplina diaria.`],
      tecnologia: [`${id}: las máquinas ayudan.`],
      casa: [`${id}: esta casa tiene historia.`],
    },
    pensamientos: [`${id} piensa en voz baja.`, `${id} mira el reloj.`],
    replicas: ["Interesante.", "Puede ser."],
    noticia: ["Vamos a ver.", "jardin-sur"],
  }
}

// Superficie (jardines, cancha), interior (habitaciones), ascensor y subsuelo (n1, n2, n3).
const PERSONAJES: Personaje[] = [
  pj("hormozi", "hormozi", "vivo", [
    [0, "habitaciones", "Duerme", "duerme"],
    [6, "jardin-sur", "Sale al Jardín Sur", "deporte"],
    [9, "dep-hormozi", "Trabaja en ofertas", "trabaja"],
    [13, "cafeteria", "Almuerza con el equipo"],
    [16, "dep-hormozi", "Revisa ventas", "trabaja"],
    [19, "jardin-sur", "Pasea por el jardín"],
    [22, "habitaciones", "Duerme", "duerme"],
  ]),
  pj("amodei", "amodei", "vivo", [
    [0, "habitaciones", "Duerme", "duerme"],
    [7, "rosas", "Lee en el jardín"],
    [10, "dep-amodei", "Trabaja", "trabaja"],
    [13, "cafeteria", "Almuerza"],
    [16, "dep-amodei", "Trabaja", "trabaja"],
    [19, "jardin-sur", "Conversa en el jardín"],
    [22, "habitaciones", "Duerme", "duerme"],
  ]),
  // Una IA: trabaja en el departamento de amodei y nunca duerme.
  pj("claude", "amodei", "ia", [
    [0, "dep-amodei", "Trabaja de noche", "trabaja"],
    [5, "habitaciones", "Descansa", "duerme"],
    [7, "rosas", "Conversa en el jardín"],
    [10, "dep-amodei", "Trabaja", "trabaja"],
    [13, "cafeteria", "Toma un café"],
    [16, "dep-amodei", "Trabaja", "trabaja"],
    [19, "jardin-sur", "Pasea"],
    [22, "dep-amodei", "Trabaja de noche", "trabaja"],
  ]),
  pj("kobe", "kobe", "fallecido", [
    [0, "habitaciones", "Duerme", "duerme"],
    [5, "gimnasio", "Entrena", "deporte"],
    [8, "cancha-basquet", "Tira al aro", "deporte"],
    [10, "dep-kobe", "Trabaja", "trabaja"],
    [13, "cafeteria", "Almuerza"],
    [16, "gimnasio", "Entrena", "deporte"],
    [19, "jardin-sur", "Pasea"],
    [22, "habitaciones", "Duerme", "duerme"],
  ]),
]
const IDS = PERSONAJES.map((p) => p.id)
const ESPECIAL_1 = "claude: Buenos días. ¿Leemos juntos?"
const ESPECIALES: Especiales = {
  "amodei|claude": [
    ["claude", ESPECIAL_1],
    ["amodei", "amodei: Claro. Primero la seguridad."],
    ["claude", "claude: Siempre."],
  ],
}

const sinNaN = (s: Simulacion) =>
  IDS.every((id) => {
    const e = s.pj[id]
    return [e.pos.x, e.pos.y, e.pos.z, e.rumbo, e.velocidad].every(Number.isFinite)
  })
const angDif = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))

// ── 1. Un día completo ────────────────────────────────────────
seccion("24 h del mundo en pasos de 0,1 s")
{
  const sim = new Simulacion(PERSONAJES, ESPECIALES, { dia: 1, minutos: 0, semilla: 7 })
  const eventos: EventoSim[] = []
  sim.on((e) => eventos.push(e))
  const lineasPorConv = new Map<string, number>()
  sim.on((e) => {
    if (e.tipo === "linea") lineasPorConv.set(e.conv.id, (lineasPorConv.get(e.conv.id) ?? 0) + 1)
  })

  const llego: Record<string, boolean[]> = Object.fromEntries(IDS.map((id) => [id, PERSONAJES.find((p) => p.id === id)!.horario.map(() => false)]))
  const entradaDe = (p: Personaje, h: number) => {
    let k = p.horario.length - 1
    p.horario.forEach((e, i) => {
      if (e[0] <= h) k = i
    })
    return k
  }
  const prev: Record<string, { nivel: NivelId; estado: EstadoCuerpo; x: number; y: number; z: number }> = {}
  for (const id of IDS) {
    const e = sim.pj[id]
    prev[id] = { nivel: e.nivel, estado: e.estado, ...e.pos }
  }
  let nan = 0
  let saltosDeNivel = 0
  let teletransportes = 0
  let pasosAscensor = 0
  let ascensorVisible = 0
  let interiorVisible = 0
  let iaDuerme = 0
  let piensa = 0
  let corre = 0
  let rumboMal = 0
  let rumboTotal = 0
  let recorrido = 0
  let esperado = 0
  let encimados = 0
  let sentadoEnEscritorio = { hormozi: false, claude: false }
  const escH = escritorioDe(PERSONAJES[0], PERSONAJES)!
  const escC = escritorioDe(PERSONAJES[2], PERSONAJES)!
  const depAmodei = LUGAR["dep-amodei"]
  ok(escH.lugarId === "dep-hormozi" && Math.abs(escH.pos.z - (LUGAR["dep-hormozi"].z0 + 3)) < 1e-9, "el escritorio del líder está en z0 + 3")
  ok(Math.abs(escC.pos.x - ((depAmodei.x0 + depAmodei.x1) / 2 + 2.5)) < 1e-9, "la IA se sienta a 2,5 m del centro")

  const dt = 0.1
  const pasos = Math.round((24 * 60 + 30) / dt) // 24 h y media del mundo a velocidad 1
  let ahora = 0
  for (let i = 0; i < pasos; i++) {
    ahora += dt * 1000
    sim.avanzar(dt, ahora)
    if (!sinNaN(sim)) nan++
    const h = sim.reloj.minutos / 60
    for (const p of PERSONAJES) {
      const e = sim.pj[p.id]
      const k = entradaDe(p, h)
      if (e.lugarId === p.horario[k][1]) llego[p.id][k] = true
      const a = prev[p.id]
      if (a.nivel !== e.nivel) {
        if (a.estado !== "ascensor" && e.estado !== "ascensor") saltosDeNivel++
      }
      const dx = e.pos.x - a.x
      const dy = e.pos.y - a.y
      const dz = e.pos.z - a.z
      const d = Math.hypot(dx, dy, dz)
      if (d > 5 * dt + 1e-6) teletransportes++
      if (e.estado === "ascensor") {
        pasosAscensor++
        if (e.visible) ascensorVisible++
      }
      if (e.lugarId && LUGAR[e.lugarId].interior && e.visible) interiorVisible++
      if (p.real === "ia" && e.estado === "duerme") iaDuerme++
      if (e.burbuja?.tipo === "piensa") piensa++
      if (e.estado === "corre") corre++
      if ((e.estado === "camina" || e.estado === "corre") && a.estado === e.estado) {
        recorrido += d
        esperado += e.velocidad * dt
        if (Math.hypot(dx, dz) > 0.05) {
          rumboTotal++
          if (angDif(Math.atan2(dx, dz), e.rumbo) > 0.5) rumboMal++
        }
      }
      if (p.id === "hormozi" && e.estado === "sentado" && Math.hypot(e.pos.x - escH.pos.x, e.pos.z - escH.pos.z) < 0.01) sentadoEnEscritorio.hormozi = true
      if (p.id === "claude" && e.estado === "sentado" && Math.hypot(e.pos.x - escC.pos.x, e.pos.z - escC.pos.z) < 0.01) sentadoEnEscritorio.claude = true
      prev[p.id] = { nivel: e.nivel, estado: e.estado, ...e.pos }
    }
    // Nadie quieto encima de otro en un lugar visible.
    for (let x = 0; x < IDS.length; x++)
      for (let y = x + 1; y < IDS.length; y++) {
        const a = sim.pj[IDS[x]]
        const b = sim.pj[IDS[y]]
        if (!a.visible || !b.visible || a.velocidad || b.velocidad || !a.lugarId || a.lugarId !== b.lugarId) continue
        if (Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z) < 0.9) encimados++
      }
  }

  ok(nan === 0, `nadie con NaN (${nan} pasos con NaN)`)
  for (const p of PERSONAJES)
    p.horario.forEach((e, k) => ok(llego[p.id][k], `${p.id} llega a ${e[1]} (entrada de las ${e[0]} h)`))
  ok(saltosDeNivel === 0, `nadie cambia de nivel sin el ascensor (${saltosDeNivel} saltos)`)
  ok(teletransportes === 0, `nadie se teletransporta (${teletransportes} saltos de más de 5 m/s)`)
  ok(pasosAscensor > 0, `alguien usó el ascensor (${pasosAscensor} pasos)`)
  ok(ascensorVisible === 0, "en el ascensor no se ve a nadie")
  ok(interiorVisible === 0, "dentro de un edificio no se ve a nadie")
  ok(iaDuerme === 0, "la IA nunca duerme")
  ok(sentadoEnEscritorio.hormozi, "el líder trabaja sentado en su escritorio")
  ok(sentadoEnEscritorio.claude, "la IA trabaja sentada al lado del líder")
  ok(corre > 0, "hay alguien corriendo (deporte en el Jardín Sur)")
  ok(piensa > 0, "hay pensamientos sueltos")
  ok(encimados === 0, `nadie quieto a menos de 0,9 m de otro (${encimados} casos)`)
  ok(rumboTotal > 100 && rumboMal / rumboTotal < 0.02, `el rumbo apunta hacia donde camina (${rumboMal}/${rumboTotal} desviados)`)
  ok(esperado > 0 && recorrido / esperado > 0.85 && recorrido / esperado < 1.01, `la velocidad coincide con el desplazamiento (${(recorrido / esperado).toFixed(3)})`)

  const lineas = eventos.filter((e): e is Extract<EventoSim, { tipo: "linea" }> => e.tipo === "linea")
  const horas = eventos.filter((e) => e.tipo === "hora")
  const avisos = eventos.filter((e) => e.tipo === "aviso")
  ok(lineas.length >= 10, `hay conversaciones con líneas (${lineas.length} líneas en ${lineasPorConv.size} conversaciones)`)
  ok([...lineasPorConv.values()].some((n) => n >= 2), "alguna conversación tiene dos o más líneas")
  ok(lineas.every((e) => e.conv.ids.includes(e.linea.id)), "cada línea la dice alguien de la conversación")
  ok(lineas.every((e) => !LUGAR[e.lugarId].interior), "las charlas de guion son en lugares visibles")
  const especial = lineas.filter((e) => e.linea.texto === ESPECIAL_1)
  ok(especial.length === 1, `la conversación especial sale una vez en el día (${especial.length})`)
  ok(lineas.some((e) => e.linea.cita), "las citas llegan marcadas")
  ok(horas.length >= 24, `evento "hora" cada hora (${horas.length})`)
  ok(avisos.some((e) => e.tipo === "aviso" && e.texto.includes("día 2")), "aviso al empezar el día 2")
  ok(sim.reloj.dia === 2 && Math.abs(sim.reloj.minutos - 30) < 0.01, `el reloj llega al día 2, 00:30 (${sim.reloj.dia}, ${sim.reloj.minutos.toFixed(2)})`)
  const conMemoria = IDS.filter((id) => sim.pj[id].memoria.length > 0)
  ok(conMemoria.length >= 3, `quedan recuerdos de las charlas (${conMemoria.join(", ")})`)
  ok(IDS.some((id) => Object.values(sim.pj[id].afinidad).some((v) => v !== 10)), "la afinidad cambia al conversar")

  // ── 2. Guardar y cargar ─────────────────────────────────────
  seccion("serializar / cargar")
  const datos = JSON.parse(JSON.stringify(sim.serializar()))
  const sim2 = new Simulacion(PERSONAJES, ESPECIALES, { dia: 9, minutos: 100, semilla: 99 })
  sim2.cargar(datos)
  ok(sim2.reloj.dia === sim.reloj.dia && Math.abs(sim2.reloj.minutos - sim.reloj.minutos) < 1e-9, "conserva el reloj")
  for (const id of IDS) {
    ok(JSON.stringify(sim2.pj[id].memoria) === JSON.stringify(sim.pj[id].memoria), `conserva la memoria de ${id}`)
    ok(JSON.stringify(sim2.pj[id].afinidad) === JSON.stringify(sim.pj[id].afinidad), `conserva la afinidad de ${id}`)
    const guardado = (datos as { pj: Record<string, { lugarId: string | null }> }).pj[id].lugarId
    ok(!guardado || sim2.pj[id].lugarId === guardado || sim2.pj[id].destinoId !== null, `${id} aparece en su lugar al cargar`)
  }
  ok(sinNaN(sim2), "después de cargar, nadie con NaN")

  // Datos rotos o viejos: nunca rompen.
  const rotos: unknown[] = [null, undefined, 42, "hola", [], { reloj: "x" }, { reloj: { dia: "x", minutos: Infinity }, pj: 5 }]
  rotos.push({ pj: { hormozi: { memoria: [1, null, { texto: 5 }, { cuando: "ayer", texto: "Vale" }], afinidad: { amodei: "mucho", kobe: 500 }, lugarId: "no-existe" } } })
  let tiro = false
  const sim3 = new Simulacion(PERSONAJES, ESPECIALES, { minutos: 600, semilla: 3 })
  for (const r of rotos) {
    try {
      sim3.cargar(r)
    } catch {
      tiro = true
    }
  }
  ok(!tiro, "cargar() con datos rotos no tira")
  ok(sinNaN(sim3) && Number.isFinite(sim3.reloj.minutos) && sim3.reloj.dia >= 1, "con datos rotos el estado sigue sano")
  ok(sim3.pj.hormozi.memoria.length === 1 && sim3.pj.hormozi.memoria[0].texto === "Vale", "de un recuerdo roto toma solo lo válido")
  ok(sim3.pj.hormozi.afinidad.kobe === 100 && sim3.pj.hormozi.afinidad.amodei === 10, "la afinidad rota se ignora y la exagerada se recorta")
  sim3.cargar({ dia: 3, min: 600, ag: { hormozi: { mem: [{ cuando: "Día 1, 08:00", txt: "Recuerdo viejo" }], rel: { amodei: 42 } } } })
  ok(sim3.reloj.dia === 3 && sim3.reloj.minutos === 600, "entiende el formato de la versión anterior (reloj)")
  ok(sim3.pj.hormozi.memoria[0]?.texto === "Recuerdo viejo" && sim3.pj.hormozi.afinidad.amodei === 42, "entiende el formato de la versión anterior (memoria y afinidad)")
}

// ── 3. reunir: junta a todos y reproduce las líneas agregadas ──
seccion("reunir / agregarLineas / cerrar")
{
  const sim = new Simulacion(PERSONAJES, ESPECIALES, { minutos: 11 * 60, semilla: 11 })
  let ahora = 0
  let transcurrido = 0
  const correr = (seg: number) => {
    for (let i = 0; i < Math.round(seg / 0.1); i++) {
      sim.avanzar(0.1, (ahora += 100))
      transcurrido += 0.1
    }
  }
  correr(5)
  const oidas: LineaConv[] = []
  let presentesAlEmpezar: string[] = []
  let empezoA = -1
  let conv: Conversacion | null = null
  sim.on((e) => {
    if (e.tipo !== "linea" || !conv || e.conv.id !== conv.id) return
    if (!oidas.length) {
      presentesAlEmpezar = sim.presentes("sala-guerra")
      empezoA = transcurrido
    }
    oidas.push(e.linea)
  })
  const antes = sim.pj.kobe.afinidad.hormozi
  conv = sim.reunir("sala-guerra", IDS, "Consejo de prueba")
  const reunidoA = transcurrido
  ok(conv.abierta && conv.lineas.length === 0 && conv.ids.length === 4, "reunir abre una conversación sin líneas")
  ok(IDS.every((id) => sim.pj[id].conversacionId === conv!.id), "todos quedan en la conversación")
  correr(1)
  sim.agregarLineas(conv.id, [
    { id: "kobe", texto: "Primera." },
    { id: "nadie", texto: "No participa." },
    { id: "hormozi", texto: "Segunda.", cita: true },
  ])
  let t = 0
  while (oidas.length < 2 && t < 120) {
    correr(1)
    t++
  }
  ok(oidas.length === 2, `se dicen las líneas agregadas (${oidas.length})`)
  ok(presentesAlEmpezar.length === 4, `cuando empieza, están todos en la Sala de guerra (${presentesAlEmpezar.join(", ")})`)
  ok(empezoA - reunidoA <= 40.5, `no espera más de 40 s reales (empezó a los ${(empezoA - reunidoA).toFixed(1)} s)`)
  correr(30)
  ok(sim.conversaciones.some((c) => c.id === conv!.id) && oidas.length === 2, "abierta y sin líneas nuevas, espera")
  ok(IDS.every((id) => sim.pj[id].lugarId === "sala-guerra"), "mientras espera, nadie se va")
  sim.agregarLineas(conv.id, [{ id: "amodei", texto: "Tercera." }])
  sim.cerrar(conv.id, "Acordaron algo.", [{ a: "kobe", b: "hormozi", delta: 7 }])
  t = 0
  while (sim.conversaciones.some((c) => c.id === conv!.id) && t < 60) {
    correr(1)
    t++
  }
  ok(!sim.conversaciones.some((c) => c.id === conv!.id), "al cerrar, termina después de la última línea")
  ok(oidas.map((l) => l.texto).join(" ") === "Primera. Segunda. Tercera.", `las líneas salen en orden (${oidas.map((l) => l.texto).join(" ")})`)
  ok(oidas[1].cita === true, "la cita se conserva")
  ok(IDS.every((id) => sim.pj[id].memoria[0]?.texto === "Consejo de prueba: Acordaron algo."), "todos recuerdan el resumen")
  ok(sim.pj.kobe.afinidad.hormozi === antes + 7 && sim.pj.hormozi.afinidad.kobe === antes + 7, "la afinidad usa el delta de la IA")
  ok(IDS.every((id) => sim.pj[id].conversacionId === null), "al terminar, nadie queda en la conversación")
  correr(2)
  ok(IDS.every((id) => sim.pj[id].destinoId !== "sala-guerra"), "al terminar, cada uno vuelve a su horario")

  // conversarGuion: a mano, con tema.
  const oidas2: LineaConv[] = []
  const c2 = sim.conversarGuion("jardin-sur", ["hormozi", "kobe"], "poder")
  sim.on((e) => {
    if (e.tipo === "linea" && e.conv.id === c2.id) oidas2.push(e.linea)
  })
  ok(!c2.abierta && c2.lineas.length >= 2, "conversarGuion arma el guion completo")
  ok(c2.lineas.slice(0, 2).every((l) => l.texto.includes("el poder se gana")), "conversarGuion respeta el tema")
  t = 0
  while (sim.conversaciones.some((c) => c.id === c2.id) && t < 300) {
    correr(1)
    t++
  }
  ok(oidas2.length === c2.lineas.length, `conversarGuion reproduce todas sus líneas (${oidas2.length}/${c2.lineas.length})`)

  ok(sinNaN(sim), "después de reunir y conversar, nadie con NaN")
}

// ── irA: manda hasta el próximo cambio de horario ──
seccion("irA")
{
  // A las 19:00 amodei está en el Jardín Sur; su horario cambia a las 22:00.
  const sim = new Simulacion(PERSONAJES, ESPECIALES, { minutos: 19 * 60, semilla: 4 })
  let ahora = 0
  sim.irA("amodei", "jardin-norte", "Mira la fachada")
  ok(sim.pj.amodei.destinoId === "jardin-norte" && sim.pj.amodei.actividad === "Mira la fachada", "irA cambia destino y actividad")
  let t = 0
  while (sim.pj.amodei.lugarId !== "jardin-norte" && t < 7000) {
    sim.avanzar(0.1, (ahora += 100))
    t++
  }
  ok(sim.pj.amodei.lugarId === "jardin-norte", `irA lo lleva al lugar (en ${(t / 10).toFixed(0)} s)`)
  while (sim.reloj.minutos < 22 * 60 + 1) sim.avanzar(0.1, (ahora += 100))
  ok(sim.pj.amodei.destinoId === "habitaciones" && sim.pj.amodei.actividad === "Duerme", "el siguiente cambio de horario vuelve a mandar")
}

// ── Todo el mapa: se llega a cada lugar desde las habitaciones ──
seccion("se llega a cada lugar del mapa")
{
  const lejos: string[] = []
  let maxS = 0
  for (const l of Object.values(LUGAR)) {
    const p = pj("viajero", "hormozi", "vivo", [
      [0, "habitaciones", "Sale"],
      [0.01, l.id, "Llega"],
    ])
    const sim = new Simulacion([p], {}, { minutos: 0, semilla: 1 })
    let ahora = 0
    let s = 0
    let nivel = sim.pj.viajero.nivel
    let estado = sim.pj.viajero.estado
    let saltos = 0
    while (sim.pj.viajero.lugarId !== l.id && s < 400) {
      sim.avanzar(1, (ahora += 1000))
      s++
      const e = sim.pj.viajero
      if (e.nivel !== nivel && e.estado !== "ascensor" && estado !== "ascensor") saltos++
      nivel = e.nivel
      estado = e.estado
    }
    maxS = Math.max(maxS, s)
    if (sim.pj.viajero.lugarId !== l.id || saltos || sim.pj.viajero.nivel !== l.nivel) lejos.push(l.id)
  }
  ok(!lejos.length, `se llega a los ${Object.keys(LUGAR).length} lugares, en su nivel y sin saltar de nivel (no: ${lejos.join(", ")}; el más lejano, ${maxS} s)`)
}

// ── 4. Determinismo, velocidad y pausa ─────────────────────────
seccion("determinismo, velocidad y pausa")
{
  const correrSim = (semilla: number) => {
    const s = new Simulacion(PERSONAJES, ESPECIALES, { minutos: 6 * 60, semilla })
    const lineas: string[] = []
    s.on((e) => {
      if (e.tipo === "linea") lineas.push(`${e.linea.id}:${e.linea.texto}`)
    })
    for (let i = 0; i < 6000; i++) s.avanzar(0.1, i * 100)
    return JSON.stringify({ pj: s.pj, lineas, reloj: s.reloj })
  }
  ok(correrSim(5) === correrSim(5), "misma semilla, misma historia")
  ok(correrSim(5) !== correrSim(6), "otra semilla, otra historia")

  const sim = new Simulacion(PERSONAJES, ESPECIALES, { minutos: 8.9 * 60, semilla: 2 })
  sim.reloj.velocidad = 4
  let vistaCaminando = false
  for (let i = 0; i < 400; i++) {
    sim.avanzar(0.1, i * 100)
    for (const id of IDS)
      if (sim.pj[id].estado === "camina" && Math.abs(sim.pj[id].velocidad - 1.4 * 2) < 1e-9) vistaCaminando = true
  }
  ok(vistaCaminando, "a ×4 caminan a 1,4 × √4 = 2,8 m/s")
  ok(Math.abs(sim.reloj.minutos - (8.9 * 60 + 40 * 4)) < 1e-6, "a ×4 el reloj avanza 4 minutos por segundo")
  sim.reloj.pausa = true
  const foto = JSON.stringify({ pj: IDS.map((id) => sim.pj[id].pos), m: sim.reloj.minutos })
  for (let i = 0; i < 50; i++) sim.avanzar(0.1, 40000 + i * 100)
  ok(foto === JSON.stringify({ pj: IDS.map((id) => sim.pj[id].pos), m: sim.reloj.minutos }), "en pausa no se mueve nada")
  sim.reloj.pausa = false
  sim.avanzar(30, 50000)
  ok(sinNaN(sim), "un salto de 30 s se recorta sin romper nada")
}

console.log(`\n${pasaron} pasaron, ${fallas} fallaron`)
if (fallas) process.exit(1)
