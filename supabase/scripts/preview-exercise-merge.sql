-- Read-only: which exercises will be merged by the universal-library migration (same name, any case).
SELECT lower(name) AS name, count(*) AS copies, array_agg(id ORDER BY (owner_id IS NULL) DESC, created_at) AS ids
  FROM public.exercises GROUP BY lower(name) HAVING count(*) > 1 ORDER BY 1;
