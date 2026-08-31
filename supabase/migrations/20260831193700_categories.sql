-- Shared income/expense categories, seeded from the original hardcoded lists.

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('income', 'expense')),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

create unique index if not exists categories_type_name_idx
  on public.categories (type, (lower(name)));

insert into public.categories (name, type)
select v.name, v.type
from (
  values
    ('Food', 'expense'),
    ('Transport', 'expense'),
    ('Bills', 'expense'),
    ('Shopping', 'expense'),
    ('Health', 'expense'),
    ('Entertainment', 'expense'),
    ('Travel', 'expense'),
    ('Rent', 'expense'),
    ('Salaries', 'expense'),
    ('Utilities', 'expense'),
    ('Marketing', 'expense'),
    ('Other', 'expense'),
    ('Sales', 'income'),
    ('Refund', 'income'),
    ('Other income', 'income'),
    ('Transfer in', 'income')
) as v(name, type)
where not exists (
  select 1
  from public.categories c
  where c.type = v.type
    and lower(c.name) = lower(v.name)
);

alter table public.categories enable row level security;

drop policy if exists "categories read" on public.categories;
drop policy if exists "categories write" on public.categories;
drop policy if exists "categories update" on public.categories;
drop policy if exists "categories delete" on public.categories;

create policy "categories read"
  on public.categories for select
  to authenticated
  using (true);

create policy "categories write"
  on public.categories for insert
  to authenticated
  with check (true);

create policy "categories update"
  on public.categories for update
  to authenticated
  using (true)
  with check (true);

create policy "categories delete"
  on public.categories for delete
  to authenticated
  using (true);

grant select, insert, update, delete on public.categories to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.categories;
exception
  when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
