'use client'

import { CSSProperties, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface CustomSelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface CustomSelectProps {
  value: string
  options: CustomSelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  style?: CSSProperties
  ariaLabel?: string
}

function findNextEnabledIndex(options: CustomSelectOption[], fromIndex: number, direction: 1 | -1) {
  if (!options.length) return -1

  let idx = fromIndex
  for (let i = 0; i < options.length; i += 1) {
    idx = (idx + direction + options.length) % options.length
    if (!options[idx]?.disabled) return idx
  }

  return -1
}

export function CustomSelect({
  value,
  options,
  onChange,
  placeholder = 'Select option',
  disabled = false,
  className = '',
  style,
  ariaLabel,
}: CustomSelectProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])

  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({ position: 'fixed', opacity: 0, pointerEvents: 'none' })

  const selected = useMemo(
    () => options.find((option) => option.value === value),
    [options, value]
  )

  const defaultHighlightedIndex = useMemo(() => {
    const selectedIndex = options.findIndex((option) => option.value === value && !option.disabled)
    if (selectedIndex >= 0) return selectedIndex
    return options.findIndex((option) => !option.disabled)
  }, [options, value])

  const activeHighlightedIndex =
    highlightedIndex >= 0 &&
    highlightedIndex < options.length &&
    !options[highlightedIndex]?.disabled
      ? highlightedIndex
      : defaultHighlightedIndex

  const closeMenu = () => {
    setOpen(false)
    setHighlightedIndex(-1)
  }

  const selectOption = (option: CustomSelectOption) => {
    if (option.disabled) return
    onChange(option.value)
    closeMenu()
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

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
    if (!open || activeHighlightedIndex < 0) return
    const option = optionRefs.current[activeHighlightedIndex]
    const menu = menuRef.current
    if (option && menu) {
      const optionTop = option.offsetTop
      const optionBottom = optionTop + option.offsetHeight
      const menuTop = menu.scrollTop
      const menuHeight = menu.clientHeight
      const menuBottom = menuTop + menuHeight

      if (optionTop < menuTop) {
        menu.scrollTop = optionTop
      } else if (optionBottom > menuBottom) {
        menu.scrollTop = optionBottom - menuHeight
      }
    }
  }, [open, activeHighlightedIndex])

  useEffect(() => {
    if (!open) return

    const updatePosition = () => {
      const trigger = triggerRef.current
      if (!trigger) return

      const rect = trigger.getBoundingClientRect()
      const viewportPadding = 8
      const preferredMaxHeight = 280
      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding
      const spaceAbove = rect.top - viewportPadding
      const openUpwards = spaceBelow < 180 && spaceAbove > spaceBelow
      const maxHeight = Math.max(140, Math.min(preferredMaxHeight, openUpwards ? spaceAbove : spaceBelow))

      const top = openUpwards
        ? Math.max(viewportPadding, rect.top - maxHeight - 8)
        : Math.min(window.innerHeight - viewportPadding, rect.bottom + 8)

      const width = rect.width
      const left = Math.max(viewportPadding, Math.min(rect.left, window.innerWidth - width - viewportPadding))

      setMenuStyle({
        position: 'fixed',
        top,
        left,
        width,
        maxHeight,
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
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        setOpen(true)
      }
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      closeMenu()
      triggerRef.current?.focus()
      return
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const direction = event.key === 'ArrowDown' ? 1 : -1
      const baseIndex = activeHighlightedIndex < 0 ? (direction === 1 ? -1 : 0) : activeHighlightedIndex
      const next = findNextEnabledIndex(options, baseIndex, direction)
      if (next >= 0) setHighlightedIndex(next)
      return
    }

    if ((event.key === 'Enter' || event.key === ' ') && activeHighlightedIndex >= 0) {
      event.preventDefault()
      const option = options[activeHighlightedIndex]
      if (option) selectOption(option)
    }
  }

  return (
    <div
      ref={rootRef}
      className={`custom-select ${open ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''} ${className}`.trim()}
      style={style}
      onKeyDown={onKeyDown}
    >
      <button
        ref={triggerRef}
        type="button"
        className="form-select custom-select-trigger"
        onClick={() => !disabled && setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel || placeholder}
        disabled={disabled}
      >
        <span className={`custom-select-trigger-text ${selected ? '' : 'is-placeholder'}`.trim()}>
          {selected?.label || placeholder}
        </span>
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          className="custom-select-menu"
          style={menuStyle}
          role="listbox"
          aria-label={ariaLabel || placeholder}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value
            const isHighlighted = index === activeHighlightedIndex
            const optionClass = [
              'custom-select-option',
              isSelected ? 'is-selected' : '',
              isHighlighted ? 'is-highlighted' : '',
              option.disabled ? 'is-disabled' : '',
            ].filter(Boolean).join(' ')

            return (
              <button
                key={`${option.value}-${index}`}
                ref={(el) => {
                  optionRefs.current[index] = el
                }}
                type="button"
                role="option"
                className={optionClass}
                aria-selected={isSelected}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => selectOption(option)}
                disabled={option.disabled}
              >
                {option.label}
              </button>
            )
          })}
        </div>,
        document.body
      )}
    </div>
  )
}
