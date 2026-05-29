// #book ch21-notion-client
import { Client as NotionClient } from '@notionhq/client';
// ch21-mcp-publish/notion-mcp/src/notion-client.ts
import { env } from './env.js';

export const notion = new NotionClient({
  auth: env.NOTION_TOKEN,
});

/**
 * 将 Notion 富文本转换为纯文本
 */
export function richTextToPlainText(
  richText: Array<{ plain_text: string }>,
): string {
  return richText.map((t) => t.plain_text).join('');
}

/**
 * 将 Notion 页面内容块递归转换为 Markdown
 */
export async function blocksToMarkdown(blockId: string): Promise<string> {
  const response = await notion.blocks.children.list({ block_id: blockId });
  const lines: string[] = [];

  for (const block of response.results) {
    if (!('type' in block)) continue;

    switch (block.type) {
      case 'paragraph':
        lines.push(richTextToPlainText(block.paragraph.rich_text));
        break;
      case 'heading_1':
        lines.push(`# ${richTextToPlainText(block.heading_1.rich_text)}`);
        break;
      case 'heading_2':
        lines.push(`## ${richTextToPlainText(block.heading_2.rich_text)}`);
        break;
      case 'heading_3':
        lines.push(`### ${richTextToPlainText(block.heading_3.rich_text)}`);
        break;
      case 'bulleted_list_item':
        lines.push(
          `- ${richTextToPlainText(block.bulleted_list_item.rich_text)}`,
        );
        break;
      case 'numbered_list_item':
        lines.push(
          `1. ${richTextToPlainText(block.numbered_list_item.rich_text)}`,
        );
        break;
      case 'code': {
        const lang = block.code.language;
        const code = richTextToPlainText(block.code.rich_text);
        lines.push(`\`\`\`${lang}\n${code}\n\`\`\``);
        break;
      }
      case 'quote':
        lines.push(`> ${richTextToPlainText(block.quote.rich_text)}`);
        break;
      case 'divider':
        lines.push('---');
        break;
      case 'callout': {
        const icon =
          block.callout.icon?.type === 'emoji'
            ? block.callout.icon.emoji
            : '📌';
        lines.push(`${icon} ${richTextToPlainText(block.callout.rich_text)}`);
        break;
      }
    }

    // 递归处理子块
    if ('has_children' in block && block.has_children) {
      const childContent = await blocksToMarkdown(block.id);
      if (childContent) lines.push(childContent);
    }
  }

  return lines.filter(Boolean).join('\n\n');
}
// #endbook
