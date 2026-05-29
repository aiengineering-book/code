// #book ch21-notion-tools
import { z } from 'zod';
// ch21-mcp-publish/notion-mcp/src/tools.ts
import {
  blocksToMarkdown,
  notion,
  richTextToPlainText,
} from './notion-client.js';
import type { Tool } from './types.js';

export const notionTools: Tool[] = [
  // 工具一：搜索页面
  {
    name: 'notion_search',
    description: '在 Notion 工作区中搜索页面和数据库',
    inputSchema: {
      query: z.string().min(1).describe('搜索关键词'),
      type: z
        .enum(['page', 'database'])
        .optional()
        .describe('限制结果类型：page（页面）/ database（数据库）'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(10)
        .describe('返回结果数，默认 10'),
    },
    execute: async (args) => {
      const { query, type, limit } = args as {
        query: string;
        type?: 'page' | 'database';
        limit: number;
      };

      const searchParams: Record<string, unknown> = { query, page_size: limit };
      if (type) searchParams.filter = { property: 'object', value: type };
      const response = await notion.search(searchParams as any);

      const results = response.results.map((item: any) => {
        if (item.object === 'page') {
          const title =
            'properties' in item
              ? Object.values(item.properties as Record<string, any>).find(
                  (p: any) => p.type === 'title',
                )
              : null;
          const titleText =
            title?.type === 'title'
              ? richTextToPlainText(title.title)
              : '无标题';
          return `📄 [页面] ${titleText}\nID: ${item.id}\nURL: ${item.url}`;
        }
        if (item.object === 'database') {
          const titleText = richTextToPlainText(item.title);
          return `📊 [数据库] ${titleText}\nID: ${item.id}\nURL: ${item.url}`;
        }
        return `未知类型：${item.object}`;
      });

      return results.length > 0
        ? `搜索结果（${results.length} 条）：\n\n${results.join('\n\n')}`
        : `未找到与"${query}"相关的内容`;
    },
  },

  // 工具二：读取页面内容
  {
    name: 'notion_get_page',
    description: '读取 Notion 页面的完整内容，转换为 Markdown 格式',
    inputSchema: {
      pageId: z
        .string()
        .min(1)
        .describe('Notion 页面 ID（从 URL 或搜索结果中获取）'),
    },
    execute: async (args) => {
      const { pageId } = args as { pageId: string };
      // 规范化页面 ID（移除连字符）
      const normalizedId = pageId.replace(/-/g, '');

      const [page, content] = await Promise.all([
        notion.pages.retrieve({ page_id: normalizedId }),
        blocksToMarkdown(normalizedId),
      ]);

      // 提取标题
      let title = '无标题';
      if ('properties' in page) {
        const titleProp = Object.values(page.properties).find(
          (p) => p.type === 'title',
        );
        if (titleProp?.type === 'title') {
          title = richTextToPlainText(titleProp.title);
        }
      }

      return [
        `# ${title}`,
        `页面 ID：${pageId}`,
        `最后编辑：${(page as any).last_edited_time}`,
        '',
        content || '（页面内容为空）',
      ].join('\n');
    },
  },

  // 工具三：创建页面
  {
    name: 'notion_create_page',
    description: '在指定的 Notion 页面或数据库下创建新页面',
    inputSchema: {
      parentId: z.string().min(1).describe('父页面或数据库的 ID'),
      parentType: z
        .enum(['page', 'database'])
        .describe('父级类型：page 或 database'),
      title: z.string().min(1).max(2000).describe('新页面的标题'),
      content: z
        .string()
        .max(10000)
        .default('')
        .describe('页面内容（纯文本，每段用空行分隔）'),
    },
    execute: async (args) => {
      const { parentId, parentType, title, content } = args as {
        parentId: string;
        parentType: 'page' | 'database';
        title: string;
        content: string;
      };

      const normalizedId = parentId.replace(/-/g, '');

      const contentBlocks = content
        .split('\n\n')
        .filter((p) => p.trim())
        .map((paragraph) => ({
          object: 'block' as const,
          type: 'paragraph' as const,
          paragraph: {
            rich_text: [
              {
                type: 'text' as const,
                text: { content: paragraph.trim() },
              },
            ],
          },
        }));

      const parent =
        parentType === 'database'
          ? { database_id: normalizedId }
          : { page_id: normalizedId };

      const page = await notion.pages.create({
        parent,
        properties: {
          title: { title: [{ text: { content: title } }] },
        },
        children: contentBlocks,
      });

      return [
        `✅ 页面创建成功`,
        `标题：${title}`,
        `页面 ID：${page.id}`,
        `URL：${'url' in page ? page.url : '无法获取'}`,
      ].join('\n');
    },
  },

  // 工具四：查询数据库
  {
    name: 'notion_query_database',
    description: '查询 Notion 数据库，支持过滤和排序',
    inputSchema: {
      databaseId: z.string().min(1).describe('数据库 ID'),
      filter: z
        .string()
        .optional()
        .describe(
          '过滤条件（JSON 格式，Notion 过滤语法）。例如：{"property": "状态", "select": {"equals": "进行中"}}  留空则返回所有记录',
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(20)
        .describe('返回记录数，默认 20'),
    },
    execute: async (args) => {
      const {
        databaseId,
        filter: filterStr,
        limit,
      } = args as {
        databaseId: string;
        filter?: string;
        limit: number;
      };

      let filter: object | undefined;
      if (filterStr) {
        try {
          filter = JSON.parse(filterStr);
        } catch {
          return '错误：filter 必须是合法的 JSON';
        }
      }

      const response = await notion.databases.query({
        database_id: databaseId.replace(/-/g, ''),
        filter: filter as any,
        page_size: limit,
      });

      if (response.results.length === 0) return '数据库查询结果为空';

      const rows = response.results.map((page, i) => {
        if (!('properties' in page)) return `第 ${i + 1} 条：（无属性）`;

        const props = Object.entries(page.properties)
          .map(([key, value]) => {
            let displayValue = '—';
            switch (value.type) {
              case 'title':
                displayValue = richTextToPlainText(value.title);
                break;
              case 'rich_text':
                displayValue = richTextToPlainText(value.rich_text);
                break;
              case 'select':
                displayValue = value.select?.name ?? '—';
                break;
              case 'multi_select':
                displayValue =
                  value.multi_select
                    .map((s: { name: string }) => s.name)
                    .join(', ') || '—';
                break;
              case 'date':
                displayValue = value.date?.start ?? '—';
                break;
              case 'checkbox':
                displayValue = value.checkbox ? '✅' : '⬜';
                break;
              case 'number':
                displayValue = value.number?.toString() ?? '—';
                break;
              case 'url':
                displayValue = value.url ?? '—';
                break;
              case 'email':
                displayValue = value.email ?? '—';
                break;
            }
            return `  ${key}: ${displayValue}`;
          })
          .join('\n');

        return `[第 ${i + 1} 条] ID: ${page.id}\n${props}`;
      });

      return [
        `数据库查询结果（${response.results.length} 条，${response.has_more ? '还有更多' : '已全部返回'}）：`,
        '',
        rows.join('\n\n'),
      ].join('\n');
    },
  },
];
// #endbook
