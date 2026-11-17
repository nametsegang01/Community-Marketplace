# Molelema Rise — Community Marketplace

A React, TypeScript, and Vite community marketplace using Supabase Authentication and Postgres.

## Set up the Supabase project

The app is configured for the Supabase project whose URL and publishable key are in `.env.example`. The URL must be the project base URL, such as `https://your-project.supabase.co`; do not append `/rest/v1`.

1. Copy `.env.example` to `.env.local`. The supplied `sb_publishable_...` key is designed for browser use. Never put a Supabase secret or `service_role` key in this app or share one in chat.
2. In the Supabase Dashboard, open **SQL Editor**, paste the contents of [`supabase/schema.sql`](./supabase/schema.sql), and run it. This creates the tables, signup profile trigger, row-level security policies, marketplace functions, and Realtime publication. If you already ran an earlier version of this setup, run the updated full script again to update seller approval and install the seller product submission flow.
3. For testing without email verification, open **Authentication → Sign In / Providers → Email** and turn off **Confirm email**. This is a Supabase project setting and cannot be changed by the frontend. New signups can then log in immediately without a confirmation email. Existing unconfirmed accounts may still need to be manually confirmed from **Authentication → Users**. The seller approval function also permits admins to approve unconfirmed test accounts. Re-enable email confirmation and restore the approval check before production. For local testing, add `http://localhost:8443` to **URL Configuration → Redirect URLs** and set the Site URL to the same address.
4. Install and start the app:

   ```sh
   pnpm install
   pnpm dev
   ```

5. Register a customer account. The `admin@example.com` below is only a placeholder: replace it with the email for the account you registered. This SQL promotes that account; it does not create an account or password. Sign in with the same email and password you registered with. To bootstrap the first administrator, use the Supabase SQL Editor:

   ```sql
   update public.users
   set role = 'admin', account_status = 'active'
   where uid = (
     select id from auth.users where email = 'nametseganglinda@gmail.com'
   );
   ```

   Only a trusted project owner should run this query. Sign out and back in after the change. Never create an administrator from a public registration form.

Run `pnpm build` before deployment.

## Database and access control

- `users` stores account profiles and roles; `sellers`, `products`, `categories`, and `orders` hold marketplace data.
- Row-level security restricts profile and order data. Customers can access their own orders, approved sellers can access their own orders, and admins can manage marketplace records.
- `place_order` checks stock and creates the order in one database transaction. Never replace it with separate browser writes.
- Seller review, account suspension, and seller removal are handled by SQL functions that verify the caller is an administrator.
- Seller applications include up to three product listings and photos. The signup trigger stores them as pending submissions, strips the image payloads from auth metadata, and publishes them only after an administrator approves the seller.
- Realtime updates are enabled by the schema script. If subscriptions do not update, check **Database → Publications** for `supabase_realtime`.

The frontend role checks are for user experience; row-level security and database functions are the access-control boundary. The publishable key is public by design, so do not weaken the policies or expose a secret/service-role key.

## Existing data and product images

Existing users, products, sellers, and orders are not copied automatically; plan a deliberate export/import if you need to keep data from an old database. The marketplace does not upload product pictures to Supabase Storage; it compresses each selected picture and stores it in the product row. A Storage bucket can be added later if you want separate image hosting.

## Testing

1. Register a customer and confirm its profile appears in `public.users`.
2. Create a second account as a seller and add one or more products. The seller approval view shows the application and its submitted listings.
3. Approve the seller and confirm the submitted products appear in the marketplace, then place a customer order and confirm stock changes and order history updates.
4. Test receipt/payment confirmation, seller order status, profile edits, password reset, and account suspension.

For production, configure your deployed site URL and redirect allowlist in Supabase Authentication, review the SQL policies for your requirements, and use a trusted email delivery provider for confirmation and password-reset messages.
