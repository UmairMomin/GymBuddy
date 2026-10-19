# GymBuddy

A workout tracker for you and one training partner. Log your own training week, and when your buddy joins a workout you both log in the same live session, side by side.

- **Solo first.** A customizable weekly split (the starter plan is Push / Pull / Legs / Push / Pull / Shoulders + Arms), routines you build from a searchable exercise catalog, and fast set logging with last-time values as placeholders.
- **Optional buddy.** Link with one friend by username. Start a workout with them on and they get an invite; you each log your own sets in real time and can correct each other's numbers (edits show who made them).
- **History.** Totals, personal records, volume and strength charts, past sessions, body metrics, CSV / JSON export. Everything is derived from your logged sets, so a correction made after a workout is reflected.
- **Phone-first PWA.** Installable on iPhone / Android, works from the gym with a flaky signal (sets are saved on the device and sync when you're back online), and a "workout in progress" bar follows you around the app.

Not included on purpose: a social feed, public profiles, leaderboards, nutrition tracking, AI plans, or a native app.

## Stack

Next.js 16 (App Router, React 19) · TypeScript (strict) · Tailwind CSS 4 · Supabase (Postgres, Auth, Realtime, Row Level Security) · Zod · Recharts · Vitest · Playwright.

## Getting started

Requirements: Node 20+, [pnpm](https://pnpm.io), and a [Supabase](https://supabase.com) project.

```bash
pnpm install
cp .env.example .env.local   # then fill in the values (see below)
pnpm dev                     # http://localhost:3000
```

### Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | Your project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `..._PUBLISHABLE_KEY`) | client + server | Public key; access is enforced by RLS |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | client | Web Push public key |
| `VAPID_PRIVATE_KEY` | server only | Web Push private key |
| `VAPID_SUBJECT` | server only | `mailto:` or `https:` contact sent to push services |
| `SUPABASE_ACCESS_TOKEN` | **local tooling only** | Used by the end-to-end suite for cleanup. Never set it on a host. |

Generate VAPID keys with `npx web-push generate-vapid-keys`. Push notifications are optional; without keys the app works and invites still arrive in-app.

### Database

The schema lives in [`supabase/migrations`](supabase/migrations). Apply the files in filename order, either with the Supabase CLI (`supabase db push`) or by pasting each one into the project's SQL editor. Sign-ups use a username and password (the app maps the username to an internal login email), so turn **off** "Confirm email" in Supabase Auth settings.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` / `pnpm build` / `pnpm start` | Develop, build, serve |
| `pnpm lint` / `pnpm type-check` | ESLint, `tsc --noEmit` |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm test:e2e` | End-to-end tests (Playwright, uses your installed Chrome) |

### Tests

- **Unit** (`src/**/*.test.ts`): merge and conflict rules, the offline outbox, history aggregation, CSV escaping.
- **Database** (`supabase/tests/*.sql`): run a file in the SQL editor; every file ends by raising `ALL_PASSED` inside a rolled-back transaction. `rls_audit.sql` checks structural security rules (RLS on every table, no anonymous access, pinned `search_path`, and so on); the others exercise the buddy, session, routine and push rules as separate simulated users.
- **End-to-end** (`e2e/`): sign-up and sign-in, a full solo workout, a two-account shared workout over the real Realtime channel, offline sync. It builds into its own folder, runs on port 3100, and creates throwaway accounts named `zz_e2e_*` in the project from `.env.local`, then deletes them (even on failure). Prefer pointing it at a separate Supabase project.

## Project layout

```
src/
  app/            routes: / (Today), /plan, /session/[id], /history, /buddy, /settings, /login, /api/export
  features/       auth · buddy · plan · workout · history · notifications
  components/     shared UI and layout
  lib/            Supabase clients, units, csv, clock, uuid, pwa helpers
supabase/
  migrations/     SQL schema, policies and functions (apply in order)
  tests/          database tests
e2e/              Playwright specs and helpers
public/           PWA manifest, icons, service worker (push only, caches nothing)
docs/             product direction, original spec, implementation plan
```

## Deploying

Any host that runs a Node server works; [Vercel](https://vercel.com) is the simplest.

1. Import the repository and set the environment variables above (everything except `SUPABASE_ACCESS_TOKEN`).
2. Deploy, then open the HTTPS URL on your phone. Installing to the home screen, push notifications and the share sheet need HTTPS (`localhost` is exempt).
3. iPhone: Safari → Share → Add to Home Screen, then Settings → Notifications → turn on. Push on iOS only works from the installed app (iOS 16.4+).

## Security notes

- Row Level Security is enabled on every table and audited by `supabase/tests/rls_audit.sql`. A buddy can only see sessions you did together; routines, solo workouts and body metrics are private.
- Multi-table writes (start / join / finish a workout, save a routine, buddy requests) go through `SECURITY DEFINER` database functions; the browser never holds a service-role key.
- The service worker has no fetch handler and caches nothing, so a stale authenticated page is never served.

## Docs

- [`docs/V2_PRODUCT_DIRECTION.md`](docs/V2_PRODUCT_DIRECTION.md): what the product is and the rules it follows (read this first).
- [`docs/MASTER_SPEC.md`](docs/MASTER_SPEC.md): the original specification (where it conflicts with the direction doc, the direction doc wins).
- [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md): milestone history and verification notes.
