-- ═══════════════════════════════════════════════════
-- 001: Initial Schema  (run this first in Supabase SQL Editor)
-- ═══════════════════════════════════════════════════

-- 1. USERS table — id mirrors auth.users.id (no random UUID default)
CREATE TABLE IF NOT EXISTS public.users (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email          VARCHAR UNIQUE NOT NULL,
  name           VARCHAR,
  exam_type      VARCHAR CHECK (exam_type IN ('JEE','NEET','Boards','Others')),
  preferred_time VARCHAR CHECK (preferred_time IN ('Morning','Afternoon','Evening','Night')),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 2. SUBJECTS
CREATE TABLE IF NOT EXISTS public.subjects (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subject_name VARCHAR NOT NULL,
  category     VARCHAR,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 3. STUDY_TOPICS
CREATE TABLE IF NOT EXISTS public.study_topics (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  topic_name VARCHAR NOT NULL,
  complexity VARCHAR CHECK (complexity IN ('Easy','Medium','Hard')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. DAILY_PLANS
CREATE TABLE IF NOT EXISTS public.daily_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  topic_id        UUID REFERENCES public.study_topics(id),
  target_duration INT NOT NULL CHECK (target_duration > 0),
  time_slot       VARCHAR CHECK (time_slot IN ('Morning','Afternoon','Evening','Night')),
  plan_date       DATE NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 5. STUDY_LOGS
CREATE TABLE IF NOT EXISTS public.study_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id       UUID REFERENCES public.daily_plans(id),
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  start_time    TIMESTAMPTZ NOT NULL,
  end_time      TIMESTAMPTZ NOT NULL,
  focus_level   INT CHECK (focus_level BETWEEN 1 AND 5),
  distractions  VARCHAR,
  reflection    TEXT,
  fatigue_level INT CHECK (fatigue_level BETWEEN 1 AND 5),
  efficiency    NUMERIC(5,2),
  throughput    NUMERIC(8,2),
  quality_score NUMERIC(5,1),
  analyzed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 6. SUGGESTIONS
CREATE TABLE IF NOT EXISTS public.suggestions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  log_id          UUID REFERENCES public.study_logs(id),
  suggestion_text TEXT NOT NULL,
  suggestion_type VARCHAR,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 7. FEEDBACK
CREATE TABLE IF NOT EXISTS public.feedback (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id UUID REFERENCES public.suggestions(id),
  reaction      VARCHAR CHECK (reaction IN ('like','dislike')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════
-- Trigger: auto-create a public.users row on signup
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        name  = COALESCE(EXCLUDED.name, public.users.name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
