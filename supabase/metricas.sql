-- ──────────────────────────────────────────────────────────────
-- LOS NÚMEROS DE CADA VIDEO — /branding
--
-- Tabla aparte del manual a propósito. El manual es un documento que se
-- guarda entero de una vez; esto son cientos de filas que crecen solas. Si
-- vivieran en el mismo jsonb, cada guardado reescribiría todo y el historial
-- duplicaría el archivo completo cada vez.
--
-- Correr en Supabase → SQL Editor.
-- ──────────────────────────────────────────────────────────────

create table if not exists public.publicaciones (
  id           uuid primary key default gen_random_uuid(),
  fecha        date not null,
  titulo       text not null,
  formato_id   text not null,          -- enlaza con un formato del manual
  red          text not null,
  url          text,
  vistas       bigint not null default 0 check (vistas >= 0),
  retencion    numeric(5,2) check (retencion >= 0 and retencion <= 100),
  likes        bigint not null default 0 check (likes >= 0),
  comentarios  bigint not null default 0 check (comentarios >= 0),
  compartidos  bigint not null default 0 check (compartidos >= 0),
  seguidores   bigint not null default 0,
  creado_en    timestamptz not null default now()
);

comment on table public.publicaciones is
  'Un registro por video publicado, con su formato y sus números. Es lo que permite saber qué formato funciona.';

create index if not exists publicaciones_fecha_idx   on public.publicaciones (fecha desc);
create index if not exists publicaciones_formato_idx on public.publicaciones (formato_id);

-- Mismo criterio que el resto: RLS activo y sin políticas. La llave anónima
-- viaja en el navegador, así que sin esto cualquiera podría inventar
-- métricas, y un número inventado aquí lleva a decidir mal durante meses.
alter table public.publicaciones enable row level security;
