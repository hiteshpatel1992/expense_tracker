# Organization P&L tracker

Installable PWA on **Vercel** with **Supabase**. Multiple companies, each with its own income/expense ledger, opening balance, and closing (bank) balance. Public sign-up is off; only an admin can add users.

## 1. Supabase

1. Apply migrations (creates companies, entries, admin lock for `nirav@thefitway.io`):

```bash
npx supabase login
npx supabase link --project-ref xxnwuiojemvkcjtapgst
npx supabase db push --linked
```

2. **Authentication → Providers → Email**: leave Email on.
3. **Authentication → Providers → Email**: turn **off** “Enable new user sign ups”.
4. **Authentication → Users**: create `nirav@thefitway.io` (or confirm that user exists). The migration marks that user as the protected admin.
5. **Project Settings → API**: copy **Project URL**, **anon public** key, and **service_role** key.
6. **Authentication → URL configuration**: Site URL = your Vercel origin (and `http://localhost:3000` locally).

Never put the **service_role** key in client code or git. Only `SUPABASE_SERVICE_ROLE_KEY` on the server / Vercel.

## 2. Local run

```bash
cp .env.example .env.local
```

Fill in the three values, then:

```bash
npm install
npm run dev
```

Sign in as the admin, add companies (set opening bank balance), add other users from **Users**.

## 3. Deploy

Set the same three env vars on Vercel and redeploy. Then sign in, add companies, and enter income/expense.

## Features

- Independent P&L per company, with multiple bank accounts
- Consolidated company totals plus a summary for each bank account
- Income and expense, each tagged to a bank account, with date (defaults to today), reason, category, notes
- Shared categories you can add, rename, or delete from **Categories**
- Closing balance = opening + income − expenses, per account and for the company
- Who added a record, who last edited it, and when; full edit history
- Only admins can add users and delete companies, bank accounts, and ledger rows
- Excel export: Entries, Monthly split, Bank accounts, Balances
- PWA (Add to Home Screen)
