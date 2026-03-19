'use client'

import { PlannerPage } from '@/components/planner/PlannerPage'
import { ToastProvider } from '@/components/ui/Toast'

export default function PlannerRoute() {
  return (
    <ToastProvider>
      <PlannerPage />
    </ToastProvider>
  )
}
