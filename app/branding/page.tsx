import { redirect } from "next/navigation"

// El manual vive en el espacio de trabajo, junto a Preguntas, Videos y el
// área de Kev López. Kev: "fusiona proyectos y branding". Esta dirección
// queda para que los enlaces viejos sigan funcionando.
export default function BrandingPage() {
  redirect("/kevlopez_proyectos")
}
