import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { AppProvider } from "@/context/app-context"
import { AuthProvider } from "@/context/auth-context"
import { Toaster } from "sonner"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const SITE_URL = "https://v0-empire-os-dashboard-rho.vercel.app"
const OG_IMAGE = "/images/logo-20editable-mesa-20de-20trabajo-201-20copia-206.jpg"

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
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "KEV PROJECT GTA — De $10 al Mansory",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "KEV PROJECT GTA | De $10 a un Mercedes-AMG Mansory",
    description:
      "El reto en vivo desde Bolivia: de $10 al Mansory, construyendo un imperio en público con PRIME (empleados de IA).",
    images: [OG_IMAGE],
    creator: "@1kevlopez",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/images/logo-20editable-mesa-20de-20trabajo-201-20copia-206.jpg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
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
