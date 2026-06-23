import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "KEV PROJECT GTA — De $10 a un Mercedes-AMG Mansory"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// OG dinámica, monocroma de lujo. Texto nítido (no imagen recortada).
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#050505",
          color: "#ffffff",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Top row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 22,
            letterSpacing: 5,
            color: "#8a8a8a",
            textTransform: "uppercase",
          }}
        >
          <div style={{ display: "flex" }}>KEV PROJECT GTA</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: 9999, background: "#ffffff" }} />
            EN VIVO
          </div>
        </div>

        {/* Center headline */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 92, fontWeight: 300, letterSpacing: -3, lineHeight: 1.04, display: "flex" }}>
            De $10 a un
          </div>
          <div style={{ fontSize: 92, fontWeight: 600, letterSpacing: -3, lineHeight: 1.04, display: "flex" }}>
            Mercedes-AMG Mansory
          </div>
          <div style={{ marginTop: 32, height: 1, width: "100%", background: "rgba(255,255,255,0.12)", display: "flex" }} />
          <div
            style={{
              marginTop: 26,
              fontSize: 28,
              color: "#9a9a9a",
              display: "flex",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            <div style={{ display: "flex" }}>Construyendo un imperio en público · desde Bolivia</div>
            <div style={{ display: "flex", color: "#dddddd" }}>$450,000</div>
          </div>
        </div>

        {/* Bottom row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 24,
            color: "#8a8a8a",
          }}
        >
          <div style={{ display: "flex" }}>@kev.project.gta</div>
          <div style={{ display: "flex" }}>Alimentado por PRIME</div>
        </div>
      </div>
    ),
    { ...size },
  )
}
