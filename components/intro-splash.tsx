"use client"

import { useEffect, useState } from "react"

// Líneas decorativas estilo Mansory (alas / speed lines).
function Flourish({ flip = false }: { flip?: boolean }) {
  return (
    <div className={`flex flex-col items-${flip ? "start" : "end"} gap-1 ${flip ? "scale-x-[-1]" : ""}`}>
      <span className="block h-px bg-white/60 w-5" />
      <span className="block h-px bg-white/60 w-8" />
      <span className="block h-px bg-white/60 w-5" />
    </div>
  )
}

// Intro estilo Mansory: negro + logotipo serif que aparece y se desvanece.
export function IntroSplash() {
  const [show, setShow] = useState(true)
  const [hide, setHide] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("kev-intro-seen")) {
      setShow(false)
      return
    }
    const t1 = setTimeout(() => setHide(true), 1900)
    const t2 = setTimeout(() => {
      setShow(false)
      try {
        sessionStorage.setItem("kev-intro-seen", "1")
      } catch {}
    }, 2600)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  if (!show) return null

  return (
    <div
      onClick={() => {
        setHide(true)
        setTimeout(() => setShow(false), 350)
      }}
      className={`fixed inset-0 z-[100] bg-black flex items-center justify-center transition-opacity duration-700 ${
        hide ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center animate-fade-in-scale px-6">
        <div className="flex items-center gap-3 md:gap-5">
          <Flourish />
          <span className="font-serif-display text-white text-xl sm:text-3xl md:text-4xl tracking-[0.22em] uppercase whitespace-nowrap">
            Kev Project GTA
          </span>
          <Flourish flip />
        </div>
        <span className="mt-5 text-[9px] md:text-[11px] uppercase tracking-[0.4em] text-white/40">
          De $10 al Mercedes
        </span>
      </div>
    </div>
  )
}
