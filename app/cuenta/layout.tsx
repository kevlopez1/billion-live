import type { Metadata } from "next"

// La cuenta de cada persona no va a Google: no aporta nada al buscador y es
// una página privada.
export const metadata: Metadata = {
  title: "Tu cuenta",
  robots: { index: false, follow: false },
}

export default function CuentaLayout({ children }: { children: React.ReactNode }) {
  return children
}
