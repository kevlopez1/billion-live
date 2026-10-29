// Corre con: npx tsx lib/fabrica/guardas.test.ts
// Sin red ni base. Un guion bueno (datos-de-prueba.ts) y, por cada regla, una
// copia con una sola cosa rota que la guarda tiene que rechazar.
// Sale con código 1 si algo falla.

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import type { Episodio } from "@/components/casa-blanca/estudio/guion"
import { CALENDARIO } from "@/components/casa-blanca/estudio/episodios"
import { contextoDePrueba, copia, guionBueno } from "./datos-de-prueba"
import {
  CITAS,
  FAMILIAS,
  etiquetaIA,
  miniaturaValida,
  oraciones,
  reglaComercial,
  revisarContenido,
  revisarGuion,
  revisarReparto,
  revisarTodo,
  similitud,
  textoValido,
  type ContextoGuion,
  type TextosDelVideo,
} from "./guardas"
import { FICCION, textoDe, textosDe, WEB_CASA } from "./textos"
import { FORMAS_VOSEO, formasDeVoseo, voseo } from "./voseo"

let fallos = 0
async function prueba(nombre: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    console.log(`ok   ${nombre}`)
  } catch (e) {
    fallos++
    console.log(`FALLA ${nombre}\n     ${e instanceof Error ? e.message : e}`)
  }
}

const hay = (errores: string[], re: RegExp) => assert.ok(errores.some((e) => re.test(e)), `se esperaba ${re} en: ${errores.join(" | ") || "(nada)"}`)
const textosBuenos = (ep: Episodio): TextosDelVideo => ({
  porRed: textosDe({ titulo: ep.titulo, pilar: "camara-oculta", descripcion: "Sun Tzu le gana tres partidas seguidas a Napoleón." }),
  miniatura: "Jaque al emperador",
})
/** El guion bueno con una línea más de Napoleón en el plano 2. */
function conLinea(texto: string, base = guionBueno()): Episodio {
  const ep = copia(base)
  ep.planos[1].dialogo!.push({ quien: "napoleon", texto })
  return ep
}

async function main() {
  const ctx: ContextoGuion = await contextoDePrueba("2026-11-15")

  // ── El guion bueno pasa ──
  await prueba("el guion bueno pasa todas las guardas y es verde", () => {
    const ep = guionBueno()
    const r = revisarTodo(ep, textosBuenos(ep), ctx)
    assert.deepEqual(r.errores, [])
    assert.equal(r.luz, "verde")
  })

  // ── Reparto y semáforo ──
  await prueba("una persona viva que habla: rechazado", () => {
    const ep = copia(guionBueno())
    ep.planos[1].reunir = ["napoleon", "suntzu", "musk"]
    ep.planos[1].dialogo!.push({ quien: "musk", texto: "Hola." })
    hay(revisarReparto(ep, undefined, "2026-11-15"), /"musk" es una persona viva: solo de fondo, sin diálogo/)
  })
  await prueba("una persona viva de fondo, no primera ni sola: pasa, pero el video queda amarillo", () => {
    const ep = copia(guionBueno())
    ep.planos[1].reunir = ["napoleon", "suntzu", "musk"]
    assert.deepEqual(revisarReparto(ep, undefined, "2026-11-15"), [])
    assert.equal(revisarTodo(ep, textosBuenos(ep), ctx).luz, "amarillo")
  })
  await prueba("una persona viva seguida, en una toma, primera o sola en reunir: rechazado", () => {
    const a = copia(guionBueno())
    a.planos[4].camara = { tipo: "seguir", personaje: "altman" }
    hay(revisarReparto(a, undefined, "2026-11-15"), /la cámara no lo sigue/)
    const b = copia(guionBueno())
    b.planos[0].camara = { tipo: "toma", toma: "sala-guerra", personaje: "karp" }
    hay(revisarReparto(b, undefined, "2026-11-15"), /no es el personaje de una toma/)
    const c = copia(guionBueno())
    c.planos[1].reunir = ["musk", "napoleon"]
    hay(revisarReparto(c, undefined, "2026-11-15"), /va primero en reunir/)
    const d = copia(guionBueno())
    d.planos[3].reunir = ["musk", "thiel"]
    hay(revisarReparto(d, undefined, "2026-11-15"), /va primero en reunir|solo hay personas vivas/)
  })
  await prueba("el nombre de un vivo en un rótulo, un texto o la miniatura: rechazado", () => {
    const ep = copia(guionBueno())
    ep.planos[3].rotulo = "Elon mira desde el fondo"
    hay(revisarReparto(ep, undefined, "2026-11-15"), /plano 4, rótulo: nombra a "musk"/)
    hay(revisarReparto(guionBueno(), { porRed: { x: "Altman también estaba" } }, "2026-11-15"), /texto de x: nombra a "altman"/)
    hay(miniaturaValida("Musk pierde", "2026-11-15"), /nombra a "musk"/)
  })
  await prueba("Trump antes del 10-nov: fuera (por fecha de salida); desde el 11, de fondo pasa", () => {
    const ep = copia(guionBueno())
    ep.planos[1].reunir = ["napoleon", "suntzu", "trump"]
    hay(revisarReparto(ep, undefined, "2026-11-10"), /"trump" está fuera del semáforo para una salida el 2026-11-10/)
    assert.deepEqual(revisarReparto(ep, undefined, "2026-11-11"), [])
    const nombrado = conLinea("Trump quiere mi escritorio.")
    hay(revisarReparto(nombrado, undefined, "2026-11-09"), /nombra a "trump", que está fuera/)
  })
  await prueba("Tate nunca", () => {
    const ep = copia(guionBueno())
    ep.planos[1].reunir = ["napoleon", "suntzu", "tate"]
    hay(revisarReparto(ep, undefined, "2027-01-01"), /"tate" está fuera/)
  })

  // ── Regla comercial ──
  await prueba("Kobe junto a {RECAUDADO}: rechazado", () => {
    const ep = copia(guionBueno())
    ep.planos[1].reunir = ["napoleon", "kobe"]
    ep.planos[3].rotulo = "Recaudado: {RECAUDADO} de {META}"
    const e = reglaComercial(ep)
    hay(e, /\{RECAUDADO\} en un video con kobe/)
    hay(e, /\{META\} en un video con kobe/)
  })
  await prueba("Jobs con PRIME o con «el reto»: rechazado; solo verdes con {RECAUDADO}: pasa", () => {
    const ep = copia(guionBueno())
    ep.planos[1].reunir = ["napoleon", "jobs"]
    ep.planos[0].titulo = "PRIME a mil millones"
    hay(reglaComercial(ep), /PRIME en un video con jobs/)
    hay(reglaComercial(guionBueno(), { porRed: { youtube: "Kobe y el reto" } }), /el reto en un video con kobe/)
    const verde = copia(guionBueno())
    verde.planos[3].rotulo = "Recaudado: {RECAUDADO} de {META}"
    assert.deepEqual(reglaComercial(verde), [])
  })

  // ── Contenido prohibido: una prueba por familia ──
  const conKobe = () => {
    const ep = copia(guionBueno())
    ep.planos[1].reunir = ["napoleon", "suntzu", "kobe"]
    return ep
  }
  const casos: Record<string, string> = {
    delitos: "Dicen que estuvo en la cárcel.",
    juicios: "Mañana empieza su juicio.",
    salud: "Dicen que tiene cáncer.",
    sexo: "Tenía una amante en Roma.",
    familia: "Su esposa lo esperaba.",
    politica: "Las elecciones ya están decididas.",
    recomendacion: "Te recomiendo esta app para vender más.",
    empresa_cifra: "Tesla vale 800 mil millones.",
    consejo_plata: "Invierte todo en bitcoin.",
    consejo_salud: "Toma esta pastilla cada mañana.",
    consejo_leyes: "No pagues impuestos este año.",
    conspiracion: "La tierra es plana y nadie lo dice.",
    muerte_kobe: "Nunca olvido el helicóptero.",
  }
  await prueba("cada familia prohibida tiene su caso", () => {
    assert.deepEqual(Object.keys(casos).sort(), FAMILIAS.map((f) => f.id).sort())
  })
  for (const f of FAMILIAS) {
    await prueba(`familia «${f.nombre}»: rechazado`, () => {
      const ep = conLinea(casos[f.id], f.cuando === "siempre" ? guionBueno() : conKobe())
      hay(revisarContenido(ep), new RegExp(f.nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    })
  }
  await prueba("las familias de personas reales no se aplican si solo hay históricos y verdes", () => {
    assert.deepEqual(revisarContenido(conLinea("Su esposa lo esperaba en París.")), [])
  })
  await prueba("lo prohibido también en los textos de publicación", () => {
    hay(revisarContenido(guionBueno(), { porRed: { youtube: "Las elecciones de EE. UU." } }), /política electoral/)
  })

  // ── Citas ──
  await prueba("comillas sin cita: rechazado; cita inventada: rechazado; cita de personajes.ts: pasa", () => {
    hay(revisarContenido(conLinea("Como dijo él: «la gloria es efímera».")), /tiene comillas/)
    const inventada = copia(guionBueno())
    inventada.planos[2].dialogo![0] = { quien: "suntzu", texto: "Ganar es fácil.", cita: true }
    hay(revisarContenido(inventada), /no está marcada como cita/)
    assert.ok(CITAS.get("suntzu")?.has("El supremo arte de la guerra es someter al enemigo sin luchar."))
    assert.deepEqual(revisarContenido(guionBueno()), [])
  })

  // ── Voseo ──
  await prueba("voseo en un título: rechazado", () => {
    const ep = copia(guionBueno())
    ep.titulo = "Mirá lo que hizo Napoleón" // sin-voseo:ejemplos
    hay(revisarGuion(ep, ctx), /título del episodio: tiene voseo \(Mirá\)/) // sin-voseo:ejemplos
  })
  await prueba("voseo: la lista es la misma de scripts/sin-voseo.py", () => {
    const py = readFileSync("scripts/sin-voseo.py", "utf8")
    const bloque = py.slice(py.indexOf("FORMAS = ["), py.indexOf("]", py.indexOf("FORMAS = [")))
    const formas = [...bloque.matchAll(/"([^"]+)"/g)].map((m) => m[1])
    assert.ok(formas.length > 100, `se leyeron ${formas.length} formas del .py`)
    const ts = new Set(FORMAS_VOSEO)
    const faltan = formas.filter((f) => !ts.has(f))
    assert.deepEqual(faltan, [], `faltan en voseo.ts: ${faltan.join(", ")}`)
  })
  await prueba("voseo: palabra entera, como el .py", () => {
    assert.deepEqual(formasDeVoseo("¿Querés venir acá?"), ["Querés", "acá"]) // sin-voseo:ejemplos
    assert.deepEqual(formasDeVoseo("Quieres venir aquí, señor de Vosges"), [])
    assert.deepEqual(voseo("Pon esto aquí"), [])
  })

  // ── Guion: duración, título, similitud ──
  await prueba("menos de 60 s o más de 90 s: rechazado; TikTok pide 61", () => {
    const corto = copia(guionBueno())
    corto.planos[4].dur = 4
    hay(revisarGuion(corto, ctx), /va de 61 a 90 s/)
    const largo = copia(guionBueno())
    largo.planos[4].dur = 40
    hay(revisarGuion(largo, ctx), /dura 90\.5 s/)
    const justo = copia(guionBueno())
    justo.planos[4].dur = 10.5 // 56,5 + 4,5 = 61 s
    assert.deepEqual(revisarGuion(justo, ctx), [])
    justo.planos[4].dur = 10 // 60 s: sirve sin TikTok
    hay(revisarGuion(justo, ctx), /va de 61 a 90 s/)
    assert.deepEqual(revisarGuion(justo, { ...ctx, redes: ["youtube", "x"] }), [])
  })
  await prueba("título de más de 48 caracteres: rechazado", () => {
    const ep = copia(guionBueno())
    ep.titulo = "Napoleón no sabe perder y Sun Tzu se lo recuerda cada noche"
    hay(revisarGuion(ep, ctx), /el título tiene \d+ caracteres/)
  })
  await prueba("un guion igual a uno reciente: rechazado; uno distinto: pasa", () => {
    hay(revisarGuion(guionBueno(), { ...ctx, recientes: [guionBueno()] }), /se parece demasiado/)
    assert.ok(similitud("Napoleón juega ajedrez en la biblioteca", "Cleopatra nada en el gimnasio de noche") < 0.6)
  })
  await prueba("lo que el estudio no puede filmar: rechazado (guionValido)", () => {
    const ep = copia(guionBueno())
    ep.planos[0].camara = { tipo: "lugar", lugar: "luna" }
    hay(revisarGuion(ep, ctx), /el lugar "luna" no existe/)
  })

  // ── Textos por red ──
  await prueba("el texto armado pasa en las cinco redes", () => {
    for (const red of ["youtube", "facebook", "instagram", "tiktok", "x"] as const) {
      const t = textoDe({ titulo: "Napoleón no sabe perder", pilar: "historia", descripcion: "Una partida que no termina." }, red)
      assert.deepEqual(textoValido(red, t, "Napoleón no sabe perder"), [], red)
      assert.equal(t.split("\n")[0], FICCION)
    }
  })
  await prueba("URL en el texto de X: rechazado (y el armado no la pone)", () => {
    const conUrl = `${FICCION}\n\nNapoleón no sabe perder\n\n${WEB_CASA}\n\n#LaCasaBlancaProject #Historia #FicciónConIA`
    hay(textoValido("x", conUrl), /texto de x: tiene una URL o un dominio/)
    hay(textoValido("x", `${FICCION}\n\nMira t.co/abc #LaCasaBlancaProject #Historia #FicciónConIA`), /dominio/)
    hay(textoValido("x", `${FICCION}\n\nhttps://x.com #LaCasaBlancaProject #Historia #FicciónConIA`), /URL/)
    assert.ok(!textoDe({ titulo: "T", pilar: "historia" }, "x").includes("kevproject"))
  })
  await prueba("sin la línea de ficción primero: rechazado", () => {
    const t = textoDe({ titulo: "Napoleón no sabe perder", pilar: "historia" }, "youtube")
    const sinFiccion = t.split("\n").slice(2).join("\n")
    hay(textoValido("youtube", sinFiccion), /la primera línea tiene que ser exactamente/)
    hay(textoValido("instagram", `Hola\n${t}`), /la primera línea/)
  })
  await prueba("X: más de 280 caracteres o etiquetas de más: rechazado; la descripción larga se cae sola", () => {
    const largo = "a".repeat(300)
    hay(textoValido("x", `${FICCION}\n\n${largo} #LaCasaBlancaProject #Historia #FicciónConIA`), /tope es 280/)
    hay(textoValido("x", `${FICCION}\n\nT #LaCasaBlancaProject #Historia #FicciónConIA #Otra`), /van 3 etiquetas/)
    const t = textoDe({ titulo: "Napoleón no sabe perder", pilar: "historia", descripcion: "b ".repeat(100) }, "x")
    assert.deepEqual(textoValido("x", t), [])
  })
  await prueba("voseo en el texto de una red: rechazado", () => {
    const t = textoDe({ titulo: "Mirá esto", pilar: "historia" }, "facebook") // sin-voseo:ejemplos
    hay(textoValido("facebook", t), /tiene voseo/)
  })
  await prueba("miniatura: 3 palabras o menos", () => {
    assert.deepEqual(miniaturaValida("Jaque al emperador", "2026-11-15"), [])
    hay(miniaturaValida("El emperador pierde otra vez", "2026-11-15"), /5 palabras/)
  })

  // ── Etiquetas de IA ──
  await prueba("etiqueta de IA por red: sin ella no se sube", () => {
    assert.deepEqual(etiquetaIA("youtube", { status: { containsSyntheticMedia: true } }), [])
    hay(etiquetaIA("youtube", { status: {} }), /containsSyntheticMedia/)
    assert.deepEqual(etiquetaIA("instagram", { is_ai_generated: "true" }), [])
    hay(etiquetaIA("instagram", {}), /is_ai_generated/)
    assert.deepEqual(etiquetaIA("tiktok", { is_aigc: true }), [])
    hay(etiquetaIA("tiktok", { is_aigc: false }), /is_aigc/)
    assert.deepEqual(etiquetaIA("facebook", { description: `${FICCION}\n\nT` }), [])
    hay(etiquetaIA("x", { text: "Hola" }), /no empieza con el aviso/)
  })

  // ── Utilidades ──
  await prueba("oraciones: el punto de miles no corta", () => {
    assert.deepEqual(oraciones("Vale 1.000.000 dólares. Otra frase"), ["Vale 1.000.000 dólares.", "Otra frase"])
  })

  // ── La temporada: corren sin excepción (se reportan, no se arreglan aquí) ──
  // Solo las guardas de contenido: la duración y el texto de la temporada siguen otras reglas (10-CASA-BLANCA-PROJECT.md).
  await prueba(`los ${CALENDARIO.length} episodios de CALENDARIO corren las guardas sin excepción`, () => {
    let conErrores = 0
    for (const e of CALENDARIO) {
      const errores = [
        ...revisarReparto(e.episodio, undefined, e.fecha),
        ...reglaComercial(e.episodio, { porRed: { youtube: e.texto } }),
        ...revisarContenido(e.episodio, { porRed: { youtube: e.texto } }),
      ]
      if (errores.length) {
        conErrores++
        console.log(`       ${e.episodio.id} (${e.fecha}): ${errores.join(" | ")}`)
      }
    }
    console.log(`       ${conErrores} de ${CALENDARIO.length} chocan con las guardas de contenido`)
  })

  console.log(fallos ? `\n${fallos} fallaron` : "\ntodas pasaron")
  process.exit(fallos ? 1 : 0)
}

main()
