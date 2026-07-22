begin transaction read only;

set local statement_timeout = '30s';

-- DIGIY PRO LOC — DIAGNOSTIC PRODUCTION V1 — LECTURE SEULE
-- Aucun téléphone, PIN, nom, slug ou profil d'abonné dans ce fichier.
-- Aucune création, modification ou suppression.
-- Objectif : révéler le schéma réel avant de brancher la sauvegarde cloud.

-- 01. Fonctions d'accès et fonctions LOC réellement installées.
select
  '01_FONCTIONS' as section,
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type,
  p.prosecdef as security_definer,
  p.provolatile as volatility,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (
    p.proname in (
      'digiy_verify_pin',
      'digiy_has_access',
      'digiy_has_module_access_from_abos',
      'digiy_loc_public_room_by_slug',
      'digiy_loc_reservations_by_slug',
      'digiy_loc_get_reservations_by_slug',
      'digiy_loc_reservations_for_slug'
    )
    or p.proname ilike '%loc%'
    or p.proname ilike '%reservation%'
    or p.proname ilike '%booking%'
  )
order by p.proname, pg_get_function_identity_arguments(p.oid);

-- 02. Tables, vues et vues matérialisées liées à LOC.
select
  '02_RELATIONS' as section,
  n.nspname as schema_name,
  c.relname as relation_name,
  case c.relkind
    when 'r' then 'table'
    when 'p' then 'partitioned_table'
    when 'v' then 'view'
    when 'm' then 'materialized_view'
    when 'f' then 'foreign_table'
    else c.relkind::text
  end as relation_type,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  coalesce(s.n_live_tup, 0) as estimated_live_rows
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_stat_all_tables s
  on s.schemaname = n.nspname
 and s.relname = c.relname
where n.nspname = 'public'
  and c.relkind in ('r','p','v','m','f')
  and (
    c.relname ilike '%loc%'
    or c.relname ilike '%reservation%'
    or c.relname ilike '%booking%'
  )
order by c.relname;

-- 03. Colonnes réelles.
select
  '03_COLONNES' as section,
  cols.table_name,
  cols.ordinal_position,
  cols.column_name,
  cols.data_type,
  cols.udt_name,
  cols.is_nullable,
  cols.column_default
from information_schema.columns cols
where cols.table_schema = 'public'
  and (
    cols.table_name ilike '%loc%'
    or cols.table_name ilike '%reservation%'
    or cols.table_name ilike '%booking%'
  )
order by cols.table_name, cols.ordinal_position;

-- 04. Contraintes.
select
  '04_CONTRAINTES' as section,
  rel.relname as table_name,
  con.conname as constraint_name,
  case con.contype
    when 'p' then 'PRIMARY KEY'
    when 'u' then 'UNIQUE'
    when 'f' then 'FOREIGN KEY'
    when 'c' then 'CHECK'
    when 'x' then 'EXCLUSION'
    else con.contype::text
  end as constraint_type,
  pg_get_constraintdef(con.oid, true) as definition
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace n on n.oid = rel.relnamespace
where n.nspname = 'public'
  and (
    rel.relname ilike '%loc%'
    or rel.relname ilike '%reservation%'
    or rel.relname ilike '%booking%'
  )
order by rel.relname, con.conname;

-- 05. Index réels.
select
  '05_INDEX' as section,
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and (
    tablename ilike '%loc%'
    or tablename ilike '%reservation%'
    or tablename ilike '%booking%'
  )
order by tablename, indexname;

-- 06. État RLS.
select
  '06_RLS' as section,
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r','p')
  and (
    c.relname ilike '%loc%'
    or c.relname ilike '%reservation%'
    or c.relname ilike '%booking%'
  )
order by c.relname;

-- 07. Politiques RLS.
select
  '07_POLITIQUES' as section,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and (
    tablename ilike '%loc%'
    or tablename ilike '%reservation%'
    or tablename ilike '%booking%'
  )
order by tablename, policyname;

-- 08. Triggers.
select
  '08_TRIGGERS' as section,
  event_object_table as table_name,
  trigger_name,
  action_timing,
  event_manipulation,
  action_statement
from information_schema.triggers
where trigger_schema = 'public'
  and (
    event_object_table ilike '%loc%'
    or event_object_table ilike '%reservation%'
    or event_object_table ilike '%booking%'
  )
order by event_object_table, trigger_name, event_manipulation;

-- 09. Droits sur les tables et vues.
select
  '09_DROITS_TABLES' as section,
  grantee,
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon','authenticated','public')
  and (
    table_name ilike '%loc%'
    or table_name ilike '%reservation%'
    or table_name ilike '%booking%'
  )
order by table_name, grantee, privilege_type;

-- 10. Droits d'exécution sur les fonctions utiles.
select
  '10_DROITS_FONCTIONS' as section,
  grantee,
  routine_name,
  privilege_type
from information_schema.routine_privileges
where specific_schema = 'public'
  and grantee in ('anon','authenticated','public')
  and (
    routine_name ilike '%loc%'
    or routine_name ilike '%reservation%'
    or routine_name ilike '%booking%'
    or routine_name in (
      'digiy_verify_pin',
      'digiy_has_access',
      'digiy_has_module_access_from_abos'
    )
  )
order by routine_name, grantee;

-- 11. Résumé des éléments appelés par le code PRO LOC.
select
  '11_RESUME' as section,
  to_regprocedure('public.digiy_verify_pin(text,text,text)') is not null
    as verify_pin_text_text_text,
  to_regprocedure('public.digiy_has_access(text,text)') is not null
    as has_access_text_text,
  to_regprocedure('public.digiy_has_module_access_from_abos(text,text)') is not null
    as abos_access_text_text,
  to_regprocedure('public.digiy_loc_public_room_by_slug(text)') is not null
    as public_room_by_slug_text,
  to_regprocedure('public.digiy_loc_reservations_by_slug(text)') is not null
    as reservations_by_slug_text,
  to_regprocedure('public.digiy_loc_get_reservations_by_slug(text)') is not null
    as get_reservations_by_slug_text,
  to_regprocedure('public.digiy_loc_reservations_for_slug(text)') is not null
    as reservations_for_slug_text,
  to_regclass('public.digiy_loc_public_fiches') is not null
    as public_fiches_present,
  to_regclass('public.digiy_loc_rooms') is not null
    as rooms_present,
  to_regclass('public.loc_rooms') is not null
    as legacy_rooms_present;

rollback;
