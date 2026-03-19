interface ProgressBarProps {
  value: number    // 0-100
  color?: string
  height?: number
}

export function ProgressBar({ value, color = 'var(--terra)', height = 6 }: ProgressBarProps) {
  return (
    <div className="progress-wrap" style={{ height }}>
      <div
        className="progress-fill"
        style={{ width: `${Math.min(Math.max(value, 0), 100)}%`, background: color }}
      />
    </div>
  )
}
