"use client"

import { useEffect, useRef, useState } from "react"
import { Pause, Play } from "lucide-react"

type Cancion = { ok: true; titulo: string; artista: string; audio: string; enlace: string } | { ok: false }

// Botón de música del inicio. Suena solo cuando la persona lo toca: los
// navegadores bloquean el audio automático, y en celular molestaría.
export function CancionInicio() {
  const [c, setC] = useState<Cancion | null>(null)
  const [sonando, setSonando] = useState(false)
  const audio = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    fetch("/api/cancion").then((r) => r.json()).then(setC).catch(() => setC({ ok: false }))
    return () => audio.current?.pause()
  }, [])

  if (!c || !c.ok) return null

  const alternar = () => {
    if (!audio.current) {
      audio.current = new Audio(c.audio)
      audio.current.volume = 0.6
      audio.current.onended = () => setSonando(false)
    }
    if (sonando) {
      audio.current.pause()
      setSonando(false)
    } else {
      audio.current.play().then(() => setSonando(true)).catch(() => setSonando(false))
    }
  }

  return (
    <div className="mb-5 flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={alternar}
        aria-label={sonando ? "Pausar la música" : "Escuchar la música"}
        className="lift flex items-center gap-2.5 rounded-full border border-border bg-card px-4 py-2 text-xs"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background">
          {sonando ? <Pause className="h-3 w-3" /> : <Play className="ml-0.5 h-3 w-3" />}
        </span>
        <span className="font-semibold text-foreground">{c.titulo}</span>
        <span className="text-muted-foreground">· {c.artista}</span>
      </button>
      <a href={c.enlace} target="_blank" rel="noopener noreferrer" className="text-[10px] text-muted-foreground/70 hover:text-foreground">
        Escuchar en Apple Music
      </a>
    </div>
  )
}
