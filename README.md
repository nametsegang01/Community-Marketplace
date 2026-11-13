# Molelema Rise — Community Marketplace

A React, TypeScript, and Vite community marketplace using Firebase Authentication and Cloud Firestore.

## Local setup

1. Install Node.js and pnpm, then run `pnpm install`.
2. In Firebase Console, open the existing project and enable **Authentication → Sign-in method → Email/Password**.
3. Create or open the project's Cloud Firestore database.
4. Copy `.env.example` to `.env.local` and fill in the existing Firebase project's web-app configuration. Do not replace the Firebase project or put service-account credentials in this client app.
5. Publish the rules from [`firestore.rules`](./firestore.rules) in **Firestore Database → Rules** before testing registration.
6. Run `pnpm dev`; restart Vite after changing `.env.local`.
7. Run `pnpm build` before deployment.

The app does not use Firebase Storage. Product pictures selected from a device are resized and saved as compressed image data in Firestore product documents.

## Authentication and roles

- Customers register publicly and receive an active customer profile at `users/{uid}`.
- Seller registration creates a pending seller application. An administrator must approve it before seller tools are available.
- There is no public administrator registration. Admin access is granted only by an authorized Firebase Console administrator.
- Login uses Firebase's browser-local persistence by default. Unchecking “Keep me logged in” uses session persistence.
- Profile recovery is available at `/complete-profile` if Firebase Authentication created an account but the Firestore profile write failed. The recovery flow reuses the signed-in UID; it does not create another Authentication account.
- Customers can only read their own orders; approved sellers can only read their own shop orders; administrators can review marketplace records. Firestore rules enforce access as well as frontend route guards.

## Securely provision the first administrator

1. Register a normal customer account in the app and confirm that it can sign in.
2. In Firebase Console → Authentication, locate that account and copy its UID.
3. In Firestore Console, open `users/{uid}` and change `role` from `customer` to `admin`; make sure `accountStatus` is `active`. Do not change the document ID or UID.
4. Sign out and sign back in. The account should now open the admin dashboard.

Only users with Firebase Console access should perform this first role change. Never add an admin creation form, password, or service-account key to the frontend. After bootstrap, the published rules allow admins—but not users—to change roles and seller approvals.

## Firestore collections

- `users/{uid}` — private profile and role/status.
- `products/{productId}` — public listings and stock.
- `sellers/{uid}` — approved public shop listings.
- `orders/{orderId}` — customer/seller order data, restricted by owner and role.
- `categories/{categoryId}` — public category names; only administrators can change them.

An administrator should create the first seller/shop and products through a seller application and approval. Existing product/seller documents are not automatically copied or seeded by this authenticated app. Review any existing documents before publishing the rules; older orders without `buyerId` and UID-based `sellerId` will not appear in protected account history.

## Testing

1. Register a customer, verify its Authentication user and matching `users/{uid}` profile in Firebase Console, then sign in and place an order.
2. Register a second account as a seller. Confirm it lands on the pending-approval page and cannot access `/seller`.
3. Sign in as an administrator and approve the seller in the Sellers tab.
4. Sign in as that seller, add a product, then sign back in as a customer and place an order.
5. Confirm stock decreases, the order appears in the buyer's history and seller's incoming orders, and only the owner/admin can read the relevant order.
6. As buyer, test receipt/payment confirmation; as seller, confirm cash received. Completion stays unavailable until both confirmations are true.
7. Test forgot-password, logout, persistent and session login, direct-route redirects, and suspended/rejected account handling.

The frontend checks are for user experience. The accompanying Firestore rules are the authorization boundary. Verify them in the Firebase Rules Playground or Emulator before launch, especially when evolving the document schema.

## Prototype constraints

The project is a marketplace prototype: it has no payment processor, no cloud image storage, and no server-side Functions. Order/payment acknowledgements are self-reported. The demo seller picker has been removed; seller identity comes from the authenticated profile. Protect any production deployment with appropriate Firebase project settings and continue to review the rules as the data model changes.
