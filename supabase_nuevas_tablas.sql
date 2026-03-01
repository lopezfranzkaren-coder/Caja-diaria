-- =============================================
-- NUEVAS TABLAS - Ejecutar en Supabase > SQL Editor
-- =============================================

-- TIENDA NUBE (datos mensuales manuales)
create table if not exists tiendanube (
  id uuid default gen_random_uuid() primary key,
  mes text not null unique,
  ventas integer not null default 0,
  facturado numeric(12,2) not null default 0,
  ticket_promedio numeric(12,2) default 0,
  notas text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- MERCADO LIBRE (importado desde excel)
create table if not exists mercadolibre_ventas (
  id uuid default gen_random_uuid() primary key,
  numero_venta text unique not null,
  fecha date not null,
  estado text,
  unidades numeric(8,2) default 1,
  ingresos_producto numeric(12,2) default 0,
  cargo_venta numeric(12,2) default 0,
  costo_fijo numeric(12,2) default 0,
  costo_cuotas numeric(12,2) default 0,
  ingresos_envio numeric(12,2) default 0,
  costos_envio_ml numeric(12,2) default 0,
  total numeric(12,2) default 0,
  titulo text,
  variante text,
  forma_entrega text,
  created_at timestamp with time zone default now()
);

-- CONFIGURACION ENVIOS ML
create table if not exists ml_config_envios (
  id text primary key,
  nombre text not null,
  costo_ml numeric(12,2) not null default 0,
  costo_moto numeric(12,2) not null default 0,
  activo boolean default true,
  updated_at timestamp with time zone default now()
);

-- Insertar valores por defecto
insert into ml_config_envios (id, nombre, costo_ml, costo_moto, activo) values
  ('caba', 'CABA',  4611,  3500, true),
  ('gba1', 'GBA 1', 7371,  4500, true),
  ('gba2', 'GBA 2', 10246, 5000, true),
  ('gba3', 'GBA 3', 14000, 8000, true)
on conflict (id) do nothing;

-- RLS policies
alter table tiendanube enable row level security;
alter table mercadolibre_ventas enable row level security;
alter table ml_config_envios enable row level security;

create policy "public_all" on tiendanube for all using (true) with check (true);
create policy "public_all" on mercadolibre_ventas for all using (true) with check (true);
create policy "public_all" on ml_config_envios for all using (true) with check (true);

-- Agregar columnas nuevas a mercadolibre_ventas si ya existe la tabla
alter table mercadolibre_ventas add column if not exists cargo_venta numeric(12,2) default 0;
alter table mercadolibre_ventas add column if not exists costo_fijo numeric(12,2) default 0;
alter table mercadolibre_ventas add column if not exists costo_cuotas numeric(12,2) default 0;
alter table mercadolibre_ventas add column if not exists ingresos_envio numeric(12,2) default 0;
alter table mercadolibre_ventas add column if not exists costos_envio_ml numeric(12,2) default 0;

