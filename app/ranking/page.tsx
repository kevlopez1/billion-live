"use client"

import Link from "next/link"
import Image from "next/image"
import { ArrowLeft } from "lucide-react"
import { SellerRanking } from "@/components/seller-ranking"
import { Reveal } from "@/components/reveal"

export default function RankingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground relative">
      {/* Cielo F2.3 (igual que el home) */}
      <div
        className="pointer-events-none fixed inset-0 z-0 dark:hidden"
        style={{
          background:
            "linear-gradient(to bottom, rgba(252,253,254,0) 0%, rgba(252,253,254,0) 20%, rgba(252,253,254,0.9) 55%, #fcfdfe 75%), radial-gradient(130% 90% at 50% -8%, #fdfdfc 0%, #cfe4f5 55%, #a8cdea 100%)",
        }}
      />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[40vh] bg-gradient-to-b from-white/[0.04] to-transparent z-0 hidden dark:block" />

      {/* Navbar flotante */}
      <header className="sticky top-3 z-40 px-3 md:px-6">
        <div className="max-w-3xl mx-auto rounded-2xl border border-border bg-background/70 backdrop-blur-xl shadow-[0_8px_30px_-12px_rgba(0,0,0,0.18)] px-4 md:px-5 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 press-effect min-w-0">
            <Image
              src="/images/kev.jpg"
              alt="Kev López"
              width={32}
              height={32}
              className="rounded-full object-cover object-[center_80%] w-8 h-8 ring-1 ring-foreground/15 shrink-0"
            />
            <div className="text-left leading-none min-w-0">
              <span className="block text-sm font-display font-extrabold tracking-tight truncate">KEV PROJECT GTA</span>
              <span className="block text-[10px] text-azul tracking-wide mt-0.5 truncate">El ranking de vendedores</span>
            </div>
          </Link>
          <Link
            href="/"
            className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm text-muted-foreground hover:text-foreground press-effect"
          >
            <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Volver al reto</span>
          </Link>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-4 md:px-6 pt-10 md:pt-14 pb-[calc(6rem+env(safe-area-inset-bottom))]">
        {/* Título de la página */}
        <Reveal>
          <div className="mb-8 border-b border-border pb-5">
            <div className="flex items-center gap-2.5">
              <span className="gold-tick" />
              <div className="section-eyebrow">Los que venden</div>
            </div>
            <h1 className="mt-2.5 leading-[0.95]">
              <span className="font-display font-extrabold tracking-tight text-4xl md:text-6xl">El </span>
              <span className="font-serif-display italic text-4xl md:text-6xl text-azul">ranking</span>
            </h1>
          </div>
        </Reveal>

        <Reveal delay={60}>
          <SellerRanking />
        </Reveal>
      </main>
    </div>
  )
}
