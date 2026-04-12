<p align="center">
  <img src="https://img.shields.io/badge/🧠_OptiLearn-AI_Study_Intelligence-C96B3A?style=for-the-badge&labelColor=1E1E2E" alt="OptiLearn" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.2-black?style=flat-square&logo=next.js&logoColor=white" />
  <img src="https://img.shields.io/badge/React-19.2-61DAFB?style=flat-square&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat-square&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/Python-3.10+-3776AB?style=flat-square&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase&logoColor=white" />
  <img src="https://img.shields.io/badge/LangGraph-Pipeline-FF6F00?style=flat-square&logo=chainlink&logoColor=white" />
  <img src="https://img.shields.io/badge/Groq-LLaMA_3.3_70B-F55036?style=flat-square&logo=meta&logoColor=white" />
</p>

<p align="center">
  <b>Adaptive cognitive intelligence that learns how you study and tells you what to change next.</b>
</p>

---

## 🔥 What Is OptiLearn?

Most study apps answer: *"What did I plan?"* and *"What did I log?"*

**OptiLearn answers the harder question:**

> ### 💡 *"What should I do next — based on how I actually study?"*

OptiLearn is not a static planner or tracker. It is an **adaptive decision system** that closes the loop between planning, behavior signals, analysis, and next-day strategy.

<br>

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        🌐 FRONTEND (Vercel)                        │
│                   Next.js 16 · React 19 · TypeScript                │
│                                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │📊 Dash-  │ │📅 Study  │ │⏱️ Session│ │🧠 AI     │ │📈 Analy- │ │
│  │  board   │ │ Planner  │ │  Logger  │ │ Insights │ │  tics    │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ │
│       │             │            │             │            │       │
│  ┌────┴─────────────┴────────────┴─────────────┴────────────┴────┐ │
│  │                  Next.js API Routes (15 endpoints)            │ │
│  └───────────────────────────┬───────────────────────────────────┘ │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
             ┌─────────────────┼─────────────────┐
             │                 │                  │
             ▼                 ▼                  ▼
┌────────────────────┐  ┌─────────────┐  ┌──────────────────┐
│  🗃️ SUPABASE       │  │  🤖 ENGINE  │  │  ☁️ GROQ API      │
│  PostgreSQL + Auth │  │  FastAPI    │  │  LLaMA 3.3 70B   │
│  + Realtime + RLS  │  │  (Render)  │  │  Inference        │
└────────────────────┘  └─────────────┘  └──────────────────┘
```

<br>

## ✨ Core Features

### 📅 Smart Study Planner
> Plan your day with subject-topic-timeslot scheduling, difficulty tagging, and overlap-safe time controls.

- Create daily study plans with **Morning / Afternoon / Evening / Night** slots
- Optional precise **start/end times** with database-enforced ordering (`end > start`)
- Track plan completion: **Done · In Progress · Upcoming** status badges
- **Subject color coding** and custom topic organization

### ⏱️ Session Logger
> Record what actually happened — focus, fatigue, distractions, and reflections.

- Log sessions against planned entries: **start/end time, focus (1–5), fatigue (1–5)**
- Multi-select **distraction tracker**: Phone, Fatigue, Boredom, Hard Material, Noise, Social Media
- Validates: no future times, no overlaps, end > start
- Auto-triggers **AI analysis** on every new log

### 🧠 AI Insights Engine
> Evidence-based, non-generic recommendations powered by a 4-node LangGraph pipeline.

```
📝 Validate  →  🔍 Build Context  →  🤖 Generate  →  📊 Parse Response
   │                   │                   │                   │
   │  Session data     │  8 derived        │  Groq LLM call   │  Structured
   │  validation       │  patterns         │  (LLaMA 3.3)     │  JSON output
```

**8 Cross-Dimensional Patterns** computed before LLM inference:
| Pattern | What it measures |
|---------|-----------------|
| 📊 Planning Accuracy | Actual vs planned duration completion rate |
| 🔬 Subject × Timeslot | Best performing subject-time combinations |
| 📱 Distraction Triggers | Which distractions correlate with efficiency drops |
| 😴 Fatigue Curve | How fatigue progresses across session sequences |
| 🎯 Deep Work Ratio | Percentage of high-focus (4-5) sessions |
| ⭐ Best/Worst Combo | Highest and lowest efficiency subject-slot pairs |
| ✅ Completion Rate | Sessions reaching ≥80% target duration |
| ⚡ Efficiency Trajectory | Linear regression trend (`np.polyfit`) |

### 📊 Analytics Dashboard
> Your productivity story, told through live charts and visual breakdowns.

| This Week | This Month | Weekly Digest |
|-----------|------------|---------------|
| Planned vs Actual bar chart | Planned vs Actual (filterable by week) | 3 Wins · 3 Issues · 3 Actions |
| Hours by Subject doughnut | Subject Priority Matrix (scatter) | Total hours, sessions, avg efficiency |
| Focus by Day line chart | Time-on-Task Correlation (scatter) | Best/worst subject identification |
| 4-Week Activity Heatmap | Procrastination Tracker (by timeslot) | Actionable recommendations |
| Stat cards with deltas | Efficiency by Weekday | Exportable as **PDF** 📄 |

### 🛡️ Burnout & Wellness Monitor
> Neuroscience-weighted readiness scoring from daily wellness check-ins.

**Daily Check-In captures 8 signals:**
| Signal | Input |
|--------|-------|
| 🌙 Sleep Hours | 0–14 hrs |
| ⭐ Sleep Quality | 1–5 scale |
| ⚡ Energy Level | 1–5 scale |
| 😰 Stress Level | 1–5 scale (inverse weighting) |
| 😊 Mood | Great · Good · Okay · Low · Bad |
| 🏃 Exercise | Yes / No |
| 🍽️ Meal Status | Yes / No |
| 📱 Screen Time | Low · Moderate · High |

**Readiness Score** = weighted composite → **0–100 score** displayed on dashboard

**Burnout Monitor** = 7-session signal blend:  
`Burnout = 0.50 × Fatigue% + 0.25 × (100 − Consistency%) + 0.25 × (100 − Focus%)`  
Risk: **Low** (<40) · **Medium** (40–67) · **High** (≥67)

### 📚 Knowledge Vault
> AI-generated flashcards with spaced repetition tracking.

- Paste study notes → **Groq generates Q&A flashcard pairs**
- Interactive **flip cards** with question numbering
- **Active Recall Test** mode: one card at a time → reveal → rate confidence (1–5)
- Response time (ms) and correctness tracked per card
- Save sessions to `recall_session` + `recall_response` tables for weak topic analysis

### 🎯 Procrastination Tracker
> Detect and visualize missed or abandoned sessions automatically.

- **PostgreSQL view** compares planned vs logged sessions
- Sessions classified as: **Skipped** (no log) or **Abandoned** (actual < 50% target)
- Dashboard shows **procrastination score**, risk level, and skipped counts by subject
- Analytics chart: **average start delay by timeslot**

### 🔄 Insight → Action Loop
> AI recommendations convert directly into study plans.

- AI insights contain structured `plan_suggestion` fields
- "**Add to Plan**" button opens a modal pre-filled with: subject, timeslot, duration
- User can modify fields and confirm → creates actual `daily_plan` entry
- Full **feedback loop**: Like/Dislike on every insight persisted to database

<br>

## 🗄️ Database Schema

**12 versioned SQL migrations** · PostgreSQL with Row Level Security (RLS)

```
┌─────────────────────────────────────────────────┐
│                 🔐 Supabase Auth                │
│            (JWT · Google OAuth · RLS)           │
└───────────────────┬─────────────────────────────┘
                    │
    ┌───────────────┼───────────────┐
    │               │               │
    ▼               ▼               ▼
┌─────────┐   ┌──────────┐   ┌──────────────┐
│  users  │   │ subject  │   │ daily_checkin │
│         │──▶│          │──▶│              │
└─────────┘   └──────────┘   └──────────────┘
                  │
           ┌──────┼──────┐
           ▼      │      ▼
     ┌──────────┐ │  ┌───────────┐
     │study_    │ │  │ exam_goal │
     │ topic    │ │  └───────────┘
     └──────────┘ │
           │      │
           ▼      │
     ┌──────────┐ │
     │daily_plan│◀┘   ┌───────────────┐
     └──────────┘     │  suggestions  │
           │          └───────────────┘
           ▼                │
     ┌──────────┐     ┌─────▼─────┐
     │study_logs│     │ feedback  │
     └──────────┘     └───────────┘
           
     ┌──────────────┐   ┌────────────────┐
     │recall_session│──▶│recall_response │
     └──────────────┘   └────────────────┘
```

**Views:**
- `weak_topics_stats` — topics with avg_confidence ≤ 3 or avg_efficiency < 65%
- `procrastination_stats` — skipped/abandoned sessions per subject

<br>

## 🔌 API Endpoints

### Next.js API Routes (15 endpoints)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/auth/register` | Email + password registration |
| `POST` | `/api/auth/login` | Email + password login |
| `GET`  | `/api/auth/google` | Google OAuth flow |
| `GET`  | `/api/auth/me` | Get current authenticated user |
| `POST` | `/api/auth/logout` | Clear session |
| `POST` | `/api/auth/change-password` | Update password |
| `GET/PUT` | `/api/profile` | View/update user profile |
| `GET/POST/DELETE` | `/api/subjects` | CRUD subjects |
| `GET/POST` | `/api/topics` | CRUD study topics |
| `GET/POST/DELETE` | `/api/plans` | CRUD daily plans |
| `GET/POST` | `/api/logs` | Get/create study logs |
| `POST` | `/api/insights` | Trigger AI insight generation |
| `POST` | `/api/feedback` | Submit insight feedback |
| `GET/POST` | `/api/checkin` | Daily wellness check-in |
| `GET/POST/DELETE` | `/api/exam-goals` | CRUD exam goals |
| `GET` | `/api/procrastination` | Get procrastination stats |
| `GET/POST` | `/api/recall` | Save recall sessions |
| `POST` | `/api/vault` | Generate flashcards |
| `GET` | `/api/digest` | Weekly 3-3-3 digest |

### FastAPI Engine (3 endpoints)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/engine/analyze` | Statistical analysis + AI suggestions |
| `GET` | `/engine/insights/today` | Retrieve today's cached insights |
| `POST` | `/engine/vault/generate` | Generate quiz flashcards from notes |

<br>

## 🛡️ Security

| Layer | Implementation |
|-------|----------------|
| 🔐 **Authentication** | Supabase Auth with JWT tokens in HTTP-only cookies |
| 🔑 **API Security** | Engine requires `x-engine-key` header on all requests |
| 🛡️ **Row Level Security** | Every table has RLS policies: users only see their own data |
| 🌐 **CORS** | Restricted to configured allowed origins only |
| 🔒 **Password Safety** | `password_hash` never exposed to client responses |
| ✅ **Input Validation** | Server-side normalization for all enum fields |

<br>

## 🚀 Getting Started

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18+ |
| Python | 3.10+ |
| npm | 9+ |
| pip | Latest |

### 1️⃣ Clone & Install Frontend

```bash
git clone https://github.com/Harsh-Vipul-Patel/OptiLearn.git
cd OptiLearn
npm install
```

### 2️⃣ Configure Environment

```bash
cp .env.example .env
```

Fill in your credentials:

```env
# Supabase (get from supabase.com/dashboard)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Engine connection
ENGINE_API_URL=http://localhost:8000
ENGINE_API_KEY=your_64_char_secret
```

### 3️⃣ Run Frontend

```bash
npm run dev
```

Open **http://localhost:3000** 🌐

### 4️⃣ Install & Run AI Engine

```bash
cd engine
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

> **Engine requires** its own environment variables:  
> `GROQ_API_KEY` · `ENGINE_API_KEY` · `CALLBACK_URL` · `ALLOWED_ORIGINS`

<br>

## 📁 Project Structure

```
OptiLearn/
├── 📂 src/
│   ├── 📂 app/
│   │   ├── 📂 api/              # 15 Next.js API route handlers
│   │   ├── 📂 dashboard/        # All dashboard pages
│   │   │   ├── page.tsx          #   Main dashboard
│   │   │   ├── 📂 analytics/    #   Charts & reports
│   │   │   ├── 📂 insights/     #   AI recommendations
│   │   │   ├── 📂 logger/       #   Session logging
│   │   │   ├── 📂 planner/      #   Study planner
│   │   │   ├── 📂 profile/      #   User profile
│   │   │   └── 📂 vault/        #   Knowledge vault
│   │   ├── 📂 login/            # Auth pages
│   │   ├── globals.css           # Full design system
│   │   ├── layout.tsx            # Root layout
│   │   └── page.tsx              # Landing page
│   ├── 📂 components/
│   │   ├── 📂 analytics/        # AnalyticsPage + charts
│   │   ├── 📂 dashboard/        # GoalRing, StatsRow, BurnoutMonitor, etc.
│   │   ├── 📂 insights/         # InsightsPage + PlanSuggestionModal
│   │   ├── 📂 layout/           # Sidebar + PageHeader
│   │   ├── 📂 logger/           # LoggerPage
│   │   ├── 📂 planner/          # PlannerPage
│   │   ├── 📂 ui/               # Reusable: Badge, Card, Toast, Select, etc.
│   │   ├── 📂 vault/            # VaultPage + flashcards
│   │   ├── Providers.tsx         # Auth context + session management
│   │   └── ParticleBackground.tsx
│   ├── 📂 hooks/                 # usePlans, useStudyLogSync, useCheckin
│   ├── 📂 lib/                   # supabase client, JWT, email helpers
│   └── 📂 services/              # LogsService, SubjectsService, etc.
├── 📂 engine/
│   ├── main.py                   # FastAPI app + 3 endpoints
│   ├── core_engine.py            # CognitiveAnalyticsEngine + InsightExtractor
│   ├── llm_chain.py              # LangGraph pipeline + ContextBuilder
│   └── requirements.txt          # Python dependencies
├── 📂 supabase/
│   └── 📂 migrations/            # 12 versioned SQL migration files
├── package.json
├── next.config.ts
├── tsconfig.json
└── vercel.json                    # Deployment config
```

<br>

## 🌐 Deployment

| Service | Hosts | URL |
|---------|-------|-----|
| **Frontend** | Vercel | `optilearn.vercel.app` |
| **AI Engine** | Render | FastAPI server |
| **Database** | Supabase | Managed PostgreSQL |
| **LLM** | Groq Cloud | `llama-3.3-70b-versatile` |

<br>

## 📊 Tech Stack Summary

<table>
<tr>
<td>

**🌐 Frontend**
- Next.js 16.2.1
- React 19.2.3
- TypeScript 5.x
- SWR 2.4.1
- Chart.js
- html2pdf.js

</td>
<td>

**⚙️ Backend**
- Python 3.10+
- FastAPI 0.115+
- Uvicorn 0.34+
- Pydantic 2.10+
- HTTPX 0.28+

</td>
<td>

**🤖 AI / ML**
- LangChain 0.3+
- LangGraph 0.2+
- Groq (LLaMA 3.3 70B)
- NumPy (polyfit, stats)

</td>
<td>

**🗄️ Database**
- Supabase
- PostgreSQL + RLS
- 12 SQL migrations
- Realtime subscriptions

</td>
</tr>
</table>

<br>

## 🎯 Why OptiLearn Matters

> **Productivity tools are usually observational. OptiLearn is interventional.**

Instead of only showing what happened, the system **recommends what to change next** and lets students **apply it immediately** — closing the gap between insight and action.

<br>

---

<p align="center">
  <img src="https://img.shields.io/badge/Made_with-🧠_Intelligence-C96B3A?style=for-the-badge&labelColor=1E1E2E" />
  <img src="https://img.shields.io/badge/Built_by-Harsh_&_Vipul_Patel-4A5FA0?style=for-the-badge&labelColor=1E1E2E" />
</p>
