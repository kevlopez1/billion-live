# KEV PROJECT GTA — Command Center

Dashboard público del reto **"De $10 a un Mercedes-AMG GT 63 Mansory"** (~$450.000), construido en público desde Bolivia. Repurposeado del antiguo dashboard "The Billion Live".

> El auto es la carnada; el imperio es la meta. El contador se alimenta del **revenue real de PRIME** (empleados de IA para empresas).

## Mensaje de dos capas

- **Capa pública (la carnada):** de $10 al Mercedes-AMG Mansory (~$450K).
- **Capa secreta (la meta real):** el imperio de $1.000.000.000 — visible, atenuada, debajo del contador.

## Mapeo de módulos

| Módulo del dashboard | Significado en el reto |
|---|---|
| Total Portfolio Value | Contador del reto · revenue real de PRIME |
| Active Projects | Las 4 marcas: PRIME · KEV Strategy · Insightful University · @Kev López |
| Social Power / "Influence as an asset" | Público & base de datos (la atención como activo) |
| Daily Pulse | Racha de consistencia (Día N) |
| Revenue | Lo que factura PRIME (MRR) |

## Cómo actualizar el contador (revenue real de PRIME)

1. En el dashboard, **doble clic en el logo** (sidebar) para abrir el acceso Admin.
2. Inicia sesión con tus credenciales de admin.
3. Pestaña **Métricas (Admin)** → actualiza el `Net Worth` (= contador del reto). Se guarda en Supabase y se refleja en vivo.
   - La **meta pública ($450K Mansory)** y la **capa secreta ($1B)** están fijas en el código (`context/app-context.tsx`: `CHALLENGE_TARGET`, `SECRET_TARGET`), no dependen de la DB.

## SEO / indexabilidad

- `app/robots.ts` permite a todos los bots y enlaza el sitemap.
- `app/sitemap.ts` lista las rutas públicas (`/` y `/profile`).
- OpenGraph + Twitter cards + metadata en `app/layout.tsx`. Idioma por defecto: español (`es`).

## Stack

- Next.js 16 (App Router, Turbopack)
- Tailwind CSS v4
- Supabase (PostgreSQL + Realtime)
- TypeScript

## Desarrollo

```bash
npm install
npm run dev
```
