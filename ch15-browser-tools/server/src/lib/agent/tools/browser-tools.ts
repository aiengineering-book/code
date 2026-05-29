// #book ch15-browser-tools
// ch15-browser-tools/server/src/lib/agent/tools/browser-tools.ts

import { browserManager } from '../../browser/manager.js';
import type { Tool } from '../react-agent.js';

/**
 * Tool 1: Fetch web page content
 */
export const fetchWebpageTool: Tool = {
  name: 'fetch_webpage',
  description:
    'Visit a URL and extract the main text content. Suitable for articles, documentation, and news. Not suitable for pages requiring login.',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'URL to visit — must start with http:// or https://',
      },
      waitFor: {
        type: 'string',
        description:
          'Wait for a CSS selector to appear before extracting (optional — for dynamically loaded pages)',
      },
    },
    required: ['url'],
  },
  execute: async (input) => {
    const { url, waitFor } = input as { url: string; waitFor?: string };

    // Security: only HTTP/HTTPS
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return 'Error: only http:// and https:// protocols are supported';
    }

    // Blocklist: no internal network addresses
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
      return 'Error: internal network addresses are not allowed';
    }

    const context = await browserManager.createContext();
    const page = await context.newPage();

    try {
      // Timeout: 30 seconds
      await page.goto(url, { timeout: 30_000, waitUntil: 'domcontentloaded' });

      if (waitFor) {
        await page.waitForSelector(waitFor, { timeout: 10_000 });
      }

      // Extract main text content
      const content = await page.evaluate(() => {
        // Remove unwanted elements
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

        // Prefer main/article content areas
        const main =
          document.querySelector(
            'main, article, [role="main"], .content, #content',
          ) ?? document.body;

        return (main as HTMLElement).innerText
          .replace(/\n{3,}/g, '\n\n')
          .replace(/[ \t]+/g, ' ')
          .trim()
          .slice(0, 8000); // Length limit
      });

      const title = await page.title();
      return `Title: ${title}\nURL: ${url}\n\n${content}`;
    } catch (error) {
      return `Access failed: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      await context.close();
    }
  },
};

/**
 * Tool 2: Take a screenshot
 */
export const screenshotTool: Tool = {
  name: 'take_screenshot',
  description:
    'Take a screenshot of a web page and return it as base64. Use when you need to "see" page content.',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to screenshot' },
      selector: {
        type: 'string',
        description: 'Capture only a specific element (CSS selector, optional)',
      },
      fullPage: {
        type: 'string',
        description: 'Whether to capture the full page, "true" or "false", default "false"',
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
      return 'Error: only http:// and https:// protocols are supported';
    }

    const context = await browserManager.createContext();
    const page = await context.newPage();

    try {
      await page.goto(url, { timeout: 30_000, waitUntil: 'networkidle' });

      let screenshotBuffer: Buffer;

      if (selector) {
        const element = await page.$(selector);
        if (!element) return `Error: element "${selector}" not found`;
        screenshotBuffer = (await element.screenshot()) as Buffer;
      } else {
        screenshotBuffer = (await page.screenshot({
          fullPage: fullPage === 'true',
        })) as Buffer;
      }

      // Return as base64 (Agent can analyze the image further)
      const base64 = screenshotBuffer.toString('base64');
      return `Screenshot captured (base64 length: ${base64.length})\ndata:image/png;base64,${base64.slice(0, 100)}...`;
    } catch (error) {
      return `Screenshot failed: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      await context.close();
    }
  },
};

/**
 * Tool 3: Interact with a page
 */
export const interactWithPageTool: Tool = {
  name: 'interact_with_page',
  description: 'Interact with a web page: click buttons, fill forms, wait for elements.',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'Target page URL' },
      actions: {
        type: 'string',
        description: `Actions to perform as a JSON array. Each action has a type and parameters.
Example: [
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
      return 'Error: only http:// and https:// protocols are supported';
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
      return 'Error: actions must be a valid JSON array';
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
              results.push('click: missing selector');
              break;
            }
            await page.click(action.selector, { timeout: 10_000 });
            results.push(`click: clicked "${action.selector}"`);
            break;

          case 'fill':
            if (!action.selector || !action.value) {
              results.push('fill: missing selector or value');
              break;
            }
            await page.fill(action.selector, action.value);
            results.push(`fill: entered value into "${action.selector}"`);
            break;

          case 'select':
            if (!action.selector || !action.value) {
              results.push('select: missing selector or value');
              break;
            }
            await page.selectOption(action.selector, action.value);
            results.push(`select: selected "${action.value}"`);
            break;

          case 'wait':
            await new Promise((r) => setTimeout(r, action.ms ?? 1000));
            results.push(`wait: waited ${action.ms ?? 1000}ms`);
            break;

          case 'extract': {
            if (!action.selector) {
              results.push('extract: missing selector');
              break;
            }
            const text = await page
              .$eval(action.selector, (el) => (el as HTMLElement).innerText)
              .catch(() => 'Element not found');
            results.push(`extract "${action.selector}": ${text.slice(0, 500)}`);
            break;
          }
        }
      }

      return results.join('\n');
    } catch (error) {
      return `Interaction failed: ${error instanceof Error ? error.message : String(error)}\nCompleted actions:\n${results.join('\n')}`;
    } finally {
      await context.close();
    }
  },
};
// #endbook
