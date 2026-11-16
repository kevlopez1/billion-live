import { NextResponse } from "next/server"

// El adelanto legal de 30 s que da Apple Music para cualquier canción. El
// audio lo sirve Apple (con su licencia), no esta web: aquí solo se pide el
// enlace. Se guarda un día para no consultar a Apple en cada visita.
export const revalidate = 86400

const BUSQUEDA = "sicko mode travis scott"

export async function GET() {
  try {
    const r = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(BUSQUEDA)}&entity=song&limit=5&country=us`,
      { next: { revalidate } },
    )
    const j = (await r.json()) as {
      results?: { trackName: string; artistName: string; previewUrl?: string; trackViewUrl: string }[]
    }
    const c = j.results?.find((x) => x.previewUrl)
    if (!c) return NextResponse.json({ ok: false })
    return NextResponse.json({
      ok: true,
      titulo: c.trackName,
      artista: c.artistName,
      audio: c.previewUrl,
      enlace: c.trackViewUrl,
    })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
