import { ImageResponse } from "next/og"
import { BODY_PATH, SLOTS, SUELO, VIEW_H, VIEW_W } from "@/lib/car-grid"
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase-config"

export const runtime = "edge"
export const alt = "KEV PROJECT GTA — De $10 a un Mercedes-AMG Mansory"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// ──────────────────────────────────────────────────────────────
// EL PREVIEW QUE SE VE AL COMPARTIR EL LINK
//
// No es una captura de la web: la web es vertical y de celular, y recortada a
// 1200×630 quedaría un pedacito con la letra ilegible. Esto REPRODUCE el hero
// con la identidad real (el celeste de la marca, el auto, el contador) a un
// tamaño que se lee en la miniatura de WhatsApp.
//
// Y es EN VIVO de verdad: el número sale de la misma tabla que alimenta el
// contador del sitio, así que cada vez que entra plata, el preview cambia solo.
// ──────────────────────────────────────────────────────────────

const META = 450000
const RESPALDO = 5091 // si Supabase no contesta, el preview igual sale

async function recaudado(): Promise<number> {
  try {
    // Timeout corto a propósito: más vale un preview con el número de ayer que
    // un link que no muestra nada porque la base tardó.
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 1500)
    const r = await fetch(`${SUPABASE_URL}/rest/v1/global_metrics?select=net_worth&limit=1`, {
      headers: { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      signal: ctrl.signal,
      cache: "no-store",
    })
    clearTimeout(t)
    if (!r.ok) return RESPALDO
    const j = (await r.json()) as { net_worth?: number }[]
    const n = j?.[0]?.net_worth
    return typeof n === "number" && n > 0 ? n : RESPALDO
  } catch {
    return RESPALDO
  }
}

const CEL = "#2e6fae"
const TINTA = "#22314f"

export default async function Image() {
  const monto = await recaudado()
  const pct = Math.min(100, (monto / META) * 100)
  const plata = `$${monto.toLocaleString("en-US", { maximumFractionDigits: 0 })}`

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          // El mismo degradado de cielo que la web
          backgroundImage: "linear-gradient(160deg, #fdfdfc 0%, #cfe4f5 55%, #a8cdea 100%)",
          color: TINTA,
          padding: "52px 64px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Barra de arriba: marca + en vivo */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
          <div style={{ display: "flex", fontSize: 23, letterSpacing: 7, fontWeight: 700, color: TINTA }}>
            KEV PROJECT GTA
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 11,
              fontSize: 19,
              letterSpacing: 3,
              fontWeight: 700,
              color: CEL,
              border: `2px solid ${CEL}`,
              borderRadius: 999,
              padding: "7px 20px",
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: 999, background: CEL, display: "flex" }} />
            EN VIVO
          </div>
        </div>

        {/* El centro: el número manda, el auto acompaña */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 25, color: "#5b6b85", letterSpacing: 1 }}>
              De $10 a un Mercedes · Bolivia
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 132,
                fontWeight: 800,
                letterSpacing: -5,
                lineHeight: 1,
                marginTop: 6,
                color: TINTA,
              }}
            >
              {plata}
            </div>
            <div style={{ display: "flex", fontSize: 27, color: "#5b6b85", marginTop: 8 }}>
              de $450.000 · {pct.toFixed(2).replace(".", ",")}%
            </div>

            {/* La barra de progreso, igual que en el sitio */}
            <div
              style={{
                display: "flex",
                width: 430,
                height: 11,
                borderRadius: 999,
                background: "rgba(34,49,79,0.14)",
                marginTop: 22,
              }}
            >
              <div
                style={{
                  display: "flex",
                  width: `${Math.max(1.5, pct)}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: CEL,
                }}
              />
            </div>
          </div>

          {/* El auto, el mismo dibujo que la web */}
          {/* Mismo ratio que el viewBox (2,5): con otra proporción satori
              deforma el dibujo y el auto sale aglobado. */}
          <svg width={580} height={232} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
            <line x1={30} y1={SUELO} x2={VIEW_W - 30} y2={SUELO} stroke={TINTA} strokeWidth={2} opacity={0.2} />
            {SLOTS.filter((s) => s.forma.tipo === "circulo").map((s) => {
              const f = s.forma as { cx: number; cy: number; r: number }
              return (
                <g key={s.id}>
                  <circle cx={f.cx} cy={f.cy} r={f.r} fill="#151a24" />
                  {/* La llanta: sin esto son dos bolas negras, no dos ruedas */}
                  <circle cx={f.cx} cy={f.cy} r={f.r * 0.52} fill="#5e86ad" />
                  <circle cx={f.cx} cy={f.cy} r={f.r * 0.2} fill="#151a24" />
                </g>
              )
            })}
            {/* Relleno OPACO: con el cuerpo translúcido las ruedas se veían a
                través y quedaban dos manchas negras flotando encima del auto. */}
            <path d={BODY_PATH} fill="#eef5fb" />
            <path d={BODY_PATH} fill="none" stroke={TINTA} strokeWidth={5} opacity={0.6} />
          </svg>
        </div>

        {/* Barra de abajo: la promesa y el dominio */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
            fontSize: 23,
            color: "#5b6b85",
            borderTop: "2px solid rgba(34,49,79,0.14)",
            paddingTop: 20,
          }}
        >
          <div style={{ display: "flex" }}>Con comprobantes reales · alimentado por PRIME</div>
          <div style={{ display: "flex", fontWeight: 700, color: TINTA }}>kevproject.world</div>
        </div>
      </div>
    ),
    { ...size },
  )
}
