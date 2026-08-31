-- Multiple bank accounts per company.
-- Existing companies get a "Main account" from the old company opening balance.

create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  opening_balance numeric(14, 2) not null default 0,
  notes text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

create unique index if not exists bank_accounts_company_name_idx
  on public.bank_accounts (company_id, (lower(name)));

create index if not exists bank_accounts_company_idx
  on public.bank_accounts (company_id, name);

alter table public.entries
  add column if not exists bank_account_id uuid references public.bank_accounts (id);

insert into public.bank_accounts (company_id, name, opening_balance, created_by, updated_by, updated_at)
select
  c.id,
  'Main account',
  c.opening_balance,
  c.created_by,
  c.updated_by,
  now()
from public.companies c
where not exists (
  select 1 from public.bank_accounts b where b.company_id = c.id
);

update public.entries e
set bank_account_id = b.id
from public.bank_accounts b
where e.bank_account_id is null
  and b.company_id = e.company_id
  and b.id = (
    select b2.id
    from public.bank_accounts b2
    where b2.company_id = e.company_id
    order by b2.created_at
    limit 1
  );

alter table public.entries
  alter column bank_account_id set not null;

create index if not exists entries_account_idx
  on public.entries (bank_account_id)
  where deleted_at is null;

alter table public.bank_accounts enable row level security;

drop policy if exists "bank accounts read" on public.bank_accounts;
drop policy if exists "bank accounts write" on public.bank_accounts;
drop policy if exists "bank accounts update" on public.bank_accounts;
drop policy if exists "bank accounts delete admin" on public.bank_accounts;

create policy "bank accounts read"
  on public.bank_accounts for select
  to authenticated
  using (true);

create policy "bank accounts write"
  on public.bank_accounts for insert
  to authenticated
  with check (true);

create policy "bank accounts update"
  on public.bank_accounts for update
  to authenticated
  using (true)
  with check (true);

create policy "bank accounts delete admin"
  on public.bank_accounts for delete
  to authenticated
  using (public.is_admin());

grant select, insert, update, delete on public.bank_accounts to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.bank_accounts;
exception
  when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
