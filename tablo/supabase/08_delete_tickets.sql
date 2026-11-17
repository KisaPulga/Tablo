-- ============================================================
-- 08_delete_tickets.sql — suppression définitive de tickets (admin uniquement)
-- À exécuter UNE FOIS dans le SQL Editor de Supabase.
-- Retour arrière :
--   drop function if exists public.delete_ticket(uuid);
--   drop function if exists public.delete_all_tickets();
-- ============================================================

-- Supprime un ticket (et ses lignes, en cascade). Erreur claire si ce n'est pas possible.
create or replace function public.delete_ticket(p_ticket_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  r public.user_role := public.my_role();
begin
  if r is distinct from 'admin' then
    raise exception 'Suppression réservée à l''admin (ton rôle : %)', coalesce(r::text, 'aucun');
  end if;

  delete from public.tickets where id = p_ticket_id;
  if not found then
    raise exception 'Ticket introuvable (déjà supprimé ?)';
  end if;
end;
$$;

-- Supprime TOUS les tickets ; renvoie le nombre de tickets supprimés.
create or replace function public.delete_all_tickets()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  r public.user_role := public.my_role();
  n integer;
begin
  if r is distinct from 'admin' then
    raise exception 'Suppression réservée à l''admin (ton rôle : %)', coalesce(r::text, 'aucun');
  end if;

  delete from public.tickets where true;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.delete_ticket(uuid) from public, anon;
revoke execute on function public.delete_all_tickets() from public, anon;
grant execute on function public.delete_ticket(uuid) to authenticated;
grant execute on function public.delete_all_tickets() to authenticated;

notify pgrst, 'reload schema';
