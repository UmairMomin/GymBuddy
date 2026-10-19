-- MANUAL SCRIPT (not a migration). Restores the built-in exercise list after a full reset.
-- Paste into Supabase dashboard > SQL editor and run. Safe to run more than once.
INSERT INTO public.exercises (name, category, primary_equipment, is_custom) VALUES
  ('Barbell Bench Press', 'chest', 'barbell', false),
  ('Incline Dumbbell Press', 'chest', 'dumbbell', false),
  ('Chest Dip', 'chest', 'bodyweight', false),
  ('Barbell Back Squat', 'legs', 'barbell', false),
  ('Romanian Deadlift', 'legs', 'barbell', false),
  ('Leg Press', 'legs', 'machine', false),
  ('Standing Overhead Press', 'shoulders', 'barbell', false),
  ('Dumbbell Lateral Raise', 'shoulders', 'dumbbell', false),
  ('Barbell Deadlift', 'back', 'barbell', false),
  ('Pull-Up', 'back', 'bodyweight', false),
  ('Barbell Bent-Over Row', 'back', 'barbell', false),
  ('Lat Pulldown', 'back', 'cable', false),
  ('Barbell Bicep Curl', 'arms', 'barbell', false),
  ('Tricep Rope Pushdown', 'arms', 'cable', false),
  ('Hanging Leg Raise', 'core', 'bodyweight', false),
  ('Plank', 'core', 'bodyweight', false)
ON CONFLICT DO NOTHING;

SELECT count(*) AS exercises FROM public.exercises;
