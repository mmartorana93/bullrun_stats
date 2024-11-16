import LPTracking from './LPTracking'
import BullRunStats from './BullRunStats'

export const tabs = [
  {
    value: 'tracking',
    label: 'LP Tracking',
    content: <LPTracking />
  },
  {
    value: 'bullrun',
    label: 'BullRun Stats',
    content: <BullRunStats />
  }
] as const 