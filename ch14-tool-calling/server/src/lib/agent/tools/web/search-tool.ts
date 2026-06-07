// ch14-tool-calling/server/src/lib/agent/tools/web/search-tool.ts
// #book ch14-search-tool
// ch14-tool-calling/server/src/lib/agent/tools/web/search-tool.ts
import { z } from 'zod';
import { env } from '../../../../env.js';

const SearchInput = z.object({
  query: z.string().min(1).max(200),
  maxResults: z.number().int().min(1).max(10).default(5),
});

export const webSearchTool = {
  name: 'web_search',
  description: `Search the internet for real-time information.
Good for: recent news, current prices, recent events, facts you're unsure about.
Not for: math calculations, code execution, file operations.
Returns up to 10 results with title, URL, and a short excerpt.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description:
          'Search query — concise keywords work better than full sentences',
      },
      maxResults: {
        type: 'number',
        description: 'Number of results to return, default 5, max 10',
      },
    },
    required: ['query'],
  },
  execute: async (input: Record<string, unknown>): Promise<string> => {
    const parsed = SearchInput.safeParse(input);
    if (!parsed.success) {
      return JSON.stringify({
        error: 'Invalid parameters',
        details: parsed.error.flatten(),
      });
    }

    const { query, maxResults } = parsed.data;

    try {
      // Tavily Search API — built for AI use cases
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.TAVILY_API_KEY}`,
        },
        body: JSON.stringify({
          query,
          max_results: maxResults,
          search_depth: 'basic',
        }),
      });

      if (!response.ok) throw new Error(`Search API error: ${response.status}`);

      const data = (await response.json()) as {
        results?: Array<{ title: string; url: string; content?: string }>;
      };

      return JSON.stringify({
        success: true,
        data: {
          results:
            data.results?.map((r) => ({
              title: r.title,
              url: r.url,
              snippet: r.content?.slice(0, 300),
            })) ?? [],
          totalResults: data.results?.length ?? 0,
        },
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Search failed',
      });
    }
  },
};
// #endbook
