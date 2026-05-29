// #book ch15-browser-tools

// ch15-browser-tools/server/src/lib/agent/tools/browser-tools.ts
import { browserManager } from '../../browser/manager.js';
import type { Tool } from '../react-agent.js';

/**
 * 工具一：抓取网页内容
 */
export const fetchWebpageTool: Tool = {
  name: 'fetch_webpage',
  description:
    '访问指定 URL，提取网页的主要文本内容。适合读取文章、文档、新闻等。不适合需要登录的页面。',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: '要访问的网页 URL，必须以 http:// 或 https:// 开头',
      },
      waitFor: {
        type: 'string',
        description:
          '等待某个 CSS 选择器出现后再提取内容（可选，用于动态加载的页面）',
      },
    },
    required: ['url'],
  },
  execute: async (input) => {
    const { url, waitFor } = input as { url: string; waitFor?: string };

    // 安全检查：只允许 HTTP/HTTPS
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return '错误：只支持 http:// 和 https:// 协议';
    }

    // 黑名单：不允许访问内网地址
    const blocked = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
      '192.168.',
      '10.',
      '172.',
    ];
    if (blocked.some((b) => url.includes(b))) {
      return '错误：不允许访问内网地址';
    }

    const context = await browserManager.createContext();
    const page = await context.newPage();

    try {
      // 超时设置：30 秒
      await page.goto(url, { timeout: 30_000, waitUntil: 'domcontentloaded' });

      if (waitFor) {
        await page.waitForSelector(waitFor, { timeout: 10_000 });
      }

      // 提取主要文本内容
      const content = await page.evaluate(() => {
        // 移除不需要的元素
        const remove = [
          'script',
          'style',
          'nav',
          'footer',
          'header',
          'aside',
          'iframe',
        ];
        remove.forEach((tag) => {
          document.querySelectorAll(tag).forEach((el) => el.remove());
        });

        // 优先提取 main/article 区域
        const main =
          document.querySelector(
            'main, article, [role="main"], .content, #content',
          ) ?? document.body;

        return (main as HTMLElement).innerText
          .replace(/\n{3,}/g, '\n\n')
          .replace(/[ \t]+/g, ' ')
          .trim()
          .slice(0, 8000); // 限制长度
      });

      const title = await page.title();
      return `标题：${title}\nURL：${url}\n\n${content}`;
    } catch (error) {
      return `访问失败：${error instanceof Error ? error.message : String(error)}`;
    } finally {
      await context.close();
    }
  },
};

/**
 * 工具二：网页截图
 */
export const screenshotTool: Tool = {
  name: 'take_screenshot',
  description:
    '对网页进行截图，返回截图的 base64 编码。适合需要"看"页面内容的场景。',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: '要截图的网页 URL' },
      selector: {
        type: 'string',
        description: '只截取指定元素（CSS 选择器，可选）',
      },
      fullPage: {
        type: 'string',
        description: '是否截取完整页面，"true" 或 "false"，默认 "false"',
        enum: ['true', 'false'],
      },
    },
    required: ['url'],
  },
  execute: async (input) => {
    const { url, selector, fullPage } = input as {
      url: string;
      selector?: string;
      fullPage?: string;
    };

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return '错误：只支持 http:// 和 https:// 协议';
    }

    const context = await browserManager.createContext();
    const page = await context.newPage();

    try {
      await page.goto(url, { timeout: 30_000, waitUntil: 'networkidle' });

      let screenshotBuffer: Buffer;

      if (selector) {
        const element = await page.$(selector);
        if (!element) return `错误：找不到元素 "${selector}"`;
        screenshotBuffer = (await element.screenshot()) as Buffer;
      } else {
        screenshotBuffer = (await page.screenshot({
          fullPage: fullPage === 'true',
        })) as Buffer;
      }

      // 返回 base64（Agent 可以进一步分析图片）
      const base64 = screenshotBuffer.toString('base64');
      return `截图成功（base64 长度：${base64.length}）\ndata:image/png;base64,${base64.slice(0, 100)}...`;
    } catch (error) {
      return `截图失败：${error instanceof Error ? error.message : String(error)}`;
    } finally {
      await context.close();
    }
  },
};

/**
 * 工具三：表单填写与交互
 */
export const interactWithPageTool: Tool = {
  name: 'interact_with_page',
  description: '与网页进行交互：点击按钮、填写表单、等待元素等。',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: '目标网页 URL' },
      actions: {
        type: 'string',
        description: `要执行的操作列表，JSON 数组格式，每个操作包含 type 和参数。
示例：[
  {"type": "click", "selector": "#submit-btn"},
  {"type": "fill", "selector": "#email", "value": "test@example.com"},
  {"type": "wait", "ms": 2000},
  {"type": "extract", "selector": ".result"}
]`,
      },
    },
    required: ['url', 'actions'],
  },
  execute: async (input) => {
    const { url, actions: actionsJson } = input as {
      url: string;
      actions: string;
    };

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return '错误：只支持 http:// 和 https:// 协议';
    }

    let actions: Array<{
      type: 'click' | 'fill' | 'wait' | 'extract' | 'select';
      selector?: string;
      value?: string;
      ms?: number;
    }>;

    try {
      actions = JSON.parse(actionsJson);
    } catch {
      return '错误：actions 必须是合法的 JSON 数组';
    }

    const context = await browserManager.createContext();
    const page = await context.newPage();
    const results: string[] = [];

    try {
      await page.goto(url, { timeout: 30_000, waitUntil: 'domcontentloaded' });

      for (const action of actions) {
        switch (action.type) {
          case 'click':
            if (!action.selector) {
              results.push('click: 缺少 selector');
              break;
            }
            await page.click(action.selector, { timeout: 10_000 });
            results.push(`click: 点击了 "${action.selector}"`);
            break;

          case 'fill':
            if (!action.selector || !action.value) {
              results.push('fill: 缺少 selector 或 value');
              break;
            }
            await page.fill(action.selector, action.value);
            results.push(`fill: 向 "${action.selector}" 输入了值`);
            break;

          case 'select':
            if (!action.selector || !action.value) {
              results.push('select: 缺少 selector 或 value');
              break;
            }
            await page.selectOption(action.selector, action.value);
            results.push(`select: 选择了 "${action.value}"`);
            break;

          case 'wait':
            await new Promise((r) => setTimeout(r, action.ms ?? 1000));
            results.push(`wait: 等待了 ${action.ms ?? 1000}ms`);
            break;

          case 'extract': {
            if (!action.selector) {
              results.push('extract: 缺少 selector');
              break;
            }
            const text = await page
              .$eval(action.selector, (el) => (el as HTMLElement).innerText)
              .catch(() => '未找到元素');
            results.push(`extract "${action.selector}": ${text.slice(0, 500)}`);
            break;
          }
        }
      }

      return results.join('\n');
    } catch (error) {
      return `交互失败：${error instanceof Error ? error.message : String(error)}\n已完成的操作：\n${results.join('\n')}`;
    } finally {
      await context.close();
    }
  },
};
// #endbook
