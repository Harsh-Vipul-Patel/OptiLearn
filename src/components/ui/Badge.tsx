import { ReactNode } from 'react'

type BadgeVariant = 'terra' | 'sage' | 'indigo' | 'gold'

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  className?: string
}

export function Badge({ variant = 'indigo', children, className = '' }: BadgeProps) {
  return (
    <span className={`badge badge-${variant} ${className}`}>
      {children}
    </span>
  )
}
