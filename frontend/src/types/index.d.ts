export interface Transaction {
  // Aggiungi qui i campi della tua interfaccia Transaction
}

declare global {
  interface Window {
    setInterval(handler: TimerHandler, timeout?: number, ...arguments: any[]): number;
    clearInterval(handle: number): void;
  }
}

export {};
