-- ============================================================
-- 05_app.sql — compléments nécessaires à l'application
-- À exécuter UNE FOIS dans le SQL Editor de Supabase, après 01 → 04.
-- ============================================================

-- ========== COLONNES SUPPLÉMENTAIRES ==========
-- modified_at : ticket modifié après envoi (badge « modifié » au bar)
alter table public.tickets add column if not exists modified_at timestamptz;
-- position : ordre des lignes dans un ticket
alter table public.ticket_items add column if not exists position int not null default 0;

-- ========== RÈGLES DE CHANGEMENT DE STATUT (hors admin) ==========
-- La RLS ne peut pas comparer ancien/nouveau statut : ce trigger le fait.
create or replace function public.check_ticket_transition()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  r public.user_role := public.my_role();
  t text := old.status::text || '>' || new.status::text;
begin
  -- admin ou appel système (clé secrète) : tout est permis
  if r is null or r = 'admin' then
    return new;
  end if;

  if new.waiter_id is distinct from old.waiter_id then
    raise exception 'Impossible de changer le serveur d''un ticket';
  end if;

  if new.status = old.status then
    if r = 'serveur' and old.status in ('brouillon', 'envoye') then
      return new;
    end if;
    raise exception 'Ce ticket ne peut plus être modifié (statut : %)', old.status;
  end if;

  if r = 'bar' and t in ('envoye>en_preparation', 'en_preparation>pret', 'envoye>pret') then
    return new;
  end if;

  if r = 'serveur' and t in (
    'brouillon>envoye', 'brouillon>annule',
    'envoye>annule', 'en_preparation>annule', 'pret>annule',
    'envoye>servi', 'en_preparation>servi', 'pret>servi'
  ) then
    return new;
  end if;

  raise exception 'Changement de statut non autorisé (% → %)', old.status, new.status;
end;
$$;

drop trigger if exists tickets_check_transition on public.tickets;
create trigger tickets_check_transition
  before update on public.tickets
  for each row execute function public.check_ticket_transition();

-- ========== ENREGISTREMENT ATOMIQUE D'UN TICKET ==========
-- Remplace toutes les lignes d'un ticket en une seule transaction
-- (le bar ne voit jamais un ticket à moitié écrit).
-- Les prix sont copiés côté serveur : prix d'origine pour une ligne existante,
-- prix actuel du menu pour une nouvelle ligne.
-- p_items : [{ "product_id": "...", "quantity": 2, "note": "sans glaçons" }, ...]
create or replace function public.save_ticket(
  p_ticket_id uuid,
  p_note text,
  p_items jsonb,
  p_send boolean default false
)
returns void
language plpgsql
security invoker set search_path = ''
as $$
declare
  v_ticket public.tickets;
  v_items jsonb;
begin
  select * into v_ticket from public.tickets where id = p_ticket_id for update;
  if not found then
    raise exception 'Ticket introuvable';
  end if;

  if public.my_role() is distinct from 'admin' and (
    v_ticket.waiter_id <> (select auth.uid())
    or v_ticket.status not in ('brouillon', 'envoye')
  ) then
    raise exception 'Ce ticket ne peut plus être modifié (statut : %)', v_ticket.status;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'product_id', p.id,
      'product_name', coalesce(o.product_name, p.name),
      'unit_price_cents', coalesce(o.unit_price_cents, p.price_cents),
      'quantity', n.quantity,
      'note', n.note,
      'position', n.ord
    ) order by n.ord), '[]'::jsonb)
  into v_items
  from (
    select (e->>'product_id')::uuid as product_id,
           (e->>'quantity')::int as quantity,
           nullif(btrim(coalesce(e->>'note', '')), '') as note,
           ord
    from jsonb_array_elements(p_items) with ordinality as x(e, ord)
  ) n
  join public.products p on p.id = n.product_id
  left join lateral (
    select ti.product_name, ti.unit_price_cents
    from public.ticket_items ti
    where ti.ticket_id = p_ticket_id and ti.product_id = n.product_id
    limit 1
  ) o on true
  where n.quantity > 0;

  delete from public.ticket_items where ticket_id = p_ticket_id;

  insert into public.ticket_items (ticket_id, product_id, product_name, unit_price_cents, quantity, note, position)
  select p_ticket_id,
         (x->>'product_id')::uuid,
         x->>'product_name',
         (x->>'unit_price_cents')::int,
         (x->>'quantity')::int,
         x->>'note',
         (x->>'position')::int
  from jsonb_array_elements(v_items) x;

  update public.tickets
  set note = nullif(btrim(coalesce(p_note, '')), ''),
      status = case when p_send and status = 'brouillon' then 'envoye'::public.ticket_status else status end,
      modified_at = case when status = 'envoye' and not p_send then now() else modified_at end
  where id = p_ticket_id;
end;
$$;

grant execute on function public.save_ticket(uuid, text, jsonb, boolean) to authenticated;
