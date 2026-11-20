# Molelema Rise Community Marketplace

A community marketplace prototype for Molelema Village and nearby Taung communities. Customers can discover local goods, place cash orders, and follow order progress. Sellers can apply to list their products, and administrators can review applications and manage the marketplace.

Users

- **Customers:** browse and search listings, add products to a basket, choose yard pickup or gate delivery, place cash-only orders, and view order details and tracking.
- **Sellers:** submit a shop application with product details and photos, then manage listings and update order progress after approval.
- **Administrators:** review seller applications, manage customers, sellers, products and categories, and oversee orders.
- **Authentication and data:** Supabase Auth and Postgres, with row-level security and database functions for protected marketplace actions. Buyers and sellers can exchange private, realtime messages on each placed order. Run the updated `supabase/schema.sql` in Supabase to create the chat table, policies, and realtime publication.

Seller accounts require administrator approval before seller tools and submitted listings become available. Payments are cash-only; this prototype does not process online payments.

Test


