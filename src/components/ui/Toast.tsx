'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { AlertIcon, CheckCircleIcon, SparklesIcon, TrashIcon } from '@/components/ui/AppIcons'

type ToastIconName = 'success' | 'warning' | 'info' | 'trash'

interface ToastContextValue {
  showToast: (msg: string, icon?: string | ToastIconName) => void
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false)
  const [msg, setMsg] = useState('')
  const [icon, setIcon] = useState<ToastIconName>('success')

  const showToast = useCallback((message: string, toastIcon: string | ToastIconName = 'success') => {
    setMsg(message)
    setIcon(normalizeToastIcon(toastIcon))
    setVisible(true)
    setTimeout(() => setVisible(false), 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className={`toast${visible ? ' show' : ''}`}>
        <ToastIcon icon={icon} />
        <span>{msg}</span>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}

function normalizeToastIcon(icon: string | ToastIconName): ToastIconName {
  if (icon === 'success' || icon === 'warning' || icon === 'info' || icon === 'trash') {
    return icon
  }

  if (icon === '⚠️') return 'warning'
  if (icon === '🗑') return 'trash'
  if (icon === '✦' || icon === '👋') return 'info'

  return 'success'
}

function ToastIcon({ icon }: { icon: ToastIconName }) {
  const common = { width: 16, height: 16 }
  if (icon === 'warning') return <AlertIcon {...common} />
  if (icon === 'info') return <SparklesIcon {...common} />
  if (icon === 'trash') return <TrashIcon {...common} />
  return <CheckCircleIcon {...common} />
}
