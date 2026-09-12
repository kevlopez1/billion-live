// URL y clave PÚBLICA (anon) de Supabase, en un solo lugar.
//
// Va aparte de lib/supabase.ts a propósito: la imagen de preview corre en el
// edge y solo necesita estos dos valores para un fetch — importar el cliente
// entero ahí sería cargar medio SDK para nada.
//
// La clave anon es pública por diseño: lo que protege los datos es RLS, no
// esconderla. La que NUNCA va acá es la service_role.
export const SUPABASE_URL = process.env.SUPABASE_URL || "https://llhvnzlbnmoufilxgshv.supabase.co"
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsaHZuemxibm1vdWZpbHhnc2h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4OTQ1OTUsImV4cCI6MjA4MzQ3MDU5NX0.rdIM39PWW6U90JfeRix6B8xdybX-wCFjEnzngsIYrrQ"
