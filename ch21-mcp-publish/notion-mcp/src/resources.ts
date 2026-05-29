// #book ch21-notion-resources
import { notion, richTextToPlainText } from './notion-client.js';
// ch21-mcp-publish/notion-mcp/src/resources.ts

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
          : '无标题';

      return {
        uri: `notion://page/${page.id}`,
        name: title,
        description: `最后编辑：${page.last_edited_time}`,
        mimeType: 'text/markdown',
      };
    });
}
// #endbook
