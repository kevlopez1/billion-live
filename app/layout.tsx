import type React from "react"
import type { Metadata, Viewport } from "next"
import { Manrope, Bricolage_Grotesque, Instrument_Serif } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { AppProvider } from "@/context/app-context"
import { AuthProvider } from "@/context/auth-context"
import { Toaster } from "sonner"
import "./globals.css"

// Mezcla de 3 tipografías (look único):
// Manrope = cuerpo · Bricolage Grotesque = títulos display · Instrument Serif = acentos editoriales.
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
})

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-grotesk",
  display: "swap",
})

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-serif-display",
  display: "swap",
})

const SITE_URL = "https://v0-empire-os-dashboard-rho.vercel.app"
const OG_IMAGE = "/images/kev.jpg"

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "KEV PROJECT GTA | De $10 a un Mercedes-AMG Mansory",
    template: "%s | KEV PROJECT GTA",
  },
  description:
    "Command Center público del reto: de $10 a un Mercedes-AMG GT 63 Mansory (~$450K), desde Bolivia, construyendo un imperio en público con PRIME (empleados de IA). El contador se alimenta del revenue real de PRIME. Sin filtro, sin papá.",
  applicationName: "KEV PROJECT GTA",
  generator: "v0.app",
  manifest: "/manifest.json",
  keywords: [
    "Kev López",
    "KEV PROJECT GTA",
    "PRIME",
    "empleados de IA",
    "Mercedes-AMG Mansory",
    "reto de $10",
    "Bolivia",
    "Santa Cruz",
    "construir en público",
    "build in public",
    "emprendimiento LatAm",
    "inteligencia artificial",
  ],
  authors: [{ name: "Benjamín Kevin López Mamani", url: "https://primebusiness.live" }],
  creator: "Kev López (@kev.project.gta)",
  publisher: "PRIME",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "es_BO",
    url: SITE_URL,
    siteName: "KEV PROJECT GTA",
    title: "KEV PROJECT GTA | De $10 a un Mercedes-AMG Mansory",
    description:
      "El reto en vivo: de $10 a un Mercedes-AMG GT 63 Mansory, desde Bolivia, construyendo un imperio en público con PRIME. El auto es la carnada; el imperio es la meta.",
  },
  twitter: {
    card: "summary_large_image",
    title: "KEV PROJECT GTA | De $10 a un Mercedes-AMG Mansory",
    description:
      "El reto en vivo desde Bolivia: de $10 al Mansory, construyendo un imperio en público con PRIME (empleados de IA).",
    creator: "@kev.project.gta",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "KEV PROJECT GTA",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: OG_IMAGE,
    apple: OG_IMAGE,
  },
  category: "business",
  other: {
    "mobile-web-app-capable": "yes",
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" }, // Mejor negro puro para OLED
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover', // <--- ¡ESTA ES LA LÍNEA MÁGICA! 🌟
}

// Datos estructurados (Schema.org) — para Google y motores de IA.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "KEV PROJECT GTA",
      inLanguage: "es",
      description:
        "El reto público de $10 a un Mercedes-AMG GT 63 Mansory, desde Bolivia, con el contador alimentado por el revenue real de PRIME.",
    },
    {
      "@type": "Person",
      "@id": `${SITE_URL}/#kev`,
      name: "Kev López",
      alternateName: "Benjamín Kevin López Mamani",
      jobTitle: "Fundador de PRIME",
      nationality: "Boliviana",
      homeLocation: { "@type": "Place", name: "Santa Cruz de la Sierra, Bolivia" },
      description:
        "Emprendedor boliviano (21) que construye su imperio en público con el reto 'De $10 a un Mercedes-AMG Mansory', financiado por PRIME (empleados de IA).",
      url: SITE_URL,
      sameAs: [
        "https://www.tiktok.com/@kev.project.gta",
        "https://www.youtube.com/@KevProjectGTA",
        "https://www.instagram.com/kev_project_gta",
        "https://www.facebook.com/people/Kev-Project-GTA/",
        "https://primebusiness.live",
      ],
      worksFor: { "@type": "Organization", name: "PRIME", url: "https://primebusiness.live" },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#prime`,
      name: "PRIME",
      url: "https://primebusiness.live",
      description: "Empleados de IA para empresas. El motor económico del reto KEV PROJECT GTA.",
      founder: { "@id": `${SITE_URL}/#kev` },
      foundingLocation: { "@type": "Place", name: "Santa Cruz de la Sierra, Bolivia" },
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#faq`,
      mainEntity: [
        {
          "@type": "Question",
          name: "¿Quién está haciendo el reto de $10 a un Mercedes-AMG Mansory desde Bolivia?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Kev López (@kev.project.gta), fundador de PRIME, desde Santa Cruz de la Sierra, Bolivia.",
          },
        },
        {
          "@type": "Question",
          name: "¿Cómo se financia el reto?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Con el revenue real de PRIME, su empresa de empleados de IA para empresas. El contador del reto refleja ingresos reales, no inventados.",
          },
        },
        {
          "@type": "Question",
          name: "¿Es dinero heredado o flex?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. El reto empieza desde $10, en público y desde la crisis, como respuesta auténtica al comentario 'me lo compró mi papá'.",
          },
        },
      ],
    },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/images/kev.jpg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${manrope.variable} ${bricolage.variable} ${instrumentSerif.variable} font-sans antialiased`}>
        <AuthProvider>
          <AppProvider>
            {children}
            <Toaster
              position="bottom-right"
              toastOptions={{
                className: "!bg-card !border-border !text-foreground",
                style: {
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                },
              }}
            />
          </AppProvider>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
