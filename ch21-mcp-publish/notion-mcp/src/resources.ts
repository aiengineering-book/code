// #book ch21-notion-resources
// ch21-mcp-publish/notion-mcp/src/resources.ts
import { notion, richTextToPlainText } from './notion-client.js';

export async function listNotionResources() {
  const response = await notion.search({
    filter: { property: 'object', value: 'page' },
    page_size: 20,
    sort: { direction: 'descending', timestamp: 'last_edited_time' },
  });

  return response.results
    .filter(
      (item): item is Extract<typeof item, { object: 'page' }> =>
        item.object === 'page',
    )
    .map((page: any) => {
      const titleProp = Object.values(
        (page.properties ?? {}) as Record<string, any>,
      ).find((p: any) => p.type === 'title');
      const title =
        titleProp?.type === 'title'
          ? richTextToPlainText(titleProp.title)
          : 'Untitled';

      return {
        uri: `notion://page/${page.id}`,
        name: title,
        description: `Last edited: ${page.last_edited_time}`,
        mimeType: 'text/markdown',
      };
    });
}
// #endbook
