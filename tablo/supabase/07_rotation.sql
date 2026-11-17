-- ============================================================
-- 07_rotation.sql — rotation des tables sur le plan (en degrés)
-- À exécuter UNE FOIS dans le SQL Editor de Supabase.
-- Retour arrière : alter table public.tables drop column if exists rotation;
-- ============================================================

alter table public.tables add column if not exists rotation real not null default 0;

notify pgrst, 'reload schema';
