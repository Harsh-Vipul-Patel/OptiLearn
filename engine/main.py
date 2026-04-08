"""
OptiLearn AI Engine — FastAPI server
Deployed on Render, called by the Vercel-hosted Next.js frontend.
"""

from pathlib import Path
from dotenv import load_dotenv

# Load .env from the engine folder (works locally; on Render env vars are set in the dashboard)
_env_path = Path(__file__).resolve().parent / ".env"
if _env_path.exists():
    load_dotenv(_env_path)

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
from core_engine import CognitiveAnalyticsEngine
import os
import httpx
import logging
from typing import Optional, List

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── App ─────────────────────────────────────────────────────────────
app = FastAPI(title="OptiLearn AI Engine", version="1.0.0")

# CORS — allow Vercel frontend + localhost dev
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Config ──────────────────────────────────────────────────────────
ENGINE_KEY = os.environ.get("ENGINE_API_KEY", "")
CALLBACK_URL = os.environ.get("CALLBACK_URL", "")  # e.g. https://your-app.vercel.app/api/engine/callback

engine = CognitiveAnalyticsEngine()


# ── Models ──────────────────────────────────────────────────────────
class AnalyzeRequest(BaseModel):
    log_id: str
    user_id: str
    plan_id: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    focus_level: Optional[int] = None
    distractions: Optional[str] = None
    reflection: Optional[str] = None
    target_duration: Optional[int] = None
    subject_category: Optional[str] = None
    topic_complexity: Optional[str] = None


class WellnessContext(BaseModel):
    sleep_hours: Optional[float] = None
    sleep_quality: Optional[int] = None
    energy_level: Optional[int] = None
    stress_level: Optional[int] = None
    mood: Optional[str] = None
    exercised_today: Optional[bool] = None
    had_meal: Optional[bool] = None
    screen_time_last_night: Optional[str] = None
    notes: Optional[str] = None


class TodayInsightsRequest(BaseModel):
    user_id: str
    wellness_context: Optional[WellnessContext] = None


# ── Helpers ─────────────────────────────────────────────────────────
def _verify_key(key: str) -> None:
    if not ENGINE_KEY:
        raise HTTPException(500, "ENGINE_API_KEY is not configured")
    if key != ENGINE_KEY:
        raise HTTPException(403, "Forbidden")


def _can_use_payload(req: AnalyzeRequest) -> bool:
    return bool(
        req.start_time
        and req.end_time
        and req.focus_level is not None
        and req.subject_category
        and req.topic_complexity
    )


def _build_payload_study_log(req: AnalyzeRequest) -> dict:
    return {
        "LogID": req.log_id,
        "PlanID": req.plan_id,
        "StartTime": req.start_time,
        "EndTime": req.end_time,
        "FocusLevel": req.focus_level,
        "Distractions": req.distractions or "",
        "Reflection": req.reflection or "",
        "TargetDuration": req.target_duration or 60,
    }


async def _post_callback(payload: dict) -> None:
    """POST results back to Next.js API → Supabase PostgreSQL."""
    if not CALLBACK_URL:
        return
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            resp = await client.post(
                CALLBACK_URL,
                headers={
                    "Content-Type": "application/json",
                    "x-engine-key": ENGINE_KEY,
                },
                json=payload,
            )
            logger.info("[engine] Callback %s → %s", CALLBACK_URL, resp.status_code)
        except Exception as exc:
            logger.warning("[engine] Callback error: %s", exc)


# ── Health ──────────────────────────────────────────────────────────
@app.api_route("/", methods=["GET", "HEAD"])
async def root():
    return {"status": "ok", "service": "OptiLearn AI Engine", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


# ── Analyze single log ──────────────────────────────────────────────
@app.post("/engine/analyze")
async def analyze(req: AnalyzeRequest, x_engine_key: str = Header(...)):
    _verify_key(x_engine_key)

    # DB-first analysis with payload fallback
    try:
        result = engine.analyze_study_session_from_db(
            log_id=req.log_id,
            user_id=req.user_id,
        )
    except Exception as db_error:
        if not _can_use_payload(req):
            raise HTTPException(
                400,
                f"Unable to fetch database context for analysis: {db_error}",
            )
        study_log = _build_payload_study_log(req)
        result = engine.analyze_study_session(
            study_log=study_log,
            subject_category=req.subject_category or "General",
            topic_complexity=req.topic_complexity or "Medium",
        )

    # POST results back via callback
    await _post_callback(
        {
            "log_id": req.log_id,
            "user_id": req.user_id,
            "efficiency": result.get("Efficiency", 0),
            "throughput": result.get("Throughput", 0),
            "quality_score": result.get("QualityScore", 0),
            "recommendations": result.get("Recommendations", []),
        }
    )

    return {"status": "analyzed", "log_id": req.log_id}


# ── Generate insights (today + historical fallback) ─────────────────
@app.post("/engine/insights/today")
async def generate_today_insights(
    req: TodayInsightsRequest, x_engine_key: str = Header(...)
):
    _verify_key(x_engine_key)

    try:
        # Convert wellness context to dict if provided
        wellness_dict = req.wellness_context.model_dump() if req.wellness_context else None

        # Use LLM-enhanced pipeline if GEMINI_API_KEY is available
        gemini_key = os.environ.get("GEMINI_API_KEY", "")
        if gemini_key:
            summary = engine.generate_llm_insights_for_user(user_id=req.user_id, wellness_context=wellness_dict)
        else:
            summary = engine.generate_today_insights_for_user(user_id=req.user_id)

        # Flatten all recommendations from all processed logs
        all_recommendations: List[str] = []

        # Prefer AI-generated insights if available
        ai_insights = summary.get("ai_insights", [])
        if ai_insights:
            all_recommendations.extend(ai_insights)
        else:
            for insight in summary.get("insights", []):
                for rec in insight.get("recommendations", []):
                    if rec and rec not in all_recommendations:
                        all_recommendations.append(rec)

        # POST recommendations via callback so Next.js can persist them
        if all_recommendations and CALLBACK_URL:
            # Find the first log_id to associate with
            first_log_id = None
            for insight in summary.get("insights", []):
                if insight.get("log_id"):
                    first_log_id = insight["log_id"]
                    break

            await _post_callback(
                {
                    "log_id": first_log_id or "insight_batch",
                    "user_id": req.user_id,
                    "efficiency": summary["insights"][0].get("efficiency", 0)
                    if summary.get("insights")
                    else 0,
                    "throughput": 0,
                    "quality_score": summary["insights"][0].get("quality_score", 0)
                    if summary.get("insights")
                    else 0,
                    "recommendations": all_recommendations,
                }
            )

        return {
            "status": "ok",
            "user_id": req.user_id,
            "processed_logs": summary.get("processed_logs", 0),
            "insights": summary.get("insights", []),
            "recommendations": all_recommendations,
            "llm_used": summary.get("llm_used", False),
        }
    except Exception as error:
        logger.exception("[engine] Error generating insights for user %s", req.user_id)
        raise HTTPException(400, f"Unable to generate insights: {error}")


# ── Generate AI-powered insights (dedicated LLM endpoint) ──────────
@app.post("/engine/insights/generate-ai")
async def generate_ai_insights(
    req: TodayInsightsRequest, x_engine_key: str = Header(...)
):
    """
    Dedicated endpoint for LLM-powered insight generation.
    Always uses Gemini → returns natural-language actionable insights.
    """
    _verify_key(x_engine_key)

    try:
        wellness_dict = req.wellness_context.model_dump() if req.wellness_context else None
        summary = engine.generate_llm_insights_for_user(user_id=req.user_id, wellness_context=wellness_dict)

        ai_insights = summary.get("ai_insights", [])
        all_recommendations: List[str] = []

        if ai_insights:
            all_recommendations.extend(ai_insights)
        else:
            for insight in summary.get("insights", []):
                for rec in insight.get("recommendations", []):
                    if rec and rec not in all_recommendations:
                        all_recommendations.append(rec)

        # POST via callback
        if all_recommendations and CALLBACK_URL:
            first_log_id = None
            for insight in summary.get("insights", []):
                if insight.get("log_id"):
                    first_log_id = insight["log_id"]
                    break

            await _post_callback(
                {
                    "log_id": first_log_id or "ai_insight_batch",
                    "user_id": req.user_id,
                    "efficiency": summary["insights"][0].get("efficiency", 0)
                    if summary.get("insights")
                    else 0,
                    "throughput": 0,
                    "quality_score": summary["insights"][0].get("quality_score", 0)
                    if summary.get("insights")
                    else 0,
                    "recommendations": all_recommendations,
                }
            )

        return {
            "status": "ok",
            "user_id": req.user_id,
            "processed_logs": summary.get("processed_logs", 0),
            "insights": summary.get("insights", []),
            "recommendations": all_recommendations,
            "llm_used": summary.get("llm_used", False),
        }
    except Exception as error:
        logger.exception("[engine] Error generating AI insights for user %s", req.user_id)
        raise HTTPException(400, f"Unable to generate AI insights: {error}")
