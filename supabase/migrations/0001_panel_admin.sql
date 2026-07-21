-- =====================================================================
-- Panel de administración — nuevas tablas, RLS y función de reserva
-- =====================================================================
-- Contexto: hasta ahora 'citas' tenía un unique(fecha, hora) que impedía
-- dos reservas en el mismo bloque. Con sobrecupos eso deja de ser cierto
-- (el barbero puede autorizar más de un cliente en el mismo bloque), así
-- que el control de concurrencia se mueve a la función reservar_cita(),
-- que usa un lock a nivel de transacción para seguir siendo segura ante
-- dos personas reservando al mismo tiempo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. citas: soporte para cancelación y sobrecupos
-- ---------------------------------------------------------------------
alter table citas add column if not exists estado text not null default 'confirmada'
  check (estado in ('confirmada', 'cancelada'));

alter table citas drop constraint if exists citas_fecha_hora_key;

-- El público solo debe ver bloques ocupados por citas activas (no las canceladas).
drop policy if exists "leer_citas_publico" on citas;
create policy "leer_citas_publico"
  on citas for select
  to anon
  using (estado = 'confirmada');

-- El barbero (autenticado vía Supabase Auth) ve y cancela sus citas.
create policy "leer_citas_admin"
  on citas for select
  to authenticated
  using (true);

create policy "cancelar_citas_admin"
  on citas for update
  to authenticated
  using (true)
  with check (true);

grant select (fecha, hora) on citas to anon;
grant select on citas to authenticated;
grant update (estado) on citas to authenticated;

-- ---------------------------------------------------------------------
-- 2. servicios (antes hardcodeados en app.js)
-- ---------------------------------------------------------------------
create table if not exists servicios (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  precio        integer not null check (precio > 0),
  -- Fijo en 60: generarBloquesHora() en app.js asume citas de 1 hora para
  -- TODOS los servicios. Si se necesita otra duración habrá que ajustar
  -- también la lógica de horarios, no solo esta tabla.
  duracion_min  integer not null default 60 check (duracion_min = 60),
  activo        boolean not null default true,
  orden         integer not null default 0,
  created_at    timestamptz not null default now()
);

alter table servicios enable row level security;

create policy "leer_servicios_publico" on servicios for select to anon using (true);
create policy "gestionar_servicios_admin" on servicios for all to authenticated using (true) with check (true);

grant select on servicios to anon;
grant all on servicios to authenticated;

insert into servicios (nombre, precio, duracion_min, activo, orden)
select 'Corte de cabello', 18000, 60, true, 0
where not exists (select 1 from servicios);

-- ---------------------------------------------------------------------
-- 3. bloqueos_dias — el barbero bloquea un día completo puntual
-- ---------------------------------------------------------------------
create table if not exists bloqueos_dias (
  fecha       date primary key,
  motivo      text,
  created_at  timestamptz not null default now()
);

alter table bloqueos_dias enable row level security;

create policy "leer_bloqueos_dias_publico" on bloqueos_dias for select to anon using (true);
create policy "gestionar_bloqueos_dias_admin" on bloqueos_dias for all to authenticated using (true) with check (true);

grant select (fecha) on bloqueos_dias to anon;
grant all on bloqueos_dias to authenticated;

-- ---------------------------------------------------------------------
-- 4. bloqueos_horarios — bloquea un bloque de hora puntual
-- ---------------------------------------------------------------------
create table if not exists bloqueos_horarios (
  fecha       date not null,
  hora        text not null,
  motivo      text,
  created_at  timestamptz not null default now(),
  primary key (fecha, hora)
);

alter table bloqueos_horarios enable row level security;

create policy "leer_bloqueos_horarios_publico" on bloqueos_horarios for select to anon using (true);
create policy "gestionar_bloqueos_horarios_admin" on bloqueos_horarios for all to authenticated using (true) with check (true);

grant select (fecha, hora) on bloqueos_horarios to anon;
grant all on bloqueos_horarios to authenticated;

-- ---------------------------------------------------------------------
-- 5. sobrecupos — permite más de 1 cita en un bloque puntual
-- ---------------------------------------------------------------------
create table if not exists sobrecupos (
  fecha       date not null,
  hora        text not null,
  cupos_extra integer not null check (cupos_extra > 0),
  created_at  timestamptz not null default now(),
  primary key (fecha, hora)
);

alter table sobrecupos enable row level security;

create policy "leer_sobrecupos_publico" on sobrecupos for select to anon using (true);
create policy "gestionar_sobrecupos_admin" on sobrecupos for all to authenticated using (true) with check (true);

grant select on sobrecupos to anon;
grant all on sobrecupos to authenticated;

-- ---------------------------------------------------------------------
-- 6. horario_negocio — horario semanal configurable (fila única)
-- ---------------------------------------------------------------------
create table if not exists horario_negocio (
  id            boolean primary key default true check (id),
  dias_habiles  smallint[] not null default '{1,2,3,4,5,6}', -- 0=domingo..6=sábado
  hora_inicio   smallint not null default 10,
  hora_fin      smallint not null default 20,
  updated_at    timestamptz not null default now()
);

alter table horario_negocio enable row level security;

create policy "leer_horario_publico" on horario_negocio for select to anon using (true);
create policy "gestionar_horario_admin" on horario_negocio for all to authenticated using (true) with check (true);

grant select on horario_negocio to anon;
grant all on horario_negocio to authenticated;

insert into horario_negocio (id) values (true) on conflict do nothing;

-- ---------------------------------------------------------------------
-- 7. reservar_cita() — inserción atómica con chequeo de bloqueos y cupos
--    La usan tanto crear-cita (clientes, vía service_role) como el panel
--    admin (autenticado, para agendar manualmente).
-- ---------------------------------------------------------------------
create or replace function reservar_cita(
  p_nombre text, p_apellido text, p_codigo_pais text, p_telefono text,
  p_email text, p_observaciones text, p_servicio_id text, p_servicio_nombre text,
  p_precio integer, p_fecha date, p_hora text
) returns citas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cupos integer;
  v_ocupadas integer;
  v_cita citas;
begin
  -- Serializa las reservas para este fecha+hora: la segunda persona que
  -- intente reservar el mismo bloque espera a que la primera termine su
  -- transacción antes de contar cupos, evitando que ambas pasen el check.
  perform pg_advisory_xact_lock(hashtext(p_fecha::text || p_hora));

  if exists (select 1 from bloqueos_dias where fecha = p_fecha) then
    raise exception 'Ese día no está disponible.' using errcode = 'VZ001';
  end if;

  if exists (select 1 from bloqueos_horarios where fecha = p_fecha and hora = p_hora) then
    raise exception 'Ese horario no está disponible.' using errcode = 'VZ001';
  end if;

  select count(*) into v_ocupadas from citas
    where fecha = p_fecha and hora = p_hora and estado = 'confirmada';

  select 1 + coalesce((select cupos_extra from sobrecupos where fecha = p_fecha and hora = p_hora), 0)
    into v_cupos;

  if v_ocupadas >= v_cupos then
    raise exception 'Ese horario ya está lleno.' using errcode = 'VZ002';
  end if;

  insert into citas (nombre, apellido, codigo_pais, telefono, email, observaciones,
                      servicio_id, servicio_nombre, precio, fecha, hora)
  values (p_nombre, p_apellido, p_codigo_pais, p_telefono, p_email, p_observaciones,
          p_servicio_id, p_servicio_nombre, p_precio, p_fecha, p_hora)
  returning * into v_cita;

  return v_cita;
end;
$$;

revoke all on function reservar_cita from public;
grant execute on function reservar_cita to authenticated;
grant execute on function reservar_cita to service_role;
