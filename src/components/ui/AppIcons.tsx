import { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function BaseIcon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export function UserIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c1.6-3.2 4.2-5 8-5s6.4 1.8 8 5" />
    </BaseIcon>
  )
}

export function MailIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </BaseIcon>
  )
}

export function LockIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </BaseIcon>
  )
}

export function BookIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H20v15.5a.5.5 0 0 1-.5.5H6.5A2.5 2.5 0 0 1 4 17.5v-11z" />
      <path d="M8 4v16" />
    </BaseIcon>
  )
}

export function BrainIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M9 6a3 3 0 0 1 6 0v1" />
      <path d="M7 10a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v1" />
      <path d="M7 11a3 3 0 0 0-3 3v1a3 3 0 0 0 3 3" />
      <path d="M17 11a3 3 0 0 1 3 3v1a3 3 0 0 1-3 3" />
      <path d="M9 18a3 3 0 0 0 6 0" />
    </BaseIcon>
  )
}

export function AnalyticsIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </BaseIcon>
  )
}

export function AlertIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 3l9 16H3L12 3z" />
      <path d="M12 9v5" />
      <circle cx="12" cy="17" r="1" />
    </BaseIcon>
  )
}

export function TargetIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1.2" />
    </BaseIcon>
  )
}

export function TimerIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 13l3-2" />
      <path d="M9 2h6" />
      <path d="M12 5v2" />
    </BaseIcon>
  )
}

export function FlameIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 3c2 3 5 4.5 5 9a5 5 0 1 1-10 0c0-2.6 1.2-4.5 3.4-6.8" />
      <path d="M12 12c1.4 1.1 2 2.2 2 3.3A2 2 0 0 1 10 15c0-1 .5-1.9 2-3z" />
    </BaseIcon>
  )
}

export function SparklesIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 3l1.4 3.6L17 8l-3.6 1.4L12 13l-1.4-3.6L7 8l3.6-1.4L12 3z" />
      <path d="M5 14l.8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14z" />
      <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z" />
    </BaseIcon>
  )
}

export function TrashIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M6 6l1 14h10l1-14" />
    </BaseIcon>
  )
}

export function CheckCircleIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12l2.5 2.5L16 9" />
    </BaseIcon>
  )
}

export function ThumbsUpIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M10 11V5.5a2.5 2.5 0 0 1 2.5-2.5L13 8h5a2 2 0 0 1 2 2l-1 6a2 2 0 0 1-2 2h-7" />
      <rect x="4" y="10" width="4" height="10" rx="1" />
    </BaseIcon>
  )
}

export function ThumbsDownIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M10 13v5.5a2.5 2.5 0 0 0 2.5 2.5L13 16h5a2 2 0 0 0 2-2l-1-6a2 2 0 0 0-2-2h-7" />
      <rect x="4" y="4" width="4" height="10" rx="1" />
    </BaseIcon>
  )
}

export function CalendarIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </BaseIcon>
  )
}

export function PhoneIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="8" y="2.5" width="8" height="19" rx="1.5" />
      <circle cx="12" cy="18" r="0.8" />
    </BaseIcon>
  )
}

export function MoonIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M15 3a8.5 8.5 0 1 0 6 14.5A9.5 9.5 0 0 1 15 3z" />
    </BaseIcon>
  )
}

export function FocusIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3" />
      <path d="M12 19v3" />
      <path d="M2 12h3" />
      <path d="M19 12h3" />
    </BaseIcon>
  )
}

export function VolumeIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <polygon points="11 5 6 9 3 9 3 15 6 15 11 19 11 5" />
      <path d="M15 9a4 4 0 0 1 0 6" />
      <path d="M17.5 6.5a7 7 0 0 1 0 11" />
    </BaseIcon>
  )
}

export function LaptopIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="4" y="5" width="16" height="10" rx="1.5" />
      <path d="M2 19h20" />
    </BaseIcon>
  )
}

export function StarIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 3l2.8 5.7L21 9.6l-4.5 4.4 1.1 6.3L12 17.4 6.4 20.3 7.5 14 3 9.6l6.2-.9L12 3z" />
    </BaseIcon>
  )
}

export function UserWaveIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c1.6-3.2 4.2-5 8-5" />
      <path d="M18 15c1.2.7 2 2 2 3.5" />
      <path d="M17 13.5c1.8.8 3 2.7 3 4.7" />
    </BaseIcon>
  )
}
