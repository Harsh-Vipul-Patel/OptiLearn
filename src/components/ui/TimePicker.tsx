'use client'

import { CSSProperties, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { TimerIcon } from '@/components/ui/AppIcons'

interface TimePickerProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  ariaLabel?: string
  minuteStep?: number
}

function parseTime(value: string): { hours: number; minutes: number } | null {
  if (!value) return null
  const [hoursPart, minutesPart] = value.split(':')
  const hours = Number.parseInt(hoursPart, 10)
  const minutes = Number.parseInt(minutesPart, 10)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return { hours, minutes }
}

function toTimeKey(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function toDisplayTime(hours: number, minutes: number): string {
  const period = hours < 12 ? 'AM' : 'PM'
  const displayHour = hours % 12 || 12
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${period}`
}

function normalizeMinuteStep(step?: number): number {
  if (!Number.isFinite(step) || !step || step < 1) return 1
  return Math.min(60, Math.floor(step))
}

export function TimePicker({
  value,
  onChange,
  placeholder = 'Select time',
  disabled = false,
  className = '',
  ariaLabel,
  minuteStep = 1,
}: TimePickerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({ position: 'fixed', opacity: 0, pointerEvents: 'none' })

  const parsed = useMemo(() => parseTime(value), [value])
  const displayLabel = useMemo(() => {
    if (!parsed) return placeholder
    return toDisplayTime(parsed.hours, parsed.minutes)
  }, [parsed, placeholder])

  const minuteOptions = useMemo(() => {
    const step = normalizeMinuteStep(minuteStep)
    const options: number[] = []
    for (let minute = 0; minute < 60; minute += step) {
      options.push(minute)
    }
    if (options[options.length - 1] !== 59) {
      options.push(59)
    }
    return Array.from(new Set(options))
  }, [minuteStep])

  const currentHours = parsed?.hours ?? 0
  const currentMinutes = parsed?.minutes ?? 0
  const currentPeriod = currentHours < 12 ? 'AM' : 'PM'
  const currentHour12 = currentHours % 12 || 12

  const closeMenu = () => {
    setOpen(false)
  }

  const updateTime = (hours12: number, minutes: number, period: 'AM' | 'PM') => {
    const normalizedHours = hours12 % 12
    const hours24 = period === 'AM'
      ? (hours12 === 12 ? 0 : normalizedHours)
      : (hours12 === 12 ? 12 : normalizedHours + 12)
    onChange(toTimeKey(hours24, minutes))
  }

  const selectHour = (hour12: number) => updateTime(hour12, currentMinutes, currentPeriod)
  const selectMinute = (minutes: number) => updateTime(currentHour12, minutes, currentPeriod)
  const selectPeriod = (period: 'AM' | 'PM') => updateTime(currentHour12, currentMinutes, period)

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
      const preferredWidth = 360
      const preferredHeight = 320
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

  const hourOptions = Array.from({ length: 12 }, (_, index) => index + 1)

  return (
    <div
      ref={rootRef}
      className={`time-picker ${open ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''} ${className}`.trim()}
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
        <span className={`picker-trigger-text ${parsed ? '' : 'is-placeholder'}`.trim()}>
          {displayLabel}
        </span>
        <span className="picker-trigger-icon" aria-hidden="true">
          <TimerIcon width={15} height={15} />
        </span>
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div ref={menuRef} className="time-picker-panel" style={menuStyle} role="dialog" aria-label={ariaLabel || placeholder}>
          <div className="picker-header">
            <div className="picker-header-title">Pick a time</div>
          </div>

          <div className="time-picker-columns">
            <div className="time-picker-column">
              <div className="time-picker-column-label">Hour</div>
              <div className="time-picker-scroll">
                {hourOptions.map((hour) => {
                  const isSelected = currentHour12 === hour
                  return (
                    <button
                      key={hour}
                      type="button"
                      className={`time-option ${isSelected ? 'is-selected' : ''}`.trim()}
                      onClick={() => selectHour(hour)}
                    >
                      {String(hour).padStart(2, '0')}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="time-picker-column">
              <div className="time-picker-column-label">Minute</div>
              <div className="time-picker-scroll">
                {minuteOptions.map((minute) => {
                  const isSelected = currentMinutes === minute
                  return (
                    <button
                      key={minute}
                      type="button"
                      className={`time-option ${isSelected ? 'is-selected' : ''}`.trim()}
                      onClick={() => selectMinute(minute)}
                    >
                      {String(minute).padStart(2, '0')}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="time-picker-column time-picker-periods">
              <div className="time-picker-column-label">Period</div>
              <button
                type="button"
                className={`time-period ${currentPeriod === 'AM' ? 'is-selected' : ''}`.trim()}
                onClick={() => selectPeriod('AM')}
              >
                AM
              </button>
              <button
                type="button"
                className={`time-period ${currentPeriod === 'PM' ? 'is-selected' : ''}`.trim()}
                onClick={() => selectPeriod('PM')}
              >
                PM
              </button>
            </div>
          </div>

          <div className="picker-footer">
            <button type="button" className="picker-secondary" onClick={() => {
              onChange('')
              closeMenu()
            }}>
              Clear
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}