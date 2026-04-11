-- ═══════════════════════════════════════════════════
-- 012: Concept Dependency Map
-- Track prerequisite relationships between study topics
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.topic_dependency (
  dependency_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  parent_topic_id   UUID NOT NULL REFERENCES public.study_topic(topic_id) ON DELETE CASCADE,
  child_topic_id    UUID NOT NULL REFERENCES public.study_topic(topic_id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT parent_child_unique UNIQUE(parent_topic_id, child_topic_id)
);

ALTER TABLE public.topic_dependency ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own topic dependencies" ON public.topic_dependency FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own topic dependencies" ON public.topic_dependency FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own topic dependencies" ON public.topic_dependency FOR DELETE USING (user_id = auth.uid());
