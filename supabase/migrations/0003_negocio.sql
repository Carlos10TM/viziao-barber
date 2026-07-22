-- =============================================================================
-- VIZIAO BARBER — 0003_negocio.sql
-- Dirección y teléfono del local, editables desde /admin — antes vivían
-- hardcodeados en app.js. Misma fila única + RLS que horario_negocio
-- (ver 0001_panel_admin.sql).
-- =============================================================================

create table if not exists negocio (
  id           boolean primary key default true,
  calle        text not null default '',
  numero       text not null default '',
  comuna       text not null default '',
  codigo_pais  text not null default '+56',
  telefono     text not null default '',
  updated_at   timestamptz not null default now(),
  constraint negocio_single_row check (id)
);

alter table negocio enable row level security;

create policy "leer_negocio_publico" on negocio for select to anon using (true);
create policy "gestionar_negocio_admin" on negocio for all to authenticated using (true) with check (true);

grant select on negocio to anon;
grant all on negocio to authenticated;

-- Precarga con los datos que hoy están hardcodeados en app.js, para que no
-- cambie nada visualmente hasta que el barbero edite algo desde /admin.
insert into negocio (id, calle, numero, comuna, codigo_pais, telefono)
select true, 'Santiago Díaz', '1127', 'Punta Arenas, Magallanes', '+56', '969001202'
where not exists (select 1 from negocio);
