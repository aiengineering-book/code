// #book ch15-browser-pool
import type { BrowserContext } from 'playwright';
// ch15-browser-tools/server/src/lib/browser/pool.ts
import { browserManager } from './manager.js';

class BrowserContextPool {
  private readonly maxSize: number;
  private active = 0;
  private queue: Array<() => void> = [];

  constructor(maxSize = 5) {
    this.maxSize = maxSize;
  }

  async acquire(): Promise<BrowserContext> {
    // 如果已满，把自己挂起，等待 release 唤醒
    if (this.active >= this.maxSize) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.active++;
    return browserManager.createContext();
  }

  release(): void {
    this.active--;
    // 唤醒队列中的下一个等待者
    const next = this.queue.shift();
    if (next) next();
  }
}

export const contextPool = new BrowserContextPool(5);
// #endbook
