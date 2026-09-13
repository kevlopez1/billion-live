# billion-live — la web pública del reto (kevproject.world)

## 🗣️ IDIOMA: ESPAÑOL NEUTRO. NUNCA VOSEO.

**Todo el texto que ve una persona va en español neutro, sin acento rioplatense.**
Aplica a la interfaz, los mensajes de error, los placeholders, los correos, los
títulos y descripciones de SEO — y a cómo se le habla a Kev en el chat.

Kev es boliviano y su audiencia es toda Latinoamérica. El voseo argentino suena
prestado y le resta credibilidad a un proyecto cuya marca es "todo real".

| ❌ No | ✅ Sí |
|---|---|
| Poné, Dejá, Mandá, Entrá, Mirá, Firmá, Elegí | Pon, Deja, Manda, Entra, Mira, Firma, Elige |
| Contame, Decime, Mandame, Quedate, Sumate | Cuéntame, Dime, Mándame, Quédate, Súmate |
| Probá, Revisá, Buscá, Seguí, Creá, Esperá | Prueba, Revisa, Busca, Sigue, Crea, Espera |
| querés, podés, tenés, sabés, hacés | quieres, puedes, tienes, sabes, haces |
| sos, construís, vendés, te llamás | eres, construyes, vendes, te llamas |
| acá | aquí |
| vos | tú |

Ojo: *"Prueba de nuevo"* es correcto pero suena forzado; en neutro se dice
**"Inténtalo de nuevo"**.

**Antes de dar por terminado cualquier cambio de texto, correr el detector:**

```bash
python3 scripts/sin-voseo.py     # tiene que dar TOTAL: 0
```

---

## Cómo está armado

- Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Supabase · deploy en Vercel desde `master`.
- **El contador sale de un solo lugar:** `RECAUDADO` en `context/app-context.tsx`.
  Lo usan la home y `/profile`. No escribir el número a mano en ningún otro lado.
- **Los comprobantes salen de un solo lugar:** `lib/comprobantes.ts`. Los totales
  (bolivianos, cantidad, entidades, fechas) se calculan solos.
- **El auto y sus precios:** `lib/car-grid.ts`, que usan el componente y la API.
  El precio lo recalcula siempre el servidor, nunca el navegador.

## Reglas de contenido

- **"Todo real, sin humo".** Ningún dato inventado, de ejemplo o de relleno.
  Si un número no se puede probar, no va.
- **Los datos de terceros se censuran EN LA IMAGEN**, con barra sólida — nunca con
  CSS, para que el archivo servido no contenga el dato.
- El auto se nombra **"un Mercedes … Mansory"** en pantalla. El nombre completo
  ("AMG GT 63") solo en los metadatos de SEO, donde no se ve y sirve para buscarlo.

## Cuidado con

- `next.config.mjs` tiene `typescript: { ignoreBuildErrors: true }`: los errores de
  tipos llegan a producción sin avisar.
- `images: { unoptimized: true }`: al reemplazar una imagen hay que **cambiarle el
  nombre**, si no el CDN y el navegador siguen sirviendo la vieja.
