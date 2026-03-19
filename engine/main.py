from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
from datetime import datetime
from core_engine import CognitiveAnalyticsEngine
import os, httpx

app = FastAPI()
engine = CognitiveAnalyticsEngine()

# ── Config ──────────────────────────────────────────────────────────
ENGINE_KEY   = os.environ.get('ENGINE_API_KEY', '')   # shared secret
CALLBACK_URL = os.environ.get('CALLBACK_URL', '')     # e.g. https://optilearn.vercel.app/api/engine/callback


class AnalyzeRequest(BaseModel):
    log_id: str
    user_id: str
    plan_id: str
    start_time: datetime
    end_time: datetime
    focus_level: int
    distractions: str
    reflection: str
    target_duration: int
    subject_category: str
    topic_complexity: str


@app.post('/engine/analyze')
async def analyze(req: AnalyzeRequest, x_engine_key: str = Header(...)):
    if x_engine_key != ENGINE_KEY:
        raise HTTPException(403, 'Forbidden')

    study_log = req.dict()
    study_log['LogID']     = req.log_id
    study_log['StartTime'] = req.start_time
    study_log['EndTime']   = req.end_time
    study_log['FocusLevel'] = req.focus_level

    # ── Run core engine analysis ─────────────────────────────────────
    result = engine.analyze_study_session(
        study_log=study_log,
        subject_category=req.subject_category,
        topic_complexity=req.topic_complexity
    )

    # ── POST results back to Next.js API → Azure PostgreSQL ──────────
    if CALLBACK_URL:
        payload = {
            'log_id':        req.log_id,
            'user_id':       req.user_id,
            'efficiency':    result.get('Efficiency', 0),
            'throughput':    result.get('Throughput', 0),
            'quality_score': result.get('QualityScore', 0),
            'recommendations': result.get('Recommendations', []),
        }
        async with httpx.AsyncClient(timeout=15) as client:
            try:
                await client.post(
                    CALLBACK_URL,
                    headers={
                        'Content-Type': 'application/json',
                        'x-engine-key': ENGINE_KEY,
                    },
                    json=payload,
                )
            except Exception as e:
                # Non-fatal: log but don't fail the response
                print(f'[engine] Callback error: {e}')

    return {'status': 'analyzed', 'log_id': req.log_id}
