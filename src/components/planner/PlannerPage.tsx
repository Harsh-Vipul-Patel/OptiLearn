'use client'

import { useState, useCallback, useEffect } from 'react'
import { useToast } from '@/components/ui/Toast'
import { useSuggestionsSync } from '@/hooks/useStudyLogSync'
import { useSession } from '@/components/Providers'
import Link from 'next/link'
import { BookIcon, SparklesIcon, TargetIcon, TrashIcon } from '@/components/ui/AppIcons'
import { formatPlanScheduleLabel } from '@/lib/planTimeLabel'

/* ── Types ── */
interface SubjectColor { hex: string; light: string }
interface Subject { id: string; name: string; color: SubjectColor; dbId?: string }
interface PlanBlock { id: string; sid: string; topic: string; time: string; startTime?: string; endTime?: string; dur: number; diff: string; goal: string; persisted?: boolean; planId?: string; logged?: boolean; planDate?: string }

type SubjectColorMap = Record<string, string>

/* ── Palette ── */
const PALETTE: SubjectColor[] = [
  { hex: '#C96B3A', light: '#FBF0EA' }, { hex: '#4A5FA0', light: '#EEF1FA' },
  { hex: '#6B9B7A', light: '#EDF5F0' }, { hex: '#D4A843', light: '#FBF5E6' },
  { hex: '#B85C7A', light: '#FAF0F4' }, { hex: '#2A8C8C', light: '#E8F5F5' },
  { hex: '#6B4F8C', light: '#F2EEF9' },
]

const SUBJECT_COLORS_KEY = 'planner.subjectColors.v1'
const SLOT_PREFS_KEY_PREFIX = 'planner.slotRanges.v1.'

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

const TIME_SLOTS = ['Morning', 'Afternoon', 'Evening', 'Night'] as const
type SlotName = typeof TIME_SLOTS[number]
type SlotRange = { start: number; end: number }
type SlotRanges = Record<SlotName, SlotRange>

const DEFAULT_SLOT_RANGES: SlotRanges = {
  Morning: { start: 4 * 60, end: 11 * 60 },
  Afternoon: { start: 11 * 60, end: 16 * 60 },
  Evening: { start: 16 * 60, end: 20 * 60 },
  Night: { start: 20 * 60, end: 4 * 60 },
}

function cloneDefaultSlotRanges(): SlotRanges {
  return {
    Morning: { ...DEFAULT_SLOT_RANGES.Morning },
    Afternoon: { ...DEFAULT_SLOT_RANGES.Afternoon },
    Evening: { ...DEFAULT_SLOT_RANGES.Evening },
    Night: { ...DEFAULT_SLOT_RANGES.Night },
  }
}

function minutesToClock(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440
  const h24 = Math.floor(normalized / 60)
  const m = normalized % 60
  return `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function minutesToAmPm(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440
  const h24 = Math.floor(normalized / 60)
  const m = normalized % 60
  const h12 = h24 % 12 || 12
  const ampm = h24 < 12 ? 'AM' : 'PM'
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

function getSlotLabel(slot: SlotName, ranges: SlotRanges): string {
  const range = ranges[slot]
  return `${slot}  (${minutesToAmPm(range.start)} - ${minutesToAmPm(range.end)})`
}

function getSlotPrefsKey(userId?: string | null): string {
  return `${SLOT_PREFS_KEY_PREFIX}${userId || 'anonymous'}`
}

function getStoredSlotRanges(userId?: string | null): SlotRanges {
  if (typeof window === 'undefined') return cloneDefaultSlotRanges()
  try {
    const raw = window.localStorage.getItem(getSlotPrefsKey(userId))
    if (!raw) return cloneDefaultSlotRanges()
    const parsed = JSON.parse(raw) as Partial<Record<SlotName, Partial<SlotRange>>> | null
    if (!parsed) return cloneDefaultSlotRanges()

    const merged = cloneDefaultSlotRanges()
    for (const slot of TIME_SLOTS) {
      const start = Number(parsed[slot]?.start)
      const end = Number(parsed[slot]?.end)
      if (Number.isFinite(start) && Number.isFinite(end)) {
        merged[slot] = { start, end }
      }
    }
    return merged
  } catch {
    return cloneDefaultSlotRanges()
  }
}

function saveStoredSlotRanges(userId: string | undefined, ranges: SlotRanges) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(getSlotPrefsKey(userId), JSON.stringify(ranges))
}

/** Determine which slot a time (in minutes from midnight) belongs to */
function isMinuteInRange(minutes: number, start: number, end: number): boolean {
  if (start === end) return true
  if (start < end) return minutes >= start && minutes < end
  return minutes >= start || minutes < end
}

function getSlotForMinutes(minutes: number, ranges: SlotRanges): SlotName {
  for (const slot of TIME_SLOTS) {
    const range = ranges[slot]
    if (isMinuteInRange(minutes, range.start, range.end)) return slot
  }
  return 'Morning'
}

/** Determine which slot a block belongs to based on its startTime */
function getBlockSlot(block: PlanBlock, ranges: SlotRanges): string {
  if (block.startTime) {
    const mins = timeToMinutes(block.startTime)
    if (mins !== null) return getSlotForMinutes(mins, ranges)
  }
  // Fallback to the stored time_slot
  return block.time
}

const today = new Date().toISOString().slice(0, 10)

function formatSessionRange(slot: string, durationMin: number, ranges: SlotRanges) {
  const typedSlot = (TIME_SLOTS.find(s => s === slot) ?? 'Morning') as SlotName
  const startMin = ranges[typedSlot].start
  if (!Number.isFinite(startMin)) return ''
  const endMin = startMin + Math.max(0, Number(durationMin || 0))

  return `${minutesToAmPm(startMin)}-${minutesToAmPm(endMin)}`
}

function timeToMinutes(time: string): number | null {
  const parts = time.split(':')
  if (parts.length !== 2) return null
  const h = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  if (isNaN(h) || isNaN(m)) return null
  return h * 60 + m
}

function checkTimeOverlap(
  startTime1: number,
  endTime1: number,
  startTime2: number,
  endTime2: number
): boolean {
  return startTime1 < endTime2 && startTime2 < endTime1
}

function getBlockTimeRange(block: PlanBlock, ranges: SlotRanges): { start: number; end: number } | null {
  if (block.startTime && block.endTime) {
    const start = timeToMinutes(block.startTime)
    const end = timeToMinutes(block.endTime)
    if (start !== null && end !== null) {
      return { start, end }
    }
  }
  
  const slotName = (TIME_SLOTS.find(s => s === block.time) ?? 'Morning') as SlotName
  const slotStart = ranges[slotName].start
  if (Number.isFinite(slotStart)) {
    return {
      start: slotStart,
      end: slotStart + block.dur,
    }
  }
  return null
}

/* ── Main Component ── */
export function PlannerPage() {
  const { data: session } = useSession()
  const { showToast } = useToast()
  const { suggestions } = useSuggestionsSync(session?.user?.id || '')

  const [subjects, setSubjects] = useState<Subject[]>([])
  const [subjectsLoading, setSubjectsLoading] = useState(true)
  const [planBlocks, setPlanBlocks] = useState<PlanBlock[]>([])
  const [saving, setSaving] = useState(false)
  const [selColor, setSelColor] = useState<SubjectColor>(PALETTE[0])
  const [newName, setNewName] = useState('')
  const [qaSubject, setQaSubject] = useState('')
  const [qaTopic, setQaTopic] = useState('')
  const [qaTime, setQaTime] = useState<SlotName>('Morning')
  const [qaUseCustomTime, setQaUseCustomTime] = useState(false)
  const [qaStartTime, setQaStartTime] = useState('09:00')
  const [qaEndTime, setQaEndTime] = useState('10:00')
  const [qaDur, setQaDur] = useState(60)
  const [qaDiff, setQaDiff] = useState('Medium')
  const [qaGoal, setQaGoal] = useState('Learn')
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)
  const [slotPulse, setSlotPulse] = useState<string | null>(null)
  const [slotRanges, setSlotRanges] = useState<SlotRanges>(() => cloneDefaultSlotRanges())
  const [showSlotEditor, setShowSlotEditor] = useState(false)
  const [slotDraft, setSlotDraft] = useState<Record<SlotName, { start: string; end: string }>>(() => ({
    Morning: { start: minutesToClock(DEFAULT_SLOT_RANGES.Morning.start), end: minutesToClock(DEFAULT_SLOT_RANGES.Morning.end) },
    Afternoon: { start: minutesToClock(DEFAULT_SLOT_RANGES.Afternoon.start), end: minutesToClock(DEFAULT_SLOT_RANGES.Afternoon.end) },
    Evening: { start: minutesToClock(DEFAULT_SLOT_RANGES.Evening.start), end: minutesToClock(DEFAULT_SLOT_RANGES.Evening.end) },
    Night: { start: minutesToClock(DEFAULT_SLOT_RANGES.Night.start), end: minutesToClock(DEFAULT_SLOT_RANGES.Night.end) },
  }))

  useEffect(() => {
    setSlotRanges(getStoredSlotRanges(session?.user?.id))
  }, [session?.user?.id])

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
            const startTime = p.start_time ? String(p.start_time).slice(0, 5) : undefined
            const endTime = p.end_time ? String(p.end_time).slice(0, 5) : undefined
            const rawSlot = String(p.time_slot || 'Morning')
            const normalizedSlot = (TIME_SLOTS.find((slot) => slot === rawSlot) ?? 'Morning') as SlotName
            return {
              id: 'b' + String(p.plan_id),
              planId: String(p.plan_id),
              sid: subj?.id || '',
              topic: String(studyTopic?.topic_name || ''),
              time: normalizedSlot,
              startTime,
              endTime,
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

  const removeBlock = useCallback((id: string) => {
    setPlanBlocks(prev => prev.filter(b => b.id !== id))
  }, [])

  // Helper to check if new session overlaps with existing ones
  const hasTimeConflict = useCallback((
    newStartTime: number,
    newEndTime: number,
    excludeBlockId?: string
  ): boolean => {
    return planBlocks.some(block => {
      if (excludeBlockId && block.id === excludeBlockId) return false
      const existing = getBlockTimeRange(block, slotRanges)
      if (!existing) return false
      return checkTimeOverlap(newStartTime, newEndTime, existing.start, existing.end)
    })
  }, [planBlocks, slotRanges])

  const openSlotEditor = useCallback(() => {
    setSlotDraft({
      Morning: { start: minutesToClock(slotRanges.Morning.start), end: minutesToClock(slotRanges.Morning.end) },
      Afternoon: { start: minutesToClock(slotRanges.Afternoon.start), end: minutesToClock(slotRanges.Afternoon.end) },
      Evening: { start: minutesToClock(slotRanges.Evening.start), end: minutesToClock(slotRanges.Evening.end) },
      Night: { start: minutesToClock(slotRanges.Night.start), end: minutesToClock(slotRanges.Night.end) },
    })
    setShowSlotEditor(true)
  }, [slotRanges])

  const saveSlotPreferences = useCallback(() => {
    const nextRanges = cloneDefaultSlotRanges()

    for (const slot of TIME_SLOTS) {
      const startMin = timeToMinutes(slotDraft[slot].start)
      const endMin = timeToMinutes(slotDraft[slot].end)
      if (startMin == null || endMin == null) {
        showToast(`Invalid ${slot} time. Use HH:MM format.`, 'warning')
        return
      }
      if (startMin === endMin) {
        showToast(`${slot} start and end cannot be the same.`, 'warning')
        return
      }
      nextRanges[slot] = { start: startMin, end: endMin }
    }

    setSlotRanges(nextRanges)
    saveStoredSlotRanges(session?.user?.id, nextRanges)
    setShowSlotEditor(false)
    showToast('Timeline slot timings updated', 'info')
  }, [session?.user?.id, showToast, slotDraft])

  const animateSubjectToSlot = useCallback((sid: string, slot: string) => {
    if (typeof window === 'undefined') return

    const subjectEl = document.querySelector(`[data-subject-id="${sid}"]`) as HTMLElement | null
    const slotEl = document.querySelector(`[data-slot-id="${slot}"]`) as HTMLElement | null
    if (!subjectEl || !slotEl) return

    const subjectRect = subjectEl.getBoundingClientRect()
    const slotRect = slotEl.getBoundingClientRect()
    const clone = subjectEl.cloneNode(true) as HTMLElement

    clone.style.position = 'fixed'
    clone.style.left = `${subjectRect.left}px`
    clone.style.top = `${subjectRect.top}px`
    clone.style.width = `${subjectRect.width}px`
    clone.style.height = `${subjectRect.height}px`
    clone.style.margin = '0'
    clone.style.zIndex = '9999'
    clone.style.pointerEvents = 'none'
    clone.style.transition = 'transform 520ms cubic-bezier(.2,.8,.2,1), opacity 520ms ease'
    clone.style.transformOrigin = 'center center'
    document.body.appendChild(clone)

    const targetX = slotRect.left + Math.min(slotRect.width * 0.25, 120)
    const targetY = slotRect.top + 40
    const dx = targetX - subjectRect.left
    const dy = targetY - subjectRect.top

    requestAnimationFrame(() => {
      clone.style.transform = `translate(${dx}px, ${dy}px) scale(0.88)`
      clone.style.opacity = '0.12'
    })

    setTimeout(() => {
      clone.remove()
      setSlotPulse(slot)
      setTimeout(() => setSlotPulse((prev) => (prev === slot ? null : prev)), 700)
    }, 560)
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

      // Validate time
      let newStartMin: number
      let newEndMin: number

      if (qaUseCustomTime) {
        const startMin = timeToMinutes(qaStartTime)
        const endMin = timeToMinutes(qaEndTime)
        
        if (startMin === null || endMin === null) {
          showToast('Invalid time format. Use HH:MM', 'warning')
          return
        }
        
        if (startMin >= endMin) {
          showToast('End time must be after start time', 'warning')
          return
        }
        
        newStartMin = startMin
        newEndMin = endMin
      } else {
        const slotStart = slotRanges[qaTime as SlotName]?.start
        if (!Number.isFinite(slotStart)) {
          showToast('Invalid time slot', 'warning')
          return
        }
        newStartMin = slotStart
        newEndMin = slotStart + qaDur
      }

      // Check for overlaps with other blocks
      if (hasTimeConflict(newStartMin, newEndMin, editingBlock.id)) {
        showToast('This time overlaps with another session!', 'warning')
        return
      }

      const applyLocalUpdate = () => {
        const updatedSlot = qaUseCustomTime ? getSlotForMinutes(newStartMin, slotRanges) : qaTime
        setPlanBlocks(prev => prev.map(b => (
          b.id === editingBlock.id
            ? { 
                ...b, 
                sid, 
                topic: qaTopic, 
                time: updatedSlot,
                startTime: qaUseCustomTime ? qaStartTime : undefined,
                endTime: qaUseCustomTime ? qaEndTime : undefined,
                dur: qaUseCustomTime ? (newEndMin - newStartMin) : qaDur, 
                diff: qaDiff, 
                goal: qaGoal 
              }
            : b
        )))
        setEditingBlockId(null)
        resetFormFields()
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
          target_duration: qaUseCustomTime ? (newEndMin - newStartMin) : qaDur,
          time_slot: qaTime,
          plan_date: editingBlock.planDate || today,
          start_time: qaUseCustomTime ? qaStartTime : undefined,
          end_time: qaUseCustomTime ? qaEndTime : undefined,
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

    let newStartMin: number
    let newEndMin: number
    let duration: number

    if (qaUseCustomTime) {
      const startMin = timeToMinutes(qaStartTime)
      const endMin = timeToMinutes(qaEndTime)
      
      if (startMin === null || endMin === null) {
        showToast('Invalid time format. Use HH:MM', 'warning')
        return
      }
      
      if (startMin >= endMin) {
        showToast('End time must be after start time', 'warning')
        return
      }
      
      newStartMin = startMin
      newEndMin = endMin
      duration = newEndMin - newStartMin
    } else {
      const slotStart = slotRanges[qaTime as SlotName]?.start
      if (!Number.isFinite(slotStart)) {
        showToast('Invalid time slot', 'warning')
        return
      }
      newStartMin = slotStart
      newEndMin = slotStart + qaDur
      duration = qaDur
    }

    // Check for overlaps with existing blocks
    if (hasTimeConflict(newStartMin, newEndMin)) {
      showToast('This time overlaps with another session!', 'warning')
      return
    }

    setPlanBlocks(prev => [...prev, { 
      id: 'b' + Date.now(), 
      sid, 
      topic: qaTopic, 
      time: qaUseCustomTime ? getSlotForMinutes(newStartMin, slotRanges) : qaTime,
      startTime: qaUseCustomTime ? qaStartTime : undefined,
      endTime: qaUseCustomTime ? qaEndTime : undefined,
      dur: duration, 
      diff: qaDiff, 
      goal: qaGoal, 
      persisted: false 
    }])
    const s = subjects.find(x => x.id === sid)
    showToast(`${s ? s.name : 'Block'} added!`)
    const targetSlot = qaUseCustomTime ? getSlotForMinutes(newStartMin, slotRanges) : qaTime
    setTimeout(() => animateSubjectToSlot(sid, targetSlot), 80)
    resetFormFields()
  }, [editingBlockId, qaSubject, qaTopic, qaTime, qaUseCustomTime, qaStartTime, qaEndTime, qaDur, qaDiff, qaGoal, subjects, hasTimeConflict, showToast, animateSubjectToSlot, slotRanges])

  const resetFormFields = useCallback(() => {
    setQaTopic('')
    setQaTime('Morning')
    setQaUseCustomTime(false)
    setQaStartTime('09:00')
    setQaEndTime('10:00')
    setQaDur(60)
    setQaDiff('Medium')
    setQaGoal('Learn')
  }, [])

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
    setQaTime((TIME_SLOTS.find((slot) => slot === blk.time) ?? 'Morning') as SlotName)
    
    if (blk.startTime && blk.endTime) {
      setQaUseCustomTime(true)
      setQaStartTime(blk.startTime)
      setQaEndTime(blk.endTime)
    } else {
      setQaUseCustomTime(false)
      setQaStartTime('09:00')
      setQaEndTime('10:00')
    }
    
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
              start_time: block.startTime || undefined,
              end_time: block.endTime || undefined,
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
  const visibleSlots = TIME_SLOTS.filter(slot => planBlocks.some(b => getBlockSlot(b, slotRanges) === slot))

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Study Planner</div>
          <div className="page-sub">Use quick-add to build your timeline. Set custom slot timings for Morning, Afternoon, Evening, and Night based on your personal routine.</div>
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
          <span style={{ fontSize: '11.5px', color: 'var(--text-soft)', display: 'inline-flex', alignItems: 'center', gap: 5 }}><SparklesIcon width={14} height={14} />Use Quick Add Block to schedule sessions</span>
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
                data-subject-id={s.id}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button className="btn-secondary btn-sm" onClick={openSlotEditor}>Adjust Slot Timings</button>
              <span className="badge badge-indigo">{planBlocks.length} blocks · {totalHours}h planned</span>
            </div>
          </div>
          {showSlotEditor && (
            <div className="card" style={{ marginBottom: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: 10 }}>Your Slot Preferences</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {TIME_SLOTS.map((slot) => (
                  <div key={slot} className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">{slot}</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      <input
                        className="form-input"
                        type="time"
                        value={slotDraft[slot].start}
                        onChange={(e) => setSlotDraft((prev) => ({ ...prev, [slot]: { ...prev[slot], start: e.target.value } }))}
                      />
                      <input
                        className="form-input"
                        type="time"
                        value={slotDraft[slot].end}
                        onChange={(e) => setSlotDraft((prev) => ({ ...prev, [slot]: { ...prev[slot], end: e.target.value } }))}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
                <button className="btn-secondary btn-sm" onClick={() => setShowSlotEditor(false)}>Cancel</button>
                <button
                  className="btn-secondary btn-sm"
                  onClick={() => {
                    const defaults = cloneDefaultSlotRanges()
                    setSlotDraft({
                      Morning: { start: minutesToClock(defaults.Morning.start), end: minutesToClock(defaults.Morning.end) },
                      Afternoon: { start: minutesToClock(defaults.Afternoon.start), end: minutesToClock(defaults.Afternoon.end) },
                      Evening: { start: minutesToClock(defaults.Evening.start), end: minutesToClock(defaults.Evening.end) },
                      Night: { start: minutesToClock(defaults.Night.start), end: minutesToClock(defaults.Night.end) },
                    })
                  }}
                >
                  Reset Defaults
                </button>
                <button className="btn-primary btn-sm" onClick={saveSlotPreferences}>Save Timings</button>
              </div>
            </div>
          )}
          {visibleSlots.length === 0 ? (
            <div className="drop-zone-banner" style={{ borderStyle: 'solid' }}>
              <div style={{ display: 'inline-flex', marginBottom: 6 }}><TargetIcon width={24} height={24} /></div>
              No timeline sections yet. Add your first session from Quick Add Block.
            </div>
          ) : (
            <div>
            {visibleSlots.map(slot => {
              const blks = planBlocks
                .filter(b => getBlockSlot(b, slotRanges) === slot)
                .sort((a, b) => {
                  const aRange = getBlockTimeRange(a, slotRanges)
                  const bRange = getBlockTimeRange(b, slotRanges)
                  return (aRange?.start ?? 0) - (bRange?.start ?? 0)
                })
              return (
                <div
                  key={slot}
                  className="timeline-slot"
                  data-slot-id={slot}
                  style={slotPulse === slot ? { boxShadow: '0 0 0 2px rgba(201,107,58,.35), 0 10px 24px rgba(0,0,0,.08)' } : undefined}
                >
                  <div className="ts-time">{getSlotLabel(slot, slotRanges)}</div>
                  <div className="ts-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {blks.length > 0 && (
                      <>
                        {blks.map(blk => {
                          const s = subjects.find(x => x.id === blk.sid)
                          const c = s ? s.color : PALETTE[0]
                          return (
                            <div key={blk.id} className="planner-block" style={{ background: c.light, borderLeftColor: c.hex }}>
                              <div style={{ flex: 1 }}>
                                <div className="pb-subj" style={{ color: c.hex, display: 'inline-flex', alignItems: 'center', gap: 6 }}><BookIcon width={14} height={14} />{s?.name || 'Unknown'}</div>
                                <div className="pb-meta">
                                  {blk.topic || 'General study'} · {blk.dur}min · 
                                  {formatPlanScheduleLabel({ start_time: blk.startTime, end_time: blk.endTime, time_slot: blk.time }, { durationMin: blk.dur, fallback: formatSessionRange(blk.time, blk.dur, slotRanges) || 'Anytime' })} · {blk.diff}
                                </div>
                              </div>
                              {blk.logged ? (
                                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'var(--sage-light)', color: 'var(--sage)', border: '1px solid rgba(107,155,122,.4)' }}>Logged</span>
                              ) : (
                                <button className="btn-secondary btn-sm" style={{ padding: '4px 8px' }} onClick={() => startEditBlock(blk.id)}>Edit</button>
                              )}
                              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: c.light, color: c.hex, border: `1px solid ${c.hex}` }}>{blk.goal}</span>
                              <button className="pb-remove" onClick={() => removeBlock(blk.id)}>✕</button>
                            </div>
                          )
                        })}
                      </>
                    )}
                    <div className="ts-empty" style={{ display: blks.length > 0 ? 'flex' : undefined, minHeight: blks.length === 0 ? '60px' : 'auto' }}>
                      Add more from Quick Add Block →
                    </div>
                  </div>
                </div>
              )
            })}
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div className="planner-sidebar">
          <div className="ps-form">
            <div className="section-title">
              {editingBlockId ? 'Edit Timeline Block' : 'Quick Add Block'}
            </div>
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
              
              {/* Time Input Section */}
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input 
                    type="checkbox" 
                    checked={qaUseCustomTime} 
                    onChange={e => setQaUseCustomTime(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  Use Custom Times
                </label>
              </div>

              {qaUseCustomTime ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div className="form-group">
                    <label className="form-label">Start Time</label>
                    <input 
                      className="form-input" 
                      type="time" 
                      value={qaStartTime} 
                      onChange={e => setQaStartTime(e.target.value)} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Time</label>
                    <input 
                      className="form-input" 
                      type="time" 
                      value={qaEndTime} 
                      onChange={e => setQaEndTime(e.target.value)} 
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">Time Slot</label>
                    <select className="form-select" value={qaTime} onChange={e => setQaTime(e.target.value as SlotName)}>
                      {TIME_SLOTS.map(slot => <option key={slot} value={slot}>{getSlotLabel(slot, slotRanges)}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Duration: <span style={{ color: 'var(--terra)', fontWeight: 700 }}>{qaDur} min</span></label>
                    <div style={{ position: 'relative', paddingBottom: '24px' }}>
                      <input className="form-range" type="range" min="15" max="180" step="15" value={qaDur} onChange={e => setQaDur(Number(e.target.value))} />
                      <div className="range-labels" style={{ position: 'absolute', bottom: '0', left: '0', right: '0', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-soft)', fontWeight: '500', userSelect: 'none', paddingLeft: '2px', paddingRight: '2px' }}>
                        <span>15m</span>
                        <span>1h</span>
                        <span>3h</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

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
                  <button 
                    className="btn-secondary" 
                    style={{ width: '100%', justifyContent: 'center' }} 
                    onClick={() => {
                      setEditingBlockId(null)
                      resetFormFields()
                    }}
                  >
                    Cancel
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
