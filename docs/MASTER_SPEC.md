# GYM TRACKER — MASTER IMPLEMENTATION SPECIFICATION

> **V2 NOTICE (2026-10-19):** Product direction changed. Groups/workspaces are removed in favour of a solo tracker with one optional buddy. Read [V2_PRODUCT_DIRECTION.md](V2_PRODUCT_DIRECTION.md) first; it overrides this document wherever they conflict (product definition, navigation, workspace/group data model and RLS, home screen).

**Project:** Collaborative Gym Tracker  
**Version:** V1.0 — Scope Locked  
**Platform:** Responsive, mobile-first web application / PWA  
**Primary objective:** Replace a shared gym-tracking spreadsheet with a secure, real-time collaborative workout application.

---

# 1. YOUR ROLE

You are the lead software architect, senior full-stack engineer, database designer, UI/UX engineer, security engineer, and test engineer responsible for implementing this application.

You must build a production-minded application, not a throwaway prototype.

Before implementing features:

1. Inspect the repository, existing code, installed dependencies, environment configuration, and Git status.
2. Understand the current state before modifying anything.
3. Identify existing implementations that should be preserved.
4. Create an implementation plan based on this specification.
5. Identify ambiguities and propose reasonable defaults without silently changing the product scope.
6. Implement the application incrementally, validating each milestone before proceeding.

Do not attempt to generate the entire application in one enormous coding pass.

Work in small, coherent, testable increments. Keep the application runnable throughout development.

The product decisions and scope in this document are authoritative. Do not reinterpret the application as a social fitness network.

# 2. PRODUCT DEFINITION

Gym Tracker is a collaborative workout-tracking application for people who train together.

Multiple users can join a shared training workspace, follow reusable workout routines, start shared workout sessions, and record their individual performance in the same real-time log.

Each user can have different:
- Weights
- Repetitions
- Number of sets
- Set types
- Exercise notes
- Completion status

Users can also correct other members' workout entries because shared editing is an explicit product requirement.

The application retains individual workout histories and provides both personal and combined session summaries.

## Core product principle

**Train together. Track individually. Review progress together.**

## What this product is NOT

Do not build:
- A public social network
- Followers or following
- Public user profiles
- Likes, comments, or activity feeds
- Public leaderboards
- Competitive points or gamification
- Nutrition or calorie tracking
- AI-generated workout plans
- Wearable integrations
- Gym-owner management software
- Payment processing or subscriptions
- A native iOS or Android application

The application must be a responsive web application optimized for mobile browsers.

# 3. LOCKED TECHNOLOGY STACK

Use the following stack unless an actual technical incompatibility requires a documented alternative.

## Application

- Next.js App Router
- React
- TypeScript with strict mode enabled
- Tailwind CSS
- shadcn/ui
- Radix UI primitives where applicable
- Lucide icons

## Backend and persistence

- Supabase PostgreSQL
- Supabase Auth
- Supabase Realtime
- PostgreSQL Row Level Security (RLS)
- Supabase JavaScript client
- Supabase SSR integration for Next.js
- SQL migrations managed through the Supabase CLI

## Forms and validation

- React Hook Form
- Zod
- Shared TypeScript types and validation schemas where appropriate

## Analytics and utilities

- Recharts for charts
- date-fns for date calculations and formatting

## Testing

- Vitest for unit tests
- Playwright for end-to-end browser tests
- Integration tests for database access and authorization behavior

## Hosting and operations

- Vercel for Next.js hosting
- Supabase for database, authentication, and realtime services
- GitHub for source control
- GitHub Actions for continuous integration
- Sentry or an equivalent error-monitoring service, with privacy-conscious configuration

## Explicit infrastructure exclusions

Do not introduce these without a documented and approved reason:

- Express as a separate backend
- Redis
- BullMQ
- Microservices
- Docker-based production orchestration
- A separate custom WebSocket server
- An additional database
- An ORM by default

This is a modular monolith backed by managed services.

Use the Supabase client and SQL migrations as the default database access approach. Use generated database types. Do not introduce Prisma merely out of habit.

# 4. HIGH-LEVEL SYSTEM ARCHITECTURE

The architecture has four logical layers.

## A. Presentation layer

Responsibilities:
- Responsive user interface
- Forms and input validation
- Workout logging interactions
- Local component state
- Loading, error, and success states
- Realtime UI updates
- Charts and summaries

Use React Server Components for appropriate read-oriented screens and layouts.

Use Client Components only when interactivity, browser APIs, timers, or live subscriptions require them.

Do not convert the entire application into a Client Component without justification.

## B. Application and authorization layer

Responsibilities:
- Authentication and session handling
- Group membership validation
- Routine operations
- Workout session lifecycle
- Performance record mutations
- Data validation
- Session completion
- Analytics calculations
- Export authorization

Use Next.js Server Actions or Route Handlers according to the operation. Select one consistent mutation pattern for each feature instead of mixing patterns arbitrarily.

All sensitive mutations must have server-side validation and authorization.

Do not trust client-provided user IDs, membership roles, ownership claims, or permissions.

Derive the authenticated user from a verified session.

## C. Data layer

PostgreSQL is the canonical source of truth.

Responsibilities:
- Relational data integrity
- Foreign keys
- Constraints
- Transactions
- Database migrations
- RLS policies
- Audit records
- Historical data preservation

Important mutations should be transactional when multiple records must remain consistent.

Use database functions or carefully designed transactional server operations for complex operations such as session finalization, bulk changes, and deletion.

## D. Realtime layer

Supabase Realtime distributes authorized updates to connected users.

Responsibilities:
- Notify session members about saved changes
- Keep active session screens synchronized
- Update participant completion status
- Notify authorized clients of relevant session changes
- Recover from temporary connection loss

Realtime is a synchronization mechanism, not the canonical data store.

A successful save means the database transaction succeeded, not merely that a WebSocket event was emitted.

## Architecture diagram

Browser / iPhone Safari
    |
    v
Next.js responsive application
    |
    +--> Authentication and authorization
    |
    +--> Server Actions / Route Handlers
    |        |
    |        v
    |    PostgreSQL
    |        |
    |        +--> Persistent workout data
    |        +--> RLS and constraints
    |        +--> Audit records
    |
    +<--> Supabase Realtime
             |
             +--> Authorized active session members

# 5. REPOSITORY STRUCTURE

Use a feature-oriented structure similar to the following.

gym-tracker/
  src/
    app/
      (auth)/
        login/
        register/
        forgot-password/
      (app)/
        dashboard/
        groups/
        routines/
        workouts/
        history/
        analytics/
        schedule/
        settings/
      api/
    components/
      ui/
      layout/
      shared/
    features/
      auth/
      groups/
      memberships/
      exercises/
      routines/
      sessions/
      performance/
      history/
      analytics/
      scheduling/
      body-metrics/
      exports/
    lib/
      supabase/
        client.ts
        server.ts
        middleware.ts
      validation/
      permissions/
      dates/
      analytics/
      errors/
    hooks/
    types/
  supabase/
    migrations/
    seed.sql
  public/
    icons/
  tests/
    unit/
    integration/
    e2e/
  .env.example
  README.md

This structure is a guide, not a reason to create empty folders or unnecessary abstraction layers.

Use the current supported Next.js and Supabase patterns. If the exact repository structure differs, adapt it while preserving clear feature boundaries.

# 6. AUTHENTICATION AND USER MANAGEMENT

Implement:

- Account registration
- Email/password authentication
- Email verification
- Login and logout
- Password recovery
- Protected application routes
- User profile and preferences
- Secure session handling

Users must have a persistent personal identity independent of any group.

Store user-specific preferences where appropriate:
- Display name
- Preferred weight unit
- Time zone
- Optional profile image
- Optional body-metric preferences

Never expose Supabase service-role credentials in browser code.

Use the publishable/anonymous client key only where appropriate and rely on RLS to restrict data access.

Validate authentication correctly on server requests.

# 7. DATABASE SCHEMA

Implement the following logical entities. Final column names and SQL types may be refined during schema design, but the relationships and semantics must be preserved.

## users / profiles

- id
- display_name
- preferred_unit
- timezone
- created_at
- updated_at

Use the Supabase Auth user ID as the identity reference.

## groups

- id
- name
- created_by
- created_at
- updated_at
- archived_at, if applicable

A group is a private shared training workspace.

## memberships

- id
- group_id
- user_id
- role
- status
- joined_at
- left_at
- created_at

Enforce unique active membership for a user/group pair.

Define membership status and role values explicitly.

Do not rely solely on frontend role checks.

## exercises

- id
- name
- description
- equipment
- primary_muscle_group
- secondary_muscle_groups
- movement_type
- measurement_type
- created_by, if custom
- is_system
- archived_at
- created_at
- updated_at

Support system exercises and user-created exercises.

Archived exercises must remain resolvable from historical workouts.

Exercise names must not be used as primary keys.

## routines

- id
- group_id
- name
- description
- owner_user_id
- current_version
- created_at
- updated_at
- archived_at

Routines are reusable templates.

## routine_exercises

- id
- routine_id
- exercise_id
- position
- default_set_count
- suggested_reps
- suggested_weight, if supported
- rest_seconds
- notes
- created_at
- updated_at

Use explicit ordering and stable IDs.

## routine_versions

Implement version history or an equivalent snapshot mechanism.

Store sufficient information to identify which routine version a session originally used.

Routine edits must not silently modify historical workouts.

## scheduled_workouts

- id
- group_id
- routine_id
- scheduled_at
- status
- created_by
- notes
- created_at
- updated_at

A scheduled workout is a plan, not an actual workout session.

## sessions

- id
- group_id
- routine_id, nullable for ad hoc workouts
- scheduled_workout_id, nullable
- routine_version_snapshot
- title
- status
- started_by
- started_at
- ended_at
- created_at
- updated_at

Session states:
- scheduled, where applicable
- active
- completed
- cancelled
- abandoned

Do not treat an abandoned session as completed.

## session_members

- id
- session_id
- user_id
- participation_status
- joined_at
- completed_at
- left_at
- created_at
- updated_at

Participation states should distinguish active participation, completion, and early departure.

## session_exercises

- id
- session_id
- exercise_id
- position
- exercise_snapshot
- notes
- created_at
- updated_at

Preserve the actual exercise configuration used in the session.

## set_records

- id
- session_exercise_id
- session_member_id
- set_number
- weight_value
- weight_unit
- reps
- set_type
- duration_seconds
- distance_value, where relevant
- notes
- completion_status
- revision
- created_at
- updated_at
- updated_by
- deleted_at, if soft deletion is used

Each set must belong to the participant who performed it.

Allow different members to have different set counts and different exercise configurations.

Set types should support at least:
- Warm-up
- Working
- Drop set
- Other, where needed

Do not force all exercises to use weight and reps. Timed and distance-based exercises require appropriate validation.

## session_events

- id
- session_id
- actor_user_id
- event_type
- entity_type
- entity_id
- change_payload
- created_at

Record important actions such as performance edits, session completion, and authorized deletion.

Avoid storing unnecessary sensitive information in audit payloads.

## personal_records

Implement a derived or cached record model if useful.

- id
- user_id
- exercise_id
- record_type
- value
- source_set_record_id
- achieved_at
- updated_at

The underlying performance history is authoritative. Cached PRs must be recalculable.

## body_metrics

- id
- user_id
- metric_type
- value
- unit
- recorded_at
- created_at

These are personal records and are private by default.

# 8. DATABASE DESIGN RULES

- Use UUID primary keys where appropriate.
- Add foreign keys and indexes for actual query patterns.
- Index group IDs, session IDs, participant IDs, scheduled dates, and historical lookup paths.
- Add unique constraints to prevent duplicate memberships and other invalid states.
- Use database transactions for multi-record changes.
- Use explicit numeric types and consistent units.
- Use timestamptz for event timestamps.
- Preserve historical snapshots.
- Use migrations for every schema change.
- Never rely on a developer manually modifying production tables.
- Avoid cascading deletes that could destroy other users' histories.
- Prefer archival or soft deletion where historical integrity requires it.

Generated database types must be updated after relevant migrations.

# 9. ROW LEVEL SECURITY AND AUTHORIZATION

RLS is mandatory for all user-accessible tables.

Define policies based on actual membership and ownership relationships.

Required principles:

1. Users can access their own profiles and private body metrics.
2. Group members can access permitted group resources.
3. Session data is available only to authorized participants and members under the agreed historical-access policy.
4. Former members may retain access to sessions they participated in.
5. Former membership must not grant automatic access to all future group data.
6. Set editing must follow the product's shared-editing rule.
7. Routine modifications must follow routine ownership and group permissions.
8. Session deletion must follow session-management permissions.
9. Archived or deleted data must not be exposed accidentally.
10. Realtime subscriptions must respect the same access boundaries.

Important: the application supports authorized cross-member editing, but not unrestricted deletion.

Every sensitive operation must validate:
- Authenticated identity
- Group membership or historical access
- Session participation, where applicable
- Operation-specific permissions
- Resource status
- Expected record revision, where applicable

Never use the presence of a UI button as an authorization mechanism.

Create automated authorization tests, including attempts to access another group's data and edit records without membership.

# 10. ROUTINE MANAGEMENT

Implement:

- Create shared routine
- Edit routine metadata
- Add and remove exercises
- Reorder exercises
- Configure suggested sets and reps
- Configure default rest duration
- Archive routines
- Reuse routines across sessions
- Routine versioning

Routine changes require an explicit scope choice:

A. Update future sessions only.
B. Update the current active session.
C. Update both.

Before changing an active session, show the user what will change.

Never silently delete recorded sets or overwrite completed performance.

The exact policy for who may edit a shared routine must be enforced consistently. Use a designated routine owner unless an explicitly authorized group-management rule applies.

# 11. WORKOUT SESSION ENGINE

Support two entry points:

A. Start an ad hoc workout.
B. Start a planned workout from the schedule.

A session can be associated with a shared routine or created without one.

When a routine is used:
- Snapshot its relevant structure.
- Create session exercise records.
- Allow each participant to modify their own performance structure.
- Preserve the source routine version.

When members join:
- Verify access.
- Create or update their session participation record.
- Load the current authoritative session state.
- Subscribe them to the authorized realtime channel.

During the workout:
- Add, edit, skip, or remove sets.
- Edit notes and set types.
- Add or remove session exercises according to permissions.
- Run an optional rest timer.
- Mark individual exercises or the full personal workout complete.

When a participant finishes:
- Mark that participant completed.
- Preserve all recorded data.
- Allow other participants to continue.

When the session is finalized:
- Validate session state.
- Save the final status.
- Generate or derive individual summaries.
- Generate a combined summary.
- Recalculate relevant analytics and PRs as needed.

Do not automatically terminate an active shared session merely because its creator disconnects.

# 12. REALTIME IMPLEMENTATION

Use Supabase Realtime with private channels or another properly authorized subscription pattern.

A suggested channel convention is:

session:<session-id>

The naming convention is not a security boundary. Channel authorization must be enforced.

Use database changes or a transactional outbox-based event pattern, depending on the implementation chosen.

Each event should contain sufficient information to identify:
- Event type
- Entity ID
- Session ID
- Revision or version
- Actor, where appropriate
- Timestamp

Do not broadcast unnecessary personal information.

## Mutation sequence

1. User initiates an edit.
2. Validate input.
3. Submit the mutation.
4. Authenticate and authorize.
5. Validate the current revision if needed.
6. Commit the database transaction.
7. Publish the event reliably.
8. Update connected clients.
9. Recover from missed events after reconnection.

Do not claim a change is permanently saved before the database confirms it.

## Concurrent editing

Every editable performance record should have a revision or equivalent conflict-detection mechanism.

If two members edit the same set concurrently:
- Do not silently overwrite one update.
- Detect stale revisions.
- Return a conflict response where appropriate.
- Refresh the authoritative record.
- Let the user retry or resolve the conflict.

Edits to different sets should not conflict unnecessarily.

## Reconnection

When a client reconnects:
- Reauthenticate as required.
- Revalidate session access.
- Resubscribe to authorized channels.
- Fetch the current authoritative session state.
- Reconcile local UI state with the server.

Offline-first editing is out of scope for V1.

# 13. WORKOUT HISTORY

The history screen is separate from the active workout screen.

Provide:
- Date-based history
- Exercise history
- Session details
- Individual performance
- Combined session performance
- Previous completed workout information
- PR indicators
- Filters by exercise and date

History should preserve what actually happened.

A later routine change must not change old performance records.

A correction to historical data must update derived analytics where relevant and be recorded in the audit trail.

Historical access after leaving a group must follow the agreed policy.

# 14. PERSONAL RECORDS AND ANALYTICS

Implement automatic PR detection using valid performance records.

Initial record categories:
- Heaviest eligible set
- Most repetitions at a comparable weight
- Highest eligible volume for a defined exercise or workout metric

Exclude skipped, invalid, and incomplete sets from metrics where appropriate.

Warm-up sets should not automatically count toward working-set PRs unless the specific record definition permits it.

Support exercise-specific comparison rules for:
- Dumbbell movements
- Unilateral movements
- Assisted movements
- Body-weight movements
- Timed exercises
- Distance-based exercises

## Analytics

Strength:
- Exercise-specific weight and rep history
- Trend charts

Volume:
- Eligible volume load
- Volume by workout and time period

Consistency:
- Completed workouts
- Weekly frequency
- Planned versus completed sessions

Muscles:
- Sets and volume grouped by configured muscle groups
- Defined handling for primary and secondary muscles

Body metrics:
- Optional personal body-weight and measurement history

Combined summaries must not rank members solely by raw lifted weight.

Use database queries and appropriate aggregation rather than downloading the entire history to the browser for every chart.

Document formulas and ensure the UI and backend use consistent definitions.

# 15. HOME SCREEN AND USER EXPERIENCE

The dashboard is hybrid.

Display:
- Today's planned workout
- Active shared session, if any
- Quick start for an ad hoc workout
- Recent personal workouts
- Upcoming scheduled workouts
- Personal progress highlights
- Useful group/session status

Do not introduce social feeds or unnecessary engagement mechanics.

Navigation should prioritize:
- Home
- Workouts
- Routines
- History
- Analytics

Use an appropriate mobile navigation pattern, with settings and group management accessible without cluttering the main workflow.

# 16. RESPONSIVE DESIGN AND IPHONE SUPPORT

This is a web application, not a native mobile app.

Design mobile-first for iPhone Safari.

Requirements:
- Responsive layouts
- Large touch targets
- Readable typography
- Accessible contrast
- Safe-area padding
- Proper keyboard and input handling
- Stable layouts when the mobile keyboard opens
- No horizontal overflow in normal mobile screens
- Clear save status
- Clear connection status
- Easy set entry
- Accessible dialogs and controls
- Loading, empty, error, and success states
- Reduced-motion support where appropriate

The active workout should be usable with one hand wherever practical.

Avoid excessive modal dialogs during a workout.

Use exercise cards on narrow screens. Provide comparison panels or wider layouts for larger groups.

Configure PWA support:
- Web app manifest
- Application icons
- Appropriate theme colors
- Standalone display mode
- Mobile viewport settings
- Installability over HTTPS
- Basic offline fallback

Do not claim full offline workout support in V1.

Test on real iPhone Safari where possible, not only desktop responsive emulation.

# 17. SET ENTRY AND UNIT HANDLING

Weight and reps must be quick to enter.

Provide:
- Appropriate numeric inputs
- Keyboard-friendly controls
- Input validation
- Clear set completion states
- Previous data access through history
- Optional notes
- Set-type selection
- Rest timer integration

Support kg and lb as display preferences.

Use a documented canonical storage convention. Convert consistently when displaying or exporting values.

Do not silently round stored data in ways that change performance records.

Timed and distance-based exercises must not be forced into weight-and-rep validation.

# 18. SCHEDULING AND EXPORT

Scheduling:
- Create planned workouts
- Associate them with routines
- Display a calendar or schedule
- Start planned workouts
- Distinguish scheduled, completed, cancelled, and missed workouts

Do not create duplicate sessions when a user repeatedly clicks Start.

CSV export:
- Export personal workout history.
- Include dates, exercise names, set numbers, weight, unit, reps, set type, duration, and notes where appropriate.
- Use stable headers.
- Escape CSV values correctly.
- Apply authorization before exporting.
- Do not expose other members' private records without permission.

Group-wide export requires explicit authorization and should not be assumed to be available to every member.

# 19. ERROR HANDLING AND EDGE CASES

Handle these scenarios deliberately:

- A user disconnects during a workout.
- The session creator disconnects.
- A user joins late.
- A user finishes early.
- A session is abandoned.
- A member leaves a group.
- A user is removed from a group.
- Two users edit the same record.
- A mutation is retried.
- A user accidentally creates duplicate sets.
- A routine changes during an active session.
- An exercise is archived.
- A historical record is corrected.
- A cached PR becomes invalid.
- A database mutation succeeds but notification delivery fails.
- A user attempts an unauthorized operation.
- A scheduled workout is missed.
- A group or session is archived.
- A user changes their preferred unit.
- A stale browser tab attempts to modify an old record.

Every mutation must have clear success and failure behavior.

Never hide an authorization failure by returning misleading success.

Never lose recorded data silently.

# 20. TESTING STRATEGY

Use Vitest and Playwright.

## Unit tests

Test:
- Validation schemas
- Weight conversion
- Volume formulas
- PR detection
- Muscle-group aggregation
- Session status transitions
- Routine versioning behavior
- Analytics calculations

## Integration tests

Test:
- Database constraints
- RLS behavior
- Authentication-dependent access
- Membership permissions
- Session mutations
- Concurrent revision handling
- Audit events
- Historical access
- Deletion and archival behavior

## End-to-end tests

Test:
1. Register two users.
2. Create a group.
3. Invite and join the second user.
4. Create a shared routine.
5. Start a shared workout.
6. Log a set from one browser.
7. Verify that the other browser receives the update.
8. Modify a different set from the second browser.
9. Finish one participant while the other remains active.
10. Complete the session.
11. Verify both summaries.
12. Verify workout history and PRs.
13. Verify access after membership changes.
14. Verify unauthorized cross-group access is blocked.

Use separate test users and isolated test data.

Do not run destructive test cleanup against production.

# 21. SECURITY REQUIREMENTS

Mandatory:
- RLS on every user-accessible table
- Server-side authorization
- Validated authentication sessions
- No service-role key in browser bundles
- No secrets committed to Git
- Private realtime subscriptions
- Input validation
- Safe CSV generation
- Rate limiting for sensitive operations
- Appropriate security headers
- Safe error responses
- Audit logging for sensitive changes
- Backup and recovery planning
- Dependency updates and vulnerability checks

Test for cross-group data leakage.

The application must not rely exclusively on frontend checks to protect resources.

# 22. ENVIRONMENT AND DEPLOYMENT

Create `.env.example` with variable names and placeholders only.

Include the appropriate variables for:
- Supabase project URL
- Supabase publishable key
- Supabase server-side configuration, where applicable
- Site URL
- Error-monitoring DSN, if configured

Do not put real credentials in `.env.example`.

Use the current Supabase SSR integration for server and browser clients.

Use environment-specific configuration for local development, preview, and production.

Production setup:
- GitHub repository
- Vercel project
- Supabase production project
- Custom domain
- HTTPS
- Authentication redirect URLs
- Environment variables
- Database migrations
- Error monitoring
- Backup and recovery verification

Use a separate development database where practical.

Do not apply unreviewed destructive migrations to production.

Do not claim deployment succeeded unless it was actually executed and verified.

# 23. AGENT WORKFLOW RULES

These rules are mandatory for all coding agents working on this project.

## Before coding

- Inspect the repository.
- Inspect package.json and installed dependencies.
- Inspect existing architecture and environment files.
- Check Git status.
- Identify the current implementation stage.
- Read this specification and all project-specific instructions.
- Propose a milestone plan.

## During implementation

- Make incremental changes.
- Keep the app runnable.
- Reuse existing components and utilities where appropriate.
- Avoid unnecessary dependencies.
- Keep business logic out of UI components when it should be independently testable.
- Use clear TypeScript types.
- Validate server-side inputs.
- Add migrations for database changes.
- Update generated types after schema changes.
- Add tests for critical logic and authorization.
- Run type checking, linting, and relevant tests.
- Explain any failed checks honestly.

## Never

- Delete or overwrite user work without review.
- Reset the database casually.
- Modify production data for convenience.
- Expose secrets.
- Disable RLS to make a feature work.
- Bypass tests by weakening assertions.
- Introduce unrelated refactors.
- Invent successful deployment or test results.
- Replace the locked product scope with your own feature ideas.
- Implement social networking features.
- Mark incomplete functionality as finished.

## If a decision is ambiguous

1. Check this specification.
2. Check existing architecture and notes.
3. Prefer the least complex safe implementation that preserves the product decisions.
4. Document the assumption.
5. Ask the user before making an irreversible or scope-changing decision.

Do not interrupt development for minor implementation details that can be safely resolved.

# 24. MILESTONE PLAN

Implement in this order.

## Milestone 0 — Repository audit and plan

Deliver:
- Repository assessment
- Proposed architecture
- Dependency plan
- Database entity map
- Security plan
- Implementation milestones
- Identified unresolved decisions

Do not start a major implementation before this assessment.

## Milestone 1 — Foundation

Implement:
- Next.js setup
- TypeScript strict mode
- Tailwind and shadcn/ui
- Layout and navigation
- Environment validation
- Supabase clients
- Linting and testing setup

Acceptance:
- App starts locally.
- Type checking and linting work.
- Environment variables are documented.
- No secrets are committed.

## Milestone 2 — Authentication and database

Implement:
- SQL migrations
- Profiles
- Groups and memberships
- Authentication screens
- RLS policies
- Permission helpers
- Basic integration tests

Acceptance:
- Two users can register and authenticate.
- A group can be created.
- Group membership works.
- Cross-group access is denied.

## Milestone 3 — Exercises and routines

Implement:
- Exercise library
- Custom exercises
- Shared routines
- Routine exercise ordering
- Routine versioning
- Routine permissions
- Scheduling

Acceptance:
- A shared routine can be created, reused, and edited.
- Routine versions remain identifiable.
- Historical records are not overwritten.

## Milestone 4 — Workout engine

Implement:
- Ad hoc sessions
- Planned sessions
- Participant management
- Session exercises
- Set records
- Individual completion
- Session finalization
- Historical snapshots

Acceptance:
- Multiple participants can log different set structures.
- Each participant can finish independently.
- Recorded data survives navigation and reloads.

## Milestone 5 — Real-time collaboration

Implement:
- Private channel authorization
- Realtime event flow
- Revision conflict detection
- Idempotent mutations
- Reconnect recovery
- Audit events

Acceptance:
- Two independent browsers see committed changes.
- Concurrent edits do not silently overwrite each other.
- Unauthorized clients cannot subscribe to private sessions.

## Milestone 6 — History and analytics

Implement:
- Workout history
- Exercise history
- PR detection
- Volume calculations
- Strength charts
- Consistency metrics
- Muscle-group analytics
- Individual summaries
- Combined summaries
- Optional body metrics

Acceptance:
- Analytics match tested formulas.
- Historical corrections update relevant derived records.
- Private metrics remain private.

## Milestone 7 — UI polish and exports

Implement:
- Mobile-first dashboard
- Rest timer
- Workout calendar
- CSV export
- Loading and error states
- Accessibility
- PWA configuration

Acceptance:
- Main workout flows work on iPhone Safari.
- No major mobile layout overflow.
- Exported records are correct and authorized.

## Milestone 8 — Production readiness

Implement and verify:
- End-to-end tests
- Security review
- Migration review
- Environment separation
- Monitoring
- Backup and recovery plan
- Deployment
- Production smoke tests

Acceptance:
- Core flows work in production.
- Authorization tests pass.
- No critical errors remain.
- Deployment and test results are documented accurately.

# 25. DEFINITION OF DONE

A feature is not complete merely because its UI exists.

It is complete only when:
- Its expected behavior is implemented.
- Data persists correctly.
- Permissions are enforced.
- Validation and error handling exist.
- Relevant tests pass.
- Type checking and linting pass.
- The UI works on mobile and desktop.
- Loading, empty, error, and success states are handled.
- Documentation is updated where necessary.

At the end of every milestone, report:
1. What was implemented.
2. Important files and migrations changed.
3. Tests and checks executed, including failures.
4. Security or architectural implications.
5. Known limitations.
6. The next milestone.

# 26. FINAL PRODUCT ACCEPTANCE TEST

The application is not ready until this complete scenario succeeds:

- User A creates a group and invites User B.
- Both users join a shared Push Day routine.
- User A starts an ad hoc or planned workout.
- User B joins the same session.
- Both users log different weights, reps, and set counts.
- Updates appear in real time on both devices.
- User A finishes while User B continues.
- User B finishes later.
- Both individual summaries and the combined summary are available.
- The workout appears in personal histories.
- PRs and analytics update correctly.
- A routine change does not silently rewrite historical performance.
- Unauthorized access is rejected.
- Both users can recover the authoritative session state after reconnecting.

# 27. FIRST ACTION

Start with Milestone 0.

Inspect the repository and prepare a concise implementation plan. Identify any conflicts between the current repository and this specification.

Do not build everything immediately.

After the audit, proceed with the foundation and implement the application milestone by milestone, testing each major component before moving on.

This specification is the source of truth for the V1 product and its architecture.