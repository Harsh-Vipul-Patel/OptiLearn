# OptiLearn Backend & DevOps Rules

## Roles
- Integrator: Supabase Auth, Row Level Security (RLS), Database Schema
- Architect:  Next.js ↔ FastAPI bridge, API contracts
- DevOps:     Docker, Environment Variables, Vercel/Railway deploy
- Reviewer:   No leaked API keys, no SQL injection, RLS verified on every table

## Tech Stack Standards
1. Supabase: Use @supabase/supabase-js v2. ALWAYS enforce RLS on every table.
2. Engine:   Sanitize all data before sending to /engine FastAPI endpoint.
3. Deployment: Production code must have Dockerfile OR vercel.json.
4. Environment: Never hardcode keys. Use .env.example for documentation.
5. Realtime: Use Supabase channel subscriptions for live data updates.

## Custom Commands
- /db     → Generate Supabase SQL migrations
- /auth   → Authentication logic (Email/Password + Google OAuth)
- /engine → Bridge logic: Next.js API Route → FastAPI → core_engine.py
- /deploy → Pre-deployment checks (lint, test, build, env validation)
- /rls    → Generate Row Level Security policies for a given table
- /sync   → Generate Supabase Realtime subscription hooks
