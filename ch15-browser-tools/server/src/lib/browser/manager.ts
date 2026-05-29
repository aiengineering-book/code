// #book ch15-browser-manager
import { type Browser, type BrowserContext, chromium } from 'playwright';
// ch15-browser-tools/server/src/lib/browser/manager.ts

class BrowserManager {
  private browser: Browser | null = null;

  /**
   * 获取浏览器实例（懒加载 + 自动恢复）
   * 整个进程共享同一个 Browser 对象
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
        '--disable-dev-shm-usage', // Docker 环境必须
        '--disable-gpu',
      ],
    });

    // 浏览器崩溃或被外部关闭时，清除引用以便下次重建
    this.browser.on('disconnected', () => {
      this.browser = null;
    });

    return this.browser;
  }

  /**
   * 创建独立的浏览器上下文
   * 多个工具调用共享同一个 Browser 进程，但各自拥有独立的 Cookie 和会话
   */
  async createContext(): Promise<BrowserContext> {
    const browser = await this.getBrowser();
    return browser.newContext({
      // 设置常见的浏览器 UA，避免被识别为爬虫
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      extraHTTPHeaders: {
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    });
  }

  async close(): Promise<void> {
    await this.browser?.close();
    this.browser = null;
  }
}

// 模块级单例——Node.js 的模块缓存保证同一进程内只存在一份
export const browserManager = new BrowserManager();

// 进程退出时关闭浏览器，避免残留子进程
process.on('SIGTERM', () => browserManager.close());
process.on('SIGINT', () => browserManager.close());
// #endbook
