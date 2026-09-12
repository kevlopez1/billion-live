-- ──────────────────────────────────────────────────────────────
-- EL AUTO DE PÍXELES · tabla de reservas
-- Correr una vez en el SQL Editor de Supabase.
-- ──────────────────────────────────────────────────────────────

create table if not exists car_pixels (
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
  claim_code  text not null unique,
  created_at  timestamptz not null default now(),
  confirmed_at timestamptz
);

-- Una celda o un espacio premium no se pueden vender dos veces.
-- Los 'anulado' liberan el lugar (por si una reserva no se paga).
create unique index if not exists car_pixels_idx_uq
  on car_pixels(idx) where kind = 'pixel' and status <> 'anulado';

create unique index if not exists car_pixels_slot_uq
  on car_pixels(slot_id) where kind = 'slot' and status <> 'anulado';

create index if not exists car_pixels_status_idx on car_pixels(status);
create index if not exists car_pixels_code_idx   on car_pixels(claim_code);
