# Shared household expense tracker

Installable PWA on **Vercel (Hobby)** with **Supabase (Free)**. People create an account with email and password. After sign-in, **everyone sees the same expenses**.

## 1. Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste [`supabase/schema.sql`](supabase/schema.sql), and run it.
3. **Authentication → Providers → Email**: leave Email enabled.
4. **Authentication → Providers → Email → Confirm email**: turn **off** so household members can sign up without clicking a mail link.
5. **Authentication → URL configuration**
   - Site URL: `http://localhost:3000` while developing, then your `https://….vercel.app` URL after deploy.
   - Redirect URLs: both `http://localhost:3000/**` and `https://YOUR-APP.vercel.app/**`.
6. **Project Settings → API**: copy **Project URL** and **anon public** key.

Never put the **service_role** key in this app.

## 2. Local run

```bash
cp .env.example .env.local
```

Fill in the two `NEXT_PUBLIC_SUPABASE_*` values, then:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Create an account, add an expense (date defaults to today), switch months, and export Excel.

## 3. Deploy on Vercel (free)

1. Push this repo to GitHub.
2. Import the project in [Vercel](https://vercel.com).
3. Add the same two environment variables.
4. Deploy, then set the Supabase Site URL and redirect URLs to the Vercel origin.

Share the Vercel URL. Anyone who creates an account can see and edit the shared list. On a phone, use **Add to Home Screen** so it opens like an app.

## Features

- Email + password sign up / sign in / sign out / forgot password
- Shared board (not private per user)
- Date, amount (INR), reason, paid by, category, notes
- Date defaults to today
- Monthly split and month picker
- Export Excel (Expenses + Monthly split sheets)
- Progressive Web App (standalone, install prompt / iOS hint)
