export type PlanSlot = 'Morning' | 'Afternoon' | 'Evening' | 'Night'

type PlanScheduleLike = {
  start_time?: string | null
  end_time?: string | null
  time_slot?: string | null
}

const SLOT_START_MINUTES: Record<PlanSlot, number> = {
  Morning: 4 * 60,
  Afternoon: 11 * 60,
  Evening: 16 * 60,
  Night: 20 * 60,
}

export function normalizePlanSlot(value?: string | null): PlanSlot | null {
  if (!value) return null
  const lower = String(value).toLowerCase()
  if (lower === 'morning') return 'Morning'
  if (lower === 'afternoon') return 'Afternoon'
  if (lower === 'evening') return 'Evening'
  if (lower === 'night') return 'Night'
  return null
}

export function parseClockToMinutes(value?: string | null): number | null {
  if (!value) return null
  const timePart = value.includes('T') ? value.split('T')[1] : value
  const normalized = (timePart || '').slice(0, 5)
  const [hh, mm] = normalized.split(':').map(Number)
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null
  return hh * 60 + mm
}

export function getSlotFromMinutes(minutes: number): PlanSlot {
  if (minutes >= 4 * 60 && minutes < 11 * 60) return 'Morning'
  if (minutes >= 11 * 60 && minutes < 16 * 60) return 'Afternoon'
  if (minutes >= 16 * 60 && minutes < 20 * 60) return 'Evening'
  return 'Night'
}

export function inferPlanSlotFromTimes(plan: PlanScheduleLike, fallback: PlanSlot = 'Morning'): PlanSlot {
  const startMinutes = parseClockToMinutes(plan.start_time)
  if (startMinutes != null) return getSlotFromMinutes(startMinutes)
  return normalizePlanSlot(plan.time_slot) ?? fallback
}

function formatMinutesToTime(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24
  const mm = minutes % 60
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  const ampm = h24 < 12 ? 'AM' : 'PM'
  return `${h12}:${String(mm).padStart(2, '0')} ${ampm}`
}

export function formatPlanScheduleLabel(
  plan: PlanScheduleLike,
  options?: { durationMin?: number; fallback?: string }
): string {
  const startMinutes = parseClockToMinutes(plan.start_time)
  const endMinutes = parseClockToMinutes(plan.end_time)

  if (startMinutes != null && endMinutes != null && endMinutes > startMinutes) {
    const slot = getSlotFromMinutes(startMinutes)
    return `${formatMinutesToTime(startMinutes)} - ${formatMinutesToTime(endMinutes)} (${slot})`
  }

  const normalizedSlot = normalizePlanSlot(plan.time_slot)
  const durationMin = options?.durationMin
  if (normalizedSlot && Number.isFinite(durationMin) && Number(durationMin) > 0) {
    const syntheticStart = SLOT_START_MINUTES[normalizedSlot]
    const syntheticEnd = syntheticStart + Number(durationMin)
    return `${formatMinutesToTime(syntheticStart)} - ${formatMinutesToTime(syntheticEnd)} (${normalizedSlot})`
  }

  if (normalizedSlot) return normalizedSlot
  return options?.fallback ?? 'Anytime'
}

export function getPlanSortMinutes(plan: PlanScheduleLike): number {
  const startMinutes = parseClockToMinutes(plan.start_time)
  if (startMinutes != null) return startMinutes
  const normalizedSlot = normalizePlanSlot(plan.time_slot)
  if (!normalizedSlot) return Number.MAX_SAFE_INTEGER
  return SLOT_START_MINUTES[normalizedSlot]
}