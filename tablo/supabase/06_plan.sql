-- ============================================================
-- 06_plan.sql — plan de salle
-- À exécuter UNE FOIS dans le SQL Editor de Supabase.
-- ============================================================

-- Position et taille de chaque table sur le plan, en % du plan.
-- pos_x / pos_y = coin haut-gauche ; null = table pas encore placée.
alter table public.tables
  add column if not exists pos_x real,
  add column if not exists pos_y real,
  add column if not exists width real not null default 16,
  add column if not exists height real not null default 10,
  add column if not exists shape text not null default 'rect';

alter table public.tables drop constraint if exists tables_shape_check;
alter table public.tables add constraint tables_shape_check check (shape in ('rect', 'round'));

-- Réglages globaux : format du plan (clé 'floor_aspect' = largeur / hauteur)
create table if not exists public.settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);
alter table public.settings enable row level security;
grant select, insert, update, delete on public.settings to authenticated;

drop policy if exists "settings: lecture" on public.settings;
create policy "settings: lecture" on public.settings for select to authenticated
  using (public.my_role() is not null);

drop policy if exists "settings: admin écrit" on public.settings;
create policy "settings: admin écrit" on public.settings for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- Nettoyage : l'image de fond du plan n'est plus utilisée
delete from public.settings where key = 'floor_plan';

-- Recharge le cache de l'API pour voir les nouvelles colonnes tout de suite
notify pgrst, 'reload schema';
