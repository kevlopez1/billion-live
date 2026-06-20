import type { MetadataRoute } from "next"

const SITE_URL = "https://v0-empire-os-dashboard-rho.vercel.app"

// Indexable y accesible para bots (importante para prensa e inversores).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/control", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
