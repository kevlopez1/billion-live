import type { MetadataRoute } from "next"

import { SITE_URL } from "@/lib/site"

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      // Es la página que sostiene toda la credibilidad del reto: va alto.
      url: `${SITE_URL}/comprobantes`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/prensa`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/profile`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    },
  ]
}
