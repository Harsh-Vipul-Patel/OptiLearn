-- ═══════════════════════════════════════════════════
-- 010: Active Recall Sessions & Confidence Ratings
-- Powers the spaced repetition and weak topic detector
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.recall_session (
  session_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  topic_id       UUID NOT NULL REFERENCES public.study_topic(topic_id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.recall_response (
  response_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID NOT NULL REFERENCES public.recall_session(session_id) ON DELETE CASCADE,
  flashcard_q    TEXT NOT NULL,
  flashcard_a    TEXT NOT NULL,
  confidence     INTEGER NOT NULL CHECK (confidence >= 1 AND confidence <= 5),
  is_correct     BOOLEAN NOT NULL,
  response_time_ms INTEGER,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for recall_session
ALTER TABLE public.recall_session ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own recall sessions" ON public.recall_session FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own recall sessions" ON public.recall_session FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own recall sessions" ON public.recall_session FOR DELETE USING (user_id = auth.uid());

-- RLS for recall_response
-- To access a recall response, the user must own the parent session
ALTER TABLE public.recall_response ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own recall responses" ON public.recall_response FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.recall_session s WHERE s.session_id = public.recall_response.session_id AND s.user_id = auth.uid())
);
CREATE POLICY "Users can insert own recall responses" ON public.recall_response FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.recall_session s WHERE s.session_id = session_id AND s.user_id = auth.uid())
);
CREATE POLICY "Users can delete own recall responses" ON public.recall_response FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.recall_session s WHERE s.session_id = public.recall_response.session_id AND s.user_id = auth.uid())
);
