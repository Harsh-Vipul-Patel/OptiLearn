-- 3.1 USER Table
CREATE TABLE public.users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR UNIQUE NOT NULL,
  name          VARCHAR NOT NULL,
  exam_type     VARCHAR CHECK (exam_type IN ('JEE','NEET','Boards','Others')),
  preferred_time VARCHAR CHECK (preferred_time IN ('Morning','Afternoon','Evening','Night')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 3.2 SUBJECTS & STUDY_TOPICS Tables
CREATE TABLE public.subjects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES public.users(id) ON DELETE CASCADE,
  subject_name  VARCHAR NOT NULL,
  category      VARCHAR,  -- 'Mathematics','Physics','Programming', etc.
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.study_topics (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id    UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  topic_name    VARCHAR NOT NULL,
  complexity    VARCHAR CHECK (complexity IN ('Easy','Medium','Hard')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 3.3 DAILY_PLAN Table
CREATE TABLE public.daily_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES public.users(id) ON DELETE CASCADE,
  topic_id        UUID REFERENCES public.study_topics(id),
  target_duration INT NOT NULL CHECK (target_duration > 0),  -- minutes
  time_slot       VARCHAR CHECK (time_slot IN ('Morning','Afternoon','Evening','Night')),
  plan_date       DATE NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 3.4 STUDY_LOG Table (core data source for engine)
CREATE TABLE public.study_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         UUID REFERENCES public.daily_plans(id),
  user_id         UUID REFERENCES public.users(id) ON DELETE CASCADE,
  start_time      TIMESTAMPTZ NOT NULL,
  end_time        TIMESTAMPTZ NOT NULL,
  focus_level     INT CHECK (focus_level BETWEEN 1 AND 5),
  distractions    VARCHAR,  -- comma-separated: 'PHONE,TIRED'
  reflection      TEXT,
  fatigue_level   INT CHECK (fatigue_level BETWEEN 1 AND 5),
  -- Engine output columns (written back after analysis)
  efficiency      NUMERIC(5,2),
  throughput      NUMERIC(8,2),
  quality_score   NUMERIC(5,1),
  analyzed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 3.5 SUGGESTION & FEEDBACK Tables
CREATE TABLE public.suggestions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES public.users(id) ON DELETE CASCADE,
  log_id          UUID REFERENCES public.study_logs(id),
  suggestion_text TEXT NOT NULL,
  suggestion_type VARCHAR,  -- 'burnout','reinforcement','planning'
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.feedback (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id   UUID REFERENCES public.suggestions(id),
  reaction        VARCHAR CHECK (reaction IN ('like','dislike')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Supabase trigger: auto-create profile on signup
CREATE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
