-- 4.1 Enable RLS on All Tables
ALTER TABLE public.users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_topics  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_plans   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggestions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback      ENABLE ROW LEVEL SECURITY;

-- users policies
CREATE POLICY "select_own" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "insert_own" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "update_own" ON public.users FOR UPDATE USING (auth.uid() = id);

-- subjects policies
CREATE POLICY "select_own" ON public.subjects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON public.subjects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON public.subjects FOR UPDATE USING (auth.uid() = user_id);

-- study_topics policies
CREATE POLICY "select_own" ON public.study_topics FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.subjects WHERE id = study_topics.subject_id AND user_id = auth.uid())
);
CREATE POLICY "insert_own" ON public.study_topics FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.subjects WHERE id = subject_id AND user_id = auth.uid())
);
CREATE POLICY "update_own" ON public.study_topics FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.subjects WHERE id = study_topics.subject_id AND user_id = auth.uid())
);

-- daily_plans policies
CREATE POLICY "select_own" ON public.daily_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON public.daily_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON public.daily_plans FOR UPDATE USING (auth.uid() = user_id);

-- study_logs policies
CREATE POLICY "select_own" ON public.study_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON public.study_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON public.study_logs FOR UPDATE USING (auth.uid() = user_id);

-- suggestions policies
CREATE POLICY "select_own" ON public.suggestions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON public.suggestions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON public.suggestions FOR UPDATE USING (auth.uid() = user_id);

-- feedback policies
CREATE POLICY "select_own" ON public.feedback FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.suggestions WHERE id = feedback.suggestion_id AND user_id = auth.uid())
);
CREATE POLICY "insert_own" ON public.feedback FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.suggestions WHERE id = suggestion_id AND user_id = auth.uid())
);
CREATE POLICY "update_own" ON public.feedback FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.suggestions WHERE id = feedback.suggestion_id AND user_id = auth.uid())
);
