// #book ch15-browser-pool
// ch15-browser-tools/server/src/lib/browser/pool.ts
import type { BrowserContext } from 'playwright';
import { browserManager } from './manager.js';

class BrowserContextPool {
  private readonly maxSize: number;
  private active = 0;
  private queue: Array<() => void> = [];

  constructor(maxSize = 5) {
    this.maxSize = maxSize;
  }

  async acquire(): Promise<BrowserContext> {
    // If at capacity, suspend and wait for release to wake us
    if (this.active >= this.maxSize) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.active++;
    return browserManager.createContext();
  }

  release(): void {
    this.active--;
    // Wake the next waiting caller
    const next = this.queue.shift();
    if (next) next();
  }
}

export const contextPool = new BrowserContextPool(5);
// #endbook
