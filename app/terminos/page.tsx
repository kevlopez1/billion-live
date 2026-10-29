import type { Metadata } from "next"
import Link from "next/link"
import { CORREO_BAJAS, FICCION } from "@/lib/fabrica/tipos"
import { Correo, CORREO_CONTACTO, Fuera, GOOGLE_PRIVACIDAD, PaginaLegal, Seccion, YOUTUBE_TERMINOS } from "../privacidad/legal"

// ──────────────────────────────────────────────────────────────
// /terminos — las reglas de uso de kevproject.world y de los videos de La
// Casa Blanca Project. Cortas y que se puedan cumplir: nada que el sitio no
// haga de verdad. La línea de ficción sale de lib/fabrica/textos.ts, la misma
// que encabeza cada publicación.
// ──────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "Términos",
  description:
    "Las reglas de uso de kevproject.world y de los videos de La Casa Blanca Project: ficción hecha con IA, bajas en menos de 24 horas y contacto.",
  alternates: { canonical: "/terminos" },
  // Sin esto hereda og:url y og:title de la portada: el enlace compartido se veía como la home.
  // La imagen se nombra a mano: un openGraph propio reemplaza el de la raíz entero, imagen incluida.
  openGraph: {
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "KEV PROJECT GTA" }],
    type: "website",
    siteName: "KEV PROJECT GTA",
    url: "/terminos",
    title: "Términos | KEV PROJECT GTA",
    description: "Las reglas de uso de kevproject.world y de los videos de La Casa Blanca Project.",
  },
  twitter: { card: "summary_large_image", title: "Términos | KEV PROJECT GTA", images: ["/opengraph-image"] },
}

export default function TerminosPage() {
  return (
    <PaginaLegal
      titulo="Términos"
      bajada="Las reglas de este sitio y de los videos de La Casa Blanca Project."
      otra={{ href: "/privacidad", texto: "Privacidad" }}
    >
      <Seccion titulo="El sitio">
        <p>
          kevproject.world es el diario público del reto KEV PROJECT GTA de Kev López. Al usarlo aceptas estas reglas. Si no
          estás de acuerdo, no lo uses.
        </p>
      </Seccion>

      <Seccion titulo="La Casa Blanca Project es ficción">
        <p>
          <strong>{FICCION}</strong>
        </p>
        <p>
          Los residentes son personajes escritos y animados con IA. Lo que dicen no es una declaración, una opinión ni un
          respaldo de las personas reales que los inspiran, y no es consejo de dinero, salud ni leyes.
        </p>
      </Seccion>

      <Seccion titulo="Los videos">
        <ul>
          <li>Se publican en las cuentas de La Casa Blanca Project en YouTube, Facebook, Instagram, TikTok y X.</li>
          <li>Cada uno lleva la línea de ficción en su texto y, donde la red lo permite, su etiqueta de contenido hecho con IA.</li>
          <li>
            En YouTube rigen los <Fuera href={YOUTUBE_TERMINOS}>Términos del Servicio de YouTube</Fuera> y la{" "}
            <Fuera href={GOOGLE_PRIVACIDAD}>Política de Privacidad de Google</Fuera>; en cada red, sus propias reglas.
          </li>
          <li>
            Para pedir que se baje un video, escribe a <Correo a={CORREO_BAJAS} /> con el asunto «Bajar video» y el enlace. Lo bajamos en menos de
            24 horas.
          </li>
        </ul>
      </Seccion>

      <Seccion titulo="Lo que publicas tú">
        <ul>
          <li>El nombre y el mensaje de una firma en el auto o en el muro se ven en público.</li>
          <li>Una firma en el auto vale cuando se confirma el pago, y el precio lo calcula el servidor.</li>
          <li>Podemos quitar lo que sea ofensivo, engañoso o ajeno al reto.</li>
          <li>No escribas datos personales tuyos ni de otros en las charlas con los residentes.</li>
        </ul>
      </Seccion>

      <Seccion titulo="Límites">
        <p>
          Las charlas con los residentes tienen un tope diario. No se permite usar el sitio para spam, para cargarlo de
          pedidos automáticos ni para intentar entrar donde no corresponde.
        </p>
        <p>El sitio puede cambiar, pausarse o fallar sin aviso. Lo que muestra se ofrece tal cual.</p>
      </Seccion>

      <Seccion titulo="Contacto">
        <p>
          <Correo a={CORREO_CONTACTO} />. Qué datos se guardan está en{" "}
          <Link href="/privacidad" className="text-foreground underline underline-offset-2">
            Privacidad
          </Link>
          .
        </p>
      </Seccion>
    </PaginaLegal>
  )
}
