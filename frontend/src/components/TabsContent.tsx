import Analytics from './Analytics'
import LPTracking from './LPTracking'
import BullRunStats from './BullRunStats'

export const tabs = [
  {
    value: 'analytics',
    label: 'Analytics',
    content: <Analytics />
  },
  {
    value: 'tracking',
    label: 'Tracking',
    content: <LPTracking />
  },
  {
    value: 'bullrun',
    label: 'BullRun',
    content: <BullRunStats />
  }
] as const 