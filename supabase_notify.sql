-- Suscriptores que quieren que les avisen cuando el reto llegue a un hito.
-- Correr una vez en Supabase (SQL Editor). Las escrituras van solo vía
-- service-role desde /api/notify, así que NO se crean políticas públicas.

create table if not exists notify_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text,
  whatsapp text,
  trigger text,
  notified boolean not null default false,
  created_at timestamptz not null default now()
);

alter table notify_subscribers enable row level security;

-- (sin políticas: solo el service-role del servidor puede leer/escribir)
