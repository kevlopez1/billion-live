-- ──────────────────────────────────────────────────────────────
-- EL MANUAL DE MARCA — /branding
--
-- Una sola fila con todo el contenido en jsonb. Es a propósito: el manual se
-- edita entero de una vez desde el panel, no campo por campo, así que una
-- fila evita quince tablas y quince migraciones cada vez que se agrega algo.
--
-- Correr entero en Supabase → SQL Editor. Después, /branding guarda de verdad.
-- Mientras no se corra, el panel funciona igual pero de solo lectura: muestra
-- el contenido de lib/branding.ts y avisa que la base no está lista.
-- ──────────────────────────────────────────────────────────────

create table if not exists public.branding (
  id text primary key,
  contenido jsonb not null,
  actualizado_en timestamptz not null default now()
);

comment on table public.branding is 'El manual de marca y contenido. Una fila por marca.';

-- ── Historial ──
-- Cada guardado deja copia. Sin esto, un borrado por error no se recupera, y
-- este documento es trabajo de meses.
create table if not exists public.branding_historial (
  id bigserial primary key,
  branding_id text not null,
  contenido jsonb not null,
  guardado_en timestamptz not null default now()
);

create index if not exists branding_historial_idx
  on public.branding_historial (branding_id, guardado_en desc);

create or replace function public.guardar_historial_branding()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.branding_historial (branding_id, contenido)
  values (old.id, old.contenido);
  return new;
end;
$$;

drop trigger if exists branding_al_actualizar on public.branding;
create trigger branding_al_actualizar
  before update on public.branding
  for each row execute function public.guardar_historial_branding();

-- ── Permisos ──
-- RLS activo y SIN políticas: nadie entra con la llave pública del navegador.
-- La API del sitio escribe con la service-role desde el servidor, que se
-- salta el RLS, y exige ADMIN_SECRET antes de dejar escribir.
alter table public.branding enable row level security;
alter table public.branding_historial enable row level security;
