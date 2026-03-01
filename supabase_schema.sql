-- =============================================
-- CAJA DIARIA - Schema Supabase
-- Ejecutar en: Supabase > SQL Editor
-- =============================================

-- VENTAS DIARIAS
create table ventas (
  id uuid default gen_random_uuid() primary key,
  fecha date not null,
  canal text not null check (canal in ('local', 'online')),
  metodo text not null check (metodo in ('mp', 'transferencia', 'efectivo')),
  monto numeric(12,2) not null default 0,
  notas text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- GASTOS
create table gastos (
  id uuid default gen_random_uuid() primary key,
  fecha date not null,
  descripcion text not null,
  monto numeric(12,2) not null default 0,
  categoria text default 'general',
  notas text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- MAYORISTAS (clientes)
create table mayoristas (
  id uuid default gen_random_uuid() primary key,
  nombre text not null,
  telefono text,
  notas text,
  activo boolean default true,
  created_at timestamp with time zone default now()
);

-- VENTAS MAYORISTAS
create table ventas_mayoristas (
  id uuid default gen_random_uuid() primary key,
  mayorista_id uuid references mayoristas(id) on delete cascade,
  fecha date not null,
  monto numeric(12,2) not null default 0,
  metodo text not null check (metodo in ('mp', 'transferencia', 'efectivo', 'pendiente')),
  descripcion text,
  pagado boolean default false,
  monto_pagado numeric(12,2) default 0,
  notas text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- STOCK
create table stock (
  id uuid default gen_random_uuid() primary key,
  nombre text not null,
  cantidad integer not null default 0,
  alerta_minimo integer default 5,
  notas text,
  activo boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- METAS MENSUALES
create table metas (
  id uuid default gen_random_uuid() primary key,
  mes text not null unique, -- formato: YYYY-MM
  meta_pesos numeric(12,2) not null default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Habilitar RLS (Row Level Security) - acceso público para todos
alter table ventas enable row level security;
alter table gastos enable row level security;
alter table mayoristas enable row level security;
alter table ventas_mayoristas enable row level security;
alter table stock enable row level security;
alter table metas enable row level security;

-- Políticas: todos pueden leer y escribir (sin autenticación)
create policy "public_all" on ventas for all using (true) with check (true);
create policy "public_all" on gastos for all using (true) with check (true);
create policy "public_all" on mayoristas for all using (true) with check (true);
create policy "public_all" on ventas_mayoristas for all using (true) with check (true);
create policy "public_all" on stock for all using (true) with check (true);
create policy "public_all" on metas for all using (true) with check (true);
