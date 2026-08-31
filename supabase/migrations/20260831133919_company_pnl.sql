-- Migration: company P&L schema, RLS, and protected primary admin.
-- Applied with: npx supabase db push --linked
-- Leave the old public.expenses table as-is (unused).

-- 1) Tables first (functions below reference these names).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text not null default '',
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now()
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  opening_balance numeric(14, 2) not null default 0,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  date date not null,
  amount numeric(14, 2) not null check (amount > 0),
  reason text not null,
  category text not null,
  notes text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id)
);

create table if not exists public.entry_edits (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries (id) on delete cascade,
  action text not null check (action in ('update', 'delete')),
  edited_by uuid references auth.users (id),
  edited_at timestamptz not null default now(),
  prev_date date,
  prev_type text,
  prev_amount numeric(14, 2),
  prev_reason text,
  prev_category text,
  prev_notes text
);

create index if not exists entries_company_date_idx on public.entries (company_id, date desc);
create index if not exists entries_company_live_idx on public.entries (company_id) where deleted_at is null;
create index if not exists entry_edits_entry_idx on public.entry_edits (entry_id, edited_at desc);

-- 2) Functions
create or replace function public.is_primary_admin_email(addr text)
returns boolean
language sql
immutable
as $$
  select lower(coalesce(addr, '')) = 'nirav@thefitway.io';
$$;

create or replace function public.is_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (
        role = 'admin'
        or public.is_primary_admin_email(email)
      )
  );
end;
$$;

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Primary admin stays admin forever; email cannot be changed.
  if public.is_primary_admin_email(old.email) or public.is_primary_admin_email(new.email) then
    new.email := 'nirav@thefitway.io';
    new.role := 'admin';
    return new;
  end if;
  -- SQL editor and service role have no auth.uid(); allow those updates.
  if auth.uid() is null then
    return new;
  end if;
  if new.role is distinct from old.role and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

create or replace function public.protect_primary_admin_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_primary_admin_email(old.email) then
    raise exception 'Cannot delete the primary admin.';
  end if;
  return old;
end;
$$;

create or replace function public.protect_primary_admin_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_primary_admin_email(old.email) then
    raise exception 'Cannot delete the primary admin.';
  end if;
  return old;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case
      when lower(coalesce(new.email, '')) = 'nirav@thefitway.io' then 'admin'
      else 'member'
    end
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = case
          when public.profiles.full_name = '' then excluded.full_name
          else public.profiles.full_name
        end,
        role = case
          when public.is_primary_admin_email(excluded.email) then 'admin'
          else public.profiles.role
        end;
  return new;
end;
$$;

grant execute on function public.is_admin() to authenticated;

-- 3) Triggers
drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

drop trigger if exists protect_primary_admin_profile on public.profiles;
create trigger protect_primary_admin_profile
  before delete on public.profiles
  for each row execute function public.protect_primary_admin_profile();

drop trigger if exists protect_primary_admin_auth on auth.users;
create trigger protect_primary_admin_auth
  before delete on auth.users
  for each row execute function public.protect_primary_admin_auth();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

grant execute on function public.is_primary_admin_email(text) to authenticated;

-- 4) Backfill existing auth users and promote admin
insert into public.profiles (id, email, full_name, role)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'full_name', ''),
  'member'
from auth.users u
on conflict (id) do update
  set email = excluded.email;

update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'nirav@thefitway.io');

-- 5) Row level security
alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.entries enable row level security;
alter table public.entry_edits enable row level security;

drop policy if exists "profiles read" on public.profiles;
drop policy if exists "profiles update self" on public.profiles;
drop policy if exists "companies read" on public.companies;
drop policy if exists "companies write" on public.companies;
drop policy if exists "companies write admin" on public.companies;
drop policy if exists "companies update" on public.companies;
drop policy if exists "companies update admin" on public.companies;
drop policy if exists "companies delete admin" on public.companies;
drop policy if exists "entries read" on public.entries;
drop policy if exists "entries insert" on public.entries;
drop policy if exists "entries update" on public.entries;
drop policy if exists "entries delete admin" on public.entries;
drop policy if exists "edits read" on public.entry_edits;
drop policy if exists "edits insert" on public.entry_edits;

create policy "profiles read"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles update self"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "companies read"
  on public.companies for select
  to authenticated
  using (true);

create policy "companies write"
  on public.companies for insert
  to authenticated
  with check (true);

create policy "companies update"
  on public.companies for update
  to authenticated
  using (true)
  with check (true);

create policy "companies delete admin"
  on public.companies for delete
  to authenticated
  using (public.is_admin());

create policy "entries read"
  on public.entries for select
  to authenticated
  using (true);

create policy "entries insert"
  on public.entries for insert
  to authenticated
  with check (true);

create policy "entries update"
  on public.entries for update
  to authenticated
  using (true)
  with check (true);

create policy "edits read"
  on public.entry_edits for select
  to authenticated
  using (true);

create policy "edits insert"
  on public.entry_edits for insert
  to authenticated
  with check (true);

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.companies to authenticated;
grant select, insert, update on public.entries to authenticated;
grant select, insert on public.entry_edits to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.companies;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.entries;
exception
  when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
