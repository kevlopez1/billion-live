import type { MetadataRoute } from "next"

const SITE_URL = "https://v0-empire-os-dashboard-rho.vercel.app"

// Bots de IA a los que damos la BIENVENIDA explícita (GEO/AEO):
// que ChatGPT, Perplexity, Claude, Gemini, etc. puedan leer e indexar el reto.
const AI_BOTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "Perplexity-User",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "Google-Extended",
  "Applebot-Extended",
  "Amazonbot",
  "Bytespider",
  "CCBot",
  "cohere-ai",
  "Meta-ExternalAgent",
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/control", "/api/"],
      },
      // Acceso explícito para motores de IA (excepto rutas privadas).
      {
        userAgent: AI_BOTS,
        allow: "/",
        disallow: ["/control", "/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
