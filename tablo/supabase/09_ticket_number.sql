-- ============================================================
-- 09_ticket_number.sql — numéro de ticket = plus grand numéro existant + 1
-- Si on supprime le(s) dernier(s) ticket(s), la numérotation reprend juste après
-- le plus grand numéro restant (et repart à 1 quand il n'y a plus aucun ticket).
-- Un ticket supprimé au milieu laisse un trou : les autres ne sont pas renumérotés.
-- À exécuter UNE FOIS dans le SQL Editor de Supabase.
-- Retour arrière :
--   drop trigger if exists tickets_set_number on public.tickets;
--   drop function if exists public.set_ticket_number();
--   do $$ declare m bigint; begin
--     select coalesce(max(number), 0) + 1 into m from public.tickets;
--     execute format('alter table public.tickets alter column number add generated always as identity (start with %s)', m);
--   end $$;
-- ============================================================

-- l'ancien compteur (identity) ne revient jamais en arrière : on le retire
alter table public.tickets alter column number drop identity if exists;

create or replace function public.set_ticket_number()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  -- verrou le temps de la transaction : deux tickets créés en même temps n'ont pas le même numéro
  perform pg_advisory_xact_lock(hashtext('public.tickets.number'));
  select coalesce(max(number), 0) + 1 into new.number from public.tickets;
  return new;
end;
$$;

drop trigger if exists tickets_set_number on public.tickets;
create trigger tickets_set_number
  before insert on public.tickets
  for each row execute function public.set_ticket_number();

notify pgrst, 'reload schema';
