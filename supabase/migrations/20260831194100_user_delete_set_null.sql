-- Keep company/entry history when a user is deleted.
-- profiles.id still cascades from auth.users.

alter table public.companies
  drop constraint if exists companies_created_by_fkey,
  drop constraint if exists companies_updated_by_fkey;
alter table public.companies
  add constraint companies_created_by_fkey
    foreign key (created_by) references auth.users (id) on delete set null,
  add constraint companies_updated_by_fkey
    foreign key (updated_by) references auth.users (id) on delete set null;

alter table public.bank_accounts
  drop constraint if exists bank_accounts_created_by_fkey,
  drop constraint if exists bank_accounts_updated_by_fkey;
alter table public.bank_accounts
  add constraint bank_accounts_created_by_fkey
    foreign key (created_by) references auth.users (id) on delete set null,
  add constraint bank_accounts_updated_by_fkey
    foreign key (updated_by) references auth.users (id) on delete set null;

alter table public.entries
  drop constraint if exists entries_created_by_fkey,
  drop constraint if exists entries_updated_by_fkey,
  drop constraint if exists entries_deleted_by_fkey;
alter table public.entries
  add constraint entries_created_by_fkey
    foreign key (created_by) references auth.users (id) on delete set null,
  add constraint entries_updated_by_fkey
    foreign key (updated_by) references auth.users (id) on delete set null,
  add constraint entries_deleted_by_fkey
    foreign key (deleted_by) references auth.users (id) on delete set null;

alter table public.entry_edits
  drop constraint if exists entry_edits_edited_by_fkey;
alter table public.entry_edits
  add constraint entry_edits_edited_by_fkey
    foreign key (edited_by) references auth.users (id) on delete set null;

alter table public.categories
  drop constraint if exists categories_created_by_fkey,
  drop constraint if exists categories_updated_by_fkey;
alter table public.categories
  add constraint categories_created_by_fkey
    foreign key (created_by) references auth.users (id) on delete set null,
  add constraint categories_updated_by_fkey
    foreign key (updated_by) references auth.users (id) on delete set null;
