from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
from datetime import datetime
from core_engine import CognitiveAnalyticsEngine
import os, httpx

app = FastAPI()
engine = CognitiveAnalyticsEngine()
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SERVICE_KEY  = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
ENGINE_KEY   = os.environ.get('ENGINE_API_KEY', '')  # shared secret

class AnalyzeRequest(BaseModel):
    log_id: str
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
    if x_engine_key != ENGINE_KEY: raise HTTPException(403, 'Forbidden')

    study_log = req.dict()
    study_log['LogID']    = req.log_id
    study_log['StartTime'] = req.start_time
    study_log['EndTime']   = req.end_time
    study_log['FocusLevel'] = req.focus_level

    # Fire core engine analysis
    result = engine.analyze_study_session(
        study_log=study_log,
        subject_category=req.subject_category,
        topic_complexity=req.topic_complexity
    )

    # Write results back to Supabase via REST
    async with httpx.AsyncClient() as client:
        await client.patch(
            f'{SUPABASE_URL}/rest/v1/study_logs?id=eq.{req.log_id}',
            headers={'apikey': SERVICE_KEY, 'Authorization': f'Bearer {SERVICE_KEY}'},
            json={
                'efficiency': result.get('Efficiency', 0),
                'throughput': result.get('Throughput', 0),
                'quality_score': result.get('QualityScore', 0),
                'analyzed_at': datetime.now().isoformat()
            }
        )
        # Write suggestions
        for suggestion_text in result.get('Recommendations', []):
            await client.post(
                f'{SUPABASE_URL}/rest/v1/suggestions',
                headers={'apikey': SERVICE_KEY, 'Authorization': f'Bearer {SERVICE_KEY}'},
                json={ 'user_id': req.log_id, 'log_id': req.log_id,
                       'suggestion_text': suggestion_text, 'suggestion_type': 'planning' }
            )

    return { 'status': 'analyzed', 'log_id': req.log_id }
