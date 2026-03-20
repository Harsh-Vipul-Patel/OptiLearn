-- 005: Align public.users with auth.users(id) via users.user_id
-- Idempotent migration: avoids destructive drops and safely updates schema/policies.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.users') IS NULL THEN
    CREATE TABLE public.users (
      user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      name VARCHAR NOT NULL,
      email VARCHAR NOT NULL UNIQUE,
      exam_type VARCHAR CHECK (exam_type IN ('JEE', 'NEET', 'Boards', 'Others')),
      preferred_study_time VARCHAR CHECK (preferred_study_time IN ('Morning', 'Afternoon', 'Evening', 'Night')),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  ELSE
    -- If older schema used id, rename it to user_id.
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'id'
    ) AND NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'user_id'
    ) THEN
      ALTER TABLE public.users RENAME COLUMN id TO user_id;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'name'
    ) THEN
      ALTER TABLE public.users ADD COLUMN name VARCHAR;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'email'
    ) THEN
      ALTER TABLE public.users ADD COLUMN email VARCHAR;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'preferred_time'
    ) AND NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'preferred_study_time'
    ) THEN
      ALTER TABLE public.users RENAME COLUMN preferred_time TO preferred_study_time;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'preferred_study_time'
    ) THEN
      ALTER TABLE public.users ADD COLUMN preferred_study_time VARCHAR;
    END IF;

    -- Backfill email/name from auth.users where missing.
    UPDATE public.users u
    SET email = a.email
    FROM auth.users a
    WHERE u.user_id = a.id
      AND (u.email IS NULL OR u.email = '');

    UPDATE public.users u
    SET name = COALESCE(
      a.raw_user_meta_data->>'name',
      a.raw_user_meta_data->>'full_name',
      split_part(COALESCE(a.email, u.email), '@', 1),
      'User'
    )
    FROM auth.users a
    WHERE u.user_id = a.id
      AND (u.name IS NULL OR u.name = '');

    -- Ensure constraints can be applied without null failures.
    UPDATE public.users
    SET email = user_id::text || '@local.invalid'
    WHERE email IS NULL OR email = '';

    UPDATE public.users
    SET name = split_part(email, '@', 1)
    WHERE name IS NULL OR name = '';

    ALTER TABLE public.users
      ALTER COLUMN user_id SET NOT NULL,
      ALTER COLUMN email SET NOT NULL,
      ALTER COLUMN name SET NOT NULL;

    -- Ensure FK to auth.users(id) exists for user_id.
    IF EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'users'
        AND c.conname = 'users_user_id_fkey'
    ) THEN
      ALTER TABLE public.users DROP CONSTRAINT users_user_id_fkey;
    END IF;

    ALTER TABLE public.users
      ADD CONSTRAINT users_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

    -- Ensure primary key exists on user_id.
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'users'
        AND c.contype = 'p'
    ) THEN
      ALTER TABLE public.users ADD PRIMARY KEY (user_id);
    END IF;

    -- Enforce unique email if not already present.
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'users'
        AND c.conname = 'users_email_key'
    ) THEN
      ALTER TABLE public.users ADD CONSTRAINT users_email_key UNIQUE (email);
    END IF;
  END IF;
END $$;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own" ON public.users;
DROP POLICY IF EXISTS "insert_own" ON public.users;
DROP POLICY IF EXISTS "update_own" ON public.users;
DROP POLICY IF EXISTS "delete_own" ON public.users;
DROP POLICY IF EXISTS "users_select_own" ON public.users;
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS "users_delete_own" ON public.users;

CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_delete_own" ON public.users
  FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.users (user_id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (user_id) DO UPDATE
  SET email = EXCLUDED.email,
      name = COALESCE(EXCLUDED.name, public.users.name);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMIT;
