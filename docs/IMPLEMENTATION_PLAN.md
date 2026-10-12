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
- **Status**: PENDING
- **Objective**: Implement exercise catalog management and routine definition with versioning.
- **Acceptance Criteria**:
  - [ ] Pre-seeded standard exercise library + custom exercise creation.
  - [ ] Routine builder with versioned routine structures (`routines`, `routine_versions`).
  - [ ] Full CRUD operations with Zod validation.
  - [ ] RLS policies ensuring routine access is scoped to authorized workspace members.
- **Blockers**: None.
- **Verification**: TBD.

---

## Milestone 4: Workout Session Engine
- **Status**: PENDING
- **Objective**: Core workout tracking engine supporting active live sessions, set logging, and personal record attribution.
- **Acceptance Criteria**:
  - [ ] Start session from a routine or empty slate.
  - [ ] Dynamic set logging (reps, weight, RPE/type, notes, completed).
  - [ ] Separate tracking for individual participants within the shared workout.
  - [ ] Mobile-optimized live workout entry interface (min 44px touch targets).
  - [ ] Session completion and historical snapshot preservation.
- **Blockers**: None.
- **Verification**: TBD.

---

## Milestone 5: Real-Time Collaboration
- **Status**: PENDING
- **Objective**: Multi-user live session synchronization, collaborative set logging, and conflict management.
- **Acceptance Criteria**:
  - [ ] Private Supabase Realtime channel subscription scoped to session.
  - [ ] Live updates reflected across co-trainees' screens.
  - [ ] Ability to log or adjust sets on behalf of training partners.
  - [ ] Concurrency control and optimistic UI with revision checks.
  - [ ] Authoritative recovery when reconnecting after gym signal drop.
- **Blockers**: None.
- **Verification**: TBD.

---

## Milestone 6: History & Analytics
- **Status**: PENDING
- **Objective**: Personal and group workout history logs, performance rollups, and volume tracking.
- **Acceptance Criteria**:
  - [ ] Historical workout logs view with exercise and set breakdowns.
  - [ ] Individual volume and progress charts over time.
  - [ ] Combined session summary comparing member performances.
  - [ ] Calculations verified with unit tests.
- **Blockers**: None.
- **Verification**: TBD.

---

## Milestone 7: Mobile Polish, PWA & Exports
- **Status**: PENDING
- **Objective**: PWA manifest, service worker configuration, responsive mobile ergonomics, and data export.
- **Acceptance Criteria**:
  - [ ] Progressive Web App (manifest.json, icons, install prompt support).
  - [ ] Mobile ergonomics audit (safe areas, virtual keyboard handling).
  - [ ] CSV / JSON workout data export.
  - [ ] Offline indicator with graceful degradation.
- **Blockers**: None.
- **Verification**: TBD.

---

## Milestone 8: Production Readiness
- **Status**: PENDING
- **Objective**: End-to-end testing, security audit, performance optimization, and production checklist.
- **Acceptance Criteria**:
  - [ ] Full RLS audit and automated security testing.
  - [ ] End-to-end user flows tested.
  - [ ] Bundle size optimization and Lighthouse mobile audit.
  - [ ] Final verification of all acceptance criteria against `docs/MASTER_SPEC.md`.
- **Blockers**: None.
- **Verification**: TBD.
