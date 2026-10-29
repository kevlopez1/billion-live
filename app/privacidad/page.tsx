import type { Metadata } from "next"
import Link from "next/link"
import { CORREO_BAJAS } from "@/lib/fabrica/tipos"
import { Correo, CORREO_CONTACTO, Fuera, GOOGLE_PERMISOS, GOOGLE_PRIVACIDAD, PaginaLegal, Seccion, YOUTUBE_TERMINOS } from "./legal"

// ──────────────────────────────────────────────────────────────
// /privacidad — qué guarda kevproject.world y para qué.
//
// Cada renglón sale de lo que el sitio guarda de verdad (supabase/correr-todo.sql,
// app/api/*, lib/casa-blanca-servidor.ts, la analítica de Vercel). Google la
// exige para que la app de YouTube salga de «Testing». Si el sitio empieza a
// guardar algo nuevo, se agrega aquí y se cambia ACTUALIZADO.
// ──────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "Privacidad",
  description:
    "Qué datos guarda kevproject.world, para qué los usa, con quién los comparte y cómo pedir que se borren. Incluye el uso de los servicios de la API de YouTube.",
  alternates: { canonical: "/privacidad" },
  // Sin esto hereda og:url y og:title de la portada: el enlace compartido se veía como la home.
  // La imagen se nombra a mano: un openGraph propio reemplaza el de la raíz entero, imagen incluida.
  openGraph: {
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "KEV PROJECT GTA" }],
    type: "website",
    siteName: "KEV PROJECT GTA",
    url: "/privacidad",
    title: "Privacidad | KEV PROJECT GTA",
    description: "Qué datos guarda kevproject.world, para qué los usa, con quién los comparte y cómo pedir que se borren.",
  },
  twitter: { card: "summary_large_image", title: "Privacidad | KEV PROJECT GTA", images: ["/opengraph-image"] },
}

export default function PrivacidadPage() {
  return (
    <PaginaLegal
      titulo="Privacidad"
      bajada="Qué guarda este sitio, para qué y cómo pedir que se borre."
      otra={{ href: "/terminos", texto: "Términos" }}
    >
      <Seccion titulo="Quién es el responsable">
        <p>
          kevproject.world es el sitio del reto KEV PROJECT GTA de Kev López, en Santa Cruz de la Sierra, Bolivia. Para
          cualquier tema de datos: <Correo a={CORREO_CONTACTO} />.
        </p>
      </Seccion>

      <Seccion titulo="Qué guardamos">
        <ul>
          <li>
            <strong>Tu cuenta.</strong> Nombre, correo y si aceptaste recibir novedades, con la fecha. La contraseña la
            guarda Supabase cifrada: nosotros no la vemos.
          </li>
          <li>
            <strong>Firmas en el auto y en el muro.</strong> Nombre, mensaje, enlace si lo pones y, si los dejas, correo y
            WhatsApp para confirmar el pago o contactarte. El nombre y el mensaje se ven en la web; el correo y el WhatsApp,
            no.
          </li>
          <li>
            <strong>Avisos y patrocinios.</strong> El correo o WhatsApp que dejas para que te avisemos, y los datos de
            empresa que escribes si quieres patrocinar.
          </li>
          <li>
            <strong>La Casa Blanca Project.</strong> Lo que le escribes a un residente lo procesa una IA (Anthropic) para
            responder. Tu mensaje no se guarda: el residente guarda un resumen en primera persona, y antes el servidor le
            borra correos, teléfonos, enlaces y el nombre con el que te presentaste. Para el límite diario de charlas se
            guarda un código sacado de tu IP y del día, no la IP. Las noticias y los temas del consejo que escribes se
            guardan (hasta 140 caracteres, sin correos, teléfonos ni enlaces) en la memoria de los residentes, que ven otros
            visitantes.
          </li>
          <li>
            <strong>Visitas.</strong> Vercel Web Analytics cuenta páginas vistas y algunos botones tocados, sin cookies. El contador de personas en
            vivo usa un código al azar que desaparece al cerrar la página.
          </li>
          <li>
            <strong>Tu navegador.</strong> El tema, los avisos que cerraste, la partida de la casa y tu sesión si tienes cuenta se
            guardan en tu propio navegador, no en nuestros servidores.
          </li>
        </ul>
        <p>No vendemos datos ni los usamos para publicidad de terceros.</p>
      </Seccion>

      <Seccion titulo="Con quién se comparten">
        <p>Solo con los servicios que hacen funcionar el sitio, para eso y nada más:</p>
        <ul>
          <li>Supabase: base de datos y cuentas.</li>
          <li>Vercel: el servidor de la web y la medición de visitas.</li>
          <li>Anthropic: la IA que responde por los residentes.</li>
        </ul>
      </Seccion>

      <Seccion titulo="Los videos y la API de YouTube">
        <p>
          La Casa Blanca Project publica videos hechos con IA en sus propias cuentas de YouTube, Facebook, Instagram, TikTok
          y X. Para YouTube, este sitio usa los servicios de la API de YouTube: sube los videos y sus subtítulos a nuestro canal y
          consulta su estado. No lee datos de quienes ven los videos ni de otras cuentas.
        </p>
        <p>
          Al usar YouTube aceptas los <Fuera href={YOUTUBE_TERMINOS}>Términos del Servicio de YouTube</Fuera>, y Google
          trata tus datos según su <Fuera href={GOOGLE_PRIVACIDAD}>Política de Privacidad</Fuera>.
        </p>
        <p>
          Los accesos a cada red se guardan cifrados en el servidor. Quien autorizó a esta aplicación en su cuenta de Google
          puede quitarle el acceso cuando quiera en la <Fuera href={GOOGLE_PERMISOS}>página de permisos de Google</Fuera>.
        </p>
      </Seccion>

      <Seccion titulo="Bajar un video">
        <p>
          Si un video te nombra, te muestra o crees que no debería estar, escribe a <Correo a={CORREO_BAJAS} /> con el
          asunto «Bajar video» y el enlace. Lo bajamos en menos de 24 horas.
        </p>
      </Seccion>

      <Seccion titulo="Ver, corregir o borrar tus datos">
        <p>
          Escribe a <Correo a={CORREO_CONTACTO} /> desde el correo de tu cuenta o el que dejaste, y dinos qué quieres ver,
          corregir o borrar. Para dejar de recibir novedades no hace falta escribir: se apaga en{" "}
          <Link href="/cuenta" className="text-foreground underline underline-offset-2">
            tu cuenta
          </Link>
          .
        </p>
        <p>Guardamos los datos mientras sirvan para lo que se dejaron, o hasta que pidas borrarlos.</p>
      </Seccion>

      <Seccion titulo="Cambios">
        <p>Si esta página cambia, cambia la fecha de arriba.</p>
      </Seccion>
    </PaginaLegal>
  )
}
