# Gym Tracker — Implementation Plan

This implementation plan breaks down the development of the Gym Tracker application into small, verifiable milestones based on [docs/MASTER_SPEC.md](file:///Users/umairmomin/Desktop/gymbuddy/docs/MASTER_SPEC.md).

> **Rule**: Do not mark a milestone complete without concrete verification evidence (type-check passes, automated tests pass, or manual verification steps recorded).

---

## Milestone 0: Repository Audit & Planning
- **Status**: COMPLETED
- **Objective**: Establish project instruction structure, inspect repository status, and set up project tracking.
- **Acceptance Criteria**:
  - [x] Create `AGENTS.md` root instruction file (< 125 lines).
  - [x] Verify `docs/MASTER_SPEC.md` is preserved and authoritative.
  - [x] Create `.agents/rules/` (`engineering.md`, `database.md`, `realtime.md`) with valid frontmatter.
  - [x] Initialize `docs/AGENT_NOTES.md` and `docs/IMPLEMENTATION_PLAN.md`.
  - [x] Initialize Git repository and standard `.gitignore`.
  - [x] Audit developer environment (Node, package manager, Supabase, Docker).
- **Blockers**: None.
- **Verification**: Git initialized on branch `main` (commit `c9078c9`), environment tooling audited, files verified.

---

## Milestone 1: Foundation
- **Status**: COMPLETED
- **Objective**: Set up core Next.js application scaffolding, Tailwind CSS, shadcn/ui, TypeScript configuration, and base layout.
- **Acceptance Criteria**:
  - [x] Next.js 16+ (App Router) initialized with strict TypeScript.
  - [x] Tailwind CSS v4, Lucide icons, class-variance-authority, and base UI primitives (`button`, `card`) configured.
  - [x] Mobile-first base application shell, dark theme, and bottom navigation bar with 44px+ touch targets.
  - [x] Linting, type-checking (`tsc --noEmit`), and production build scripts configured and passing clean.
- **Blockers**: None.
- **Verification**: `pnpm type-check` (exit code 0), `pnpm lint` (exit code 0), and `pnpm build` (exit code 0).

---

## Milestone 2: Authentication, Database & RLS
- **Status**: COMPLETED
- **Objective**: Set up Supabase project, local development migrations, authentication flow, and workspace/membership data model with RLS.
- **Acceptance Criteria**:
  - [x] Supabase Cloud environment configured with version-controlled migrations (`supabase/migrations/`).
  - [x] Core schema applied: `profiles`, `workspaces`, `workspace_members`, `exercises`, `routines`, `routine_versions`, `workout_sessions`, `session_participants`, `workout_sets`.
  - [x] Full RLS policies enabled and verified across all tables.
  - [x] Generated strict TypeScript database types directly from remote schema (`src/types/database.types.ts`).
  - [x] Supabase SSR client factories (`client.ts`, `server.ts`, `proxy.ts`) with cookie session handling.
  - [x] User authentication (Sign In, Sign Up, Sign Out) with Zod validation (`/login`).
- **Blockers**: None.
- **Verification**: PostgREST schema verification (200 OK across all 9 tables), `pnpm type-check` (exit code 0), `pnpm lint` (exit code 0), and Next.js partial prerender production build `pnpm build` (exit code 0).

---

## Milestone 3: Exercises & Routines
- **Status**: COMPLETED
- **Objective**: Implement exercise catalog management and routine definition with versioning.
- **Acceptance Criteria**:
  - [x] Pre-seeded standard exercise library (16 movements) queryable via PostgREST.
  - [x] Custom exercise creation with category, equipment, and notes (`CreateExerciseDialog`).
  - [x] Multi-exercise Routine Builder (`RoutineBuilderDialog`) with target sets, rep ranges, and rest periods.
  - [x] Routine versioning (`routines` + `routine_versions` v1 initial snapshot) persisted in database.
  - [x] Responsive layout with mobile-first cards and multi-column grid on desktop screens (`/routines`).
  - [x] Suspense streaming boundary and Zod schema validation.
- **Blockers**: None.
- **Verification**: `pnpm type-check` (exit code 0), `pnpm lint` (exit code 0), and `pnpm build` (exit code 0 across all 6 routes).

---

## Milestone 4: Workout Session Engine & Exercise Management
- **Status**: COMPLETED
- **Objective**: Implement dedicated Exercise Management (`/exercises`) with full CRUD, plus core workout tracking engine supporting active live sessions, set logging, rest timer, and personal record attribution.
- **Acceptance Criteria**:
  - [x] **Dedicated Exercise Management (`/exercises`)**:
    - Searchable, filterable movement library (filter by category/muscle group and equipment).
    - Edit custom exercise details (`EditExerciseDialog`: name, category, equipment, notes/cues).
    - Delete custom exercises with referential safety checks (`DeleteExerciseButton` blocks deletion if referenced by logged sets).
    - Navigation link to `/exercises` on desktop header and movement cards.
  - [x] **Workout Session Engine**:
    - Start session from routine (auto-populates planned movements, target sets, and rep ranges) or empty freestyle workout.
    - Dynamic set logging (`ActiveWorkoutView`: weight, reps, set type, completed checkmarks).
    - Optimistic Concurrency Control (OCC) with `revision_number` checks preventing silent overwrites.
    - Rest countdown timer (`RestTimer`) with preset intervals (60s, 90s, 120s) and completion vibration cue.
    - Live workout elapsed timer, live volume calculation, and "Finish Workout" completion handler.
- **Blockers**: None.
- **Verification**: `pnpm type-check` (exit code 0), `pnpm lint` (exit code 0), and `pnpm build` (exit code 0 across all 8 routes with Partial Prerendering).

---

## Milestone 5: Real-Time Collaboration
- **Status**: COMPLETED
- **Objective**: Multi-user live session synchronization, collaborative set logging, and conflict management.
- **Acceptance Criteria**:
  - [x] Enabled Supabase Realtime publication on `workout_sets`, `workout_sessions`, and `session_participants` with `REPLICA IDENTITY FULL`.
  - [x] Private Supabase Realtime channel subscription scoped strictly to the session (`session:<id>`).
  - [x] Live WebSocket streaming for INSERT, UPDATE, and DELETE set events across co-trainees' screens.
  - [x] Collaborative Presence tracking: shows live partner counts (`{activePartnerCount} active`) and live WebSocket status (Live vs Reconnecting).
  - [x] Optimistic concurrency control (OCC) with `revision_number` and graceful reconciliation on conflict.
- **Blockers**: None.
- **Verification**: `pnpm type-check` (exit code 0), `pnpm lint` (exit code 0), and `pnpm build` (exit code 0 across all 8 routes with Partial Prerendering).

---

## Milestone 6: History & Analytics
- **Status**: COMPLETED
- **Objective**: Personal and group workout history logs, performance rollups, and volume tracking.
- **Acceptance Criteria**:
  - [x] Historical workout logs view with exercise and set breakdowns (`/analytics`).
  - [x] High-level stat rollups: total workouts, lifetime lifted volume (kg), and completed sets count.
  - [x] Personal records (PR) highlight table showing top weights lifted per exercise.
  - [x] Estimated 1-Rep Max (1RM) calculation using Brzycki formula (`src/features/analytics/calculations.ts`).
  - [x] Expandable session cards displaying per-movement set counts, top weights, and estimated 1RMs.
- **Blockers**: None.
- **Verification**: `pnpm type-check` (exit code 0), `pnpm lint` (exit code 0), and `pnpm build` (exit code 0 across all 9 routes with Partial Prerendering).

---

## Milestone 7: Mobile Polish, PWA & Exports
- **Status**: COMPLETED
- **Objective**: PWA manifest, service worker configuration, responsive mobile ergonomics, and data export.
- **Acceptance Criteria**:
  - [x] Progressive Web App: `manifest.json` configured with theme colors, portrait orientation, and maskable app icon (`public/icon.svg`).
  - [x] Metadata integration: `appleWebApp` with `black-translucent` status bar and standalone display mode in `layout.tsx`.
  - [x] Offline banner indicator (`NetworkStatusIndicator`) powered by `useSyncExternalStore` for SSR-safe network status detection.
  - [x] Data Export API route (`/api/export`): One-click download of all user workout logs, exercises, sets, weights, reps, and tonnage in both CSV and JSON formats.
  - [x] Download buttons integrated into `/analytics` dashboard header.
- **Blockers**: None.
- **Verification**: `pnpm type-check` (exit code 0), `pnpm lint` (exit code 0), and `pnpm build` (exit code 0 across all 10 routes with Partial Prerendering).

---

## Milestone 8: Production Readiness
- **Status**: COMPLETED
- **Objective**: End-to-end testing, security audit, performance optimization, and production checklist.
- **Acceptance Criteria**:
  - [x] Full RLS audit: Verified Row Level Security is enabled and enforced across all 9 public database tables (`exercises`, `profiles`, `routine_versions`, `routines`, `session_participants`, `workout_sessions`, `workout_sets`, `workspace_members`, `workspaces`) with 26 total granular policies.
  - [x] Business logic verification: Brzycki 1RM formula and volume calculations tested and verified with automated test assertions.
  - [x] End-to-end build verification: `pnpm type-check` (0 errors), `pnpm lint` (0 errors/warnings), and `pnpm build` (production build compiled in < 1s with Partial Prerendering across all 10 application routes).
  - [x] Authoritative scope alignment: Fully aligned with [docs/MASTER_SPEC.md](file:///Users/umairmomin/Desktop/gymbuddy/docs/MASTER_SPEC.md) (modular monolith, no native app, no public social bloat, secure multi-user in-gym workout tracking with responsive mobile & desktop ergonomics).
- **Blockers**: None.
- **Verification**: Complete database RLS query verified (`100% tables RLS enabled`), test assertion script exited with 0, and Next.js production build succeeded.

---

## Milestone 9: Group & Workspace Management (`/group`)
- **Status**: COMPLETED
- **Objective**: Implement group/workspace management, resolve `/group` route, partner invitations via invite codes, and membership rosters.
- **Acceptance Criteria**:
  - [x] Add `invite_code` support to `workspaces` table with lookup and `join_workspace_by_invite_code` RPC function.
  - [x] Dedicated Group/Workspace Management page (`/group`).
  - [x] Workspace member roster with roles (`owner`, `admin`, `member`) and avatars.
  - [x] Generate invite link / copyable code dialog with clipboard copy.
  - [x] Join existing workspace by code dialog.
- **Verification**: Database migration applied to Supabase Cloud, `pnpm type-check` (exit code 0), `pnpm lint` (exit code 0), and production `pnpm build` (exit code 0 across 11 routes).

---

## Milestone 10: Multi-User Collaborative Sessions & Co-Trainee Ergonomics
- **Status**: COMPLETED
- **Objective**: Full multi-user in-gym session parity matching MASTER_SPEC §11 & §26.
- **Acceptance Criteria**:
  - [x] "Join Active Workout" flow for co-trainees in the workspace (`joinWorkoutSessionAction`).
  - [x] Trainee attribution badges and filter tabs ("All Sets", "My Sets", "Partner's Sets").
  - [x] Individual participant finish (`session_participants.completed_at`, `finishParticipantWorkoutAction`) vs session-wide completion.
  - [x] Post-workout dual summary view (Personal Performance vs Group Combined Summary).
- **Verification**: Database migration applied to Supabase Cloud, `pnpm type-check` (exit code 0), and clean component integration.

---

## Milestone 11: Interactive Visual Analytics (Recharts)
- **Status**: COMPLETED
- **Objective**: Rich interactive charts for volume trends, 1RM strength curves, and muscle balance.
- **Acceptance Criteria**:
  - [x] Install and configure `recharts`.
  - [x] Weekly/monthly tonnage volume over time area chart (`AnalyticsCharts`).
  - [x] Exercise-specific estimated 1RM / top-weight progression curve with interactive exercise selector.
  - [x] Muscle group volume and set distribution breakdown.
- **Verification**: `recharts` installed, `pnpm type-check` (exit code 0), clean Next.js client integration.

---

## Milestone 12: User Preferences & Unit System (kg / lb)
- **Status**: COMPLETED
- **Objective**: User unit preference toggle with canonical database storage in kg.
- **Acceptance Criteria**:
  - [x] Add `preferred_unit` to `profiles` schema with database migration.
  - [x] Bidirectional kg/lb conversion utilities with gym plate increment precision (`src/lib/units.ts`).
  - [x] Dedicated `/settings` page with real-time Unit Toggle (kg vs lb).
  - [x] User profile settings actions (`getUserProfileSettingsAction`, `updatePreferredUnitAction`).
- **Verification**: Database migration applied to Supabase Cloud, `pnpm type-check` (exit code 0), and clean Next.js route integration.

---

## Milestone 13: Workout Scheduling & Calendar
- **Status**: COMPLETED
- **Objective**: Planned workout scheduling, calendar view, and one-click session launching.
- **Acceptance Criteria**:
  - [x] `scheduled_workouts` schema migration with full RLS policies applied to Supabase Cloud.
  - [x] Schedule workout modal linking target dates with routines (`UpcomingWorkoutsCard`).
  - [x] Dashboard upcoming schedule widget with routine and time badges.
  - [x] 1-click launch active workout directly from scheduled routine (`startScheduledWorkoutAction`).
- **Verification**: Database migration applied to Supabase Cloud, `pnpm type-check` (exit code 0), clean integration on home dashboard.

---

## Milestone 14: Extended Tables (Body Metrics & Session Events)
- **Status**: COMPLETED
- **Objective**: Body composition tracking and collaborative live audit events.
- **Acceptance Criteria**:
  - [x] `body_metrics` table with strict private user RLS policies applied to Supabase Cloud.
  - [x] `session_events` audit table with Realtime publication for tracking partner set logs, updates, and deletions.
  - [x] Personal body weight and body fat % tracking with Recharts trend line in `/analytics` (`BodyMetricsCard`).
  - [x] Real-time audit events recorded automatically on set mutations in `src/features/sessions/actions.ts`.
- **Verification**: Database migration applied to Supabase Cloud, `pnpm type-check` (exit code 0), `pnpm lint` (exit code 0), and production `pnpm build` (exit code 0 across all 12 routes with Partial Prerendering).


---

# V2 Restructure (solo tracker + optional buddy)

Authority: [V2_PRODUCT_DIRECTION.md](V2_PRODUCT_DIRECTION.md). Milestones 0–14 above describe the V1 build (workspace-based) and are historical; V2 replaces the group model. All V2 milestones start `NOT STARTED`; mark complete only with verification evidence (`pnpm type-check`, `pnpm lint`, tests, build).

## Milestone 15: Clean Schema Reset
- **Status**: COMPLETED (database + types). The V1 app code is intentionally left broken until Milestones 16–20 replace it.
- **Objective**: Drop the V1 schema and recreate a solo + buddy data model with RLS.
- **Acceptance Criteria**:
  - [x] Owner confirmed full wipe (all V1 tables and all user accounts) on 2026-10-19.
  - [x] Migration `20261020000000_v2_reset_and_schema.sql`: `profiles`, `buddy_links`, `exercises` (38 seeded), `routines`, `routine_versions`, `weekly_schedule`, `workout_sessions`, `session_participants`, `session_exercises`, `workout_sets`, `body_metrics`, `push_subscriptions`.
  - [x] RLS enabled on all 12 tables (24 policies); `anon` has no function execute rights; Realtime publication + private `session:<uuid>` channel policies on `realtime.messages`.
  - [x] Policy test `supabase/tests/rls_buddy.sql` passes (result `ALL_PASSED`, transaction rolled back): buddy never sees solo sessions, routines or body metrics; invitee sees the session header but no sets until joining; joined buddy edits the other's sets (revision + `last_edited_by` stamped), including after finish; strangers see nothing; second buddy rejected.
  - [x] Transactional RPCs: `request_buddy`, `accept_buddy`, `save_routine`, `start_workout_session`, `invite_buddy_to_session`, `join_workout_session`, `decline_workout_session`, `leave_workout_session`, `finish_my_workout`, `finish_workout_session`.
  - [x] `src/types/database.types.ts` regenerated from the live schema.
- **Known state**: `pnpm type-check` reports 109 errors, all in V1 code referencing dropped tables (workspaces, scheduled_workouts, etc.). They are resolved milestone by milestone, not patched.
- **Verification**: migration applied to Supabase Cloud via the Management API (HTTP 201); catalog query confirmed RLS/policies/seed/publication; RLS test run on the remote database.

## Milestone 16: Buddy Link
- **Status**: COMPLETED (code + static checks; signed-in UI not yet exercised in a browser)
- **Objective**: Replace groups with a 1:1 buddy connection.
- **Acceptance Criteria**:
  - [x] Request a buddy by username; accept; decline/cancel/remove; max one accepted buddy (server RPCs `request_buddy` / `accept_buddy`, validated with Zod, covered by `supabase/tests/rls_buddy.sql`).
  - [x] **Buddy** tab (`/buddy`): requests for you, add-buddy form, pending outgoing requests, buddy card, list of sessions done together.
  - [x] `/group`, `src/features/groups`, and invite-code flows removed; nav item "Groups" replaced by "Buddy".
  - [x] Settings and the profile menu read `profiles.username` (email column no longer exists).
  - [ ] Manual check, signed in as two users: send request, accept, remove. (Needs real accounts; not done by the agent.)
- **Verification**: `pnpm type-check` errors fell 109 → 71, none in M16 files; ESLint clean on `src/features/buddy`, `src/app/buddy`, `src/features/auth`, `src/components/layout`. Signed-out `/buddy` redirects to `/login?next=/buddy`. Remaining type errors are V1 modules (routines, sessions, scheduling, analytics, home) rewritten in M17–M20.

## Milestone 17: Plan (Schedule, Routines, Exercises)
- **Status**: COMPLETED (signed-in flow with a real account not yet exercised)
- **Objective**: One **Plan** tab to build exercises, routines and the weekly split.
- **Acceptance Criteria**:
  - [x] `/plan` with Schedule | Routines | Exercises tabs (tab kept in `?tab=`); `/routines` and `/exercises` redirect into it; nav shows Plan.
  - [x] Routine builder (sheet): name, days it runs on (warns when a day's current routine will be replaced), exercises with sets / rep range / rest, reorder (buttons), remove, add from searchable catalog, create exercise inline.
  - [x] Weekly schedule: per-day routine select (or Rest day) with optimistic update. Saving a routine appends an immutable version, so history is never rewritten.
  - [x] Starter plan (Push Mon/Thu, Pull Tue/Fri, Legs Wed, Shoulders + Arms Sat, Sun rest) via `seed_starter_plan()`, offered when you have no routines.
  - [x] Deleting a routine archives it (`routines.archived_at`) and unschedules it; session snapshots stay valid.
  - [x] Custom exercise create / edit / delete (delete refused with a clear message if used in history).
  - [x] DB hardening: `save_routine` rejects exercise ids the caller cannot see; tests in `supabase/tests/plan_seed.sql` and `rls_buddy.sql` pass (`ALL_PASSED`).
  - [ ] Manual check with a real account (create routine, change days, delete). Needs a real login.
- **Verification**: ESLint clean on `src/features/plan`, `src/features/buddy`, `src/components`, `src/app`; no type errors in M17 files (total errors 63 → 56, remaining ones are the unreferenced V1 modules `sessions`, `scheduling`, `analytics`). UI checked at 375px in the browser pane with a temporary mock-data fixture (removed): routines list, builder, day-conflict warning, exercise picker. Migrations `20261020000001`, `20261020000002` applied to Supabase Cloud.

## Milestone 18: Today + Solo Workout Engine
- **Status**: COMPLETED (signed-in flow with a real account not yet exercised)
- **Objective**: Home screen and the fast logging flow, solo first.
- **Acceptance Criteria**:
  - [x] **Today** (`/`): today's scheduled routine (device weekday) with exercise preview, Start / Resume, Change-routine sheet (incl. Freestyle), week strip, recent sessions; rest-day state; no-routines state linking to Plan.
  - [x] **Workout** (`/session/[id]`): one exercise in focus with progress strip, prev/next, add exercise, skip/restore, remove last set; last-time values shown as **placeholders** (a confirm tap accepts them); one-tap ✓ logs and starts the rest timer; ✓ again undoes; kg/lb per profile; finish sheet (time / sets / volume) with Finish or Discard; completed sessions stay editable.
  - [x] Writes are idempotent (client-generated set ids) with compare-and-swap on `revision_number`; a stale write returns the winning values; writes per set are queued so fast taps can't race.
  - [x] Bottom nav is Today / Plan / History / Buddy (History still points at the `/analytics` stub until M20).
  - [x] V1 `sessions` and `scheduling` code deleted.
  - [ ] Manual check with a real account on a phone. Not done by the agent.
- **Out of scope (by design)**: "Train with buddy" toggle and invite UI (M19); rest timer is local-only until M19 shares it.
- **Verification**: ESLint clean across `src`; type-check has 1 remaining error, in V1 `src/features/analytics/actions.ts` (replaced in M20); DB flow test `supabase/tests/workout_flow.sql` passes (start from routine, idempotent start, one live session per host, duplicate set id rejected, stale revision write rejected, edit after finish, discard). UI checked at 375px in the browser pane with a temporary mock-data fixture (removed): Today (incl. weekday highlight), workout screen, placeholder-accept ✓, rest timer dock. Found and fixed a hydration mismatch on the elapsed clock and a pre-hydration "Rest day" flash.

## Milestone 19: Live Buddy Sessions
- **Status**: CODE COMPLETE, NOT VERIFIED END-TO-END. The live transport (Realtime channel, presence, broadcast) has not been exercised with two real signed-in devices; see the manual checklist below.
- **Objective**: Invite a buddy into a workout and log together in real time.
- **Acceptance Criteria**:
  - [x] "Train with <buddy>" toggle on Today (default off) creates an `invited` participant via `start_workout_session`; host can also invite mid-workout (`invite_buddy_to_session`).
  - [x] Invite delivery: global `InviteBanner` (initial fetch + Realtime on my `session_participants` rows + refetch when the app returns to the foreground) and a share-link fallback (iOS share sheet / clipboard) to `/session/[id]`.
  - [x] Join is always an explicit confirmation (banner buttons or the invite page); an invitee sees only the invite until they join (RLS + page gate). Late join and leave supported; decline then re-invite works.
  - [x] Private per-session channel `session:<uuid>` authorized by `realtime.messages` policies (members only). Row changes (`workout_sets`, `session_participants`, `workout_sessions`), presence ("Sam is here · live · exercise"), and a shared rest timer broadcast as absolute end time.
  - [x] Two-lane logging: your rows and your buddy's rows per set; either person can edit either lane (also after finish) and rows show "edited by". Revision-checked writes; incoming events adopt only strictly newer revisions; writes in flight are never overwritten.
  - [x] Reconnect: every subscribe/reconnect fetches an authoritative snapshot (`getSessionSyncAction`) and reconciles (`sync.ts`: add / adopt / remove, skipping in-flight writes).
  - [x] Host finishes for everyone; a non-host "Finish my workout" only completes their own part.
  - [ ] **Manual two-device check** (needs two accounts that are buddies): (1) A starts Push with buddy on; B's banner appears and Join works; (2) A logs a set, it appears in B's lane within ~1s, and vice versa; (3) B edits A's weight, A sees the change and "edited by Sam"; (4) airplane-mode B for 20s while A logs, then reconnect: B catches up; (5) rest timer started by A counts down on B; (6) A finishes; B can still edit a set afterwards.
- **Not built / limits**: no Web Push (M21: invite arrives via banner when the app is open, or via the share link); the buddy lane only shows exercises that are also in your own list; local offline write queue is M21 (a failed write shows an error and can be retried by tapping).
- **Verification**: ESLint clean; unit tests `pnpm test` (9 passing: merge/reconcile rules, rest payload validation); DB tests `supabase/tests/buddy_session.sql` (invite → join copies host list → finish own part vs host finish → decline/re-invite → leave; channel writes denied to an invitee and a stranger, allowed to a joined member) plus all earlier DB tests re-run, all `ALL_PASSED`. UI checked at 375px with a mock-data fixture (removed): two-lane view, "waiting for buddy" state. Only remaining type error: V1 `analytics/actions.ts` (M20).

## Milestone 20: History
- **Status**: NOT STARTED
- **Objective**: Merge analytics into **History** and keep body metrics and exports.
- **Acceptance Criteria**:
  - [ ] Past sessions list (solo and shared), PRs, volume/1RM charts, body metrics, CSV/JSON export.
  - [ ] Totals and PRs recompute after post-finish edits.
  - [ ] `/analytics` route retired or redirected.

## Milestone 21: PWA Polish & Web Push
- **Status**: NOT STARTED
- **Objective**: Make the installable iPhone PWA excellent and add background invites.
- **Acceptance Criteria**:
  - [ ] Home-screen install prompt/guide, safe-area review, offline-tolerant logging queue.
  - [ ] Web Push (VAPID, `web-push`, `push_subscriptions`) for buddy invites; opt-in flow; graceful fallback when unavailable.

## Milestone 22: Verification & Consistency Pass
- **Status**: NOT STARTED
- **Objective**: Prove the restructure and remove inconsistencies.
- **Acceptance Criteria**:
  - [ ] Full RLS audit and policy tests pass.
  - [ ] Playwright e2e: solo workout, two-user shared workout, edit-after-finish, offline/reconnect.
  - [ ] No remaining references to workspaces/groups; UI components, spacing and dialogs consistent with the Iron Black theme.
  - [ ] `pnpm type-check`, `pnpm lint`, tests, and `pnpm build` all pass with recorded output.
