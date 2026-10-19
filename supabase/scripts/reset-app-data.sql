-- ==============================================================================
-- MANUAL SCRIPT — NOT A MIGRATION. Do not move this into supabase/migrations.
-- FULL CLEAN SLATE: deletes ALL app data, ALL profiles and ALL user accounts,
-- including routines and every exercise (built-in and custom).
-- Run it yourself in the Supabase dashboard > SQL editor, after a backup
-- (Dashboard > Database > Backups). It is irreversible. There is no BEGIN/COMMIT:
-- the statements run and are saved as soon as you press Run.
-- ==============================================================================

TRUNCATE TABLE
  public.session_events,
  public.workout_sets,
  public.session_participants,
  public.scheduled_workouts,
  public.workout_sessions,
  public.routine_versions,
  public.routines,
  public.body_metrics,
  public.exercises,
  public.workspace_members,
  public.workspaces,
  public.profiles
CASCADE;

-- Accounts (cascades to anything still referencing them).
DELETE FROM auth.users;

-- Re-seed the 16 standard exercises from migration 20261012000000 so the exercise
-- picker is not empty. Delete this block if you truly want ZERO exercises.
-- INSERT INTO public.exercises (name, category, primary_equipment, is_custom) VALUES
--   ('Barbell Bench Press', 'chest', 'barbell', false),
--   ('Incline Dumbbell Press', 'chest', 'dumbbell', false),
--   ('Chest Dip', 'chest', 'bodyweight', false),
--   ('Barbell Back Squat', 'legs', 'barbell', false),
--   ('Romanian Deadlift', 'legs', 'barbell', false),
--   ('Leg Press', 'legs', 'machine', false),
--   ('Standing Overhead Press', 'shoulders', 'barbell', false),
--   ('Dumbbell Lateral Raise', 'shoulders', 'dumbbell', false),
--   ('Barbell Deadlift', 'back', 'barbell', false),
--   ('Pull-Up', 'back', 'bodyweight', false),
--   ('Barbell Bent-Over Row', 'back', 'barbell', false),
--   ('Lat Pulldown', 'back', 'cable', false),
--   ('Barbell Bicep Curl', 'arms', 'barbell', false),
--   ('Tricep Rope Pushdown', 'arms', 'cable', false),
--   ('Hanging Leg Raise', 'core', 'bodyweight', false),
--   ('Plank', 'core', 'bodyweight', false)
-- ON CONFLICT DO NOTHING;

-- Sanity check: everything should be 0 except exercises (16 if re-seeded).
SELECT
  (SELECT count(*) FROM auth.users)              AS users,
  (SELECT count(*) FROM public.profiles)         AS profiles,
  (SELECT count(*) FROM public.workspaces)       AS workspaces,
  (SELECT count(*) FROM public.routines)         AS routines,
  (SELECT count(*) FROM public.workout_sessions) AS sessions,
  (SELECT count(*) FROM public.exercises)        AS exercises;

