-- ═══════════════════════════════════════════════════
-- 007: Daily Wellness Check-In Table
-- Science-backed metrics for cognitive readiness prediction
-- ═══════════════════════════════════════════════════

-- 1. DAILY_CHECKIN — one row per user per calendar day
CREATE TABLE IF NOT EXISTS public.daily_checkin (
  checkin_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  checkin_date      DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Sleep metrics (strongest cognitive predictor)
  sleep_hours       NUMERIC(3,1) CHECK (sleep_hours >= 0 AND sleep_hours <= 14),
  sleep_quality     INT CHECK (sleep_quality BETWEEN 1 AND 5),

  -- Physiological readiness
  energy_level      INT CHECK (energy_level BETWEEN 1 AND 5),
  stress_level      INT CHECK (stress_level BETWEEN 1 AND 5),

  -- Affective state
  mood              VARCHAR CHECK (mood IN ('Great','Good','Okay','Low','Bad')),

  -- Lifestyle factors (acute performance modulators)
  exercised_today   BOOLEAN DEFAULT FALSE,
  had_meal          BOOLEAN DEFAULT FALSE,
  screen_time_last_night VARCHAR CHECK (screen_time_last_night IN ('Low','Moderate','High')),

  -- Optional free-text
  notes             TEXT,

  created_at        TIMESTAMPTZ DEFAULT NOW(),

  -- Enforce exactly one check-in per user per day
  CONSTRAINT daily_checkin_user_date_unique UNIQUE (user_id, checkin_date)
);

-- Index for fast lookups by user + date
CREATE INDEX IF NOT EXISTS idx_daily_checkin_user_date
  ON public.daily_checkin (user_id, checkin_date DESC);

-- ═══════════════════════════════════════════════════
-- RLS Policies — users can only manage their own check-ins
-- ═══════════════════════════════════════════════════
ALTER TABLE public.daily_checkin ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- SELECT: users can read their own check-ins
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'daily_checkin' AND policyname = 'daily_checkin_select_own'
  ) THEN
    CREATE POLICY daily_checkin_select_own ON public.daily_checkin
      FOR SELECT USING (user_id = auth.uid());
  END IF;

  -- INSERT: users can create their own check-ins
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'daily_checkin' AND policyname = 'daily_checkin_insert_own'
  ) THEN
    CREATE POLICY daily_checkin_insert_own ON public.daily_checkin
      FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;

  -- UPDATE: users can update their own check-ins
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'daily_checkin' AND policyname = 'daily_checkin_update_own'
  ) THEN
    CREATE POLICY daily_checkin_update_own ON public.daily_checkin
      FOR UPDATE USING (user_id = auth.uid());
  END IF;
END
$$;

-- Also allow service_role full access (used by engine/API)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'daily_checkin' AND policyname = 'daily_checkin_service_all'
  ) THEN
    CREATE POLICY daily_checkin_service_all ON public.daily_checkin
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END
$$;
