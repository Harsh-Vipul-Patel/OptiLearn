'use client'

import { Suspense } from 'react'
import { PlannerPage } from '@/components/planner/PlannerPage'
import { ToastProvider } from '@/components/ui/Toast'

export default function PlannerRoute() {
  return (
    <ToastProvider>
      <Suspense fallback={<div style={{ padding: 20, color: 'var(--text-soft)' }}>Loading planner...</div>}>
        <PlannerPage />
      </Suspense>
    </ToastProvider>
  )
}
