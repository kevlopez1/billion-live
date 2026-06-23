-- ====================================
-- SPONSORS — solicitudes para auspiciar el reto
-- Ejecutar una vez en Supabase (SQL Editor).
-- ====================================

create table if not exists public.sponsors (
  id uuid default gen_random_uuid() primary key,
  company text not null,
  name text,
  email text,
  whatsapp text,
  message text,
  plan text, -- "dia" | "semana" | "otro"
  created_at timestamptz default timezone('utc', now()) not null
);

create index if not exists idx_sponsors_created on public.sponsors (created_at desc);

-- RLS: la escritura ocurre SOLO desde el servidor (service role). Nada de lectura
-- pública (son leads privados tuyos).
alter table public.sponsors enable row level security;
-- (sin policies = nadie con anon key puede leer/escribir; el service role ignora RLS)
