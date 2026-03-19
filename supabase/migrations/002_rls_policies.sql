-- ═══════════════════════════════════════════════════
-- 002: RLS Policies  (run after 001_initial_schema.sql)
-- ═══════════════════════════════════════════════════

-- Enable RLS
ALTER TABLE public.users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_topics  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_plans   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggestions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback      ENABLE ROW LEVEL SECURITY;

-- ── users ──────────────────────────────────────────
DROP POLICY IF EXISTS "select_own" ON public.users;
DROP POLICY IF EXISTS "insert_own" ON public.users;
DROP POLICY IF EXISTS "update_own" ON public.users;
DROP POLICY IF EXISTS "delete_own" ON public.users;
CREATE POLICY "select_own" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "insert_own" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "update_own" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "delete_own" ON public.users FOR DELETE USING (auth.uid() = id);

-- ── subjects ────────────────────────────────────────
DROP POLICY IF EXISTS "select_own" ON public.subjects;
DROP POLICY IF EXISTS "insert_own" ON public.subjects;
DROP POLICY IF EXISTS "update_own" ON public.subjects;
DROP POLICY IF EXISTS "delete_own" ON public.subjects;
CREATE POLICY "select_own" ON public.subjects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON public.subjects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON public.subjects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete_own" ON public.subjects FOR DELETE USING (auth.uid() = user_id);

-- ── study_topics ────────────────────────────────────
DROP POLICY IF EXISTS "select_own" ON public.study_topics;
DROP POLICY IF EXISTS "insert_own" ON public.study_topics;
DROP POLICY IF EXISTS "update_own" ON public.study_topics;
DROP POLICY IF EXISTS "delete_own" ON public.study_topics;
CREATE POLICY "select_own" ON public.study_topics FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.subjects WHERE id = study_topics.subject_id AND user_id = auth.uid())
);
CREATE POLICY "insert_own" ON public.study_topics FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.subjects WHERE id = subject_id AND user_id = auth.uid())
);
CREATE POLICY "update_own" ON public.study_topics FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.subjects WHERE id = study_topics.subject_id AND user_id = auth.uid())
);
CREATE POLICY "delete_own" ON public.study_topics FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.subjects WHERE id = study_topics.subject_id AND user_id = auth.uid())
);

-- ── daily_plans ─────────────────────────────────────
DROP POLICY IF EXISTS "select_own" ON public.daily_plans;
DROP POLICY IF EXISTS "insert_own" ON public.daily_plans;
DROP POLICY IF EXISTS "update_own" ON public.daily_plans;
DROP POLICY IF EXISTS "delete_own" ON public.daily_plans;
CREATE POLICY "select_own" ON public.daily_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON public.daily_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON public.daily_plans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete_own" ON public.daily_plans FOR DELETE USING (auth.uid() = user_id);

-- ── study_logs ──────────────────────────────────────
DROP POLICY IF EXISTS "select_own" ON public.study_logs;
DROP POLICY IF EXISTS "insert_own" ON public.study_logs;
DROP POLICY IF EXISTS "update_own" ON public.study_logs;
DROP POLICY IF EXISTS "delete_own" ON public.study_logs;
CREATE POLICY "select_own" ON public.study_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON public.study_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON public.study_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete_own" ON public.study_logs FOR DELETE USING (auth.uid() = user_id);

-- ── suggestions ─────────────────────────────────────
DROP POLICY IF EXISTS "select_own" ON public.suggestions;
DROP POLICY IF EXISTS "insert_own" ON public.suggestions;
DROP POLICY IF EXISTS "update_own" ON public.suggestions;
DROP POLICY IF EXISTS "delete_own" ON public.suggestions;
CREATE POLICY "select_own" ON public.suggestions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON public.suggestions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON public.suggestions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete_own" ON public.suggestions FOR DELETE USING (auth.uid() = user_id);

-- ── feedback ────────────────────────────────────────
DROP POLICY IF EXISTS "select_own" ON public.feedback;
DROP POLICY IF EXISTS "insert_own" ON public.feedback;
DROP POLICY IF EXISTS "update_own" ON public.feedback;
DROP POLICY IF EXISTS "delete_own" ON public.feedback;
CREATE POLICY "select_own" ON public.feedback FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.suggestions WHERE id = feedback.suggestion_id AND user_id = auth.uid())
);
CREATE POLICY "insert_own" ON public.feedback FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.suggestions WHERE id = suggestion_id AND user_id = auth.uid())
);
CREATE POLICY "update_own" ON public.feedback FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.suggestions WHERE id = feedback.suggestion_id AND user_id = auth.uid())
);
CREATE POLICY "delete_own" ON public.feedback FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.suggestions WHERE id = feedback.suggestion_id AND user_id = auth.uid())
);
