-- If the person who last edited a set deletes their account, keep the set (it belongs to its owner) and
-- forget who edited it. Previously ON DELETE RESTRICT would have blocked deleting any account that had
-- ever corrected a buddy's set. The BEFORE INSERT/UPDATE trigger still stamps the editor on every write.
ALTER TABLE public.workout_sets ALTER COLUMN last_edited_by DROP NOT NULL;
ALTER TABLE public.workout_sets DROP CONSTRAINT IF EXISTS workout_sets_last_edited_by_fkey;
ALTER TABLE public.workout_sets
  ADD CONSTRAINT workout_sets_last_edited_by_fkey
  FOREIGN KEY (last_edited_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
