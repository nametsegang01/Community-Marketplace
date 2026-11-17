# Molelema Rise Community Marketplace

A community marketplace prototype for Molelema Village and nearby Taung communities. Customers can discover local goods, place cash orders, and follow order progress. Sellers can apply to list their products, and administrators can review applications and manage the marketplace.

## What the app includes

- **Customers:** browse and search listings, add products to a basket, choose yard pickup or gate delivery, place cash-only orders, and view order details and tracking.
- **Sellers:** submit a shop application with product details and photos, then manage listings and update order progress after approval.
- **Administrators:** review seller applications, manage customers, sellers, products and categories, and oversee orders.
- **Authentication and data:** Supabase Auth and Postgres, with row-level security and database functions for protected marketplace actions.

Seller accounts require administrator approval before seller tools and submitted listings become available. Payments are cash-only; this prototype does not process online payments.

## Technology

- React 19 and TypeScript
- Vite
- Supabase Auth, Postgres, and Realtime
- Tailwind CSS 4 alongside the project’s existing CSS

## Run locally

### Requirements

- Node.js compatible with the installed Vite version
- pnpm
- A Supabase project

### Configure Supabase

1. Create a local `.env.local` file in the project root. Add your own Supabase project URL and **publishable** key:

   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
   ```

   Do not put a Supabase secret or `service_role` key in a `VITE_` variable or commit it to GitHub. Keep `.env.local` private.

2. In your Supabase project’s **SQL Editor**, run [`supabase/schema.sql`](./supabase/schema.sql) to create the tables, row-level security policies, signup trigger, database functions, and Realtime setup.
3. Add your local app URL to Supabase’s authentication redirect allowlist. The default development URL is `http://localhost:8443`.
4. For this testing prototype, disable **Confirm email** in the Supabase email provider settings if you want new test accounts to sign in without email verification. This setting is managed in the Supabase Dashboard, not by the app. Before production, enable confirmation and review the seller approval SQL and all access policies.
5. Install dependencies and start the development server:

   ```sh
   pnpm install
   pnpm dev
   ```

Vite uses port `8443` by default. To create a production build, run:

```sh
pnpm build
```

## Accounts and roles

Anyone can register as a customer or submit a seller application. Seller applications and submitted products are reviewed by an administrator. The public registration form does not allow users to create administrator accounts.

To bootstrap the first administrator in a new project, a trusted project owner must first create a regular account, then promote that account from the Supabase SQL Editor. Replace the placeholder with that account’s email:

```sql
update public.users
set role = 'admin', account_status = 'active'
where uid = (
  select id
  from auth.users
  where email = 'YOUR_ADMIN_EMAIL'
);
```

Only run this as a trusted Supabase project owner. Sign out and back in after the change. Never give administrator access to an account you do not control.

## Data and security notes

- Supabase row-level security and database functions are the access-control boundary; frontend role checks are not a security boundary.
- Order placement validates stock and records the order transactionally in the database.
- Orders are cash-only. The app does not collect, store, or transfer card or online-payment details.
- Product photos are compressed in the browser and saved with marketplace data; the current prototype does not use Supabase Storage.
- Existing data is not imported automatically when configuring a new Supabase project.
- Never commit `.env.local`, passwords, access tokens, secret keys, or service-role keys.

## Before production

Enable email confirmation, configure the production site URL and redirect allowlist, and review the SQL policies and seller approval rules for the intended production workflow. Configure a trusted email delivery provider and test account recovery, seller approval, order tracking, stock updates, and administrator access.
