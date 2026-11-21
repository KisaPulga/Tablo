-- ============================================================
-- 11_plan_portrait.sql — plan de salle toujours en portrait allongé (9:16)
-- À exécuter UNE FOIS dans le SQL Editor de Supabase (le relancer ne fait rien).
--
-- Le plan devient plus haut : on étale les tables sur toute la hauteur
-- (leur centre garde la même position en %), sans les déformer
-- (leur hauteur en % est réduite pour garder la même forme à l'écran).
-- ============================================================

do $$
declare
  old_aspect real;
  new_aspect constant real := 9.0 / 16.0;
  f real;
begin
  select nullif(value, '')::real into old_aspect from public.settings where key = 'floor_aspect';
  if old_aspect is null or old_aspect <= 0 then
    old_aspect := 3.0 / 4.0; -- ancien format par défaut (portrait 3:4)
  end if;

  if abs(old_aspect - new_aspect) > 0.001 then
    f := new_aspect / old_aspect; -- < 1 : le plan est plus haut, donc une même taille fait moins de %

    update public.tables
    set height = greatest(4, least(100, height * f)),
        pos_y = case when pos_y is null then null
                     else least(100 - greatest(4, least(100, height * f)),
                                greatest(0, (pos_y + height / 2) - greatest(4, least(100, height * f)) / 2))
                end;

    insert into public.settings (key, value, updated_at)
    values ('floor_aspect', new_aspect::text, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;
end $$;
