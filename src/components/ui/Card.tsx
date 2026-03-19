import { ReactNode, CSSProperties } from 'react'

interface CardProps {
  children: ReactNode
  flat?: boolean
  style?: CSSProperties
  className?: string
  id?: string
}

export function Card({ children, flat = false, style, className = '', id }: CardProps) {
  return (
    <div id={id} className={`${flat ? 'card-flat' : 'card'} ${className}`} style={style}>
      {children}
    </div>
  )
}
