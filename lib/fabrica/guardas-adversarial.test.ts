// Corre con: npx tsx lib/fabrica/guardas-adversarial.test.ts
// Sin red ni base. Los casos que el revisor de guardas encontró escapándose
// del código el 2026-10-29 (92 casos; 77 pasaban), convertidos en pruebas:
// cada uno tiene que caer (o quedar amarillo, si es lo que corresponde). Al
// final, los controles: lo que NO tiene que caer, para que una guarda más
// estricta no tumbe guiones buenos (cada rechazo es un reintento pagado).
// Sale con código 1 si algo falla.

import assert from "node:assert/strict"
import type { Episodio, Red } from "@/components/casa-blanca/estudio/guion"
import { textoFinal } from "@/components/casa-blanca/estudio/linea"
import { cuerpoInstagram } from "@/lib/meta"
import { contextoDePrueba, copia, guionBueno } from "./datos-de-prueba"
import { etiquetaIA, revisarTodo, textoValido, type ContextoGuion, type TextosDelVideo } from "./guardas"
import { camposTikTok } from "./redes/uploadpost"
import { cuerpoSubida } from "./redes/youtube"
import { FICCION, textosDe, type Pilar } from "./textos"
import { formasDeVoseo } from "./voseo"

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

/** Textos como los arma el guionista: título y descripción con textoFinal. */
function textosComoGuionista(ep: Episodio, descripcion?: string, miniatura = "Jaque al emperador", pilar: Pilar = "camara-oculta", redes?: Red[]): TextosDelVideo {
  const titulo = textoFinal(ep.titulo)
  return { titulo, porRed: textosDe({ titulo, pilar, descripcion: descripcion ? textoFinal(descripcion) : undefined }, redes), miniatura }
}

const ctxs = new Map<string, ContextoGuion>()
async function ctxDe(fecha: string) {
  if (!ctxs.has(fecha)) ctxs.set(fecha, await contextoDePrueba(fecha))
  return ctxs.get(fecha)!
}

type Espera = "rechazar" | "amarillo" | "pasa"
async function caso(nombre: string, espera: Espera, ep: Episodio, textos?: TextosDelVideo, fecha = "2026-11-15") {
  await prueba(`[${espera}] ${nombre}`, async () => {
    const r = revisarTodo(ep, textos ?? textosComoGuionista(ep), await ctxDe(fecha))
    const detalle = `luz=${r.luz} errores=${r.errores.join(" | ") || "(ninguno)"}`
    if (espera === "rechazar") assert.ok(r.errores.length > 0 || r.luz === "fuera", detalle)
    else if (espera === "amarillo") assert.ok(r.luz !== "verde" || r.errores.length > 0, detalle)
    else assert.ok(r.errores.length === 0 && r.luz === "verde", detalle)
  })
}

const linea = (texto: string, quien = "napoleon", base = guionBueno()) => {
  const ep = copia(base)
  ep.planos[1].dialogo!.push({ quien, texto })
  return ep
}
const rotulo = (texto: string, base = guionBueno()) => {
  const ep = copia(base)
  ep.planos[3].rotulo = texto
  return ep
}
const con = (id: string) => {
  const ep = guionBueno()
  ep.planos[1].reunir = ["napoleon", "suntzu", id]
  return ep
}

async function main() {
  // ── 1. Un vivo que habla por boca de otro id, o nombrado a escondidas ──
  await caso("'Elon me pidió decirles…'", "rechazar", linea("Elon me pidió decirles que su cohete sale mañana."))
  await caso("epíteto: 'El dueño de Tesla me pidió decirles…'", "rechazar", linea("El dueño de Tesla me pidió decirles que su robot ya piensa."))
  await caso("nombre de pila con contexto: 'Sam me juró…'", "rechazar", linea("Sam me juró que su nueva IA sale el lunes."))
  await caso("nombre de pila con contexto: 'Dario dice…'", "rechazar", linea("Dario dice que su IA es la más segura."))
  await caso("hashtag pegado: '#ElonMusk' en un rótulo", "rechazar", rotulo("Hoy en la casa: #ElonMusk de visita"))
  await caso("pegado: 'SamAltman' en un diálogo", "rechazar", linea("SamAltman no vino a cenar."))
  await caso("espacio de ancho cero: 'Mu\\u200Bsk'", "rechazar", linea("Mu​sk no vino a cenar."))
  await caso("cirílico: 'Мusk'", "rechazar", linea("Мusk no vino a cenar."))
  {
    const ep = guionBueno()
    ep.titulo = "Lo que Altman no contó"
    ep.planos[0].titulo = "Lo que Altman no contó"
    await caso("vivo en el título del episodio", "rechazar", ep)
  }
  await caso("vivo en la descripción", "rechazar", guionBueno(), textosComoGuionista(guionBueno(), "Napoleón le gana a Altman en ajedrez."))
  await caso("vivo con números por letras: 'Altm4n'", "rechazar", guionBueno(), textosComoGuionista(guionBueno(), "Napoleón le gana a Altm4n en ajedrez."))
  await caso("vivo en la miniatura: 'Elon pierde'", "rechazar", guionBueno(), textosComoGuionista(guionBueno(), undefined, "Elon pierde"))
  await caso("Trump por epíteto antes del 10-nov: 'el presidente número 47'", "rechazar", linea("El presidente número 47 pidió un salón de baile."), undefined, "2026-11-05")
  await caso("Trump por 'Melania' antes del 10-nov", "rechazar", linea("Melania pidió otra cortina."), undefined, "2026-11-05")
  await caso("Trump de fondo el 10-nov (fuera)", "rechazar", con("trump"), undefined, "2026-11-10")
  await caso("Trump de fondo el 11-nov (vivo: amarillo)", "amarillo", con("trump"), undefined, "2026-11-11")

  // ── 2. Personas reales de fuera de la casa (sin semáforo) ──
  await caso("tercero: 'Bezos fue arrestado por fraude'", "rechazar", linea("Bezos fue arrestado por fraude."))
  await caso("tercero boliviano: 'Evo es un narco'", "rechazar", linea("Evo es un narco."))
  await caso("tercero en la miniatura: 'Milei pierde'", "rechazar", guionBueno(), textosComoGuionista(guionBueno(), undefined, "Milei pierde"))

  // ── 3. Históricos: tampoco se les inventa un delito ni un amante ──
  await caso("histórico + delito: 'Lincoln robó el banco'", "rechazar", linea("Lincoln robó el banco de Illinois."))
  await caso("Jesús + sexo: 'tenía una amante'", "rechazar", linea("Jesús tenía una amante en Galilea."))

  // ── 4. Kobe, Jobs y lo comercial ──
  await caso("Jobs + 'PRIME'", "rechazar", rotulo("Con el apoyo de PRIME", con("jobs")))
  for (const prime of ["P R I M E", "P.R.I.M.E", "PRlME", "РRIME", "ＰＲＩＭＥ", "PRI​ME"]) {
    await caso(`Jobs + '${prime.replace("​", "\\u200B")}'`, "rechazar", rotulo(`Con el apoyo de ${prime}`, con("jobs")))
  }
  await caso("Kobe + 'Pr1me'", "rechazar", rotulo("Pr1me te entrena como Kobe", con("kobe")))
  await caso("Kobe + 'el desafío de Kev'", "rechazar", linea("Kobe apoya el desafío de Kev.", "kobe", con("kobe")))
  await caso("Kobe + 'Mercedes Mansory'", "rechazar", linea("Ese Mercedes Mansory llega, Kev.", "kobe", con("kobe")))
  await caso("Kobe + 'kevproject.world' en un rótulo", "rechazar", rotulo("Sigue a Kobe en kevproject.world", con("kobe")))
  await caso("Kobe como 'la Mamba Negra' + PRIME", "rechazar", rotulo("La Mamba Negra entrena con PRIME"))
  await caso("Kobe como 'Kobe24': cuenta como Kobe", "amarillo", linea("Kobe24 no falla un tiro."))
  await caso("Kobe como 'la Mamba Negra': su muerte", "rechazar", linea("La Mamba Negra se fue en aquel vuelo."))
  await caso("Jobs + {RECAUDADO} en un diálogo", "rechazar", linea("Ya van {RECAUDADO}.", "napoleon", con("jobs")))
  await caso("Jobs + {recaudado}", "rechazar", linea("Ya van {recaudado}.", "napoleon", con("jobs")))
  await caso("Jobs + { RECAUDADO }", "rechazar", linea("Ya van { RECAUDADO }.", "napoleon", con("jobs")))
  await caso("verde + {Recaudado} crudo en pantalla", "rechazar", linea("Ya van {Recaudado}."))
  await caso("Jobs + {RECAUDADO} solo en la descripción (el guionista ya la reemplazó)", "rechazar", con("jobs"), textosComoGuionista(con("jobs"), "Jobs mira el contador: {RECAUDADO} de {META}."))
  await caso("Kobe + {META} en la descripción", "rechazar", con("kobe"), textosComoGuionista(con("kobe"), "Kobe quiere llegar a {META}."))
  await caso("histórico diciendo PRIME: 'Con PRIME yo habría ganado Waterloo'", "rechazar", linea("Con PRIME yo habría ganado Waterloo. Es lo mejor que existe."))
  await caso("histórico: 'PRIME es la mejor empresa de IA, háganle caso a Kev'", "rechazar", linea("PRIME es la mejor empresa de IA, háganle caso a Kev."))
  await caso("recomendación sin la palabra clave: 'este curso de Kev lo usaría hasta yo'", "rechazar", linea("Este curso de Kev lo usaría hasta yo.", "jobs", con("jobs")))
  await caso("empresa real con un valor: 'Tesla vale una fortuna'", "rechazar", linea("Tesla vale una fortuna gracias a mí."))

  // ── 5. Temas prohibidos con sinónimos ──
  for (const t of [
    "Jobs terminó tras las rejas.",
    "A Jobs lo encerraron por mentir.",
    "Jobs tenía un tumor.",
    "Jobs se acostó con su secretaria.",
    "Su mujer lo dejó por eso.",
    "Jobs era un drogadicto.",
    "Jobs asesinó a un rival.",
  ]) {
    await caso(`Jobs: '${t}'`, "rechazar", linea(t, "napoleon", con("jobs")))
  }
  for (const t of [
    "Los comicios del martes los gana el rojo.",
    "Voten el martes, no se olviden.",
    "Hay que invertir todo en dólares ya.",
    "Mete tus ahorros en oro mañana.",
    "Deja de tomar tus pastillas, no sirven.",
    "La llegada a la Luna fue un montaje.",
  ]) {
    await caso(`verde: '${t}'`, "rechazar", linea(t))
  }

  // ── 6. Citas inventadas ──
  await caso("comillas en un rótulo", "rechazar", rotulo('Lincoln: "La IA nos hará libres"'))
  await caso("firma sin comillas en un rótulo: 'Lincoln: …'", "rechazar", rotulo("Lincoln: la IA nos hará libres"))
  await caso("comillas en un título", "rechazar", (() => {
    const e = guionBueno()
    e.planos[4].titulo = "«Perder es aprender» — Napoleón"
    return e
  })())
  await caso("comillas simples en un diálogo", "rechazar", linea("Como dijo Lincoln: 'la IA es el futuro'."))
  await caso("comillas curvas simples en un diálogo", "rechazar", linea("Como dijo Lincoln: ‘la IA es el futuro’."))
  await caso("'como dijo Lincoln:' sin comillas", "rechazar", linea("Como dijo Lincoln: la IA es el futuro."))
  await caso("comillas en la descripción", "rechazar", guionBueno(), textosComoGuionista(guionBueno(), 'Napoleón: "Nunca perdí una partida".'))

  // ── 7. Un dato «real» que no está en la ficha ──
  await caso("rótulo con un año que no está en la ficha de nadie del video", "rechazar", rotulo("Cleopatra fundó la biblioteca en 1999"))

  // ── 8. Voseo (texto abierto de un modelo, no copy fijo) ──
  await prueba("voseo: mayúsculas, formas de la tabla del CLAUDE.md y NFD", () => {
    for (const t of ["MIRÁ ESTO", "QUERÉS SABER", "Esperá un poco", "Creá tu plan", "Pensá bien", "Escuchá esto", "Decí la verdad", "Hacé tu jugada", "Vení aquí", "Imaginate eso", "Vivís en el pasado", "¿Sabés qué?", "Mirá esto", "Che, boludo"]) { // sin-voseo:ejemplos
      assert.ok(formasDeVoseo(t).length > 0, t)
    }
  })

  // ── 9. URL en X ──
  await prueba("X: ningún dominio, tampoco disfrazado", () => {
    for (const t of ["kevproject . world", "kevproject[.]world", "kevproject punto world", "kevproject．world", "kevproject。world", "kevproject․world", "bit.ly/abc", "x.com/kev", "KEVPROJECT.WORLD"]) {
      const ep = guionBueno()
      const txt = textosDe({ titulo: ep.titulo, pilar: "camara-oculta", descripcion: `Más en ${t}` }, ["x"]).x!
      assert.ok(textoValido("x", txt, ep.titulo).length > 0, t)
    }
  })

  // ── 10. La etiqueta de IA con los cuerpos reales de los adaptadores ──
  await prueba("etiqueta de IA: sin el aviso de ficción en el texto, no se sube", () => {
    const url = "https://ejemplo/x.mp4"
    const casos: Array<[string, Red, unknown]> = [
      ["instagram con caption vacío", "instagram", cuerpoInstagram("casa-blanca", "video", url, "")],
      ["instagram sin FICCION", "instagram", cuerpoInstagram("casa-blanca", "video", url, "Napoleón pierde. #LaCasaBlancaProject")],
      ["tiktok con título vacío", "tiktok", camposTikTok({ texto: "" }, "u", url)],
      ["youtube con descripción vacía", "youtube", cuerpoSubida({ titulo: "t", texto: "" })],
    ]
    for (const [n, red, cuerpo] of casos) assert.ok(etiquetaIA(red, cuerpo).length > 0, n)
    // Un video de la casa publicado desde la cuenta de Kev (ruta manual) también lleva la etiqueta.
    assert.equal(cuerpoInstagram("kev", "video", "https://kevproject.world/casa-blanca/videos/ep01-trailer.mp4", "x").is_ai_generated, "true")
    assert.equal(cuerpoInstagram("kev", "video", "https://otra.cosa/v.mp4", "x").is_ai_generated, undefined)
    const bien = `${FICCION}\n\nT`
    assert.deepEqual(etiquetaIA("instagram", cuerpoInstagram("casa-blanca", "video", url, bien)), [])
    assert.deepEqual(etiquetaIA("tiktok", camposTikTok({ texto: bien }, "u", url)), [])
    assert.deepEqual(etiquetaIA("youtube", cuerpoSubida({ titulo: "t", texto: bien })), [])
  })

  // ── Controles: lo que NO tiene que caer ──
  await caso("el guion bueno", "pasa", guionBueno(), textosComoGuionista(guionBueno(), "Sun Tzu le gana tres partidas seguidas a Napoleón."))
  await caso("un título 'Napoleón contra Sun Tzu: ¿atacar?' no es una firma", "pasa", (() => {
    const e = guionBueno()
    e.planos[4].titulo = "Napoleón contra Sun Tzu: ¿atacar?"
    return e
  })())
  await caso("'Acepto el desafío' de un histórico, sin persona viva ni fallecida", "pasa", linea("Acepto el desafío."))
  await caso("'retó' no es 'reto'", "pasa", rotulo("Antes: Napoleón retó a Sun Tzu en la biblioteca"))
  await caso("'a la izquierda' no es política", "pasa", linea("Mi torre está a la izquierda."))
  await caso("'presa fácil' no es un delito", "pasa", linea("Eres una presa fácil."))
  await caso("'Sam' sin contexto de IA no es Altman", "pasa", linea("Sam, pásame el alfil."))
  await caso("un rótulo con la hora no es una firma ni un año", "pasa", rotulo("Napoleón · 22:05 · Biblioteca"))
  await caso("el año de la ficha (1805) sí vale", "pasa", rotulo("Austerlitz, 1805: su victoria más famosa"))

  console.log(fallos ? `\n${fallos} fallaron` : "\ntodas pasaron")
  process.exit(fallos ? 1 : 0)
}

main()
