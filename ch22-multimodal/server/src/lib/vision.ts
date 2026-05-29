// #book ch22-vision

// ch22-multimodal/server/src/lib/vision.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import type OpenAI from 'openai';
import { DEFAULT_MODEL, openai } from './openai.js';

export type ImageMediaType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/gif'
  | 'image/webp';

export interface ImageInput {
  // 二选一：base64 或 URL
  base64?: string;
  url?: string;
  mediaType?: ImageMediaType;
}

/**
 * 从文件路径读取图像为 base64
 */
export async function imageFromFile(filePath: string): Promise<{
  base64: string;
  mediaType: ImageMediaType;
}> {
  const buffer = await fs.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();

  const mediaTypeMap: Record<string, ImageMediaType> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };

  const mediaType = mediaTypeMap[ext] ?? 'image/jpeg';
  return { base64: buffer.toString('base64'), mediaType };
}

/**
 * 从 URL 下载图像并转为 base64
 */
export async function imageFromUrl(url: string): Promise<{
  base64: string;
  mediaType: ImageMediaType;
}> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`图像下载失败：${response.status}`);

  const contentType = response.headers.get('content-type') ?? 'image/jpeg';
  const mediaType =
    (contentType.split(';')[0]?.trim() as ImageMediaType) ?? 'image/jpeg';
  const buffer = await response.arrayBuffer();

  return { base64: Buffer.from(buffer).toString('base64'), mediaType };
}

type ImageContentPart = OpenAI.ChatCompletionContentPartImage;

/**
 * 核心：带图像的 LLM 调用
 */
export async function analyzeImage(
  image: ImageInput,
  prompt: string,
  systemPrompt?: string,
): Promise<string> {
  let imageContent: ImageContentPart;

  if (image.url && !image.base64) {
    // URL 方式（模型会自动下载）
    imageContent = {
      type: 'image_url',
      image_url: { url: image.url },
    };
  } else if (image.base64) {
    // base64 方式
    imageContent = {
      type: 'image_url',
      image_url: {
        url: `data:${image.mediaType ?? 'image/jpeg'};base64,${image.base64}`,
      },
    };
  } else {
    throw new Error('必须提供 base64 或 url');
  }

  const response = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    max_completion_tokens: 2048,
    messages: [
      ...(systemPrompt
        ? [{ role: 'system' as const, content: systemPrompt }]
        : []),
      {
        role: 'user',
        content: [imageContent, { type: 'text', text: prompt }],
      },
    ],
  });

  return response.choices[0]?.message.content ?? '';
}

/**
 * 多图像分析（对比、序列分析）
 */
export async function analyzeMultipleImages(
  images: ImageInput[],
  prompt: string,
  systemPrompt?: string,
): Promise<string> {
  const imageContents: ImageContentPart[] = images.map((image) => {
    if (image.url && !image.base64) {
      return {
        type: 'image_url' as const,
        image_url: { url: image.url },
      };
    }
    return {
      type: 'image_url' as const,
      image_url: {
        url: `data:${image.mediaType ?? 'image/jpeg'};base64,${image.base64!}`,
      },
    };
  });

  const response = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    max_completion_tokens: 3000,
    messages: [
      ...(systemPrompt
        ? [{ role: 'system' as const, content: systemPrompt }]
        : []),
      {
        role: 'user',
        content: [...imageContents, { type: 'text', text: prompt }],
      },
    ],
  });

  return response.choices[0]?.message.content ?? '';
}
// #endbook
