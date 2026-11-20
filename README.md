# Molelema Rise Community Marketplace

A community marketplace prototype for Molelema Village and nearby Taung communities. Customers can discover local goods, place cash orders, and follow order progress. Sellers can apply to list their products, and administrators can review applications and manage the marketplace.

Users

- **Customers:** browse and search listings, add products to a basket, choose yard pickup or gate delivery, place cash-only orders, and view order details and tracking.
- **Sellers:** submit a shop application with product details and photos, then manage listings and update order progress after approval.
- **Administrators:** review seller applications, manage customers, sellers, products and categories, and oversee orders.
- **Authentication and data:** Supabase Auth and Postgres, with row-level security and database functions for protected marketplace actions.

Seller accounts require administrator approval before seller tools and submitted listings become available. Payments are cash-only; this prototype does not process online payments.

## Email confirmation setup

In Supabase, set **Authentication → URL Configuration → Site URL** to
`https://molelema-rise-community-marketplace.onrender.com` and add
`https://molelema-rise-community-marketplace.onrender.com/login` to the allowed
redirect URLs. For a custom domain, use that domain instead and set
`VITE_APP_URL` to its base URL in the hosting provider before rebuilding.
Keep the confirmation email template linked to Supabase's `{{ .ConfirmationURL }}`
so the requested redirect is honored.
Unconfirmed users can request another confirmation email from the login page.
