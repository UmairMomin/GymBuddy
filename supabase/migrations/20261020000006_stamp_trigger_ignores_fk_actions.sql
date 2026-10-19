-- The stamping trigger must not treat the FK action "ON DELETE SET NULL last_edited_by" (an UPDATE that
-- changes only last_edited_by) as a user edit: it would re-stamp the deleted user and bump the revision.
CREATE OR REPLACE FUNCTION public.workout_sets_stamp()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.last_edited_by := auth.uid();
    NEW.revision_number := 1;
  ELSE
    IF NEW.session_id <> OLD.session_id OR NEW.user_id <> OLD.user_id THEN
      RAISE EXCEPTION 'session_id and user_id are immutable';
    END IF;
    -- Referential action (editor account deleted): only last_edited_by changed. Leave it alone.
    IF NEW.last_edited_by IS DISTINCT FROM OLD.last_edited_by
       AND ROW(NEW.exercise_id, NEW.set_order, NEW.set_type, NEW.weight_kg, NEW.reps, NEW.rpe, NEW.completed, NEW.notes)
           IS NOT DISTINCT FROM
           ROW(OLD.exercise_id, OLD.set_order, OLD.set_type, OLD.weight_kg, OLD.reps, OLD.rpe, OLD.completed, OLD.notes)
    THEN
      RETURN NEW;
    END IF;
    NEW.last_edited_by := auth.uid();
    NEW.revision_number := OLD.revision_number + 1;
    NEW.updated_at := timezone('utc'::text, now());
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.workout_sets_stamp() FROM PUBLIC, anon, authenticated;
