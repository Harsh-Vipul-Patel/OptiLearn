-- 006: Persist subject color for cross-device consistency.
-- Adds subject_color to whichever subject table variant exists.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.subject') IS NOT NULL THEN
    ALTER TABLE public.subject
      ADD COLUMN IF NOT EXISTS subject_color VARCHAR(7);
  END IF;

  IF to_regclass('public.subjects') IS NOT NULL THEN
    ALTER TABLE public.subjects
      ADD COLUMN IF NOT EXISTS subject_color VARCHAR(7);
  END IF;
END $$;

COMMIT;
