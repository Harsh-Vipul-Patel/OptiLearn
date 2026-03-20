# OptiLearn Deployment Checklist

## ✅ Completed
- [x] Fixed Supabase schema (users table now uses auth.users.id)
- [x] API routes updated to use session.user.id directly
- [x] Environment variables properly separated (NEXT_PUBLIC_ vs server-only)
- [x] Vercel.json configured with correct CORS headers
- [x] No TypeScript/build errors
- [x] RLS policies enabled on users table

---

## 🔴 CRITICAL: Run These Supabase Migrations (In Order)

Go to **Supabase Dashboard → SQL Editor** and run these migrations in the exact order:

### 1. Enable Extensions
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

### 2. Run Migration 002: RLS Policies
Copy entire content from `supabase/migrations/002_rls_policies.sql` and run it.
This enables Row Level Security on all tables.

### 3. Run Migration 003: Realtime Enable
Copy entire content from `supabase/migrations/003_realtime_enable.sql` and run it.
This enables real-time subscriptions for dashboard updates.

### 4. Run Migration 004: RLS Delete Policies
Copy entire content from `supabase/migrations/004_rls_delete_policies.sql` and run it.
This adds delete policies to tables.

---

## 🚀 Deploy Frontend to Vercel

### 1. Push to GitHub
```bash
git add .
git commit -m "Ready for production deployment"
git push origin main
```

### 2. Connect to Vercel
1. Go to https://vercel.com/dashboard
2. Click "New Project"
3. Select your GitHub repo
4. Click "Import"

### 3. Set Environment Variables in Vercel
1. In Vercel Project Settings → **Environment Variables**
2. Add these variables:

```env
# Supabase - Public (Browser Safe)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Supabase - Server Only
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here

# Engine Backend
ENGINE_API_URL=https://your-engine-url.com
ENGINE_API_KEY=your_64_char_secret_key

# Node
NODE_ENV=production
```

### 4. Deploy
Click "Deploy" in Vercel dashboard.

---

## 🐍 Deploy FastAPI Engine Backend

Choose one:

### Option A: Railway (Recommended)
1. Go to https://railway.app
2. Create new project
3. Select "GitHub Repo" → your repo
4. Railway will auto-detect `engine/Dockerfile`
5. Set environment variables:
   - `ENGINE_API_KEY=your_secret_key`
   - `CALLBACK_URL=https://your-vercel-app.vercel.app/api/engine/callback`
6. Deploy

### Option B: Azure Container Instances
1. Build Docker image: `docker build -t optilearn-engine ./engine`
2. Push to Azure Container Registry
3. Deploy as ACI
4. Set env vars for API key and callback URL

### Option C: Docker Compose (Self-Hosted)
```bash
cd engine
docker build -t optilearn-engine .
docker run -e ENGINE_API_KEY=your_key -e CALLBACK_URL=https://yourapp.com/api/engine/callback -p 8000:8000 optilearn-engine
```

---

## 📋 Final Pre-Launch Checklist

### Database
- [ ] All 4 Supabase migrations run successfully
- [ ] RLS policies enabled on all tables
- [ ] Auth users can authenticate via Supabase
- [ ] Row Level Security blocking unauthorized access

### Frontend (Vercel)
- [ ] All environment variables set in Vercel
- [ ] Build completes without errors
- [ ] Can login and create subjects
- [ ] Can create study plans
- [ ] Supabase connection working

### Backend Engine
- [ ] FastAPI deployment running
- [ ] ENGINE_API_KEY matches between frontend and backend
- [ ] CALLBACK_URL points to your Vercel domain
- [ ] Can submit logs and receive analysis

### Testing
- [ ] Sign up with test account
- [ ] Create 2-3 subjects
- [ ] Add topics under subjects
- [ ] Create a study plan
- [ ] Log a study session
- [ ] Check for AI suggestions
- [ ] Test feedback submission

### Monitoring
- [ ] Set up Vercel error tracking
- [ ] Set up Supabase dashboard alerts (optional)
- [ ] Check logs for any errors

---

## 🔒 Security Checklist

- [ ] `.env.local` is in `.gitignore` (never commit secrets)
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` is safe to expose (public key)
- [ ] `ENGINE_API_KEY` is server-side only
- [ ] RLS policies prevent unauthorized data access
- [ ] CORS origin in vercel.json matches your domain

---

## 📊 Post-Deployment

1. **Monitor Errors**: Check Vercel error tracking
2. **Test APIs**: Run some sample requests to verify all endpoints work
3. **Monitor Database**: Check Supabase dashboard for any constraint violations
4. **Gradual Rollout**: Start with limited users, then scale up

---

## ❓ Troubleshooting

### "Table not found" errors
→ Verify all Supabase migrations were run

### RLS policy errors
→ Check that user_id matches session.user.id

### Engine callback failures
→ Verify CALLBACK_URL points to correct domain in Vercel

### CORS errors
→ Update `vercel.json` CORS origin to your production domain

---

## 📞 Need Help?

Reference:
- Supabase Docs: https://supabase.com/docs
- Next.js Docs: https://nextjs.org/docs
- Vercel Docs: https://vercel.com/docs
