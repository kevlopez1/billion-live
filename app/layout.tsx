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

export const metadata: Metadata = {
  title: "Kev Strategy | The Billion Live",
  description: "Investment portfolio management and performance tracking - Road to $1B",
  generator: "v0.app",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Kev Strategy",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/images/logo-20editable-mesa-20de-20trabajo-201-20copia-206.jpg",
    apple: "/images/logo-20editable-mesa-20de-20trabajo-201-20copia-206.jpg",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#3D5A4C" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
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
