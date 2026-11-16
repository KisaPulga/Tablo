-- ========== FONCTION : rôle de l'utilisateur connecté ==========
create or replace function public.my_role()
returns public.user_role
language sql
stable
security definer set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid())
$$;

-- ========== GRANTS : ouvrir l'accès aux utilisateurs connectés ==========
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.profiles, public.tables, public.categories,
  public.products, public.tickets, public.ticket_items
  to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.my_role() to authenticated;

-- ========== PROFILS ==========
create policy "profiles: lecture si connecté"
  on public.profiles for select to authenticated
  using (public.my_role() is not null);

create policy "profiles: admin modifie"
  on public.profiles for update to authenticated
  using (public.my_role() = 'admin')
  with check (public.my_role() = 'admin');

-- ========== TABLES, CATÉGORIES, PRODUITS : lecture pour tous, écriture admin ==========
create policy "tables: lecture" on public.tables for select to authenticated
  using (public.my_role() is not null);
create policy "tables: admin écrit" on public.tables for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

create policy "categories: lecture" on public.categories for select to authenticated
  using (public.my_role() is not null);
create policy "categories: admin écrit" on public.categories for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

create policy "products: lecture" on public.products for select to authenticated
  using (public.my_role() is not null);
create policy "products: admin écrit" on public.products for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- ========== TICKETS ==========
create policy "tickets: lecture" on public.tickets for select to authenticated
  using (public.my_role() is not null);

create policy "tickets: serveur crée les siens" on public.tickets for insert to authenticated
  with check (
    waiter_id = (select auth.uid())
    and public.my_role() in ('serveur', 'admin')
  );

create policy "tickets: serveur modifie les siens" on public.tickets for update to authenticated
  using (waiter_id = (select auth.uid()))
  with check (
    waiter_id = (select auth.uid())
    and status in ('brouillon', 'envoye', 'servi', 'annule')
  );

create policy "tickets: bar fait avancer" on public.tickets for update to authenticated
  using (public.my_role() = 'bar' and status in ('envoye', 'en_preparation', 'pret'))
  with check (status in ('en_preparation', 'pret'));

create policy "tickets: admin tout" on public.tickets for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- ========== LIGNES DE TICKET ==========
create policy "items: lecture" on public.ticket_items for select to authenticated
  using (public.my_role() is not null);

create policy "items: serveur modifie ses tickets ouverts" on public.ticket_items for all to authenticated
  using (exists (
    select 1 from public.tickets t
    where t.id = ticket_id
      and t.waiter_id = (select auth.uid())
      and t.status in ('brouillon', 'envoye')
  ))
  with check (exists (
    select 1 from public.tickets t
    where t.id = ticket_id
      and t.waiter_id = (select auth.uid())
      and t.status in ('brouillon', 'envoye')
  ));

create policy "items: admin tout" on public.ticket_items for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');