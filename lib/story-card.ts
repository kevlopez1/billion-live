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

  // Dibuja texto centrado, encogiendo el tamaño hasta que entre en maxW.
  // Así nunca se sale del marco, da igual la fuente del dispositivo (SF Pro, etc.).
  const fitText = (
    text: string,
    y: number,
    size: number,
    weight: string,
    color: string,
    o: { maxW?: number; ls?: number; family?: string; style?: string } = {},
  ) => {
    const maxW = o.maxW ?? 840
    const fam = o.family ?? sans
    const style = o.style ?? ""
    setLS(o.ls ?? 0)
    let s = size
    const apply = () => (ctx.font = `${style} ${weight} ${s}px ${fam}`.trim())
    apply()
    while (ctx.measureText(text).width > maxW && s > 12) {
      s -= 2
      apply()
    }
    ctx.fillStyle = color
    ctx.fillText(text, W / 2, y)
    setLS(0)
  }

  // Render en alta calidad
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"

  // ── Paleta luxury (crema editorial, igual que la web) ──
  const INK = "#1b1710"
  const mut = (a: number) => `rgba(27,23,16,${a})`
  const GOLD = "#b0894e"

  // ── Fondo crema ──
  ctx.fillStyle = "#f2ede3"
  ctx.fillRect(0, 0, W, H)
  // Luz cálida superior (profundidad sutil)
  const top = ctx.createRadialGradient(W / 2, 300, 80, W / 2, 300, 820)
  top.addColorStop(0, "rgba(255,255,255,0.55)")
  top.addColorStop(1, "rgba(255,255,255,0)")
  ctx.fillStyle = top
  ctx.fillRect(0, 0, W, 900)
  // Viñeta muy sutil (look impreso premium)
  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.62)
  vig.addColorStop(0, "rgba(27,23,16,0)")
  vig.addColorStop(1, "rgba(27,23,16,0.05)")
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, W, H)

  // ── Marco doble fino (invitación de lujo) ──
  ctx.strokeStyle = mut(0.22)
  ctx.lineWidth = 2
  roundRect(46, 46, W - 92, H - 92, 44)
  ctx.stroke()
  ctx.strokeStyle = mut(0.1)
  ctx.lineWidth = 1
  roundRect(62, 62, W - 124, H - 124, 34)
  ctx.stroke()

  ctx.textAlign = "center"

  // ── Encabezado ──
  fitText("EL RETO · EN VIVO", 166, 25, "600", mut(0.5), { ls: 7, maxW: 820 })
  fitText("KEV PROJECT GTA", 230, 50, "800", INK, { ls: 2, maxW: 840 })
  // Acento dorado fino
  ctx.strokeStyle = GOLD
  ctx.lineWidth = 3
  ctx.lineCap = "round"
  ctx.beginPath()
  ctx.moveTo(W / 2 - 46, 262)
  ctx.lineTo(W / 2 + 46, 262)
  ctx.stroke()
  ctx.lineCap = "butt"

  // ── Auto recortado, flotando ──
  const carImg = await loadImg("/images/car/green-2-cut.png")
  if (carImg) {
    const cw = 968
    const ch = cw * (carImg.height / carImg.width)
    const cx = (W - cw) / 2
    const cy = 326
    const shY = cy + ch - 14
    // Sombra de contacto suave (gris cálido)
    ctx.save()
    ctx.translate(W / 2, shY)
    ctx.scale(1, 0.14)
    const sh = ctx.createRadialGradient(0, 0, 12, 0, 0, cw / 2.1)
    sh.addColorStop(0, "rgba(27,23,16,0.26)")
    sh.addColorStop(1, "rgba(27,23,16,0)")
    ctx.fillStyle = sh
    ctx.beginPath()
    ctx.arc(0, 0, cw / 2.1, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    ctx.drawImage(carImg, cx, cy, cw, ch)
  }

  // ── Contador ──
  fitText(`$${net.toLocaleString("en-US")}`, 1058, 168, "900", INK, { maxW: 780 })
  fitText(`DE $${target.toLocaleString("en-US")}`, 1150, 40, "600", mut(0.5), { ls: 1, maxW: 680 })

  // Barra de progreso
  const barX = 160
  const barW = W - barX * 2
  const barY = 1232
  const barH = 20
  ctx.fillStyle = mut(0.13)
  roundRect(barX, barY, barW, barH, barH / 2)
  ctx.fill()
  ctx.fillStyle = INK
  roundRect(barX, barY, Math.max((barW * pct) / 100, barH), barH, barH / 2)
  ctx.fill()

  fitText(`${pct.toFixed(pct < 1 ? 4 : 1)}% AL MERCEDES   ·   DÍA ${day}`, 1320, 32, "600", mut(0.55), { ls: 2, maxW: 840 })

  // ── Frase ──
  fitText("De $10 a un", 1500, 54, "600", mut(0.5), {
    style: "italic",
    family: 'Georgia, "Times New Roman", serif',
    maxW: 820,
  })
  fitText("MERCEDES-AMG GT 63", 1592, 90, "800", INK, { maxW: 840 })
  fitText("BY MANSORY", 1658, 44, "600", mut(0.5), { ls: 3, maxW: 700 })

  // ── Pie (sin URL) ──
  fitText("@KEV.PROJECT.GTA", 1800, 40, "600", mut(0.62), { ls: 2, maxW: 760 })
  fitText("SANTA CRUZ · BOLIVIA", 1850, 30, "500", mut(0.4), { ls: 3, maxW: 760 })

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
