'use client'

import { useState, useCallback, useEffect } from 'react'
import { useToast } from '@/components/ui/Toast'
import { useSuggestionsSync } from '@/hooks/useStudyLogSync'
import { useSession } from '@/components/Providers'
import Link from 'next/link'
import { BookIcon, SparklesIcon, TargetIcon, TrashIcon } from '@/components/ui/AppIcons'

/* ── Types ── */
interface SubjectColor { hex: string; light: string }
interface Subject { id: string; name: string; color: SubjectColor; dbId?: string }
interface PlanBlock { id: string; sid: string; topic: string; time: string; dur: number; diff: string; goal: string; persisted?: boolean; planId?: string; logged?: boolean; planDate?: string }

type SubjectColorMap = Record<string, string>

/* ── Palette ── */
const PALETTE: SubjectColor[] = [
  { hex: '#C96B3A', light: '#FBF0EA' }, { hex: '#4A5FA0', light: '#EEF1FA' },
  { hex: '#6B9B7A', light: '#EDF5F0' }, { hex: '#D4A843', light: '#FBF5E6' },
  { hex: '#B85C7A', light: '#FAF0F4' }, { hex: '#2A8C8C', light: '#E8F5F5' },
  { hex: '#6B4F8C', light: '#F2EEF9' },
]

const SUBJECT_COLORS_KEY = 'planner.subjectColors.v1'

function getColorByHex(hex?: string | null): SubjectColor | undefined {
  if (!hex) return undefined
  return PALETTE.find(c => c.hex.toLowerCase() === String(hex).toLowerCase())
}

function getStoredSubjectColors(): SubjectColorMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(SUBJECT_COLORS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed as SubjectColorMap : {}
  } catch {
    return {}
  }
}

function setStoredSubjectColor(subjectId: string, colorHex: string) {
  if (typeof window === 'undefined' || !subjectId || !colorHex) return
  const current = getStoredSubjectColors()
  current[subjectId] = colorHex
  window.localStorage.setItem(SUBJECT_COLORS_KEY, JSON.stringify(current))
}

function removeStoredSubjectColor(subjectId: string) {
  if (typeof window === 'undefined' || !subjectId) return
  const current = getStoredSubjectColors()
  if (!(subjectId in current)) return
  delete current[subjectId]
  window.localStorage.setItem(SUBJECT_COLORS_KEY, JSON.stringify(current))
}

function paletteColorFromSeed(seed: string): SubjectColor {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0
  }
  const idx = Math.abs(hash) % PALETTE.length
  return PALETTE[idx]
}

const HOURS = ['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00']
const HLBL: Record<string, string> = { '07:00':'7 AM','08:00':'8 AM','09:00':'9 AM','10:00':'10 AM','11:00':'11 AM','12:00':'12 PM','13:00':'1 PM','14:00':'2 PM','15:00':'3 PM','16:00':'4 PM','17:00':'5 PM','18:00':'6 PM','19:00':'7 PM','20:00':'8 PM' }

const SLOT_TO_HOUR: Record<string, string> = {
  Morning: '09:00',
  Afternoon: '14:00',
  Evening: '18:00',
  Night: '20:00',
}

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
  const [qaSubject, setQaSubject] = useState('')
  const [qaTopic, setQaTopic] = useState('')
  const [qaTime, setQaTime] = useState('09:00')
  const [qaDur, setQaDur] = useState(60)
  const [qaDiff, setQaDiff] = useState('Medium')
  const [qaGoal, setQaGoal] = useState('Learn')
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null)
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)

  /* ── Load subjects from DB on mount ── */
  useEffect(() => {
    if (!session?.user?.id) return
    let loadedSubjects: Subject[] = []
    fetch('/api/subjects')
      .then(r => r.json())
      .then(data => {
        if (data.subjects) {
          const storedColors = getStoredSubjectColors()
          loadedSubjects = data.subjects.map((s: Record<string, unknown>, i: number) => ({
            id: 's' + s.subject_id,
            dbId: String(s.subject_id),
            name: String(s.subject_name),
            color: (() => {
              const subjectId = String(s.subject_id)
              const fromDb = getColorByHex((s as Record<string, unknown>).subject_color as string | undefined)
              if (fromDb) return fromDb
              const fromStorage = getColorByHex(storedColors[subjectId])
              if (fromStorage) return fromStorage
              return paletteColorFromSeed(subjectId || `${String(s.subject_name)}-${i}`)
            })(),
          }))

          // Backfill local storage so deterministic colors remain fixed for old rows.
          for (const subject of loadedSubjects) {
            if (subject.dbId) {
              setStoredSubjectColor(String(subject.dbId), subject.color.hex)
            }
          }

          setSubjects(loadedSubjects)
        }
      })
      .then(() => {
        return fetch(`/api/plans?date=${today}`)
      })
      .then(r => r.json())
      .then(data => {
        if (data.plans) {
          const blocks = (data.plans as Record<string, unknown>[]).map((p) => {
            const studyTopic = p.studyTopic as Record<string, unknown> | undefined
            const subject = studyTopic?.subject as Record<string, unknown> | undefined
            const subj = loadedSubjects.find(s => s.dbId === String(subject?.subject_id || ''))
            return {
              id: 'b' + String(p.plan_id),
              planId: String(p.plan_id),
              sid: subj?.id || '',
              topic: String(studyTopic?.topic_name || ''),
              time: SLOT_TO_HOUR[String(p.time_slot || '')] || String(p.time_slot || '09:00'),
              dur: Number(p.target_duration || 0),
              diff: String(studyTopic?.complexity || 'Medium'),
              goal: 'Learn',
              persisted: true,
              logged: Array.isArray(p.logs) && p.logs.length > 0,
              planDate: String(p.plan_date || today),
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
    if (!newName.trim()) { showToast('Enter a subject name', 'warning'); return }
    if (subjects.find(s => s.name.toLowerCase() === newName.toLowerCase())) {
      showToast('Subject already exists', 'warning'); return
    }
    try {
      const res = await fetch('/api/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject_name: newName.trim(), subject_color: selColor.hex }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const entry: Subject = {
        id: 's' + data.subject.subject_id,
        dbId: data.subject.subject_id,
        name: newName.trim(),
        color: selColor,
      }
      setSubjects(prev => [...prev, entry])
      if (entry.dbId) {
        setStoredSubjectColor(String(entry.dbId), entry.color.hex)
      }
      setNewName('')
      showToast(`"${entry.name}" added!`)
    } catch (e) {
      showToast('Failed to add subject', 'warning')
      console.error(e)
    }
  }, [newName, selColor, subjects, showToast])

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
      removeStoredSubjectColor(String(s.dbId))
      showToast('Subject removed', 'trash')
    } catch {
      showToast('Failed to remove subject', 'warning')
    }
  }, [subjects, showToast])

  /* ── Drag & drop plan blocks (local state only) ── */
  const doDropBlock = useCallback((sid: string, hour: string) => {
    if (planBlocks.find(b => b.time === hour)) { showToast('That slot is already taken!', 'warning'); return }
    setPlanBlocks(prev => [...prev, { id: 'b' + Date.now(), sid, topic: '', time: hour, dur: 60, diff: 'Medium', goal: 'Learn', persisted: false }])
    const s = subjects.find(x => x.id === sid)
    showToast(`${s ? s.name : 'Block'} added at ${HLBL[hour]}!`)
  }, [planBlocks, subjects, showToast])

  const removeBlock = useCallback((id: string) => {
    setPlanBlocks(prev => prev.filter(b => b.id !== id))
  }, [])

  const addBlockFromForm = useCallback(() => {
    const editingBlock = editingBlockId ? planBlocks.find(b => b.id === editingBlockId) : null

    if (editingBlock) {
      if (editingBlock.logged) {
        showToast('This session is already logged and cannot be edited', 'warning')
        return
      }

      const sid = qaSubject || editingBlock.sid
      if (!sid) { showToast('No subjects — add one first', 'warning'); return }
      const isTimeChanged = qaTime !== editingBlock.time
      if (isTimeChanged && planBlocks.find(b => b.id !== editingBlock.id && b.time === qaTime)) {
        showToast('That slot is already taken!', 'warning')
        return
      }

      const applyLocalUpdate = () => {
        setPlanBlocks(prev => prev.map(b => (
          b.id === editingBlock.id
            ? { ...b, sid, topic: qaTopic, time: qaTime, dur: qaDur, diff: qaDiff, goal: qaGoal }
            : b
        )))
        setEditingBlockId(null)
        setQaTopic('')
        setQaDur(60)
        setQaDiff('Medium')
        setQaGoal('Learn')
        showToast('Timeline block updated', 'info')
      }

      if (!editingBlock.persisted || !editingBlock.planId) {
        applyLocalUpdate()
        return
      }

      setSaving(true)
      const subj = subjects.find(s => s.id === sid)
      if (!subj?.dbId) {
        setSaving(false)
        showToast('Could not resolve subject for update', 'warning')
        return
      }

      fetch('/api/plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: editingBlock.planId,
          topic_id: subj.dbId,
          target_duration: qaDur,
          time_slot: qaTime,
          plan_date: editingBlock.planDate || today,
        }),
      })
        .then(async (res) => {
          const payload = await res.json().catch(() => null)
          if (!res.ok) {
            throw new Error(payload?.error || `Update failed (${res.status})`)
          }
          applyLocalUpdate()
        })
        .catch((error) => {
          showToast(error instanceof Error ? error.message : 'Failed to update block', 'warning')
        })
        .finally(() => setSaving(false))

      return
    }

    const sid = qaSubject || subjects[0]?.id
    if (!sid) { showToast('No subjects — add one first', 'warning'); return }
    if (planBlocks.find(b => b.time === qaTime)) { showToast('That slot is already taken!', 'warning'); return }
    setPlanBlocks(prev => [...prev, { id: 'b' + Date.now(), sid, topic: qaTopic, time: qaTime, dur: qaDur, diff: qaDiff, goal: qaGoal, persisted: false }])
    const s = subjects.find(x => x.id === sid)
    showToast(`${s ? s.name : 'Block'} added at ${HLBL[qaTime] || qaTime}!`)
  }, [editingBlockId, qaSubject, qaTopic, qaTime, qaDur, qaDiff, qaGoal, subjects, planBlocks, showToast])

  const startEditBlock = useCallback((id: string) => {
    const blk = planBlocks.find(b => b.id === id)
    if (!blk) return
    if (blk.logged) {
      showToast('This session is already logged and cannot be edited', 'warning')
      return
    }
    setEditingBlockId(blk.id)
    setQaSubject(blk.sid)
    setQaTopic(blk.topic)
    setQaTime(blk.time)
    setQaDur(blk.dur)
    setQaDiff(blk.diff)
    setQaGoal(blk.goal)
  }, [planBlocks, showToast])

  /* ── Save plan → POST each block to /api/plans ── */
  const savePlan = useCallback(async () => {
    if (!planBlocks.length) { showToast('Add blocks first', 'warning'); return }

    const unsavedBlocks = planBlocks.filter(block => !block.persisted)
    if (!unsavedBlocks.length) {
      showToast('No new blocks to save', 'info')
      return
    }

    setSaving(true)
    try {
      // For each plan block we need a studyTopic id — right now subjects don't have topics yet,
      // so we save what we can. Blocks without topics are skipped.
      const results = await Promise.allSettled(
        unsavedBlocks.map(block => {
          const subj = subjects.find(s => s.id === block.sid)
          if (!subj?.dbId) return Promise.reject('No dbId')
          return fetch('/api/plans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              topic_id: subj.dbId,      // API resolves subject-id fallback to a real topic id
              target_duration: block.dur,
              time_slot: block.time,
              plan_date: today,
            }),
          })
            .then(async (res) => {
              const payload = await res.json().catch(() => null)
              if (!res.ok) {
                throw new Error(payload?.error || `Request failed (${res.status})`)
              }
              return { payload, blockId: block.id }
            })
        })
      )

      const fulfilled = results.filter((r): r is PromiseFulfilledResult<{ payload: Record<string, unknown> | null; blockId: string }> => r.status === 'fulfilled')
      const saved = fulfilled.length

      if (saved > 0) {
        const savedIds = new Set(fulfilled.map(r => r.value.blockId))
        setPlanBlocks(prev => prev.map(block => (
          savedIds.has(block.id)
            ? { ...block, persisted: true }
            : block
        )))
      }

      if (saved === unsavedBlocks.length) {
        showToast(`Plan saved! ${saved}/${unsavedBlocks.length} new blocks saved`, 'info')
      } else {
        const firstFailure = results.find(
          (r): r is PromiseRejectedResult => r.status === 'rejected'
        )
        const reason = firstFailure?.reason instanceof Error
          ? firstFailure.reason.message
          : String(firstFailure?.reason || 'Unknown error')
        showToast(`Plan saved! ${saved}/${unsavedBlocks.length} new blocks saved. ${reason}`, 'warning')
      }
    } catch (e) {
      showToast('Failed to save plan', 'warning')
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
          <button className="btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => { setPlanBlocks([]); showToast('Plan cleared', 'trash') }}><TrashIcon width={15} height={15} />Clear</button>
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
          <span style={{ fontSize: '11.5px', color: 'var(--text-soft)', display: 'inline-flex', alignItems: 'center', gap: 5 }}><SparklesIcon width={14} height={14} />Drag a chip → drop on any time slot</span>
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
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><BookIcon width={14} height={14} />{s.name}</span>
                <button className="chip-del" onClick={() => delSubject(s.id)}>✕</button>
              </div>
            ))
          )}
        </div>
        <div className="add-subject-row">
          <input className="form-input" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSubject()} placeholder="Subject name…" style={{ flex: 1 }} />
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
              if (!free) { showToast('All time slots are filled!', 'warning'); return }
              doDropBlock(sid, free)
            }}
          >
            <div style={{ display: 'inline-flex', marginBottom: 6 }}><TargetIcon width={24} height={24} /></div>
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
                          <div className="pb-subj" style={{ color: c.hex, display: 'inline-flex', alignItems: 'center', gap: 6 }}><BookIcon width={14} height={14} />{s.name}</div>
                          <div className="pb-meta">{blk.topic || 'General study'} · {blk.dur}min · {blk.diff}</div>
                        </div>
                        {blk.logged ? (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'var(--sage-light)', color: 'var(--sage)', border: '1px solid rgba(107,155,122,.4)' }}>Logged</span>
                        ) : (
                          <button className="btn-secondary btn-sm" style={{ padding: '4px 8px' }} onClick={() => startEditBlock(blk.id)}>Edit</button>
                        )}
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
            <div className="section-title">{editingBlockId ? 'Edit Timeline Block' : 'Quick Add Block'}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Subject</label>
                <select className="form-select" value={qaSubject} onChange={e => setQaSubject(e.target.value)}>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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
              <div className="planner-dual-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: editingBlockId ? '1fr 1fr' : '1fr', gap: 8 }}>
                <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={addBlockFromForm}>
                  {editingBlockId ? 'Update Block' : 'Add to Timeline'}
                </button>
                {editingBlockId && (
                  <button className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setEditingBlockId(null)}>
                    Cancel Edit
                  </button>
                )}
              </div>
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
