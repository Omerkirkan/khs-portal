<div align="center">

# KHS — Hackerspace Portal

**A member registration & dues (aidat) tracking portal for a hackerspace.**

Register members, import bank statements, and automatically see who paid their monthly
dues — month by month, per member.

[![Vue 3](https://img.shields.io/badge/Vue-3-42b883?logo=vuedotjs&logoColor=white)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Netlify](https://img.shields.io/badge/Deploy-Netlify-00C7B7?logo=netlify&logoColor=white)](https://www.netlify.com/)

</div>

---

> **Note on language:** the app's UI and code comments are in **Turkish** (the team's language),
> but this README is in English so anyone can contribute. You don't need to read Turkish to work
> on the code — the architecture below explains everything.

## Table of contents

- [What is this?](#what-is-this)
- [Features](#features)
- [Tech stack (with a plain-English explanation)](#tech-stack)
- [New to Vue or Supabase? Start here](#new-to-vue-or-supabase-start-here)
- [Quick start](#quick-start)
- [Supabase setup (the database)](#supabase-setup-the-database)
- [Project structure](#project-structure)
- [Available commands](#available-commands)
- [How the app works (architecture)](#how-the-app-works-architecture)
- [Deployment (Netlify)](#deployment-netlify)
- [Contributing](#contributing)
- [License](#license)

## What is this?

KHS Portal is a small **single-page web app (SPA)** that helps a hackerspace manage its members
and their monthly membership dues. It is **frontend-only**: there is no custom backend server. The
browser talks **directly to [Supabase](https://supabase.com/)** (a hosted PostgreSQL database with
authentication and row-level security) using a public **anon key**. All privileged operations run
inside the database as secure functions.

In practice, an admin can:

1. Add members (with or without a login account).
2. Import the monthly bank statement (Excel) — payments are parsed automatically.
3. Open the **Dues** page and instantly see a grid of *who paid which month*.

## Features

- 🔐 **Role-based access control** — four roles: `superadmin > admin > keyholder > member`. No public
  sign-up; login only.
- 👥 **Member registry** — members exist independently of login accounts; a login can be attached later.
- 🧾 **Bank statement import** — drop in the bank's `.xlsx` export; dues and donations are detected,
  classified, and matched to members by name.
- 📋 **Member list import** — import a detailed member roster (`Kurum Üyelik Listesi.xlsx`) with
  T.C. ID, profession, birth date, etc.; existing members are updated, new ones created.
- 📅 **Automatic dues tracking** — a per-member × per-month matrix (paid / unpaid / partial / credit),
  computed live from imported transactions. Nothing is stored or overwritten, so re-importing is safe.
- ⚙️ **Configurable tracking start** — choose the month from which dues are calculated (Settings → General).
- 🏷️ **Dues types** — named templates (e.g. *Full = ₺2000*, *Student = ₺500*) assigned to members.
- 🎁 **Donations** — donations are tracked and reported separately from dues.
- 🌗 **Dark / light theme** — class-based, persisted, no flash on load.

## Tech stack

You don't need to know all of these — here's what each one does in one line:

| Technology | What it is / does | Learn it |
| --- | --- | --- |
| [**Vue 3**](https://vuejs.org/) | The UI framework. Components are written in `.vue` files. | [Quick start](https://vuejs.org/guide/quick-start.html) |
| [**Vite**](https://vite.dev/) | Dev server + build tool. Gives instant hot-reload. | [Guide](https://vite.dev/guide/) |
| [**TypeScript**](https://www.typescriptlang.org/) | JavaScript with types. Strict mode; `any` is avoided. | [Handbook](https://www.typescriptlang.org/docs/) |
| [**Pinia**](https://pinia.vuejs.org/) | Shared state (e.g. the logged-in user). | [Intro](https://pinia.vuejs.org/introduction.html) |
| [**Vue Router**](https://router.vuejs.org/) | Maps URLs to pages and guards them by role. | [Guide](https://router.vuejs.org/guide/) |
| [**Tailwind CSS v4**](https://tailwindcss.com/) | Styling via utility classes in the markup. | [Docs](https://tailwindcss.com/docs) |
| [**Supabase**](https://supabase.com/) | Hosted PostgreSQL + Auth + row-level security. | [Docs](https://supabase.com/docs) |
| [**SheetJS (xlsx)**](https://sheetjs.com/) | Reads the Excel files in the browser. | [Docs](https://docs.sheetjs.com/) |
| [**lucide-vue-next**](https://lucide.dev/) | The icon set. | [Icons](https://lucide.dev/icons/) |

## New to Vue or Supabase? Start here

If you've written any JavaScript, you can contribute. A few mental models that unlock the codebase:

- **A page is a `.vue` file.** It has a `<script setup lang="ts">` block (the logic, in TypeScript)
  and a `<template>` block (the HTML). Pages live in [`src/views/`](src/views), reusable pieces in
  [`src/components/`](src/components).
- **Data fetching lives in "composables."** These are plain functions named `useSomething()` in
  [`src/composables/`](src/composables) that call Supabase and return reactive data. Views call them;
  views themselves don't talk to the database directly. Want to change how members are loaded? Look at
  [`src/composables/useMembers.ts`](src/composables/useMembers.ts).
- **The database is just Supabase.** A query looks like
  `supabase.from('members').select('*')`. Privileged actions (create user, etc.) call a database
  function: `supabase.rpc('admin_create_user', { ... })`. The SQL for those lives in
  [`supabase/`](supabase).
- **The whole thing is typed end-to-end.** The database shape is described in
  [`src/types/database.ts`](src/types/database.ts), so the editor autocompletes table columns and
  catches mistakes before you run anything.

That's 90% of it. Run `npm run dev`, edit a file in `src/views/`, and the browser updates instantly.

## Quick start

### Prerequisites

- **[Node.js](https://nodejs.org/)** `^22.18.0` or `>=24.12.0` (check with `node -v`).
  We recommend [nvm](https://github.com/nvm-sh/nvm) to manage versions.
- A free **[Supabase](https://supabase.com/)** account (for the database).
- **[git](https://git-scm.com/)**.

### 1. Clone and install

```sh
git clone https://github.com/Omerkirkan/khs-portal.git
cd khs-portal
npm install
```

### 2. Configure environment variables

Copy the example file and fill in your Supabase credentials:

```sh
cp .env.example .env.local
```

Then edit `.env.local` (find these in your Supabase dashboard under **Settings → API**):

```ini
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

> The **anon key is meant to be public** — it's safe to ship in a frontend. Access is protected by
> Postgres Row-Level Security. **Never** put the `service_role` key here.

### 3. Set up the database

See [Supabase setup](#supabase-setup-the-database) below — run two SQL scripts once, then create the
first admin. (Skip if you're pointing at an already-configured project.)

### 4. Run it

```sh
npm run dev
```

Open the printed URL (usually `http://localhost:5173`) and log in with the admin you created.

## Supabase setup (the database)

The app reads its schema and security rules from the SQL files in [`supabase/`](supabase). They are
**not run automatically** — paste them into the Supabase **SQL Editor** and run them (they're
idempotent, so re-running is safe).

1. **`supabase/rbac.sql`** — profiles, roles, and the privileged user-management functions.
2. **`supabase/aidat.sql`** — members, transactions, dues types, app settings, and RLS policies.

Then create the first **superadmin** (run once in the SQL Editor):

```sql
select public.admin_bootstrap_superadmin('you@example.org', 'a-strong-password', 'Your Name');
```

You can now log in. There is no public sign-up by design — admins create all other accounts from the
**Members** page.

> **Heads-up:** whenever you change the database shape in `supabase/*.sql`, mirror it in
> [`src/types/database.ts`](src/types/database.ts) so the TypeScript types stay accurate.

## Project structure

```
khs-portal/
├─ supabase/              # SQL run manually in Supabase (schema, RLS, RPC functions)
│  ├─ rbac.sql            #   roles & privileged user management
│  └─ aidat.sql           #   members, transactions, dues, settings
├─ src/
│  ├─ views/              # Pages (one per route): Dashboard, Members, Dues, Import, Settings…
│  ├─ components/
│  │  ├─ ui/              #   generic building blocks (BaseModal, ConfirmDialog…)
│  │  └─ domain/          #   app-specific pieces (MemberFormModal, DuesTypesPanel…)
│  ├─ composables/        # Data access & logic (useMembers, useDues, useMemberImport…)
│  ├─ stores/             # Pinia stores (auth session, theme)
│  ├─ router/             # Routes + role-based navigation guards
│  ├─ lib/                # Pure helpers (Excel parsers, Supabase client, name matching)
│  ├─ types/              # Domain types + the hand-maintained Supabase schema type
│  ├─ layouts/            # AppLayout (authenticated shell) and AuthLayout (login)
│  └─ assets/             # Tailwind theme & global CSS
├─ .env.example           # template for your local secrets
└─ netlify.toml           # deployment config
```

## Available commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server with hot-reload. |
| `npm run build` | Type-check **and** build for production (output in `dist/`). |
| `npm run type-check` | Run the TypeScript checker only (`vue-tsc`). |
| `npm run preview` | Preview the production build locally. |

> There is **no test runner and no linter** configured. **`npm run type-check` is the verification
> gate** — run it before committing. The project is strict TypeScript and avoids `any` by convention.

## How the app works (architecture)

- **Auth & roles are the core.** Every user is a Supabase `auth.users` row plus a `profiles` row and a
  `user_roles` row. The session, profile, and role live in a Pinia store
  ([`src/stores/useAuthStore.ts`](src/stores/useAuthStore.ts)); use its getters (`isAdmin`,
  `isSuperadmin`, `hasRole`) instead of ad-hoc checks.
- **Routes are guarded by role.** [`src/router/index.ts`](src/router/index.ts) redirects
  unauthenticated users to `/login` and role-denied users to `/forbidden`.
- **Privileged logic runs in the database.** Because the frontend only holds the anon key, actions like
  creating a user are `SECURITY DEFINER` Postgres functions called via `supabase.rpc(...)`. The
  escalation rules (who may manage whom) are enforced **both** in SQL and mirrored in the UI.
- **Dues are derived, not stored.** The Dues grid is computed live from the `transactions` table by
  matching payments to members and months. Importing a new statement just adds transactions; the grid
  reflects them on next load, and existing data is never overwritten.
- **End-to-end typing.** The Supabase client is `createClient<Database>(...)`, with `Database`
  hand-maintained in [`src/types/database.ts`](src/types/database.ts). Keep it in sync with the SQL.

## Deployment (Netlify)

The repo is deploy-ready (`netlify.toml` + SPA redirects are included).

1. **Connect the repo** in Netlify → *Add new site → Import an existing project → GitHub*. Build
   settings are picked up from `netlify.toml` (build `npm run build`, publish `dist`).
2. **Add environment variables** (*Site configuration → Environment variables*): `VITE_SUPABASE_URL`
   and `VITE_SUPABASE_ANON_KEY`. These are baked in at build time, so set them **before** the first deploy.
3. **Pin the Node version** to satisfy `engines` — add `NODE_VERSION = 22.18.0` (or add a `.nvmrc`).
4. **Run the SQL** (`rbac.sql`, then `aidat.sql`) on your production Supabase project and bootstrap a
   superadmin — same as [local setup](#supabase-setup-the-database).

## Contributing

Contributions are welcome — you don't need prior Vue experience.

1. **Fork & branch.** Create a feature branch from `main` (`git checkout -b feat/my-change`).
2. **Make your change.** Keep logic in composables, pages in views; match the surrounding style.
   Use the semantic Tailwind tokens (`bg-surface`, `text-content`, …), not raw color shades.
3. **Verify.** Run `npm run type-check` — it must pass with no errors. This is the project's only gate.
4. **Open a pull request** describing what changed and why. Screenshots help for UI changes.

A few conventions worth knowing:

- Vue 3 `<script setup>` + Composition API everywhere; `@/` is an alias for `src/`.
- UI strings and code comments are in **Turkish** — please follow suit for user-facing text.
- If you touch the database schema, update both the relevant `supabase/*.sql` file and
  `src/types/database.ts`.

## License

This project is **open source**. A `LICENSE` file (e.g. [MIT](https://choosealicense.com/licenses/mit/))
should be added by the repository owner to make the terms explicit. Until then, please open an issue
before using it in your own project.
