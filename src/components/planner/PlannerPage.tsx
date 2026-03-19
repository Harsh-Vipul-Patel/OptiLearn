'use client'

import { useState, useCallback, useEffect } from 'react'
import { useToast } from '@/components/ui/Toast'
import { useSuggestionsSync } from '@/hooks/useStudyLogSync'
import { useSession, signOut } from '@/components/Providers'
import Link from 'next/link'

/* ── Types ── */
interface SubjectColor { hex: string; light: string }
interface Subject { id: string; name: string; emoji: string; color: SubjectColor; dbId?: string }
interface PlanBlock { id: string; sid: string; topic: string; time: string; dur: number; diff: string; goal: string }

/* ── Palette ── */
const PALETTE: SubjectColor[] = [
  { hex: '#C96B3A', light: '#FBF0EA' }, { hex: '#4A5FA0', light: '#EEF1FA' },
  { hex: '#6B9B7A', light: '#EDF5F0' }, { hex: '#D4A843', light: '#FBF5E6' },
  { hex: '#B85C7A', light: '#FAF0F4' }, { hex: '#2A8C8C', light: '#E8F5F5' },
  { hex: '#6B4F8C', light: '#F2EEF9' },
]

const HOURS = ['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00']
const HLBL: Record<string, string> = { '07:00':'7 AM','08:00':'8 AM','09:00':'9 AM','10:00':'10 AM','11:00':'11 AM','12:00':'12 PM','13:00':'1 PM','14:00':'2 PM','15:00':'3 PM','16:00':'4 PM','17:00':'5 PM','18:00':'6 PM','19:00':'7 PM','20:00':'8 PM' }

const today = new Date().toISOString().slice(0, 10)

/* ── Main Component ── */
export function PlannerPage() {
  const { data: session } = useSession()
  const { showToast } = useToast()
  const { suggestions } = useSuggestionsSync(session?.user?.id || '')

  const [subjects, setSubjects] = useState<Subject[]>([])
  const [subjectsLoading, setSubjectsLoading] = useState(true)
  const [planBlocks, setPlanBlocks] = useState<PlanBlock[]>([])
  const [saving, setSaving] = useState(false)
  const [dragSid, setDragSid] = useState<string | null>(null)
  const [selColor, setSelColor] = useState<SubjectColor>(PALETTE[0])
  const [newName, setNewName] = useState('')
  const [newEmoji, setNewEmoji] = useState('')
  const [qaSubject, setQaSubject] = useState('')
  const [qaTopic, setQaTopic] = useState('')
  const [qaTime, setQaTime] = useState('09:00')
  const [qaDur, setQaDur] = useState(60)
  const [qaDiff, setQaDiff] = useState('Medium')
  const [qaGoal, setQaGoal] = useState('Learn')
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null)

  /* ── Load subjects from DB on mount ── */
  useEffect(() => {
    if (!session?.user?.id) return
    let loadedSubjects: Subject[] = []
    fetch('/api/subjects')
      .then(r => r.json())
      .then(data => {
        if (data.subjects) {
          loadedSubjects = data.subjects.map((s: Record<string, unknown>, i: number) => ({
            id: 's' + s.id,
            dbId: String(s.id),
            name: String(s.subject_name),
            emoji: '📗',
            color: PALETTE[i % PALETTE.length],
          }))
          setSubjects(loadedSubjects)
        }
      })
      .then(() => {
        return fetch(`/api/plans?date=${today}`)
      })
      .then(r => r.json())
      .then(data => {
        if (data.plans) {
          const blocks = data.plans.map((p: any) => {
            const subj = loadedSubjects.find(s => s.dbId === p.studyTopic?.subject?.id)
            return {
              id: 'b' + p.id,
              sid: subj?.id || '',
              topic: p.studyTopic?.topic_name || '',
              time: p.time_slot || '09:00',
              dur: p.target_duration,
              diff: p.studyTopic?.complexity || 'Medium',
              goal: 'Learn'
            }
          })
          setPlanBlocks(blocks)
        }
      })
      .catch(console.error)
      .finally(() => setSubjectsLoading(false))
  }, [session?.user?.id])

  /* ── Add subject → DB + local state ── */
  const addSubject = useCallback(async () => {
    if (!newName.trim()) { showToast('Enter a subject name', '⚠️'); return }
    if (subjects.find(s => s.name.toLowerCase() === newName.toLowerCase())) {
      showToast('Subject already exists', '⚠️'); return
    }
    try {
      const res = await fetch('/api/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject_name: newName.trim(), category: newName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const entry: Subject = {
        id: 's' + data.subject.id,
        dbId: data.subject.id,
        name: newName.trim(),
        emoji: newEmoji || '📗',
        color: selColor,
      }
      setSubjects(prev => [...prev, entry])
      setNewName(''); setNewEmoji('')
      showToast(`"${entry.name}" added!`)
    } catch (e) {
      showToast('Failed to add subject', '⚠️')
      console.error(e)
    }
  }, [newName, newEmoji, selColor, subjects, showToast])

  /* ── Delete subject → DB + local state ── */
  const delSubject = useCallback(async (id: string) => {
    const s = subjects.find(x => x.id === id)
    if (!s?.dbId) {
      setSubjects(prev => prev.filter(x => x.id !== id))
      setPlanBlocks(prev => prev.filter(b => b.sid !== id))
      return
    }
    try {
      await fetch(`/api/subjects?id=${s.dbId}`, { method: 'DELETE' })
      setSubjects(prev => prev.filter(x => x.id !== id))
      setPlanBlocks(prev => prev.filter(b => b.sid !== id))
      showToast('Subject removed', '🗑')
    } catch {
      showToast('Failed to remove subject', '⚠️')
    }
  }, [subjects, showToast])

  /* ── Drag & drop plan blocks (local state only) ── */
  const doDropBlock = useCallback((sid: string, hour: string) => {
    if (planBlocks.find(b => b.time === hour)) { showToast('That slot is already taken!', '⚠️'); return }
    setPlanBlocks(prev => [...prev, { id: 'b' + Date.now(), sid, topic: '', time: hour, dur: 60, diff: 'Medium', goal: 'Learn' }])
    const s = subjects.find(x => x.id === sid)
    showToast(`${s ? s.emoji + ' ' + s.name : 'Block'} added at ${HLBL[hour]}!`)
  }, [planBlocks, subjects, showToast])

  const removeBlock = useCallback((id: string) => {
    setPlanBlocks(prev => prev.filter(b => b.id !== id))
  }, [])

  const addBlockFromForm = useCallback(() => {
    const sid = qaSubject || subjects[0]?.id
    if (!sid) { showToast('No subjects — add one first', '⚠️'); return }
    if (planBlocks.find(b => b.time === qaTime)) { showToast('That slot is already taken!', '⚠️'); return }
    setPlanBlocks(prev => [...prev, { id: 'b' + Date.now(), sid, topic: qaTopic, time: qaTime, dur: qaDur, diff: qaDiff, goal: qaGoal }])
    const s = subjects.find(x => x.id === sid)
    showToast(`${s ? s.emoji + ' ' + s.name : 'Block'} added at ${HLBL[qaTime] || qaTime}!`)
  }, [qaSubject, qaTopic, qaTime, qaDur, qaDiff, qaGoal, subjects, planBlocks, showToast])

  /* ── Save plan → POST each block to /api/plans ── */
  const savePlan = useCallback(async () => {
    if (!planBlocks.length) { showToast('Add blocks first', '⚠️'); return }
    setSaving(true)
    try {
      // For each plan block we need a studyTopic id — right now subjects don't have topics yet,
      // so we save what we can. Blocks without topics are skipped.
      const results = await Promise.allSettled(
        planBlocks.map(block => {
          const subj = subjects.find(s => s.id === block.sid)
          if (!subj?.dbId) return Promise.reject('No dbId')
          return fetch('/api/plans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              topic_id: subj.dbId,      // uses subject id as fallback until topics are added
              target_duration: block.dur,
              time_slot: block.time,
              plan_date: today,
            }),
          })
        })
      )
      const saved = results.filter(r => r.status === 'fulfilled').length
      showToast(`Plan saved! ${saved}/${planBlocks.length} blocks saved ✦`)
    } catch (e) {
      showToast('Failed to save plan', '⚠️')
      console.error(e)
    } finally {
      setSaving(false)
    }
  }, [planBlocks, subjects, showToast])

  const totalHours = (planBlocks.reduce((a, b) => a + b.dur, 0) / 60).toFixed(1)

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Study Planner</div>
          <div className="page-sub">Drag subject chips into time slots, or use the quick-add form.</div>
        </div>
        <div className="header-actions">
          <button className="btn-secondary btn-sm" onClick={() => { setPlanBlocks([]); showToast('Plan cleared', '🗑') }}>🗑 Clear</button>
          <button className="btn-primary btn-sm" onClick={savePlan} disabled={saving}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            {saving ? 'Saving…' : 'Save Plan'}
          </button>
        </div>
      </div>

      {/* Subjects Panel */}
      <div className="subjects-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 13 }}>
          <div className="section-title" style={{ margin: 0 }}>My Subjects</div>
          <span style={{ fontSize: '11.5px', color: 'var(--text-soft)' }}>✦ Drag a chip → drop on any time slot</span>
        </div>
        <div className="subjects-grid">
          {subjectsLoading ? (
            <div style={{ fontSize: 13, color: 'var(--text-soft)', padding: '6px 0' }}>Loading subjects…</div>
          ) : subjects.length === 0 ? (
            <div className="chips-empty">No subjects yet — add one below!</div>
          ) : (
            subjects.map(s => (
              <div
                key={s.id}
                className="subject-chip"
                draggable
                onDragStart={e => { setDragSid(s.id); e.dataTransfer.setData('sid', s.id) }}
                onDragEnd={() => setDragSid(null)}
                style={{ background: s.color.light, borderColor: s.color.hex, color: s.color.hex }}
              >
                <span className="chip-dot" style={{ background: s.color.hex }} />
                <span>{s.emoji} {s.name}</span>
                <button className="chip-del" onClick={() => delSubject(s.id)}>✕</button>
              </div>
            ))
          )}
        </div>
        <div className="add-subject-row">
          <input className="form-input" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSubject()} placeholder="Subject name…" style={{ flex: 1 }} />
          <input className="form-input" value={newEmoji} onChange={e => setNewEmoji(e.target.value)} placeholder="📗" style={{ width: 52, textAlign: 'center' }} maxLength={2} />
          <div style={{ display: 'flex', gap: 5 }}>
            {PALETTE.map(c => (
              <div key={c.hex} className={`color-swatch${c === selColor ? ' selected' : ''}`} style={{ background: c.hex }} onClick={() => setSelColor(c)} />
            ))}
          </div>
          <button className="btn-primary btn-sm" onClick={addSubject}>+ Add</button>
        </div>
      </div>

      {/* Planner Layout */}
      <div className="planner-layout">
        {/* Timeline */}
        <div className="timeline-area">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div className="section-title" style={{ margin: 0 }}>Today&apos;s Timeline</div>
            <span className="badge badge-indigo">{planBlocks.length} blocks · {totalHours}h planned</span>
          </div>
          <div
            className={`drop-zone-banner${dragSid ? ' drag-over' : ''}`}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault()
              const sid = e.dataTransfer.getData('sid') || dragSid
              if (!sid) return
              const free = HOURS.find(h => !planBlocks.find(b => b.time === h))
              if (!free) { showToast('All time slots are filled!', '⚠️'); return }
              doDropBlock(sid, free)
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 4 }}>🎯</div>
            Drop a subject chip here → fills next free slot automatically
          </div>
          <div>
            {HOURS.map(hour => {
              const blk = planBlocks.find(b => b.time === hour)
              const s = blk ? subjects.find(x => x.id === blk.sid) : null
              const c = s ? s.color : PALETTE[0]
              return (
                <div key={hour} className="timeline-slot">
                  <div className="ts-time">{HLBL[hour]}</div>
                  <div className="ts-body">
                    {blk && s ? (
                      <div className="planner-block" style={{ background: c.light, borderLeftColor: c.hex }}>
                        <div style={{ flex: 1 }}>
                          <div className="pb-subj" style={{ color: c.hex }}>{s.emoji} {s.name}</div>
                          <div className="pb-meta">{blk.topic || 'General study'} · {blk.dur}min · {blk.diff}</div>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: c.light, color: c.hex, border: `1px solid ${c.hex}` }}>{blk.goal}</span>
                        <button className="pb-remove" onClick={() => removeBlock(blk.id)}>✕</button>
                      </div>
                    ) : (
                      <div
                        className={`ts-empty${dragOverSlot === hour ? ' drag-over' : ''}`}
                        onDragOver={e => { e.preventDefault(); setDragOverSlot(hour) }}
                        onDragLeave={() => setDragOverSlot(null)}
                        onDrop={e => {
                          e.preventDefault(); setDragOverSlot(null)
                          const sid = e.dataTransfer.getData('sid') || dragSid
                          if (sid) doDropBlock(sid, hour)
                        }}
                      >
                        Drop here or use form →
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Panel */}
        <div className="planner-sidebar">
          <div className="ps-form">
            <div className="section-title">Quick Add Block</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Subject</label>
                <select className="form-select" value={qaSubject} onChange={e => setQaSubject(e.target.value)}>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Topic / Notes</label>
                <input className="form-input" value={qaTopic} onChange={e => setQaTopic(e.target.value)} placeholder="e.g. Integration by Parts" />
              </div>
              <div className="form-group">
                <label className="form-label">Time Slot</label>
                <select className="form-select" value={qaTime} onChange={e => setQaTime(e.target.value)}>
                  {HOURS.map(h => <option key={h} value={h}>{HLBL[h]}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Duration: <span style={{ color: 'var(--terra)', fontWeight: 700 }}>{qaDur} min</span></label>
                <input className="form-range" type="range" min="15" max="180" step="15" value={qaDur} onChange={e => setQaDur(Number(e.target.value))} />
                <div className="range-labels"><span>15m</span><span>1h</span><span>3h</span></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">Difficulty</label>
                  <select className="form-select" value={qaDiff} onChange={e => setQaDiff(e.target.value)}>
                    <option>Easy</option><option>Medium</option><option>Hard</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Goal</label>
                  <select className="form-select" value={qaGoal} onChange={e => setQaGoal(e.target.value)}>
                    <option>Learn</option><option>Revise</option><option>Practice</option>
                  </select>
                </div>
              </div>
              <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={addBlockFromForm}>Add to Timeline</button>
            </div>
          </div>

          {/* AI Tip */}
          {suggestions.length > 0 && (
            <div style={{ background: 'linear-gradient(135deg,#3D4F8C,#2D3D7A)', borderRadius: 'var(--r-lg)', padding: '18px 20px', color: 'white' }}>
              <div className="insight-label">AI Scheduling Tip</div>
              <div className="insight-text" style={{ fontSize: '13.5px' }}>&quot;{String((suggestions[0] as Record<string, unknown>)?.content || suggestions[0]?.text || 'Plan your hardest subjects when you are most alert.')}&quot;</div>
              <button className="insight-btn insight-btn-primary" style={{ marginTop: 11 }} onClick={() => showToast('Suggestion applied!')}>Apply ✦</button>
            </div>
          )}

          <Link href="/dashboard" className="btn-secondary btn-sm" style={{ textDecoration: 'none', display: 'flex', justifyContent: 'center' }}>
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
