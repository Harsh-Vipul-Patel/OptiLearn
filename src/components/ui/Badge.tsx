import { ReactNode } from 'react'

type BadgeVariant = 'terra' | 'sage' | 'indigo' | 'gold'

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  className?: string
  style?: React.CSSProperties
}

export function Badge({ variant = 'indigo', children, className = '', style }: BadgeProps) {
  return (
    <span className={`badge badge-${variant} ${className}`} style={style}>
      {children}
    </span>
  )
}
