// #book ch15-browser-manager
// ch15-browser-tools/server/src/lib/browser/manager.ts
import { type Browser, type BrowserContext, chromium } from 'playwright';

class BrowserManager {
  private browser: Browser | null = null;

  /**
   * Get the browser instance (lazy initialization + auto-recovery)
   * One Browser object shared across the entire process
   */
  async getBrowser(): Promise<Browser> {
    if (this.browser?.isConnected()) {
      return this.browser;
    }

    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // Required in Docker
        '--disable-gpu',
      ],
    });

    // When the browser crashes or is closed externally, clear the reference
    this.browser.on('disconnected', () => {
      this.browser = null;
    });

    return this.browser;
  }

  /**
   * Create an isolated browser context
   * Multiple tool calls share one Browser process but each has independent cookies and session
   */
  async createContext(): Promise<BrowserContext> {
    const browser = await this.getBrowser();
    return browser.newContext({
      // Use a realistic browser UA to avoid bot detection
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
  }

  async close(): Promise<void> {
    await this.browser?.close();
    this.browser = null;
  }
}

// Module-level singleton — Node.js module cache guarantees one instance per process
export const browserManager = new BrowserManager();

// Close the browser on process exit to avoid orphaned subprocesses
process.on('SIGTERM', () => browserManager.close());
process.on('SIGINT', () => browserManager.close());
// #endbook
