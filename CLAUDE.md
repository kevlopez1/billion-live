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

## ✂️ MENOS PALABRAS

> «Hay que ir reduciendo todo el copy innecesario de la web, todo lo que sea de
>  más en palabras.» — Kev

Una idea por bloque. Fuera los preámbulos (*lo que hacemos es…*), las muletillas
(*simplemente*, *básicamente*, *realmente*) y los superlativos vacíos
(*increíble*, *único*): si algo es bueno se prueba con un número.

**Al recortar se CORTA, no se reescribe.** Lo que queda tiene que estar ya en el
original: nunca se agrega una afirmación nueva, y no se pierde ni un dato. Si el
texto quedó frío y corporativo, te pasaste — se corta el relleno, no el carácter.

No se recorta: los números y de dónde salen, lo que la honestidad obliga a
aclarar, los mensajes de error (mejor claros que cortos) y los metadatos de SEO
(son descriptivos a propósito, para Google).

```bash
python3 scripts/sin-relleno.py          # resumen de candidatos
python3 scripts/sin-relleno.py --todo   # cada uno con su línea
```

No falla el build: señala y ordena. La tijera la decide una persona.

---

## Cómo está armado

- Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Supabase · deploy en Vercel desde `master`.
- **El contador sale de un solo lugar:** `RECAUDADO` en `context/app-context.tsx`.
  Lo usan la home y `/profile`. No escribir el número a mano en ningún otro lado.
- **Los comprobantes salen de un solo lugar:** `lib/comprobantes.ts`. Los totales
  (bolivianos, cantidad, entidades, fechas) se calculan solos.
- **El auto y sus precios:** `lib/car-grid.ts`, que usan el componente y la API.
  El precio lo recalcula siempre el servidor, nunca el navegador.

## 🔵 PRIME SIEMPRE VA CON SU LOGO, NUNCA ESCRITO

En **todo** texto que se ve en pantalla, "PRIME" va con el logo y con enlace a
primebusiness.live. Nunca la palabra suelta.

```tsx
import { PrimeMark, conPrime } from "@/components/prime-mark"

<PrimeMark />                      // dentro de JSX
{conPrime(texto)}                  // textos que viven como string en un array
<PrimeMark link={false} />         // si ya está dentro de otro <a> o de un <button>
{conPrime(texto, false)}           //   (un <a> dentro de otro <a> es HTML inválido)
```

`conPrime` usa límite de palabra: sin él, "SÉ EL PRIMERO" se partiría y
aparecería un logo en medio de la palabra.

**Únicas excepciones** (no es una elección, es que ahí no entra una imagen):
`title`, `description`, `keywords` y JSON-LD de los metadatos — son cadenas de
texto del `<head>`, no admiten HTML, y además ahí el nombre escrito es lo que
encuentra Google. Tampoco en el `alt` del propio logo.

**Comprobar antes de dar por terminado:** cargar la web y buscar `\bPRIME\b` en
el texto de pantalla. Tiene que dar 0.

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
