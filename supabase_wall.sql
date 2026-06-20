-- ====================================
-- MURO "Yo estuve aquí desde el Día 1"
-- Ejecutar una vez en Supabase (SQL Editor).
-- ====================================

create table if not exists public.wall_signatures (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  message text,
  email text,
  whatsapp text,
  created_at timestamptz default timezone('utc', now()) not null
);

-- Índice para ordenar por fecha
create index if not exists idx_wall_created on public.wall_signatures (created_at desc);

-- RLS: lectura pública; la escritura ocurre solo desde el servidor (service role),
-- que ignora RLS de forma segura. No habilitamos INSERT para anon (evita spam directo).
alter table public.wall_signatures enable row level security;

drop policy if exists "wall public read" on public.wall_signatures;
create policy "wall public read"
on public.wall_signatures for select
to public
using (true);

-- Realtime (opcional, para que el muro se actualice en vivo)
alter publication supabase_realtime add table public.wall_signatures;
