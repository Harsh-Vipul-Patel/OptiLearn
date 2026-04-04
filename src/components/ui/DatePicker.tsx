'use client'

import { CSSProperties, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarIcon } from '@/components/ui/AppIcons'

interface DatePickerProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  ariaLabel?: string
  allowClear?: boolean
}

function parseDateKey(value: string): Date | null {
  if (!value) return null
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function isSameDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function buildCalendarDays(viewMonth: Date) {
  const monthStart = startOfMonth(viewMonth)
  const firstWeekday = monthStart.getDay()
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate()
  const totalCells = 42
  const cells: Array<{ date: Date; currentMonth: boolean }> = []

  for (let index = 0; index < totalCells; index += 1) {
    const dayOffset = index - firstWeekday + 1
    const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), dayOffset)
    cells.push({
      date,
      currentMonth: dayOffset >= 1 && dayOffset <= daysInMonth,
    })
  }

  return cells
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  disabled = false,
  className = '',
  ariaLabel,
  allowClear = true,
}: DatePickerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({ position: 'fixed', opacity: 0, pointerEvents: 'none' })
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(parseDateKey(value) ?? new Date()))

  const selectedDate = useMemo(() => parseDateKey(value), [value])
  const displayLabel = useMemo(() => {
    if (!selectedDate) return placeholder
    return selectedDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }, [placeholder, selectedDate])
  const today = useMemo(() => new Date(), [])

  const closeMenu = () => {
    setOpen(false)
  }

  const selectDate = (date: Date) => {
    onChange(toDateKey(date))
    closeMenu()
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  useEffect(() => {
    if (!open) return

    const targetDate = selectedDate ?? new Date()
    setViewMonth(startOfMonth(targetDate))
  }, [open, selectedDate])

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      closeMenu()
    }

    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  useEffect(() => {
    if (!open) return

    const updatePosition = () => {
      const trigger = triggerRef.current
      if (!trigger) return

      const rect = trigger.getBoundingClientRect()
      const viewportPadding = 8
      const preferredWidth = 340
      const preferredHeight = 390
      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding
      const spaceAbove = rect.top - viewportPadding
      const openUpwards = spaceBelow < preferredHeight && spaceAbove > spaceBelow
      const top = openUpwards
        ? Math.max(viewportPadding, rect.top - preferredHeight - 8)
        : Math.min(window.innerHeight - viewportPadding, rect.bottom + 8)
      const left = Math.max(viewportPadding, Math.min(rect.left, window.innerWidth - preferredWidth - viewportPadding))

      setMenuStyle({
        position: 'fixed',
        top,
        left,
        width: Math.min(preferredWidth, window.innerWidth - viewportPadding * 2),
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return

    if (!open) {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
        event.preventDefault()
        setOpen(true)
      }
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      closeMenu()
      triggerRef.current?.focus()
    }
  }

  const calendarDays = buildCalendarDays(viewMonth)
  const monthLabel = viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div
      ref={rootRef}
      className={`date-picker ${open ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''} ${className}`.trim()}
      onKeyDown={onKeyDown}
    >
      <button
        ref={triggerRef}
        type="button"
        className="form-input picker-trigger"
        onClick={() => !disabled && setOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel || placeholder}
        disabled={disabled}
      >
        <span className={`picker-trigger-text ${selectedDate ? '' : 'is-placeholder'}`.trim()}>
          {displayLabel}
        </span>
        <span className="picker-trigger-icon" aria-hidden="true">
          <CalendarIcon width={15} height={15} />
        </span>
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div ref={menuRef} className="date-picker-panel" style={menuStyle} role="dialog" aria-label={ariaLabel || placeholder}>
          <div className="picker-header">
            <button type="button" className="picker-nav" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))} aria-label="Previous month">
              &lt;
            </button>
            <div className="picker-header-title">{monthLabel}</div>
            <button type="button" className="picker-nav" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))} aria-label="Next month">
              &gt;
            </button>
          </div>

          <div className="picker-weekdays" aria-hidden="true">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="picker-calendar-grid" role="grid" aria-label={monthLabel}>
            {calendarDays.map(({ date, currentMonth }) => {
              const isSelected = isSameDay(selectedDate, date)
              const isToday = isSameDay(today, date)
              const classes = [
                'picker-day',
                currentMonth ? '' : 'is-outside',
                isSelected ? 'is-selected' : '',
                isToday ? 'is-today' : '',
              ].filter(Boolean).join(' ')

              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  className={classes}
                  onClick={() => selectDate(date)}
                  aria-pressed={isSelected}
                  aria-label={date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                >
                  {date.getDate()}
                </button>
              )
            })}
          </div>

          <div className="picker-footer">
            <button type="button" className="picker-secondary" onClick={() => selectDate(new Date())}>
              Today
            </button>
            {allowClear && (
              <button type="button" className="picker-secondary" onClick={() => {
                onChange('')
                closeMenu()
              }}>
                Clear
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}