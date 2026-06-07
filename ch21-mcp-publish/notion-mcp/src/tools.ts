// #book ch21-notion-tools
// ch21-mcp-publish/notion-mcp/src/tools.ts
import { z } from 'zod';
import {
  blocksToMarkdown,
  notion,
  richTextToPlainText,
} from './notion-client.js';
import type { Tool } from './types.js';

export const notionTools: Tool[] = [
  // Tool 1: Search pages
  {
    name: 'notion_search',
    description: 'Search for pages and databases in the Notion workspace',
    inputSchema: {
      query: z.string().min(1).describe('Search keywords'),
      type: z
        .enum(['page', 'database'])
        .optional()
        .describe('Limit result type: page / database'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(10)
        .describe('Number of results to return, default 10'),
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
              : 'Untitled';
          return `📄 [Page] ${titleText}\nID: ${item.id}\nURL: ${item.url}`;
        }
        if (item.object === 'database') {
          const titleText = richTextToPlainText(item.title);
          return `📊 [Database] ${titleText}\nID: ${item.id}\nURL: ${item.url}`;
        }
        return `Unknown type: ${item.object}`;
      });

      return results.length > 0
        ? `Search results (${results.length}):\n\n${results.join('\n\n')}`
        : `No content found matching "${query}"`;
    },
  },

  // Tool 2: Read page content
  {
    name: 'notion_get_page',
    description:
      'Read the full content of a Notion page, converted to Markdown format',
    inputSchema: {
      pageId: z
        .string()
        .min(1)
        .describe('Notion page ID (from URL or search results)'),
    },
    execute: async (args) => {
      const { pageId } = args as { pageId: string };
      // Normalize page ID (remove hyphens)
      const normalizedId = pageId.replace(/-/g, '');

      const [page, content] = await Promise.all([
        notion.pages.retrieve({ page_id: normalizedId }),
        blocksToMarkdown(normalizedId),
      ]);

      // Extract title
      let title = 'Untitled';
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
        `Page ID: ${pageId}`,
        `Last edited: ${(page as any).last_edited_time}`,
        '',
        content || '(Page content is empty)',
      ].join('\n');
    },
  },

  // Tool 3: Create a page
  {
    name: 'notion_create_page',
    description: 'Create a new page under a specified Notion page or database',
    inputSchema: {
      parentId: z.string().min(1).describe('ID of the parent page or database'),
      parentType: z
        .enum(['page', 'database'])
        .describe('Parent type: page or database'),
      title: z.string().min(1).max(2000).describe('Title of the new page'),
      content: z
        .string()
        .max(10000)
        .default('')
        .describe(
          'Page content (plain text, paragraphs separated by blank lines)',
        ),
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
        `✅ Page created successfully`,
        `Title: ${title}`,
        `Page ID: ${page.id}`,
        `URL: ${'url' in page ? page.url : 'unavailable'}`,
      ].join('\n');
    },
  },

  // Tool 4: Query database
  {
    name: 'notion_query_database',
    description: 'Query a Notion database with optional filters and sorting',
    inputSchema: {
      databaseId: z.string().min(1).describe('Database ID'),
      filter: z
        .string()
        .optional()
        .describe(
          'Filter condition (JSON format, Notion filter syntax). Example: {"property": "Status", "select": {"equals": "In Progress"}}. Leave empty to return all records.',
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(20)
        .describe('Number of records to return, default 20'),
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
          return 'Error: filter must be valid JSON';
        }
      }

      const response = await notion.databases.query({
        database_id: databaseId.replace(/-/g, ''),
        filter: filter as any,
        page_size: limit,
      });

      if (response.results.length === 0)
        return 'Database query returned no results';

      const rows = response.results.map((page, i) => {
        if (!('properties' in page)) return `Row ${i + 1}: (no properties)`;

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

        return `[Row ${i + 1}] ID: ${page.id}\n${props}`;
      });

      return [
        `Database query results (${response.results.length} rows, ${response.has_more ? 'more available' : 'all returned'}):`,
        '',
        rows.join('\n\n'),
      ].join('\n');
    },
  },
];
// #endbook
