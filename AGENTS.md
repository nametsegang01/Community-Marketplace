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
- `src/App.tsx` contains the buyer, seller, and admin views, shared marketplace types, and UI state/actions.
- `src/supabase.ts` initializes the Supabase client from `VITE_SUPABASE_*` environment variables and provides authentication, realtime collection, and marketplace data helpers.
- `src/index.css` contains the global theme and current component styling. Tailwind CSS v4 is configured, but most existing UI styles are handwritten CSS; follow the surrounding style rather than converting unrelated UI to utilities.
- `index.html` is the document shell and default metadata.
- `vite.config.ts` configures React, Tailwind, and Figma Make plugins. It imports `.figma/make/site.json`; preserve this integration when changing build configuration.
- `.env.example` documents the Supabase client configuration. Publishable keys are intended for browser use; never commit secret or service-role keys.

## App Behavior

- Supabase Authentication and Postgres provide account access and marketplace data. Run `supabase/schema.sql` in the project SQL Editor to create the tables, row-level security policies, and database functions.
- Buyer order history uses the demo buyer label `You`; the admin Buyers view is derived from existing orders.
- Orders are cash-only prototype flows. The frontend and publishable client key are not substitutes for row-level security and trusted database functions.

## Implementation Notes

- Keep React components, TypeScript types, and marketplace actions consistent with the patterns in `src/App.tsx` unless the task calls for extracting them.
- Keep global styles and design tokens in `src/index.css`; preserve responsive behavior and existing class naming where practical.
- When changing persistence, keep the Supabase row-level security policies and SQL functions consistent with client behavior.
- Run `pnpm build` after code changes. There is no test script currently defined in `package.json`.
