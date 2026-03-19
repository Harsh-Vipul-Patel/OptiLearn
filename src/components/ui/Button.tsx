import { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
  size?: 'sm' | 'md'
  children: ReactNode
  fullWidth?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  fullWidth,
  className = '',
  ...props
}: ButtonProps) {
  const classes = [
    `btn-${variant}`,
    size === 'sm' ? 'btn-sm' : '',
    fullWidth ? 'w-full justify-center' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <button className={classes} style={fullWidth ? { width: '100%', justifyContent: 'center' } : {}} {...props}>
      {children}
    </button>
  )
}
