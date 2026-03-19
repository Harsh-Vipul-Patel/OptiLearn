-- 004: Add missing DELETE policies on all tables
-- Without DELETE policies, RLS blocks all row deletions even for the owner.

CREATE POLICY "delete_own" ON public.users
  FOR DELETE USING (auth.uid() = id);

CREATE POLICY "delete_own" ON public.subjects
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "delete_own" ON public.study_topics
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.subjects WHERE id = study_topics.subject_id AND user_id = auth.uid())
  );

CREATE POLICY "delete_own" ON public.daily_plans
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "delete_own" ON public.study_logs
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "delete_own" ON public.suggestions
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "delete_own" ON public.feedback
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.suggestions WHERE id = feedback.suggestion_id AND user_id = auth.uid())
  );
