# GymBuddy — V2 Product Direction (Addendum to MASTER_SPEC)

**Status:** Agreed with the product owner on 2026-10-19 after a requirements review ("grilling" session).
**Authority:** Where this document conflicts with [MASTER_SPEC.md](MASTER_SPEC.md), **this document wins**. Everything in the spec that is not contradicted here (tech stack, RLS rules, security, testing, realtime rules, unit handling, coding standards) still applies.
**Why it exists:** V1 was built around *groups/workspaces*. That concept never matched the real use case and made the product inconsistent. V2 replaces it with a solo tracker plus one optional training buddy.

---

## 1. Use case

- The user trains **6 days a week**: Push, Pull, Legs, Push, Pull, Shoulders+Arms (Sun rest). The split is **fully customizable**; it can change at any time.
- It is a **solo tracker first**. The user can optionally bring **one friend (buddy)** into a workout so both log in the same live session.
- Live workout screen (Option 1): the header holds the **All / Mine / <buddy>** bar. *All* shows your rows plus a one-line summary of the buddy's sets (tap it to open and correct them), *Mine* only yours, *<buddy>* their full rows.
- Primary device: **iPhone**, used in the gym. Delivered as an **installable PWA** (Safari → Add to Home Screen). No native app, no App Store, no Apple developer fee. Desktop remains supported for planning and review.
- Core moment: open the app → tap today's routine → log sets (with buddy if present) → finish.

## 2. Superseded concepts (remove from product and code)

| V1 concept | V2 replacement |
| --- | --- |
| Groups / workspaces / `workspace_members` / invite codes / `/group` | **Buddy link**: one persistent 1:1 connection between two users (request by username, accept) |
| Session belongs to a workspace | Session belongs to a **host user**; the buddy is a **participant** |
| Five tabs: Workout, Routines, Exercises, Groups, Analytics | Four tabs: **Today, Plan, History, Buddy** |
| "Prefill" set values | Last-time values shown as **placeholders**; the user types or confirms |

Keep (do not cut): kg/lb preference, scheduling, body metrics, exercise catalog, settings (profile menu), PWA, exports, Iron Black theme and accents.

## 3. Information architecture

- **In-progress bar**: while a workout is live, every page except the workout itself shows a "Workout in progress" bar above the bottom nav with the elapsed time and a **Resume** button.
- **Today** (home): scheduled routine for today, exercise preview, "Train with buddy" toggle, Start / Resume, week strip, recent sessions.
- **Plan**: segmented *Schedule | Routines | Exercises*. Weekly schedule maps weekday → routine (Sun = rest by default). Routine builder sets name, **days it runs on**, exercises and target sets; exercises are added from the catalog or created inline.
- **History**: past sessions, personal records, volume/1RM charts, body metrics, exports.
- **Buddy**: buddy link management and shared sessions.
- **Profile menu** (not a tab): Settings (appearance, units), sign out.

## 4. Domain rules

1. **Routines are versioned.** A session snapshots the routine version it used; editing the split never rewrites history.
2. **Schedule** is a repeating weekly template (weekday → routine). Missed days do not roll over. Any routine can be started manually on any day.
3. **Shared session**: the host's routine is the template. Each participant has an **independent log** per exercise. Adding/skipping an exercise affects only that participant's own list.
4. **Mutual editing**: either participant may edit any set in the session, **including after the session is finished** (no locking). Each set records `last_edited_by`; the UI shows who edited. Totals and PRs recompute on edit. Conflicts are detected with `revision_number`; no silent overwrites.
5. **Visibility**: the buddy sees **only sessions done together**. Solo workouts, analytics and body metrics are private (enforced by RLS, not just UI).
6. **Set entry**: last-time values appear as grey **placeholders** in empty inputs. Logging a set requires typing values or an explicit confirm tap (which accepts the placeholder values).
7. **No rest timer.** Rest between sets is not tracked: no timer starts when a set is logged, and routines have no rest setting.
8. **Units**: canonical storage in kg; display per user preference.

## 5. Live buddy system

**Invite**
- Starting a session with "Train with buddy" on writes a `session_participants` row for the buddy with status `invited`. The invite is a database row; delivery is best-effort in three layers:
  1. **Realtime** (buddy's app open): banner "X started Push A — Join?" plus a Join button on Today and Buddy tabs.
  2. **Web Push** (buddy installed the PWA and allowed notifications; iOS 16.4+): sent from the server with the `web-push` library and VAPID keys. No third-party service. Treated as unreliable-by-nature (iOS may delay/drop).
  3. **Share link** fallback via the iOS share sheet (iMessage/WhatsApp); opens the invite after sign-in.
- **Joining always requires confirmation** (Join / Decline). Opening a notification never drops the buddy into a workout automatically.
- The buddy may join late or leave early; their sets remain in the shared session and their own history.
- Build order: invite via DB + Realtime + share link first; Web Push afterwards.

**Sync**
- One **private Realtime channel per session**, authorized by RLS so only the two participants can subscribe.
- Every mutation is committed to PostgreSQL first; the other phone updates only from the confirmed change (never from optimistic local state).
- **Presence** drives "Buddy is here · live" and the buddy's current set.
- Stable client-generated set IDs, idempotent writes, `revision_number` conflict detection.
- On reconnect: refetch authoritative session state, then merge queued local writes; conflicts surface to the user.

## 6. Data model (clean reset — no migration of V1 data)

V1 data is test data. The Supabase schema is **dropped and recreated** via version-controlled migrations; generated types must match.

Tables (names indicative; finalize in the Milestone 15 migration):
- `profiles` (id, username, display_name, preferred_unit, …)
- `buddy_links` (id, user_a, user_b, status `pending|accepted`, requested_by, created_at) — max one accepted link per user in V2 (enforced by constraint/function)
- `exercises` (system + user-owned custom)
- `routines`, `routine_versions` (+ per-version exercise list with target sets)
- `weekly_schedule` (user_id, weekday 0–6, routine_id nullable = rest)
- `workout_sessions` (host_id, routine_version_id nullable, status, started_at, finished_at)
- `session_participants` (session_id, user_id, status `invited|joined|declined|left`, completed_at)
- `set_records` (id, session_id, participant_id, exercise_id, set_number, weight_kg, reps, set_type, completed, revision_number, last_edited_by, timestamps)
- `body_metrics` (private)
- `push_subscriptions` (user_id, endpoint, keys)

RLS: enabled and tested on every table. Visibility of a session and its sets = host or an accepted/joined participant. Buddy link rows visible only to the two parties. No service-role key on the client.

## 7. Delivery

Mobile target: installable PWA, polished for iPhone (home-screen install prompt, safe areas, offline-tolerant logging queue). Native (Expo) is explicitly out of scope; revisit only if a real PWA limitation is hit.

Screen designs (Iron Black theme, lime default accent): Claude Design canvas "Workout Logging Screen" — https://claude.ai/artifact/E3Vj7SZqRuRtYef5PNcxAD (Today, Plan, Routine builder, Solo workout, Workout with buddy).
