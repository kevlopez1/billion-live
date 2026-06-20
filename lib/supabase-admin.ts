import { createClient } from "@supabase/supabase-js"

// Cliente de SERVIDOR con service-role. NUNCA se importa en el cliente.
// La service key SOLO vive en variables de entorno (Vercel), jamás en el bundle.
const url = process.env.SUPABASE_URL || "https://llhvnzlbnmoufilxgshv.supabase.co"
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export function getAdminClient() {
  if (!serviceKey) return null
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
