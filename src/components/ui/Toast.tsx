'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface ToastContextValue {
  showToast: (msg: string, icon?: string) => void
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false)
  const [msg, setMsg] = useState('')
  const [icon, setIcon] = useState('✅')

  const showToast = useCallback((message: string, toastIcon = '✅') => {
    setMsg(message)
    setIcon(toastIcon)
    setVisible(true)
    setTimeout(() => setVisible(false), 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className={`toast${visible ? ' show' : ''}`}>
        <span>{icon}</span>
        <span>{msg}</span>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
