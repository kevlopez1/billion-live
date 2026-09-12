/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // El dominio real es kevproject.world. Corregir el canonical no alcanza:
  // mientras el dominio viejo devuelva 200 OK, Google puede seguir
  // indexándolo. Un 301 es la señal definitiva de mudanza.
  // Se listan hosts EXACTOS a propósito: las URLs de preview
  // (billionlive-git-…vercel.app) no deben redirigirse nunca.
  async redirects() {
    const viejos = ["billion-live.vercel.app", "v0-empire-os-dashboard-rho.vercel.app"]
    return viejos.map((host) => ({
      source: "/:path*",
      has: [{ type: "host", value: host }],
      destination: "https://kevproject.world/:path*",
      permanent: true,
    }))
  },
}

export default nextConfig
