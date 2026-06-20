# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

KHS — Hackerspace Portal: a member registration and dues (aidat) tracking web app for a hackerspace.
Frontend-only SPA (Vite + Vue 3) talking directly to Supabase with the **anon key** — there is no
custom backend or Edge Functions. Deployed on Netlify.

**The user communicates in Turkish; respond in Turkish.** Code comments and UI strings are in Turkish.

## Commands

```sh
npm install         # install deps (Node ^22.18.0 || >=24.12.0)
npm run dev         # Vite dev server with HMR
npm run build       # type-check (vue-tsc) + production build, run in parallel
npm run type-check  # vue-tsc --build only
npm run preview     # preview the production build
```

There is **no test runner and no linter configured** — do not invent `npm test`/`npm run lint`.
Type-checking via `vue-tsc` is the verification gate; run `npm run type-check` after changes.
TypeScript is strict and `any` is disallowed by convention — keep things fully typed.

## Environment

Copy `.env.example` → `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
(Supabase dashboard → Settings → API). `src/lib/supabase.ts` throws on startup if either is missing.

## Architecture

**Auth & RBAC are the core of this app.** Roles (DB enum `public.app_role`):
`superadmin > admin > keyholder > member`. Every user is an `auth.users` + `public.profiles` +
`public.user_roles` row. There is **no public signup** — login only.

- `src/stores/useAuthStore.ts` (Pinia) owns session/profile/role state. `init()` runs once at app
  start: loads the session, fetches profile+role, subscribes to auth changes. `signIn` is atomic —
  if profile/role can't be fetched it signs back out rather than leaving a half-logged-in session.
  Use its getters (`isAdmin`, `isSuperadmin`, `hasRole`) for gating, not ad-hoc role checks.
- `src/router/index.ts` guards routes via `meta.requiresAuth` and `meta.allowedRoles`. The
  `beforeEach` guard `await`s `auth.init()` when not ready (prevents a refresh race), redirects
  unauthenticated users to `/login`, and sends role-denied users to `/forbidden`. Layouts split the
  tree: `AppLayout` (authenticated shell) vs `AuthLayout` (login).

**Server-side privilege logic lives in `supabase/rbac.sql`** (run manually in the Supabase SQL
Editor — not migrated automatically). Because the frontend only has the anon key, all privileged
operations go through `SECURITY DEFINER` Postgres RPCs:
- `admin_create_user`, `admin_update_user`, `admin_delete_user` — write directly to
  `auth.users`/`auth.identities` using `pgcrypto`. (This is deliberately frontend-only; it is fragile
  across GoTrue versions — the robust alternative would be a service_role Edge Function.)
- `admin_bootstrap_superadmin(email, password, full_name)` — one-time seed of the first superadmin.
- **Escalation rule (enforced in SQL AND mirrored in the UI):** only `superadmin` can manage
  `admin`/`superadmin`; `admin` can only manage `member`/`keyholder`. Users cannot change their own
  role or delete their own account. When touching role logic, keep DB and frontend (`MemberFormModal.vue`
  `availableRoles`, `MembersView.vue` `canManage`) in sync.

User management is **not a separate page** — it's consolidated into the Members (Üyeler) view:
add/edit via `MemberFormModal.vue` (a `BaseModal` that closes ONLY via ✕ / İptal — no backdrop/Esc
close, by explicit user request), delete via `ConfirmDialog.vue`.

### Supabase typing (important gotcha)

The client is `createClient<Database>(...)` with `Database` hand-maintained in `src/types/database.ts`,
kept in sync with `supabase/rbac.sql`. Two non-obvious rules — break either and every row resolves to
`never`:
1. Row types in `Database['public']['Tables'][*]['Row']` must be `type` aliases, **not** `interface`
   (interfaces lack the implicit index signature the `GenericSchema` constraint needs). So `Profile`/
   `UserRole` in `src/types/index.ts` are `type`.
2. Empty `Views`/`CompositeTypes` must be `{ [_ in never]: never }`, **not** `Record<string, never>`.

With this in place `.from()`/`.rpc()` are fully typed — no manual `.returns<T>()` generics needed.

### Styling

Tailwind CSS v4 via `@tailwindcss/vite`, CSS-first config in `src/assets/main.css` (`@theme` +
`:root`/`.dark`). Theme is class-based (`<html class="dark|light">`), toggled in the topbar, persisted
to localStorage via `useThemeStore`, with a no-FOUC inline script in `index.html`.

**Use the semantic tokens, not raw `zinc-*` shades:** `bg-base`/`bg-surface`/`bg-sidebar`/`bg-input`,
`text-content`/`text-muted`/`text-faint`, `border-line`/`divide-line`. Accent is matrix-green `#22c55e`;
mono font for IDs/dates; thin borders + backdrop-blur instead of shadows. Neutral hovers use the
theme-agnostic `bg-zinc-500/10`.

## Conventions

- Vue 3 `<script setup>` + Composition API throughout. `@/` aliases `src/`.
- Data-access logic belongs in composables (`src/composables/`, e.g. `useUserManagement.ts`), not in views.
