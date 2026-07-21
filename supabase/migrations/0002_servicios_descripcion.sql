-- =============================================================================
-- VIZIAO BARBER — 0002_servicios_descripcion.sql
-- Agrega una descripción opcional a los servicios, editable desde /admin y
-- visible en el sitio público cuando existe. No hace falta tocar RLS/grants:
-- las policies de 'servicios' (ver 0001_panel_admin.sql) ya cubren todas las
-- columnas de la tabla.
-- =============================================================================

alter table servicios add column if not exists descripcion text;
