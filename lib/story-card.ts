import { CHALLENGE_LAUNCH, CHALLENGE_TARGET } from "@/context/app-context"

// Genera la tarjeta 9:16 (story) editorial con la foto real del auto y la
// comparte (Web Share API con archivo) o la descarga. Mismo origen → el
// canvas no se "ensucia" y se puede exportar. Sin URL en la imagen.
// Devuelve "shared" si usó el compartir nativo, "downloaded" si la bajó.
export async function downloadStoryCard(netWorth: number): Promise<"shared" | "downloaded"> {
  const W = 1080
  const H = 1920
  const c = document.createElement("canvas")
  c.width = W
  c.height = H
  const ctx = c.getContext("2d")
  if (!ctx) throw new Error("no-canvas")

  const net = netWorth
  const target = CHALLENGE_TARGET
  const pct = Math.min(100, (net / target) * 100)
  const day = Math.max(
    1,
    Math.floor((Date.now() - new Date(CHALLENGE_LAUNCH + "T00:00:00").getTime()) / 86_400_000) + 1,
  )

  const sans = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
  const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, r)
  }
  const setLS = (px: number) => {
    try {
      ;(ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${px}px`
    } catch {}
  }
  const loadImg = (src: string) =>
    new Promise<HTMLImageElement | null>((res) => {
      const im = new Image()
      im.onload = () => res(im)
      im.onerror = () => res(null)
      im.src = src
    })

  // ── Fondo ──
  ctx.fillStyle = "#0b0b0c"
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W / 2, 360, 80, W / 2, 360, 760)
  glow.addColorStop(0, "rgba(255,255,255,0.07)")
  glow.addColorStop(1, "rgba(255,255,255,0)")
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, 1000)

  // Marco editorial
  ctx.strokeStyle = "rgba(255,255,255,0.14)"
  ctx.lineWidth = 2
  roundRect(46, 46, W - 92, H - 92, 44)
  ctx.stroke()

  ctx.textAlign = "center"

  // ── Encabezado ──
  ctx.fillStyle = "rgba(255,255,255,0.5)"
  ctx.font = `600 26px ${sans}`
  setLS(7)
  ctx.fillText("EN VIVO · EL RETO", W / 2, 170)

  ctx.fillStyle = "#ffffff"
  ctx.font = `800 50px ${sans}`
  setLS(2)
  ctx.fillText("KEV PROJECT GTA", W / 2, 234)
  setLS(0)

  // ── Auto recortado, flotando (look poster de presentación) ──
  const carImg = await loadImg("/images/car/green-2-cut.png")
  // Spotlight detrás del auto
  const spot = ctx.createRadialGradient(W / 2, 560, 60, W / 2, 560, 560)
  spot.addColorStop(0, "rgba(255,255,255,0.11)")
  spot.addColorStop(1, "rgba(255,255,255,0)")
  ctx.fillStyle = spot
  ctx.fillRect(40, 280, W - 80, 600)
  if (carImg) {
    const cw = 948
    const ch = cw * (carImg.height / carImg.width)
    const cx = (W - cw) / 2
    const cy = 360
    const shY = cy + ch - 16
    // Sombra elíptica suave debajo
    ctx.save()
    ctx.translate(W / 2, shY)
    ctx.scale(1, 0.15)
    const sh = ctx.createRadialGradient(0, 0, 12, 0, 0, cw / 2)
    sh.addColorStop(0, "rgba(0,0,0,0.6)")
    sh.addColorStop(1, "rgba(0,0,0,0)")
    ctx.fillStyle = sh
    ctx.beginPath()
    ctx.arc(0, 0, cw / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    ctx.drawImage(carImg, cx, cy, cw, ch)
  }

  // ── Contador ──
  ctx.fillStyle = "#ffffff"
  ctx.font = `900 210px ${sans}`
  ctx.fillText(`$${net.toLocaleString("en-US")}`, W / 2, 1100)

  ctx.fillStyle = "rgba(255,255,255,0.42)"
  ctx.font = `600 46px ${sans}`
  setLS(1)
  ctx.fillText(`DE $${target.toLocaleString("en-US")}`, W / 2, 1162)
  setLS(0)

  // Barra de progreso
  const barX = 160
  const barW = W - barX * 2
  const barY = 1240
  const barH = 22
  ctx.fillStyle = "rgba(255,255,255,0.14)"
  roundRect(barX, barY, barW, barH, barH / 2)
  ctx.fill()
  ctx.fillStyle = "#ffffff"
  roundRect(barX, barY, Math.max((barW * pct) / 100, barH), barH, barH / 2)
  ctx.fill()

  ctx.fillStyle = "rgba(255,255,255,0.55)"
  ctx.font = `600 32px ${sans}`
  setLS(2)
  ctx.fillText(`${pct.toFixed(pct < 1 ? 4 : 1)}% AL MERCEDES   ·   DÍA ${day}`, W / 2, 1340)
  setLS(0)

  // ── Frase ──
  ctx.fillStyle = "rgba(255,255,255,0.55)"
  ctx.font = `italic 600 54px Georgia, "Times New Roman", serif`
  ctx.fillText("De $10 a un", W / 2, 1500)
  ctx.fillStyle = "#ffffff"
  ctx.font = `800 92px ${sans}`
  ctx.fillText("MERCEDES-AMG GT 63", W / 2, 1590)
  ctx.fillStyle = "rgba(255,255,255,0.5)"
  ctx.font = `600 44px ${sans}`
  setLS(3)
  ctx.fillText("BY MANSORY", W / 2, 1655)
  setLS(0)

  // ── Pie (sin URL) ──
  ctx.fillStyle = "rgba(255,255,255,0.55)"
  ctx.font = `600 40px ${sans}`
  setLS(2)
  ctx.fillText("@KEV.PROJECT.GTA", W / 2, 1800)
  ctx.fillStyle = "rgba(255,255,255,0.32)"
  ctx.font = `500 30px ${sans}`
  setLS(3)
  ctx.fillText("SANTA CRUZ · BOLIVIA", W / 2, 1850)
  setLS(0)

  const blob: Blob = await new Promise((res, rej) =>
    c.toBlob((b) => (b ? res(b) : rej(new Error("no-blob"))), "image/png"),
  )
  const file = new File([blob], "kev-project-gta.png", { type: "image/png" })

  const navAny = navigator as Navigator & {
    canShare?: (data?: { files?: File[] }) => boolean
  }
  if (navAny.canShare && navAny.canShare({ files: [file] }) && navigator.share) {
    await navigator.share({
      files: [file],
      title: "KEV PROJECT GTA",
      text: `De $10 a un Mercedes-AMG Mansory · Día ${day} 🏁`,
    })
    return "shared"
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "kev-project-gta.png"
  a.click()
  URL.revokeObjectURL(url)
  return "downloaded"
}
