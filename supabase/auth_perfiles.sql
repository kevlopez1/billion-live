-- ──────────────────────────────────────────────────────────────
-- CUENTAS DE KEV PROJECT GTA
--
-- La autenticación la maneja Supabase Auth (tabla auth.users): el hash de la
-- contraseña, la verificación del correo y el reseteo los hace Supabase.
-- Acá va SOLO lo nuestro: el nombre y si la persona quiere recibir novedades.
--
-- Correr entero en Supabase → SQL Editor.
-- Después, en Authentication → Providers → Email: dejar "Confirm email" ACTIVADO.
-- Sin verificación, la lista se llena de correos inventados y eso es lo que
-- quema la reputación del dominio.
-- ──────────────────────────────────────────────────────────────

create table if not exists public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null default '',
  email text not null,
  -- Consentimiento explícito y con fecha. No es burocracia: es la prueba de
  -- que la persona dijo que sí, y es lo que te salva si alguien reclama.
  novedades boolean not null default false,
  novedades_desde timestamptz,
  creado_en timestamptz not null default now()
);

comment on table public.perfiles is 'Datos propios de cada cuenta. La identidad vive en auth.users.';

-- ── El perfil se crea solo al registrarse ──
-- Si dependiera del navegador, un registro cortado a la mitad dejaría un
-- usuario sin perfil. Con un trigger, o pasan las dos cosas o no pasa ninguna.
create or replace function public.crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, email, nombre, novedades, novedades_desde)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nombre', ''),
    coalesce((new.raw_user_meta_data ->> 'novedades')::boolean, false),
    case when (new.raw_user_meta_data ->> 'novedades')::boolean then now() end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil();

-- ── RLS: cada uno ve y edita SOLO lo suyo ──
-- Sin esto, con la clave pública cualquiera podría leer todos los correos.
alter table public.perfiles enable row level security;

drop policy if exists "ver lo propio" on public.perfiles;
create policy "ver lo propio" on public.perfiles
  for select using (auth.uid() = id);

drop policy if exists "editar lo propio" on public.perfiles;
create policy "editar lo propio" on public.perfiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Nadie inserta ni borra a mano: de eso se encarga el trigger y el borrado
-- en cascada de auth.users.

-- ── Para mandar las novedades ──
-- Consultá SIEMPRE por esta vista, nunca por la tabla entera: así es imposible
-- mandarle un correo a alguien que no lo pidió o que nunca lo verificó.
create or replace view public.lista_novedades as
  select p.email, p.nombre, p.novedades_desde
  from public.perfiles p
  join auth.users u on u.id = p.id
  where p.novedades = true
    and u.email_confirmed_at is not null;
