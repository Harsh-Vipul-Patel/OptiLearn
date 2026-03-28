-- ═══════════════════════════════════════════════════
-- 005: Add start_time / end_time columns to daily_plan
-- Allows precise time-overlap checking instead of
-- the coarse Morning/Afternoon/Evening/Night slot.
-- ═══════════════════════════════════════════════════

ALTER TABLE public.daily_plan
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS end_time   TIME;

-- Add a constraint: end_time must be after start_time (when both are provided)
ALTER TABLE public.daily_plan
  ADD CONSTRAINT chk_plan_time_order
  CHECK (start_time IS NULL OR end_time IS NULL OR end_time > start_time);
