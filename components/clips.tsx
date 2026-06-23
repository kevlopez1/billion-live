"use client"

import { useEffect } from "react"
import { Clapperboard } from "lucide-react"

type Clip =
  | { type: "youtube"; id: string; title?: string }
  | { type: "tiktok"; url: string; title?: string }

// ── CLIPS DEL RETO ─────────────────────────────────────────────────────
// Pegá acá los videos a medida que los publiques. Ejemplos:
//   { type: "youtube", id: "dQw4w9WgXcQ", title: "Día 1" }
//   { type: "tiktok", url: "https://www.tiktok.com/@kev.project.gta/video/123..." }
// Mientras esté vacío, se muestra un estado "próximamente" con CTA a seguir.
const clips: Clip[] = []

const TIKTOK_PROFILE = "https://www.tiktok.com/@kev.project.gta"

function tiktokId(url: string): string | null {
  const m = url.match(/\/video\/(\d+)/)
  return m ? m[1] : null
}

export function Clips() {
  const hasTikTok = clips.some((c) => c.type === "tiktok")

  useEffect(() => {
    if (!hasTikTok) return
    const id = "tiktok-embed-script"
    if (document.getElementById(id)) return
    const s = document.createElement("script")
    s.id = id
    s.src = "https://www.tiktok.com/embed.js"
    s.async = true
    document.body.appendChild(s)
  }, [hasTikTok])

  if (clips.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
        <Clapperboard className="w-8 h-8 text-muted-foreground mx-auto mb-3" strokeWidth={1.5} />
        <p className="font-display font-bold text-lg">Los primeros clips vienen en camino</p>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto">
          Acá van a vivir los videos del reto, capítulo por capítulo. Seguime para no perderte el Día 1.
        </p>
        <a
          href={TIKTOK_PROFILE}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-accent mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold"
        >
          Seguir en TikTok
        </a>
      </div>
    )
  }

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {clips.map((clip, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card/40 overflow-hidden">
          {clip.type === "youtube" ? (
            <div className="relative w-full aspect-video">
              <iframe
                src={`https://www.youtube.com/embed/${clip.id}`}
                title={clip.title || "Clip del reto"}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
                loading="lazy"
              />
            </div>
          ) : (
            <blockquote
              className="tiktok-embed"
              cite={clip.url}
              data-video-id={tiktokId(clip.url) || undefined}
              style={{ maxWidth: "100%", minWidth: "100%", margin: 0 }}
            >
              <a href={clip.url} target="_blank" rel="noopener noreferrer">
                {clip.title || "Ver en TikTok"}
              </a>
            </blockquote>
          )}
        </div>
      ))}
    </div>
  )
}
