-- ========== NETTOYAGE (au cas où une partie aurait déjà été créée) ==========
drop trigger if exists on_auth_user_created on auth.users;
drop table if exists public.ticket_items, public.tickets, public.products,
  public.categories, public.tables, public.profiles cascade;
drop function if exists public.handle_new_user();
drop function if exists public.set_ticket_timestamps();
drop type if exists public.ticket_status;
drop type if exists public.user_role;

-- ========== TYPES ==========
create type public.user_role as enum ('admin', 'serveur', 'bar');
create type public.ticket_status as enum ('brouillon', 'envoye', 'en_preparation', 'pret', 'servi', 'annule');

-- ========== PROFILS ==========
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role public.user_role not null default 'serveur',
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- ========== TABLES DU RESTAURANT ==========
create table public.tables (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.tables enable row level security;

-- ========== MENU ==========
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0
);
alter table public.categories enable row level security;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  price_cents int not null check (price_cents >= 0),
  is_available boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.products enable row level security;

-- ========== TICKETS ==========
create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity,
  table_id uuid not null references public.tables(id) on delete restrict,
  waiter_id uuid not null references public.profiles(id) on delete restrict,
  status public.ticket_status not null default 'brouillon',
  note text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  preparing_at timestamptz,
  ready_at timestamptz,
  served_at timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.tickets enable row level security;

create table public.ticket_items (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price_cents int not null check (unit_price_cents >= 0),
  quantity int not null check (quantity > 0),
  note text,
  created_at timestamptz not null default now()
);
alter table public.ticket_items enable row level security;

-- ========== INDEX ==========
create index tickets_table_id_idx on public.tickets (table_id);
create index tickets_waiter_id_idx on public.tickets (waiter_id);
create index tickets_status_idx on public.tickets (status);
create index ticket_items_ticket_id_idx on public.ticket_items (ticket_id);

-- ========== AUTOMATISME 1 : profil créé à chaque nouvel utilisateur ==========
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ========== AUTOMATISME 2 : heure de chaque changement de statut ==========
create or replace function public.set_ticket_timestamps()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.status is distinct from old.status then
    if new.status = 'envoye'         and new.sent_at      is null then new.sent_at      := now(); end if;
    if new.status = 'en_preparation' and new.preparing_at is null then new.preparing_at := now(); end if;
    if new.status = 'pret'           and new.ready_at     is null then new.ready_at     := now(); end if;
    if new.status = 'servi'          and new.served_at    is null then new.served_at    := now(); end if;
    if new.status = 'annule'         and new.cancelled_at is null then new.cancelled_at := now(); end if;
  end if;
  return new;
end;
$$;

create trigger tickets_timestamps
  before update on public.tickets
  for each row execute function public.set_ticket_timestamps();