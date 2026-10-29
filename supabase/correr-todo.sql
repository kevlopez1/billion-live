-- ══════════════════════════════════════════════════════════════
-- TODO EN UNO — las once partes que necesita kevproject.world
--
-- CÓMO SE CORRE
--   1. Abre https://supabase.com/dashboard/project/llhvnzlbnmoufilxgshv/sql/new
--   2. Copia este archivo COMPLETO y pégalo ahí.
--   3. Botón Run (o Ctrl+Enter).
--   4. Al final te devuelve una tabla de 19 filas. Todas tienen que decir
--      "protegida". Si alguna dice "ABIERTA", algo falló: avísame.
--
-- Se puede correr las veces que quieras: no borra nada ni duplica nada.
-- Las líneas amarillas que dicen "NOTICE: ... does not exist, skipping" son
-- normales la primera vez. Las rojas que dicen ERROR no.
--
-- Si se agrega una tabla, va aquí: este es el único archivo de base.
-- ══════════════════════════════════════════════════════════════


-- ──────────────────────────────────────────────────────────────
-- 1 de 11 · CUENTAS  (para que "Crear tu cuenta" funcione)
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
-- 2 de 11 · EL AUTO DE PÍXELES  (las firmas en el auto)
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
-- 3 de 11 · EL MANUAL DE MARCA  (/branding deja de ser solo lectura)
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
-- 4 de 11 · LOS NÚMEROS DE CADA VIDEO  ("Los números" en /branding)
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
-- 5 de 11 · PROYECTOS DE KEV  (/kevlopez_proyectos: notas + mapa mental)
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
-- 6 de 11 · PREGUNTAS ABIERTAS  (/preguntas: una pregunta, 20 respuestas)
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
-- 7 de 11 · LA CASA BLANCA PROJECT · ENTREGABLES  (/casa-blanca)
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
-- 8 de 11 · LA CASA BLANCA PROJECT · EL LÍMITE DIARIO DE LA IA
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
-- 9 de 11 · LA CASA BLANCA PROJECT · LA MEMORIA COMPARTIDA
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
-- 10 de 11 · LA CASA BLANCA PROJECT · LA CONCIENCIA
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


-- ──────────────────────────────────────────────────────────────
-- 11 de 11 · LA FÁBRICA DE VIDEOS  (La Casa Blanca Project en las redes)
--
-- Lo que pasa en la casa se convierte en 3 a 6 videos por día que se publican
-- solos. Plan: kev-project-gta/estrategia-reto/11-FABRICA-DE-VIDEOS.md.
-- Contrato: docs/fabrica/ESPECIFICACION.md.
--
-- Dos reglas mandan aquí, y las dos ya costaron plata en otro proyecto:
--   · Reservar ANTES de mandar. Mandar y después marcar es publicar dos
--     veces: si el proceso muere entre una cosa y la otra, el siguiente ve
--     "sin marcar" y manda de nuevo. Cada paso que gasta o publica se reserva
--     con un UPDATE condicional (estado + dueño + vencimiento) en UNA
--     sentencia, con la hora de la base, nunca la de Vercel.
--   · La fábrica NACE PAUSADA. Hasta que Kev la reanude desde /publicar, no
--     se reserva nada: cada reserva mira `pausada` en la misma sentencia.
-- ──────────────────────────────────────────────────────────────

-- ── Los videos ──
create table if not exists public.fabrica_videos (
  id                  uuid primary key default gen_random_uuid(),
  creado              timestamptz not null default now(),
  actualizado         timestamptz not null default now(),
  dia                 date not null,             -- el día de salida (Bolivia)
  slot                int check (slot between 1 and 6),  -- null = reserva sin lugar
  hora_salida         timestamptz,
  es_reserva          boolean not null default false,
  estado              text not null default 'idea' check (estado in (
                        'idea', 'guion', 'aprobacion_pendiente', 'listo_para_render', 'renderizado',
                        'calidad_ok', 'subido_parcial', 'programado', 'publicado', 'fallido', 'rechazado')),
  pilar               text,
  personajes          text[] not null default '{}',
  semaforo            text check (semaforo in ('verde', 'amarillo')),
  idea                jsonb,
  episodio            jsonb,                     -- un Episodio de guion.ts
  guion_hash          text,
  textos              jsonb,                     -- título y texto por red, ya validados
  avisos              text[] not null default '{}',
  archivo             text,                      -- ruta en el almacén
  archivo_bytes       bigint,
  duracion_s          numeric(6,2),
  calidad             jsonb,
  aprobado_guion_por  text,
  aprobado_guion_en   timestamptz,
  aprobado_video_por  text,
  aprobado_video_en   timestamptz,
  motivo_rechazo      text,
  -- La reserva: quién lo tiene, para qué y hasta cuándo.
  dueno               text,
  trabajo             text,
  vence_en            timestamptz,
  intentos            int not null default 0 check (intentos >= 0),
  errores             jsonb not null default '[]'::jsonb   -- los últimos 20, cada uno con el cómo
);

comment on table public.fabrica_videos is
  'Fábrica de videos: un video por fila, con su estado y su reserva. Ver docs/fabrica/ESPECIFICACION.md.';

-- Un lugar del día lo ocupa un solo video. Las reservas no tienen lugar.
create unique index if not exists fabrica_videos_slot_uq
  on public.fabrica_videos (dia, slot) where slot is not null;
create index if not exists fabrica_videos_estado_idx on public.fabrica_videos (estado);
create index if not exists fabrica_videos_dia_idx on public.fabrica_videos (dia);

-- ── Un envío por video y red ──
-- Una fila por red y no un jsonb en el video: una fila se reserva con un
-- UPDATE condicional; una clave dentro de un jsonb no.
create table if not exists public.fabrica_envios (
  id                   uuid primary key default gen_random_uuid(),
  creado               timestamptz not null default now(),
  actualizado          timestamptz not null default now(),
  video_id             uuid not null references public.fabrica_videos(id) on delete cascade,
  red                  text not null check (red in ('youtube', 'facebook', 'instagram', 'tiktok', 'x')),
  estado               text not null default 'pendiente' check (estado in (
                         'pendiente', 'subiendo', 'subido', 'programado', 'publicando', 'procesando',
                         'ambiguo', 'publicado', 'confirmado', 'no_hoy', 'fallido', 'omitido')),
  id_red               text,
  enlace               text,
  contenedor           text,                     -- Instagram: el contenedor que se procesa
  media_id             text,                     -- X: el media subido por la VM
  media_expira_en      timestamptz,
  publish_at           timestamptz,              -- YouTube
  publicado_en         timestamptz,
  dueno                text,
  reservado_en         timestamptz,
  vence_en             timestamptz,
  intentos             int not null default 0 check (intentos >= 0),
  proximo_intento      timestamptz,
  visibilidad          text,
  verificado_en        timestamptz,
  subtitulos           text not null default 'no_aplica' check (subtitulos in ('no_aplica', 'pendiente', 'ok', 'fallido')),
  intentos_subtitulos  int not null default 0,
  ultimo_error         jsonb,
  unique (video_id, red)
);

comment on table public.fabrica_envios is
  'Fábrica de videos: el envío de un video a una red, con su reserva. Se reserva antes de mandar, nunca después.';

create index if not exists fabrica_envios_estado_idx on public.fabrica_envios (estado);

-- Sumadas después de la primera versión (idempotente: la tabla puede venir de antes).
--   enviado_en     cuándo se MANDÓ (reserva en publicando o subiendo). Es el
--                  ancla de recientes() para un ambiguo: las reservas que solo
--                  miran (resolver un ambiguo) no la mueven. Si la movieran,
--                  tres listas fallidas seguidas dejarían el post original
--                  fuera de la ventana y "no está" sería publicar dos veces.
--   ambiguo_desde  de dónde vino el ambiguo (publicando | subiendo). Columna
--                  propia: un error posterior (la lista que falla) no la pisa,
--                  y una subida de la VM no se confunde con una publicación.
alter table public.fabrica_envios add column if not exists enviado_en timestamptz;
alter table public.fabrica_envios add column if not exists ambiguo_desde text;

-- ── El interruptor y los contadores del día (una sola fila) ──
create table if not exists public.fabrica_estado (
  id                  boolean primary key default true check (id),
  pausada             boolean not null default true,   -- NACE PAUSADA
  motivo              text default 'recién creada: la reanuda Kev',
  pausada_por         text,
  pausada_en          timestamptz default now(),
  modo_aprobacion     boolean not null default true,
  videos_por_dia      int not null default 3 check (videos_por_dia between 1 and 6),
  tope_gasto_usd_dia  numeric(8,2) not null default 5 check (tope_gasto_usd_dia >= 0),  -- a decidir por Kev
  dia                 date,
  gasto_usd_dia       numeric(10,4) not null default 0,
  publicados_dia      int not null default 0,
  fallidos_dia        int not null default 0,
  -- { "x": { "pausada": true, "motivo": "...", "fallos_seguidos": 2 } }
  redes               jsonb not null default '{}'::jsonb,
  ultimo_tick_en      timestamptz,
  ultima_tanda_en     timestamptz,
  ultima_tanda        jsonb
);

comment on table public.fabrica_estado is
  'Fábrica de videos: el interruptor (pausada), los ajustes de Kev y los contadores del día. Una sola fila.';

insert into public.fabrica_estado (id) values (true) on conflict (id) do nothing;

-- ── Tokens cifrados (YouTube, X) ──
-- Cifrados con FABRICA_CLAVE_TOKENS (AES-256-GCM, iv.tag.datos en base64): la
-- base sola no alcanza para publicar. `version` permite rotar sin pisar: el
-- refresh de X sería de un solo uso, y dos renovaciones a la vez dejarían
-- guardado el que ya no sirve.
create table if not exists public.fabrica_tokens (
  red              text primary key,
  cifrado          text not null,
  version          int not null default 1,
  expira_en        timestamptz,
  renovando_hasta  timestamptz,
  actualizado      timestamptz not null default now(),
  ultimo_error     text
);

comment on table public.fabrica_tokens is 'Fábrica de videos: tokens de las redes, cifrados, con versión para rotarlos sin pisarse.';

-- ── Candados diarios (la tanda de la VM y el parte de las 23:00) ──
create table if not exists public.fabrica_candados (
  que        text not null check (que in ('tanda', 'parte')),
  dia        date not null,
  intentos   int not null default 0,
  reclamado  timestamptz not null default now(),
  terminado  timestamptz,
  primary key (que, dia)
);

comment on table public.fabrica_candados is 'Fábrica de videos: lo diario se reclama aquí, un ganador por día.';

-- ── El parte diario ──
-- Se guarda ANTES de mandarlo: si el canal falla, el parte existe igual y el
-- vigilante ve que no salió.
create table if not exists public.fabrica_reporte (
  dia          date primary key,
  generado_en  timestamptz not null default now(),
  enviado_en   timestamptz,
  canal        text,
  resumen      jsonb not null default '{}'::jsonb,
  texto        text not null default '',
  error        text
);

comment on table public.fabrica_reporte is 'Fábrica de videos: el parte de cada día, guardado antes de mandarse.';

-- RLS activo y SIN políticas, como el resto: solo el servidor (service-role).
alter table public.fabrica_videos   enable row level security;
alter table public.fabrica_envios   enable row level security;
alter table public.fabrica_estado   enable row level security;
alter table public.fabrica_tokens   enable row level security;
alter table public.fabrica_candados enable row level security;
alter table public.fabrica_reporte  enable row level security;


-- ── Ayudantes ──

-- Suma un error a la lista y deja los últimos 20. Cada error lleva el cómo.
create or replace function public.fabrica_con_error(p_lista jsonb, p_error jsonb)
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(jsonb_agg(x.e order by x.n), '[]'::jsonb)
  from (
    select t.e, t.n
    from jsonb_array_elements(
      coalesce(p_lista, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('cuando', now()) || p_error)
    ) with ordinality as t(e, n)
    order by t.n desc
    limit 20
  ) x;
$$;

-- Si cambió el día de Bolivia, los contadores vuelven a cero.
create or replace function public.fabrica_al_dia()
returns void
language sql
security definer
set search_path = public
as $$
  update public.fabrica_estado
  set dia = (now() at time zone 'America/La_Paz')::date,
      gasto_usd_dia = 0, publicados_dia = 0, fallidos_dia = 0
  where id and dia is distinct from (now() at time zone 'America/La_Paz')::date;
$$;

-- El latido del tick: deja la hora y devuelve el estado con el `now()` de la
-- base, que es la hora con la que el tick decide.
create or replace function public.fabrica_latido()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.fabrica_estado;
begin
  perform public.fabrica_al_dia();
  update public.fabrica_estado set ultimo_tick_en = now() where id returning * into e;
  return to_jsonb(e) || jsonb_build_object('ahora', now());
end;
$$;

-- Pausar: la fábrica entera (p_red null) o una red. El primer motivo se
-- queda: si ya estaba pausada, una segunda pausa no tapa la causa.
create or replace function public.fabrica_pausar(p_motivo text, p_por text, p_red text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.fabrica_estado;
begin
  if p_red is null then
    update public.fabrica_estado
    set pausada = true, motivo = p_motivo, pausada_por = p_por, pausada_en = now()
    where id and not pausada;
  else
    update public.fabrica_estado
    set redes = jsonb_set(redes, array[p_red],
      coalesce(redes -> p_red, '{}'::jsonb)
        || jsonb_build_object('pausada', true, 'motivo', p_motivo, 'por', p_por, 'en', now()))
    where id and coalesce((redes -> p_red ->> 'pausada')::boolean, false) = false;
  end if;
  select * into e from public.fabrica_estado where id;
  return to_jsonb(e);
end;
$$;

-- Reanudar. Lo llama solo la ruta de Kev: el vigilante y el equipo pausan,
-- nunca reanudan.
create or replace function public.fabrica_reanudar(p_por text, p_red text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.fabrica_estado;
begin
  if p_red is null then
    update public.fabrica_estado
    set pausada = false, motivo = null, pausada_por = p_por, pausada_en = null
    where id;
  else
    update public.fabrica_estado
    set redes = jsonb_set(redes, array[p_red],
      jsonb_build_object('pausada', false, 'fallos_seguidos', 0, 'por', p_por, 'en', now()))
    where id;
  end if;
  select * into e from public.fabrica_estado where id;
  return to_jsonb(e);
end;
$$;


-- ── Reservas de videos ──

-- Gana solo si el estado es uno de p_desde, nadie lo tiene (o su reserva
-- venció), quedan intentos y la fábrica no está pausada: todo leído en la
-- MISMA sentencia. El intento se suma al reservar: una caída también cuenta.
create or replace function public.fabrica_reservar_video(
  p_id uuid, p_desde text[], p_trabajo text, p_dueno text, p_vence_min int, p_max_intentos int)
returns setof public.fabrica_videos
language sql
security definer
set search_path = public
as $$
  update public.fabrica_videos v
  set dueno = p_dueno, trabajo = p_trabajo,
      vence_en = now() + make_interval(mins => p_vence_min),
      intentos = v.intentos + 1, actualizado = now()
  where v.id = p_id
    and v.estado = any(p_desde)
    and (v.dueno is null or v.vence_en < now())
    and v.intentos < p_max_intentos
    and exists (select 1 from public.fabrica_estado e where e.id and not e.pausada)
  returning v.*;
$$;

-- Cierra solo quien tiene la reserva. p_campos trae lo que se guarda; las
-- claves especiales:
--   error           se suma a `errores` (con el cómo)
--   mantener_dueno  true = cambia el estado sin soltar la reserva
--   intentos        si no viene: vuelve a 0 al cambiar de estado (paso nuevo)
create or replace function public.fabrica_terminar_video(p_id uuid, p_dueno text, p_hasta text, p_campos jsonb default '{}'::jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  c jsonb := coalesce(p_campos, '{}'::jsonb);
  seguir boolean := coalesce((c ->> 'mantener_dueno')::boolean, false);
  n int;
begin
  update public.fabrica_videos v
  set estado         = p_hasta,
      actualizado    = now(),
      dueno          = case when seguir then v.dueno else null end,
      trabajo        = case when seguir then v.trabajo else null end,
      vence_en       = case when seguir then v.vence_en else null end,
      intentos       = case when c ? 'intentos' then r.intentos
                            when p_hasta <> v.estado then 0 else v.intentos end,
      pilar          = case when c ? 'pilar' then r.pilar else v.pilar end,
      personajes     = case when c ? 'personajes' then r.personajes else v.personajes end,
      semaforo       = case when c ? 'semaforo' then r.semaforo else v.semaforo end,
      idea           = case when c ? 'idea' then r.idea else v.idea end,
      episodio       = case when c ? 'episodio' then r.episodio else v.episodio end,
      guion_hash     = case when c ? 'guion_hash' then r.guion_hash else v.guion_hash end,
      textos         = case when c ? 'textos' then r.textos else v.textos end,
      avisos         = case when c ? 'avisos' then r.avisos else v.avisos end,
      archivo        = case when c ? 'archivo' then r.archivo else v.archivo end,
      archivo_bytes  = case when c ? 'archivo_bytes' then r.archivo_bytes else v.archivo_bytes end,
      duracion_s     = case when c ? 'duracion_s' then r.duracion_s else v.duracion_s end,
      calidad        = case when c ? 'calidad' then r.calidad else v.calidad end,
      motivo_rechazo = case when c ? 'motivo_rechazo' then r.motivo_rechazo else v.motivo_rechazo end,
      es_reserva     = case when c ? 'es_reserva' then r.es_reserva else v.es_reserva end,
      errores        = case when c ? 'error' then public.fabrica_con_error(v.errores, c -> 'error') else v.errores end
  from jsonb_populate_record(null::public.fabrica_videos, c - 'error' - 'mantener_dueno') r
  where v.id = p_id and v.dueno = p_dueno;
  get diagnostics n = row_count;
  return n = 1;
end;
$$;

-- Un cambio de estado sin red de por medio (el tick cierra un video cuando
-- todas sus redes terminaron, lo pasa a programado…). El UPDATE condicional
-- es la reserva: solo pasa si sigue en p_desde y nadie lo tiene.
create or replace function public.fabrica_mover_video(p_id uuid, p_desde text[], p_hasta text, p_campos jsonb default '{}'::jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  c jsonb := coalesce(p_campos, '{}'::jsonb);
  n int;
begin
  update public.fabrica_videos v
  set estado = p_hasta, actualizado = now(),
      intentos = case when p_hasta <> v.estado then 0 else v.intentos end,
      motivo_rechazo = case when c ? 'motivo_rechazo' then c ->> 'motivo_rechazo' else v.motivo_rechazo end,
      -- archivo: null cuando se borró del almacén
      archivo = case when c ? 'archivo' then c ->> 'archivo' else v.archivo end,
      errores = case when c ? 'error' then public.fabrica_con_error(v.errores, c -> 'error') else v.errores end
  where v.id = p_id
    and v.estado = any(p_desde)
    and (v.dueno is null or v.vence_en < now());
  get diagnostics n = row_count;
  return n = 1;
end;
$$;


-- ── Reservas de envíos ──

-- Como reservar_video, y además: que ya sea la hora del próximo intento y que
-- esa red no esté pausada. Para PUBLICAR, el video tiene que seguir en
-- `programado` en esta misma sentencia: si Kev lo rechazó desde el panel
-- mientras el tick corría, la reserva pierde y no sale.
--   p_sumar       false = revisar sin gastar un intento (mirar si salió)
--   p_aun_pausada true  = solo para DESPROGRAMAR YouTube, que es justo lo que
--                         hay que hacer cuando la fábrica está pausada
create or replace function public.fabrica_reservar_envio(
  p_id uuid, p_desde text[], p_en_curso text, p_dueno text, p_vence_min int, p_max_intentos int,
  p_sumar boolean default true, p_aun_pausada boolean default false)
returns setof public.fabrica_envios
language sql
security definer
set search_path = public
as $$
  update public.fabrica_envios v
  set estado = p_en_curso, dueno = p_dueno, reservado_en = now(),
      enviado_en = case when p_en_curso in ('publicando', 'subiendo') then now() else v.enviado_en end,
      vence_en = now() + make_interval(mins => p_vence_min),
      intentos = v.intentos + case when p_sumar then 1 else 0 end,
      actualizado = now()
  where v.id = p_id
    and v.estado = any(p_desde)
    and (v.dueno is null or v.vence_en < now())
    and v.intentos < p_max_intentos
    and (v.proximo_intento is null or v.proximo_intento <= now())
    and (p_en_curso <> 'publicando' or exists (
      select 1 from public.fabrica_videos fv where fv.id = v.video_id and fv.estado = 'programado'))
    and (p_aun_pausada or exists (
      select 1 from public.fabrica_estado e
      where e.id and not e.pausada
        and coalesce((e.redes -> v.red ->> 'pausada')::boolean, false) = false))
  returning v.*;
$$;

-- Cierra solo quien tiene la reserva. Claves especiales de p_campos:
--   error            se guarda en ultimo_error (con el cómo y la hora)
--   publicado_ahora  true = publicado_en = now() de la base
--   verificado_ahora true = verificado_en = now()
--   intentos         si no viene, se conserva (lo decide la cola)
create or replace function public.fabrica_terminar_envio(p_id uuid, p_dueno text, p_hasta text, p_campos jsonb default '{}'::jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  c jsonb := coalesce(p_campos, '{}'::jsonb);
  n int;
begin
  update public.fabrica_envios v
  set estado              = p_hasta,
      actualizado         = now(),
      dueno               = null,
      vence_en            = null,
      intentos            = case when c ? 'intentos' then r.intentos else v.intentos end,
      id_red              = case when c ? 'id_red' then r.id_red else v.id_red end,
      enlace              = case when c ? 'enlace' then r.enlace else v.enlace end,
      contenedor          = case when c ? 'contenedor' then r.contenedor else v.contenedor end,
      media_id            = case when c ? 'media_id' then r.media_id else v.media_id end,
      media_expira_en     = case when c ? 'media_expira_en' then r.media_expira_en else v.media_expira_en end,
      publish_at          = case when c ? 'publish_at' then r.publish_at else v.publish_at end,
      proximo_intento     = case when c ? 'proximo_intento' then r.proximo_intento else v.proximo_intento end,
      visibilidad         = case when c ? 'visibilidad' then r.visibilidad else v.visibilidad end,
      subtitulos          = case when c ? 'subtitulos' then r.subtitulos else v.subtitulos end,
      intentos_subtitulos = case when c ? 'intentos_subtitulos' then r.intentos_subtitulos else v.intentos_subtitulos end,
      publicado_en        = case when coalesce((c ->> 'publicado_ahora')::boolean, false) then now() else v.publicado_en end,
      verificado_en       = case when coalesce((c ->> 'verificado_ahora')::boolean, false) then now() else v.verificado_en end,
      ultimo_error        = case when c ? 'error' then jsonb_build_object('cuando', now()) || (c -> 'error') else v.ultimo_error end,
      -- Al entrar en ambiguo se anota desde dónde (el estado en curso de la
      -- reserva); mientras siga ambiguo se conserva; al salir, se borra.
      ambiguo_desde       = case when p_hasta <> 'ambiguo' then null
                                 when v.estado <> 'ambiguo' then v.estado
                                 else v.ambiguo_desde end
  from jsonb_populate_record(null::public.fabrica_envios, c - 'error' - 'publicado_ahora' - 'verificado_ahora') r
  where v.id = p_id and v.dueno = p_dueno;
  get diagnostics n = row_count;
  return n = 1;
end;
$$;

-- Un cambio de estado de un envío sin red de por medio (omitir una red
-- apagada, marcar publicado lo que YouTube ya sacó a la hora). Mismo
-- criterio que fabrica_mover_video.
create or replace function public.fabrica_mover_envio(p_id uuid, p_desde text[], p_hasta text, p_campos jsonb default '{}'::jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  c jsonb := coalesce(p_campos, '{}'::jsonb);
  n int;
begin
  update public.fabrica_envios v
  set estado = p_hasta, actualizado = now(),
      publicado_en = case when coalesce((c ->> 'publicado_ahora')::boolean, false) then now() else v.publicado_en end,
      ultimo_error = case when c ? 'error' then jsonb_build_object('cuando', now()) || (c -> 'error') else v.ultimo_error end
  where v.id = p_id
    and v.estado = any(p_desde)
    and (v.dueno is null or v.vence_en < now());
  get diagnostics n = row_count;
  return n = 1;
end;
$$;

-- Una reserva vencida en `subiendo` o `publicando` no se sabe si salió: pasa
-- a `ambiguo`, y de ahí solo se sale mirando los posts recientes de la red.
-- Es lo primero que hace cada tick y cada tanda.
create or replace function public.fabrica_vencidos_a_ambiguo()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update public.fabrica_envios
  set ultimo_error = jsonb_build_object(
        'cuando', now(), 'paso', estado, 'clase', 'ambiguo',
        'como', 'la reserva de ' || coalesce(dueno, 'nadie') || ' venció en ' || estado || ' sin cerrarse'),
      ambiguo_desde = estado,
      estado = 'ambiguo', dueno = null, vence_en = null, actualizado = now()
  where estado in ('subiendo', 'publicando') and vence_en < now();
  get diagnostics n = row_count;
  return n;
end;
$$;


-- ── Aprobaciones vencidas y huecos ──

-- Un guion sin respuesta de Kev en p_horas, o (en modo aprobación) un video
-- sin OK a p_min_sin_ok minutos de su salida, no sale: queda rechazado y su
-- lugar lo cubre la reserva. Devuelve cuántos y los lugares que quedaron libres.
create or replace function public.fabrica_vencer_aprobaciones(p_horas int default 24, p_min_sin_ok int default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n_guiones int;
  huecos jsonb;
begin
  update public.fabrica_videos
  set estado = 'rechazado', motivo_rechazo = 'sin aprobación del guion en ' || p_horas || ' h',
      dueno = null, trabajo = null, vence_en = null, actualizado = now()
  where estado = 'aprobacion_pendiente'
    and actualizado < now() - make_interval(hours => p_horas)
    and (dueno is null or vence_en < now());
  get diagnostics n_guiones = row_count;

  with rechazados as (
    update public.fabrica_videos v
    set estado = 'rechazado', motivo_rechazo = 'sin OK del video a ' || p_min_sin_ok || ' min de la salida',
        dueno = null, trabajo = null, vence_en = null, actualizado = now()
    where v.estado in ('calidad_ok', 'subido_parcial', 'programado')
      and v.aprobado_video_en is null
      and not v.es_reserva
      and v.hora_salida is not null
      and v.hora_salida < now() + make_interval(mins => p_min_sin_ok)
      and (v.dueno is null or v.vence_en < now())
      and exists (select 1 from public.fabrica_estado e where e.id and e.modo_aprobacion)
      -- Lo que ya salió (o puede haber salido) no se rechaza: un video sigue en
      -- `programado` hasta 24 h después de publicar, y encender el modo
      -- aprobación a media tarde no puede tumbar lo de la mañana. Mismo
      -- criterio que fabrica_decidir al rechazar. Un YouTube con publishAt
      -- todavía por delante sí se puede rechazar: el tick lo desprograma.
      and not exists (
        select 1 from public.fabrica_envios en
        where en.video_id = v.id
          and (en.estado in ('publicando', 'procesando', 'ambiguo', 'publicado', 'confirmado')
               or (en.estado = 'programado' and en.publish_at is not null and en.publish_at <= now())))
    returning v.dia, v.slot, v.hora_salida
  )
  select coalesce(jsonb_agg(jsonb_build_object('dia', dia, 'slot', slot, 'hora', hora_salida)), '[]'::jsonb)
  into huecos from rechazados;

  return jsonb_build_object('guiones', n_guiones, 'videos', huecos);
end;
$$;

-- Un lugar del día que no va a llegar a tiempo lo toma la reserva verde más
-- vieja que esté lista (subida, y aprobada si hay modo aprobación). El que no
-- llegó deja el lugar: si es verde y sigue vivo pasa a la reserva; un
-- amarillo nunca es reserva y queda rechazado. Con `skip locked`, dos ticks a
-- la vez no se llevan la misma reserva. Devuelve el video que tomó el lugar,
-- o nada (lugar ocupado por uno listo, o reserva vacía).
create or replace function public.fabrica_cubrir_hueco(p_dia date, p_slot int, p_hora timestamptz)
returns setof public.fabrica_videos
language plpgsql
security definer
set search_path = public
as $$
declare
  viejo public.fabrica_videos;
  hay_viejo boolean;
  nuevo public.fabrica_videos;
  modo boolean;
begin
  if not exists (select 1 from public.fabrica_estado e where e.id and not e.pausada) then
    return;
  end if;
  select modo_aprobacion into modo from public.fabrica_estado where id;

  select * into viejo from public.fabrica_videos where dia = p_dia and slot = p_slot for update;
  hay_viejo := found;
  if hay_viejo and viejo.estado in ('programado', 'publicado') then return; end if;
  if hay_viejo and viejo.dueno is not null and viejo.vence_en > now() then return; end if;

  select * into nuevo from public.fabrica_videos
  where es_reserva and slot is null and semaforo = 'verde' and estado = 'subido_parcial'
    and (dueno is null or vence_en < now())
    and (not modo or aprobado_video_en is not null)
  order by creado
  limit 1
  for update skip locked;
  if not found then return; end if;

  if hay_viejo then
    update public.fabrica_videos
    set slot = null,
        es_reserva = (semaforo = 'verde' and estado not in ('fallido', 'rechazado', 'publicado')),
        estado = case when semaforo = 'verde' or estado in ('fallido', 'rechazado') then estado else 'rechazado' end,
        motivo_rechazo = case when semaforo = 'verde' or estado in ('fallido', 'rechazado') then motivo_rechazo
                              else 'no llegó a tiempo y un amarillo no va a la reserva' end,
        actualizado = now()
    where id = viejo.id;
  end if;

  update public.fabrica_videos
  set dia = p_dia, slot = p_slot, hora_salida = p_hora, es_reserva = false, actualizado = now()
  where id = nuevo.id
  returning * into nuevo;
  return next nuevo;
end;
$$;


-- ── Plata y fallos ──

-- Se suma ANTES de gastar, y solo si no pasa el tope del día. Si pasa, la
-- fábrica se pausa y devuelve ok: false: ese gasto no se hace.
create or replace function public.fabrica_sumar_gasto(p_usd numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.fabrica_estado;
begin
  perform public.fabrica_al_dia();
  update public.fabrica_estado
  set gasto_usd_dia = gasto_usd_dia + p_usd
  where id and not pausada and gasto_usd_dia + p_usd <= tope_gasto_usd_dia
  returning * into e;
  if found then
    return jsonb_build_object('ok', true, 'gasto', e.gasto_usd_dia, 'tope', e.tope_gasto_usd_dia);
  end if;

  update public.fabrica_estado
  set pausada = true, pausada_por = 'fabrica', pausada_en = now(),
      motivo = 'tope de gasto: ' || gasto_usd_dia || ' + ' || p_usd || ' pasa de ' || tope_gasto_usd_dia || ' USD'
  where id and not pausada;
  select * into e from public.fabrica_estado where id;
  return jsonb_build_object('ok', false, 'gasto', e.gasto_usd_dia, 'tope', e.tope_gasto_usd_dia, 'motivo', e.motivo);
end;
$$;

-- El resultado de cada envío de una red: un éxito pone los fallos seguidos en
-- 0; con 2 fallos seguidos, esa red se pausa sola.
create or replace function public.fabrica_registrar_resultado(p_red text, p_ok boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  fallos int;
  r jsonb;
begin
  perform public.fabrica_al_dia();
  update public.fabrica_estado
  set redes = jsonb_set(redes, array[p_red],
        coalesce(redes -> p_red, '{}'::jsonb) || jsonb_build_object('fallos_seguidos',
          case when p_ok then 0 else coalesce((redes -> p_red ->> 'fallos_seguidos')::int, 0) + 1 end)),
      publicados_dia = publicados_dia + case when p_ok then 1 else 0 end,
      fallidos_dia = fallidos_dia + case when p_ok then 0 else 1 end
  where id
  returning (redes -> p_red ->> 'fallos_seguidos')::int into fallos;

  if not p_ok and fallos >= 2 then
    perform public.fabrica_pausar(fallos || ' fallos seguidos', 'fabrica', p_red);
  end if;
  select redes -> p_red into r from public.fabrica_estado where id;
  return r;
end;
$$;


-- ── Candados diarios ──

-- Como casa_blanca_reclamar_reflexion: devuelve el día (de Bolivia) si lo
-- ganó, o null si ya está hecho, lo tiene otro o se acabaron los intentos.
create or replace function public.fabrica_reclamar(p_que text, p_intentos int, p_vence_min int)
returns date
language plpgsql
security definer
set search_path = public
as $$
declare
  hoy date := (now() at time zone 'America/La_Paz')::date;
  ganado date;
begin
  insert into public.fabrica_candados as c (que, dia, intentos, reclamado)
  values (p_que, hoy, 1, now())
  on conflict (que, dia) do update set intentos = c.intentos + 1, reclamado = now()
    where c.terminado is null
      and c.intentos < p_intentos
      and c.reclamado < now() - make_interval(mins => p_vence_min)
  returning c.dia into ganado;

  if ganado is not null then
    delete from public.fabrica_candados where dia < hoy - 30;
  end if;
  return ganado;
end;
$$;

create or replace function public.fabrica_terminar_candado(p_que text, p_dia date)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update public.fabrica_candados set terminado = now()
  where que = p_que and dia = p_dia and terminado is null;
  get diagnostics n = row_count;
  return n = 1;
end;
$$;


-- ── El parte ──

-- Se guarda antes de mandarlo. Si se vuelve a armar (el envío falló), se
-- reescribe, pero un parte ya enviado no se toca.
create or replace function public.fabrica_guardar_parte(p_dia date, p_resumen jsonb, p_texto text, p_canal text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  insert into public.fabrica_reporte as r (dia, resumen, texto, canal)
  values (p_dia, p_resumen, p_texto, p_canal)
  on conflict (dia) do update
    set resumen = excluded.resumen, texto = excluded.texto, canal = excluded.canal,
        generado_en = now(), error = null
    where r.enviado_en is null;
  get diagnostics n = row_count;
  return n = 1;
end;
$$;

-- `enviado_en` solo si el canal confirmó; si no, queda el error con el cómo.
create or replace function public.fabrica_parte_resultado(p_dia date, p_error text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.fabrica_reporte
  set enviado_en = case when p_error is null then now() else enviado_en end,
      error = p_error
  where dia = p_dia;
$$;


-- ── Tokens ──

-- Reserva la renovación de un token por p_vence_seg segundos. Gana uno.
create or replace function public.fabrica_reservar_token(p_red text, p_vence_seg int)
returns setof public.fabrica_tokens
language sql
security definer
set search_path = public
as $$
  update public.fabrica_tokens
  set renovando_hasta = now() + make_interval(secs => p_vence_seg)
  where red = p_red and (renovando_hasta is null or renovando_hasta < now())
  returning *;
$$;

-- Rota solo si nadie rotó antes (misma versión). Si da false, otro rotó: se
-- relee el token, no se pisa.
create or replace function public.fabrica_rotar_token(p_red text, p_version int, p_cifrado text, p_expira timestamptz)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update public.fabrica_tokens
  set cifrado = p_cifrado, version = version + 1, expira_en = p_expira,
      renovando_hasta = null, actualizado = now(), ultimo_error = null
  where red = p_red and version = p_version;
  get diagnostics n = row_count;
  return n = 1;
end;
$$;


-- ── Lo que decide Kev en /publicar ──

-- Aprobar o rechazar un guion (con amarillos) o un video terminado (modo
-- aprobación). Gana solo si el video sigue COMO KEV LO VIO: mismo estado,
-- mismo guion_hash y nadie trabajándolo, en UNA sentencia. Si no gana, se
-- relee la fila para decir por qué (un "no" mudo deja a Kev apretando de nuevo).
--   guion  aprobar  → listo_para_render (+ aprobado_guion_por/en)
--          rechazar → rechazado
--   video  aprobar  → mismo estado + aprobado_video_por/en
--          rechazar → rechazado, solo si ninguna red lo está publicando ni lo
--                     publicó (un rechazo no borra lo que ya salió). El lugar
--                     que deja lo cubre la reserva en el próximo tick.
create or replace function public.fabrica_decidir(
  p_id uuid, p_que text, p_aprobar boolean, p_hash text, p_por text, p_motivo text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  fila public.fabrica_videos;
  n int := 0;
  salio text;
  razon text := coalesce(nullif(trim(p_motivo), ''), 'rechazado por ' || p_por);
begin
  if p_que = 'guion' then
    update public.fabrica_videos
    set estado = case when p_aprobar then 'listo_para_render' else 'rechazado' end,
        aprobado_guion_por = case when p_aprobar then p_por else aprobado_guion_por end,
        aprobado_guion_en = case when p_aprobar then now() else aprobado_guion_en end,
        motivo_rechazo = case when p_aprobar then motivo_rechazo else razon end,
        intentos = 0, actualizado = now()
    where id = p_id and estado = 'aprobacion_pendiente'
      and guion_hash is not distinct from p_hash
      and (dueno is null or vence_en < now());
    get diagnostics n = row_count;
  elsif p_que = 'video' and p_aprobar then
    update public.fabrica_videos
    set aprobado_video_por = p_por, aprobado_video_en = now(), actualizado = now()
    where id = p_id and estado in ('calidad_ok', 'subido_parcial', 'programado')
      and aprobado_video_en is null
      and guion_hash is not distinct from p_hash;
    get diagnostics n = row_count;
  elsif p_que = 'video' then
    update public.fabrica_videos v
    set estado = 'rechazado', motivo_rechazo = razon, actualizado = now()
    where v.id = p_id and v.estado in ('calidad_ok', 'subido_parcial', 'programado')
      and v.guion_hash is not distinct from p_hash
      and (v.dueno is null or v.vence_en < now())
      and not exists (
        select 1 from public.fabrica_envios e
        where e.video_id = v.id and e.estado in ('publicando', 'procesando', 'ambiguo', 'publicado', 'confirmado'));
    get diagnostics n = row_count;
  else
    return jsonb_build_object('ok', false, 'motivo', 'qué decidir: guion o video');
  end if;

  select * into fila from public.fabrica_videos where id = p_id;
  if n = 1 then
    return jsonb_build_object('ok', true, 'estado', fila.estado);
  end if;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'ese video ya no existe');
  end if;
  if fila.guion_hash is distinct from p_hash then
    return jsonb_build_object('ok', false, 'estado', fila.estado, 'motivo', 'el guion cambió desde que lo viste: recarga');
  end if;
  if fila.dueno is not null and fila.vence_en > now() then
    return jsonb_build_object('ok', false, 'estado', fila.estado,
      'motivo', 'la fábrica lo está trabajando (' || coalesce(fila.trabajo, '?') || '): inténtalo en unos minutos');
  end if;
  select string_agg(e.red || ' ' || e.estado, ', ') into salio from public.fabrica_envios e
  where e.video_id = p_id and e.estado in ('publicando', 'procesando', 'ambiguo', 'publicado', 'confirmado');
  if salio is not null and p_que = 'video' and not p_aprobar then
    return jsonb_build_object('ok', false, 'estado', fila.estado,
      'motivo', 'ya está saliendo o salió (' || salio || '): se baja a mano en cada red');
  end if;
  if p_que = 'video' and p_aprobar and fila.aprobado_video_en is not null then
    return jsonb_build_object('ok', false, 'estado', fila.estado, 'motivo', 'ya estaba aprobado');
  end if;
  return jsonb_build_object('ok', false, 'estado', fila.estado, 'motivo', 'ya no espera esta decisión (está en ' || fila.estado || ')');
end;
$$;


-- Solo el servidor llama a estas funciones. Con la llave pública, cualquiera
-- podría reanudar la fábrica o reservar envíos.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as firma
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname like 'fabrica\_%'
  loop
    execute format('revoke execute on function %s from public', f.firma);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke execute on function %s from anon', f.firma);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke execute on function %s from authenticated', f.firma);
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function %s to service_role', f.firma);
    end if;
  end loop;
end $$;


-- ── Lo que pide la medición (etapa 6) en `publicaciones` ──
-- Un dato que una red no reporta no es un cero: las cuatro columnas aceptan
-- vacío y dejan de tener default. /api/publicaciones sigue mandando números
-- siempre, así que lo de hoy no cambia.
alter table public.publicaciones
  alter column vistas drop not null,       alter column vistas drop default,
  alter column likes drop not null,        alter column likes drop default,
  alter column comentarios drop not null,  alter column comentarios drop default,
  alter column compartidos drop not null,  alter column compartidos drop default;

alter table public.publicaciones add column if not exists fabrica_video_id uuid
  references public.fabrica_videos(id) on delete set null;
alter table public.publicaciones add column if not exists id_red text;
alter table public.publicaciones add column if not exists corte text check (corte in ('72h', '7d'));
-- El cómo: pilar, visor, cámara del plano 1, personajes, voz, música, formato, duración.
alter table public.publicaciones add column if not exists como jsonb;
alter table public.publicaciones add column if not exists medido_en timestamptz;

create unique index if not exists publicaciones_fabrica_corte_uq
  on public.publicaciones (fabrica_video_id, red, corte) where fabrica_video_id is not null;


-- ── El reloj: pg_cron llama al tick cada 10 minutos ──
-- NO corre solo: está comentado a propósito. Necesita la web desplegada con
-- /api/fabrica/tick y la clave FABRICA_CRON_SECRET. La clave NUNCA va en este
-- archivo: se guarda una vez en Vault, a mano, y el bloque la lee de ahí.
--
-- Para encenderlo:
--   1. Database → Extensions: activar pg_cron y pg_net.
--   2. Guardar la clave (la misma de FABRICA_CRON_SECRET en Vercel), una vez:
--        select vault.create_secret('<la clave>', 'fabrica_cron');
--   3. Quitar los "-- " del bloque de abajo y correrlo solo. Se puede correr
--      de nuevo: cron.schedule con el mismo nombre reemplaza el anterior.
--      La URL tiene que ser la final: pg_net no sigue redirecciones (si el
--      dominio manda a www, el tick no llega y solo lo nota el vigilante).
--   4. Comprobar a los 10 min: select status_code, content from net._http_response
--      order by created desc limit 3;   (200 = el tick corrió)
--   Para apagarlo: select cron.unschedule('fabrica-tick');
--
-- do $$
-- declare
--   falta text[] := '{}';
--   hay_clave boolean := false;
-- begin
--   if not exists (select 1 from pg_extension where extname = 'pg_cron') then falta := array_append(falta, 'pg_cron'); end if;
--   if not exists (select 1 from pg_extension where extname = 'pg_net') then falta := array_append(falta, 'pg_net'); end if;
--   if to_regclass('vault.decrypted_secrets') is not null then
--     execute 'select exists (select 1 from vault.decrypted_secrets where name = $1)' into hay_clave using 'fabrica_cron';
--   end if;
--   if not hay_clave then falta := array_append(falta, 'el secreto fabrica_cron en Vault'); end if;
--   if cardinality(falta) > 0 then
--     raise notice 'fabrica-tick NO se programó. Falta: %', array_to_string(falta, ', ');
--     return;
--   end if;
--   perform cron.schedule('fabrica-tick', '*/10 * * * *', $cron$
--     select net.http_post(
--       url := 'https://kevproject.world/api/fabrica/tick',
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'fabrica_cron')),
--       body := '{}'::jsonb,
--       timeout_milliseconds := 60000
--     );
--   $cron$);
--   raise notice 'fabrica-tick programado: cada 10 minutos.';
-- end $$;


-- ══════════════════════════════════════════════════════════════
-- COMPROBACIÓN · tienen que salir 19 filas, todas "protegida"
-- ══════════════════════════════════════════════════════════════

select relname as tabla,
       case when relrowsecurity then 'protegida' else 'ABIERTA — avísame' end as estado
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('perfiles', 'car_pixels', 'branding', 'branding_historial', 'publicaciones', 'proyectos_kev', 'proyectos_kev_historial', 'preguntas', 'casa_blanca_entregables', 'casa_blanca_uso', 'casa_blanca_memoria', 'casa_blanca_conciencia', 'casa_blanca_reflexion', 'fabrica_videos', 'fabrica_envios', 'fabrica_estado', 'fabrica_tokens', 'fabrica_candados', 'fabrica_reporte')
order by relname;
