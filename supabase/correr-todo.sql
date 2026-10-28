-- ══════════════════════════════════════════════════════════════
-- TODO EN UNO — las diez partes que necesita kevproject.world
--
-- CÓMO SE CORRE
--   1. Abre https://supabase.com/dashboard/project/llhvnzlbnmoufilxgshv/sql/new
--   2. Copia este archivo COMPLETO y pégalo ahí.
--   3. Botón Run (o Ctrl+Enter).
--   4. Al final te devuelve una tabla de 13 filas. Todas tienen que decir
--      "protegida". Si alguna dice "ABIERTA", algo falló: avísame.
--
-- Se puede correr las veces que quieras: no borra nada ni duplica nada.
-- Las líneas amarillas que dicen "NOTICE: ... does not exist, skipping" son
-- normales la primera vez. Las rojas que dicen ERROR no.
--
-- Si se agrega una tabla, va aquí: este es el único archivo de base.
-- ══════════════════════════════════════════════════════════════


-- ──────────────────────────────────────────────────────────────
-- 1 de 10 · CUENTAS  (para que "Crear tu cuenta" funcione)
--
-- La autenticación la maneja Supabase Auth (tabla auth.users): el hash de la
-- contraseña, la verificación del correo y el reseteo los hace Supabase.
-- Aquí va SOLO lo nuestro: el nombre y si la persona quiere recibir novedades.
--
-- Después de correr esto: Authentication → Providers → Email → dejar
-- "Confirm email" ACTIVADO. Sin verificación, la lista se llena de correos
-- inventados y eso es lo que quema la reputación del dominio.
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

-- El perfil se crea solo al registrarse. Si dependiera del navegador, un
-- registro cortado a la mitad dejaría un usuario sin perfil. Con un trigger,
-- o pasan las dos cosas o no pasa ninguna.
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

-- RLS: cada uno ve y edita SOLO lo suyo. Sin esto, con la clave pública
-- cualquiera podría leer todos los correos.
alter table public.perfiles enable row level security;

drop policy if exists "ver lo propio" on public.perfiles;
create policy "ver lo propio" on public.perfiles
  for select using (auth.uid() = id);

drop policy if exists "editar lo propio" on public.perfiles;
create policy "editar lo propio" on public.perfiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Nadie inserta ni borra a mano: de eso se encarga el trigger y el borrado
-- en cascada de auth.users.

-- ── El navegador solo puede tocar UNA columna ──
-- La política de RLS dice "edita tu fila", pero no dice QUÉ columnas, y
-- Supabase le da UPDATE sobre todas al rol de las personas con sesión. Así,
-- cualquiera con cuenta podía reescribir su `email` (el que se usa para
-- mandar las novedades) y su `novedades_desde` (la prueba con fecha de que
-- aceptó). Una prueba de consentimiento que el interesado puede reescribir
-- no prueba nada.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke update on public.perfiles from authenticated';
    execute 'grant update (novedades) on public.perfiles to authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke update on public.perfiles from anon';
  end if;
end $$;

-- ── La fecha del consentimiento la pone la base ──
-- Si el navegador ya no puede escribirla, alguien tiene que hacerlo. Y es el
-- lugar correcto: la fecha de consentimiento es CUÁNDO cambió el permiso, no
-- un dato que se manda aparte y puede venir equivocado.
create or replace function public.sellar_consentimiento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.novedades is distinct from old.novedades then
    new.novedades_desde := case when new.novedades then now() else null end;
  else
    new.novedades_desde := old.novedades_desde;
  end if;
  return new;
end;
$$;

drop trigger if exists perfiles_al_actualizar on public.perfiles;
create trigger perfiles_al_actualizar
  before update on public.perfiles
  for each row execute function public.sellar_consentimiento();

-- Para mandar las novedades, consulta SIEMPRE por esta vista, nunca por la
-- tabla entera: así es imposible mandarle un correo a alguien que no lo pidió
-- o que nunca lo verificó.
--
-- OJO con las dos líneas de seguridad de abajo, no son adorno:
-- en Postgres una vista corre con los permisos de QUIEN LA CREÓ, no de quien
-- la consulta. Sin `security_invoker`, esta vista es un túnel por debajo del
-- RLS de `perfiles`: la tabla queda protegida y la vista entrega igual todos
-- los correos a cualquiera que tenga la llave anónima, que viaja en el
-- navegador de cualquiera que abra la web.
create or replace view public.lista_novedades
  with (security_invoker = true) as
  select p.email, p.nombre, p.novedades_desde
  from public.perfiles p
  join auth.users u on u.id = p.id
  where p.novedades = true
    and u.email_confirmed_at is not null;

-- Y además, que la llave del navegador no la pueda ni mirar. Esta lista solo
-- la necesita el servidor. (Los roles se comprueban porque fuera de Supabase
-- no existen y el script tiene que correr igual.)
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.lista_novedades from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.lista_novedades from authenticated';
  end if;
end $$;


-- ──────────────────────────────────────────────────────────────
-- 2 de 10 · EL AUTO DE PÍXELES  (las firmas en el auto)
-- ──────────────────────────────────────────────────────────────

create table if not exists public.car_pixels (
  id          bigserial primary key,
  kind        text not null check (kind in ('pixel', 'slot')),
  idx         int,                  -- posición canónica (solo kind='pixel')
  slot_id     text,                 -- 'capo' | 'rueda-del' | 'rueda-tras'
  price_usd   int  not null,
  name        text not null,
  message     text,
  link        text,
  email       text,
  whatsapp    text,
  status      text not null default 'pendiente'
              check (status in ('pendiente', 'confirmado', 'anulado')),
  -- El código es el comprobante de UN PEDIDO, no de una fila: quien compra 10
  -- firmas se lleva un código, y las 10 filas lo comparten. Por eso NO es
  -- unique — con unique puesto, comprar más de una firma falla siempre.
  claim_code  text not null,
  created_at  timestamptz not null default now(),
  confirmed_at timestamptz
);

-- Una celda o un espacio premium no se pueden vender dos veces.
-- Los 'anulado' liberan el lugar (por si una reserva no se paga).
create unique index if not exists car_pixels_idx_uq
  on public.car_pixels(idx) where kind = 'pixel' and status <> 'anulado';

create unique index if not exists car_pixels_slot_uq
  on public.car_pixels(slot_id) where kind = 'slot' and status <> 'anulado';

create index if not exists car_pixels_status_idx on public.car_pixels(status);
create index if not exists car_pixels_code_idx   on public.car_pixels(claim_code);

-- Para las bases que se crearon con la versión anterior, donde claim_code sí
-- era unique. Sin esto, ahí comprar más de una firma sigue fallando.
alter table public.car_pixels drop constraint if exists car_pixels_claim_code_key;

-- En Supabase, una tabla del esquema public con RLS apagado se puede leer Y
-- ESCRIBIR con la llave anónima, que viaja en el navegador de cualquiera que
-- abra la web. Es decir que alguien podía insertar firmas falsas y encenderlas
-- en el auto. RLS activo y sin políticas cierra esa puerta: la API del sitio
-- escribe con la service-role desde el servidor, que se salta el RLS.
alter table public.car_pixels enable row level security;


-- ──────────────────────────────────────────────────────────────
-- 3 de 10 · EL MANUAL DE MARCA  (/branding deja de ser solo lectura)
--
-- Una sola fila con todo el contenido en jsonb. Es a propósito: el manual se
-- edita entero de una vez desde el panel, no campo por campo, así que una
-- fila evita quince tablas y quince migraciones cada vez que se agrega algo.
-- ──────────────────────────────────────────────────────────────

create table if not exists public.branding (
  id text primary key,
  contenido jsonb not null,
  actualizado_en timestamptz not null default now()
);

comment on table public.branding is 'El manual de marca y contenido. Una fila por marca.';

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

-- RLS activo y SIN políticas: nadie entra con la llave pública del navegador.
-- La API del sitio escribe con la service-role desde el servidor, que se
-- salta el RLS, y exige ADMIN_SECRET antes de dejar escribir.
alter table public.branding enable row level security;
alter table public.branding_historial enable row level security;


-- ──────────────────────────────────────────────────────────────
-- 4 de 10 · LOS NÚMEROS DE CADA VIDEO  ("Los números" en /branding)
--
-- Tabla aparte del manual a propósito. El manual es un documento que se
-- guarda entero de una vez; esto son cientos de filas que crecen solas. Si
-- vivieran en el mismo jsonb, cada guardado reescribiría todo y el historial
-- duplicaría el archivo completo cada vez.
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

-- ── Lo que de verdad decide la distribución ──
-- YouTube dice en su documentación que para recomendar un Short mira tres
-- cosas: qué proporción de gente ELIGIÓ verlo, la duración media y el
-- porcentaje medio visto. El memo interno de MrBeast obliga a su equipo a
-- mirar exactamente esas tres. Instagram (Mosseri) nombró otras: tiempo de
-- visionado, likes por alcance y envíos por alcance.
--
-- Nada de eso se puede calcular sin el ALCANCE, y la tabla no lo guardaba. Sin
-- él solo quedan números crudos, y un número crudo no se compara: 400 likes
-- sobre 2.000 vistas y 400 sobre 200.000 son cosas opuestas.
--
-- Todas nulas a propósito: no todas las redes dan todos estos datos, y un dato
-- que falta no es un cero.
alter table public.publicaciones add column if not exists alcance bigint check (alcance >= 0);
alter table public.publicaciones add column if not exists ctr numeric(5,2) check (ctr >= 0 and ctr <= 100);
alter table public.publicaciones add column if not exists duracion_media numeric(7,2) check (duracion_media >= 0);

-- Los tres primeros segundos, transcritos. El manual dice que ahí se decide
-- todo; guardarlos junto a la retención que sacaron convierte esa creencia en
-- algo medible.
alter table public.publicaciones add column if not exists gancho text;

create index if not exists publicaciones_fecha_idx   on public.publicaciones (fecha desc);
create index if not exists publicaciones_formato_idx on public.publicaciones (formato_id);

-- Mismo criterio que el resto: RLS activo y sin políticas. La llave anónima
-- viaja en el navegador, así que sin esto cualquiera podría inventar
-- métricas, y un número inventado aquí lleva a decidir mal durante meses.
alter table public.publicaciones enable row level security;


-- ──────────────────────────────────────────────────────────────
-- 5 de 10 · PROYECTOS DE KEV  (/kevlopez_proyectos: notas + mapa mental)
--
-- Una sola fila con el árbol entero en jsonb, igual que el manual de marca.
-- Se guarda solo (autoguardado), así que el historial NO archiva cada
-- guardado: deja una copia como máximo cada 10 minutos. Sin ese tope, escribir
-- una frase llenaría la tabla de copias del documento completo.
-- ──────────────────────────────────────────────────────────────

create table if not exists public.proyectos_kev (
  id text primary key,
  contenido jsonb not null,
  actualizado_en timestamptz not null default now()
);

comment on table public.proyectos_kev is 'Notas y mapa mental de /kevlopez_proyectos. Una fila por espacio.';

create table if not exists public.proyectos_kev_historial (
  id bigserial primary key,
  proyecto_id text not null,
  contenido jsonb not null,
  guardado_en timestamptz not null default now()
);

create index if not exists proyectos_kev_historial_idx
  on public.proyectos_kev_historial (proyecto_id, guardado_en desc);

create or replace function public.guardar_historial_proyectos_kev()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.proyectos_kev_historial
    where proyecto_id = old.id and guardado_en > now() - interval '10 minutes'
  ) then
    insert into public.proyectos_kev_historial (proyecto_id, contenido)
    values (old.id, old.contenido);
  end if;
  return new;
end;
$$;

drop trigger if exists proyectos_kev_al_actualizar on public.proyectos_kev;
create trigger proyectos_kev_al_actualizar
  before update on public.proyectos_kev
  for each row execute function public.guardar_historial_proyectos_kev();

-- RLS activo y SIN políticas, como el resto: la llave pública del navegador
-- no entra. La API escribe y LEE con la service-role, y exige ADMIN_SECRET.
alter table public.proyectos_kev enable row level security;
alter table public.proyectos_kev_historial enable row level security;


-- ──────────────────────────────────────────────────────────────
-- 6 de 10 · PREGUNTAS ABIERTAS  (/preguntas: una pregunta, 20 respuestas)
--
-- Una sola fila con el tablero entero en jsonb, igual que el manual de marca
-- y los proyectos. Sin historial: aquí no se reescribe un documento largo,
-- se agregan renglones, y lo que se borra se borra a propósito.
-- ──────────────────────────────────────────────────────────────

create table if not exists public.preguntas (
  id text primary key,
  contenido jsonb not null,
  actualizado_en timestamptz not null default now()
);

comment on table public.preguntas is 'Tablero de /preguntas. Una fila por persona.';

-- RLS activo y SIN políticas, como el resto: la llave pública del navegador
-- no entra. La API escribe y LEE con la service-role, y exige ADMIN_SECRET.
alter table public.preguntas enable row level security;


-- ──────────────────────────────────────────────────────────────
-- 7 de 10 · LA CASA BLANCA PROJECT · ENTREGABLES  (/casa-blanca)
--
-- Lo que entregan de verdad los departamentos de agentes cuando Kev aprieta
-- "Trabajar". El progreso de cada departamento se cuenta con estas filas: sin
-- fila, no hay progreso. El contenido se ve solo si Kev lo marca público.
-- ──────────────────────────────────────────────────────────────

create table if not exists public.casa_blanca_entregables (
  id               uuid primary key default gen_random_uuid(),
  creado           timestamptz not null default now(),
  objetivo_id      text not null,          -- enlaza con OBJETIVOS (datos/empresa.ts)
  departamento_id  text not null,          -- el id del líder: 'hormozi', 'suntzu'…
  puesto           int  not null check (puesto between 0 and 99),
  agente_nombre    text not null,
  rol              text not null,
  titulo           text not null,          -- el título de la tarea que se hizo
  contenido        text not null,
  publico          boolean not null default false
);

comment on table public.casa_blanca_entregables is
  'Entregables de los departamentos de La Casa Blanca Project. Una fila por tarea hecha.';

-- Una tarea se entrega una sola vez. Si Kev aprieta dos veces y los dos
-- pedidos llegan a la vez, el segundo no deja una copia.
create unique index if not exists casa_blanca_entregables_tarea_uq
  on public.casa_blanca_entregables (departamento_id, objetivo_id, titulo);

create index if not exists casa_blanca_entregables_creado_idx
  on public.casa_blanca_entregables (creado desc);

-- RLS activo y SIN políticas, como el resto: la llave pública del navegador
-- no entra. La API lee y escribe con la service-role y decide qué contenido
-- se muestra.
alter table public.casa_blanca_entregables enable row level security;


-- ──────────────────────────────────────────────────────────────
-- 8 de 10 · LA CASA BLANCA PROJECT · EL LÍMITE DIARIO DE LA IA
--
-- Cada charla con un personaje la paga la cuenta de Anthropic de Kev. Una
-- fila por persona y por día, y una fila '*' con el total del día (el techo
-- del gasto). La IP nunca se guarda: `quien` es un hash con sal secreta de la
-- IP y el día, así que tampoco se puede seguir a nadie de un día a otro.
-- ──────────────────────────────────────────────────────────────

create table if not exists public.casa_blanca_uso (
  dia   date not null,
  quien text not null,
  n     int  not null default 0 check (n >= 0),
  primary key (dia, quien)
);

comment on table public.casa_blanca_uso is
  'Llamadas a la IA por persona (hash) y por día en /casa-blanca. La fila * es el total del día.';

alter table public.casa_blanca_uso enable row level security;

-- Contar y decidir en la MISMA sentencia. Leer, comparar y después sumar deja
-- pasar a dos pedidos simultáneos con el último cupo; con el `where` dentro
-- del `on conflict`, la fila se bloquea y el segundo ve el número ya sumado.
-- Primero la persona y después el total: si la persona ya no tiene cupo, el
-- total no se toca; si el total se llenó, se le devuelve a la persona el suyo.
-- El día es el de Bolivia: el cupo se renueva a la medianoche de Kev.
create or replace function public.casa_blanca_consumir(p_quien text, p_tope int, p_tope_global int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  hoy date := (now() at time zone 'America/La_Paz')::date;
  n_quien int;
  n_total int;
begin
  insert into public.casa_blanca_uso as u (dia, quien, n) values (hoy, p_quien, 1)
  on conflict (dia, quien) do update set n = u.n + 1 where u.n < p_tope
  returning u.n into n_quien;
  if n_quien is null then
    return jsonb_build_object('ok', false, 'motivo', 'persona');
  end if;

  insert into public.casa_blanca_uso as u (dia, quien, n) values (hoy, '*', 1)
  on conflict (dia, quien) do update set n = u.n + 1 where u.n < p_tope_global
  returning u.n into n_total;
  if n_total is null then
    update public.casa_blanca_uso set n = n - 1 where dia = hoy and quien = p_quien;
    return jsonb_build_object('ok', false, 'motivo', 'global');
  end if;

  -- La primera llamada del día barre lo de hace más de una semana: para
  -- contar hoy no hace falta guardar el pasado.
  if n_total = 1 then
    delete from public.casa_blanca_uso where dia < hoy - 7;
  end if;

  return jsonb_build_object('ok', true, 'quedan', p_tope - n_quien);
end;
$$;

-- Solo el servidor la llama. Con la llave pública, cualquiera podría gastar
-- el tope del día llamándola en bucle y dejar la casa sin IA para todos.
revoke execute on function public.casa_blanca_consumir(text, int, int) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on function public.casa_blanca_consumir(text, int, int) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke execute on function public.casa_blanca_consumir(text, int, int) from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.casa_blanca_consumir(text, int, int) to service_role';
  end if;
end $$;


-- ──────────────────────────────────────────────────────────────
-- 9 de 10 · LA CASA BLANCA PROJECT · LA MEMORIA COMPARTIDA
--
-- Lo que vivió cada residente con todos los visitantes: las charlas, las
-- conversaciones entre ellos, los consejos, las noticias, lo que entregó su
-- equipo y su diario. Antes vivía solo en el navegador de cada visitante y
-- se perdía; ahora lo recuerdan para todos.
--
-- Sin datos personales: lo que se guarda es un resumen que escribe el
-- personaje en primera persona, no lo que escribió el visitante, y antes de
-- guardarlo el servidor le borra correos, teléfonos, enlaces y el nombre con
-- el que se presentó el visitante.
-- ──────────────────────────────────────────────────────────────

create table if not exists public.casa_blanca_memoria (
  id            uuid primary key default gen_random_uuid(),
  creado        timestamptz not null default now(),
  personaje_id  text not null,           -- el id del residente: 'hormozi', 'claude'…
  tipo          text not null check (tipo in ('charla', 'conversacion', 'consejo', 'noticia', 'trabajo', 'diario')),
  texto         text not null check (char_length(texto) between 1 and 400),
  importancia   int  not null default 5 check (importancia between 1 and 10),
  con           text[] not null default '{}'   -- los otros residentes que estaban
);

comment on table public.casa_blanca_memoria is
  'Recuerdos de los residentes de La Casa Blanca Project, compartidos entre todos los visitantes. Sin datos personales.';

create index if not exists casa_blanca_memoria_personaje_idx
  on public.casa_blanca_memoria (personaje_id, creado desc);

-- RLS activo y SIN políticas, como el resto: la API lee y escribe con la
-- service-role y decide qué se muestra.
alter table public.casa_blanca_memoria enable row level security;

-- Lo que recuerda cada uno antes de hablar: sus p_recientes recuerdos más
-- nuevos y, sin repetirlos, los p_importantes más importantes de los últimos
-- p_dias días. En UNA consulta para todos: el consejo puede sentar a los 24,
-- y con la API de tablas serían dos consultas por residente.
create or replace function public.casa_blanca_recuerdos(p_ids text[], p_recientes int, p_importantes int, p_dias int)
returns table (id uuid, personaje_id text, tipo text, texto text, importancia int, con text[], creado timestamptz)
language sql
stable
set search_path = public
as $$
  select m.id, m.personaje_id, m.tipo, m.texto, m.importancia, m.con, m.creado
  from unnest(p_ids) as p(pid)
  cross join lateral (
    with recientes as (
      select r.* from public.casa_blanca_memoria r
      where r.personaje_id = p.pid
      order by r.creado desc
      limit p_recientes
    )
    select * from recientes
    union all
    (
      select i.* from public.casa_blanca_memoria i
      where i.personaje_id = p.pid
        and i.creado > now() - make_interval(days => p_dias)
        and i.id not in (select recientes.id from recientes)
      order by i.importancia desc, i.creado desc
      limit p_importantes
    )
  ) m
  order by m.personaje_id, m.creado desc;
$$;

revoke execute on function public.casa_blanca_recuerdos(text[], int, int, int) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on function public.casa_blanca_recuerdos(text[], int, int, int) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke execute on function public.casa_blanca_recuerdos(text[], int, int, int) from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.casa_blanca_recuerdos(text[], int, int, int) to service_role';
  end if;
end $$;


-- ──────────────────────────────────────────────────────────────
-- 10 de 10 · LA CASA BLANCA PROJECT · LA CONCIENCIA
--
-- El estado interior de cada residente: cómo amaneció, qué quiere lograr
-- hoy, qué piensa, su diario y lo que opina de los demás. Cambia una vez por
-- día: la primera visita del día (hora de Bolivia) despierta una reflexión de
-- todos, en UNA llamada al modelo barato, a partir de lo que vivieron.
-- ──────────────────────────────────────────────────────────────

create table if not exists public.casa_blanca_conciencia (
  personaje_id  text primary key,
  dia           date not null,           -- el día (de Bolivia) de esta reflexión
  animo         text not null default '',
  meta          text not null default '',
  pensamiento   text not null default '',
  diario        text not null default '',
  -- { "<id de otro residente>": { "valor": -100..100, "frase": "por qué" } }
  opiniones     jsonb not null default '{}'::jsonb,
  actualizado   timestamptz not null default now()
);

comment on table public.casa_blanca_conciencia is
  'Estado interior de cada residente de La Casa Blanca Project. Se reescribe una vez por día.';

alter table public.casa_blanca_conciencia enable row level security;

-- El candado de la reflexión: una fila por día. Sin él, las primeras visitas
-- del día llegan juntas y cada una pagaría su propia reflexión.
--   intentos   cuántas veces se reclamó hoy (tope: si la IA falla, no se
--              reintenta para siempre)
--   reclamado  cuándo se reclamó por última vez (si quien la hacía murió a
--              la mitad, el candado vence y otra visita la retoma)
--   terminado  cuándo se guardó: con fecha, hoy ya no se vuelve a hacer
create table if not exists public.casa_blanca_reflexion (
  dia        date primary key,
  intentos   int not null default 0,
  reclamado  timestamptz not null default now(),
  terminado  timestamptz
);

comment on table public.casa_blanca_reflexion is
  'Candado diario de la reflexión de La Casa Blanca Project: quién la hace y si ya se hizo.';

alter table public.casa_blanca_reflexion enable row level security;

-- Reclamar y decidir en la MISMA sentencia, como casa_blanca_consumir: con el
-- `where` dentro del `on conflict`, la fila del día se bloquea y la segunda
-- visita simultánea ve la fila ya reclamada. Devuelve el día reclamado, o
-- null si hoy ya está hecha, la está haciendo otro o se acabaron los intentos.
create or replace function public.casa_blanca_reclamar_reflexion(p_intentos int, p_vence_min int)
returns date
language plpgsql
security definer
set search_path = public
as $$
declare
  hoy date := (now() at time zone 'America/La_Paz')::date;
  reclamado_dia date;
begin
  insert into public.casa_blanca_reflexion as r (dia, intentos, reclamado)
  values (hoy, 1, now())
  on conflict (dia) do update set intentos = r.intentos + 1, reclamado = now()
    where r.terminado is null
      and r.intentos < p_intentos
      and r.reclamado < now() - make_interval(mins => p_vence_min)
  returning r.dia into reclamado_dia;

  -- Para decidir hoy no hace falta el pasado lejano.
  if reclamado_dia is not null then
    delete from public.casa_blanca_reflexion where dia < hoy - 30;
  end if;

  return reclamado_dia;
end;
$$;

revoke execute on function public.casa_blanca_reclamar_reflexion(int, int) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on function public.casa_blanca_reclamar_reflexion(int, int) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke execute on function public.casa_blanca_reclamar_reflexion(int, int) from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.casa_blanca_reclamar_reflexion(int, int) to service_role';
  end if;
end $$;


-- ══════════════════════════════════════════════════════════════
-- COMPROBACIÓN · tienen que salir 13 filas, todas "protegida"
-- ══════════════════════════════════════════════════════════════

select relname as tabla,
       case when relrowsecurity then 'protegida' else 'ABIERTA — avísame' end as estado
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('perfiles', 'car_pixels', 'branding', 'branding_historial', 'publicaciones', 'proyectos_kev', 'proyectos_kev_historial', 'preguntas', 'casa_blanca_entregables', 'casa_blanca_uso', 'casa_blanca_memoria', 'casa_blanca_conciencia', 'casa_blanca_reflexion')
order by relname;
