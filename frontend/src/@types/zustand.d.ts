declare module 'zustand' {
  import { StateCreator } from 'zustand/vanilla'
  
  export declare const create: <T>(stateCreator: StateCreator<T>) => (selector?: (state: T) => unknown) => T

  export type StoreApi<T> = {
    getState: () => T
    setState: (partial: T | Partial<T> | ((state: T) => T | Partial<T>), replace?: boolean) => void
    subscribe: (listener: (state: T, prevState: T) => void) => () => void
    destroy: () => void
  }
} 