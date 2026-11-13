# Molelema Rise Community Marketplace

React + TypeScript + Vite prototype for a community marketplace serving Molelema Village and nearby Taung communities. Follow the existing app patterns and keep changes scoped to the requested behavior.

## Commands

- `pnpm install` installs dependencies from `pnpm-lock.yaml`.
- `pnpm dev` starts the Vite development server. The configured default port is 8443; `PORT` can override it, and `strictPort` is enabled.
- `pnpm build` creates the production build in `dist/`.
- `pnpm preview` serves the production build locally.
- `pnpm format` runs oxfmt.

## Project Map

- `src/main.tsx` mounts the app and imports global styles.
- `src/App.tsx` contains the buyer, seller, and admin views, shared marketplace types, sample records, and UI state/actions.
- `src/firebase.ts` initializes Firebase from `VITE_FIREBASE_*` environment variables and provides Firestore collection, save, seed, and removal helpers.
- `src/index.css` contains the global theme and current component styling. Tailwind CSS v4 is configured, but most existing UI styles are handwritten CSS; follow the surrounding style rather than converting unrelated UI to utilities.
- `index.html` is the document shell and default metadata.
- `vite.config.ts` configures React, Tailwind, and Figma Make plugins. It imports `.figma/make/site.json`; preserve this integration when changing build configuration.
- `.env.example` documents the optional Firebase client configuration. Never commit populated local environment files or credentials.

## App Behavior

- With all required Firebase variables configured, Firestore snapshots provide collection updates and writes go to Firestore. Without Firebase configuration, the app uses sample data and caches products, sellers, and orders in browser `localStorage`.
- The role switch and seller selector are demo controls, not authentication or authorization. Do not treat UI visibility as a security boundary.
- Buyer order history uses the demo buyer label `You`; the admin Buyers view is derived from existing orders.
- Orders are cash-only prototype flows. The frontend and Firestore client configuration are not substitutes for trusted server-side authorization or restrictive Firestore Security Rules.

## Implementation Notes

- Keep React components, TypeScript types, and marketplace actions consistent with the patterns in `src/App.tsx` unless the task calls for extracting them.
- Keep global styles and design tokens in `src/index.css`; preserve responsive behavior and existing class naming where practical.
- When changing persistence, account for both configured Firestore and local fallback behavior.
- Run `pnpm build` after code changes. There is no test script currently defined in `package.json`.
