-- Shared household expenses. Run this in the Supabase SQL Editor once.
-- Auth: enable Email provider. For a household app, turn OFF "Confirm email"
-- so people can sign up without a mail link.

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  amount numeric(12, 2) not null check (amount > 0),
  reason text not null,
  paid_by text not null,
  category text not null,
  notes text,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists expenses_date_idx on public.expenses (date desc);
create index if not exists expenses_created_at_idx on public.expenses (created_at desc);

alter table public.expenses enable row level security;

drop policy if exists "authenticated read all" on public.expenses;
drop policy if exists "authenticated insert" on public.expenses;
drop policy if exists "authenticated update" on public.expenses;
drop policy if exists "authenticated delete" on public.expenses;

-- Every signed-in user can see and change every row (shared board).
create policy "authenticated read all"
  on public.expenses for select
  to authenticated
  using (true);

create policy "authenticated insert"
  on public.expenses for insert
  to authenticated
  with check (true);

create policy "authenticated update"
  on public.expenses for update
  to authenticated
  using (true)
  with check (true);

create policy "authenticated delete"
  on public.expenses for delete
  to authenticated
  using (true);

grant select, insert, update, delete on public.expenses to authenticated;

notify pgrst, 'reload schema';

-- Live updates when someone else adds a row (optional; skip if already added).
do $$
begin
  alter publication supabase_realtime add table public.expenses;
exception
  when duplicate_object then null;
end $$;
