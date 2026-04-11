-- ═══════════════════════════════════════════════════
-- 009: Exam Goals — target exam dates + required hours
-- Powers the "Exam Readiness Score" feature.
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.exam_goal (
  exam_goal_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  subject_id     UUID NOT NULL REFERENCES public.subject(subject_id) ON DELETE CASCADE,
  exam_name      VARCHAR NOT NULL DEFAULT '',
  exam_date      DATE NOT NULL,
  target_hours   NUMERIC(6,1) NOT NULL DEFAULT 40,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.exam_goal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own exam goals"
  ON public.exam_goal FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own exam goals"
  ON public.exam_goal FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own exam goals"
  ON public.exam_goal FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own exam goals"
  ON public.exam_goal FOR DELETE
  USING (user_id = auth.uid());
