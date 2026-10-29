// ──────────────────────────────────────────────────────────────
// LA FÁBRICA · CARGAR UN TOKEN A MANO (YouTube o X)
//
//   echo "$REFRESH" | npx tsx scripts/fabrica/cargar-token.ts youtube [--probar]
//   echo "$REFRESH" | npx tsx scripts/fabrica/cargar-token.ts x [--probar]
//
// El refresh token entra por la entrada estándar (nunca como argumento: quedaría
// en el historial de la terminal). Se cifra con FABRICA_CLAVE_TOKENS y se
// guarda en fabrica_tokens subiendo la versión (un renovador viejo pierde).
// Con --probar, renueva una vez: en X eso ROTA el refresh y guarda el nuevo.
//
// Necesita SUPABASE_SERVICE_ROLE_KEY y FABRICA_CLAVE_TOKENS (y los CLIENT_ID /
// CLIENT_SECRET de la red para --probar).
// ──────────────────────────────────────────────────────────────

import { renovarX } from "../../lib/fabrica/redes/x"
import { renovarYouTube } from "../../lib/fabrica/redes/youtube"
import { accesoVigente, baseTokensSupabase, cifrar, claveDe } from "../../lib/fabrica/tokens"
import { getAdminClient } from "../../lib/supabase-admin"

async function leerEntrada(): Promise<string> {
  const trozos: Buffer[] = []
  for await (const t of process.stdin) trozos.push(Buffer.from(t))
  return Buffer.concat(trozos).toString("utf8").trim()
}

async function main() {
  const red = process.argv[2]
  const probar = process.argv.includes("--probar")
  if (red !== "youtube" && red !== "x") {
    console.error("Uso: echo \"$REFRESH\" | npx tsx scripts/fabrica/cargar-token.ts <youtube|x> [--probar]")
    process.exit(2)
  }
  const clave = claveDe(process.env)
  if (!clave) {
    console.error("Falta FABRICA_CLAVE_TOKENS (32 bytes en hex o base64).")
    process.exit(2)
  }
  const db = getAdminClient()
  if (!db) {
    console.error("Falta SUPABASE_SERVICE_ROLE_KEY.")
    process.exit(2)
  }
  const refresh = await leerEntrada()
  if (!refresh || /\s/.test(refresh)) {
    console.error("El refresh token llega vacío o con espacios: pásalo solo, por la entrada estándar.")
    process.exit(2)
  }
  const base = baseTokensSupabase(db)
  await base.guardar(red, cifrar({ refresh }, clave))
  console.log(`Token de ${red} guardado (cifrado).`)

  if (probar) {
    const r = await accesoVigente(red, {
      base,
      env: process.env,
      fetch,
      ahora: () => new Date(),
      renovadores: { youtube: renovarYouTube, x: renovarX },
    })
    if (!r.ok) {
      console.error(`La prueba falló (${r.clase}): ${r.como}`)
      process.exit(1)
    }
    console.log(`Prueba bien: ${red} dio un token de acceso${red === "x" ? " y el refresh rotado quedó guardado" : ""}.`)
  }
}

main().catch((e) => {
  console.error(`cargar-token falló: ${e instanceof Error ? e.message : e}`)
  process.exit(1)
})
