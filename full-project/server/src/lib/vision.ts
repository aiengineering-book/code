// #book-ref ch22-multimodal/server/src/lib/vision.ts

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
  // One of: base64 or URL
  base64?: string;
  url?: string;
  mediaType?: ImageMediaType;
}

/**
 * Read an image from a file path as base64
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
 * Download an image from a URL and convert to base64
 */
export async function imageFromUrl(url: string): Promise<{
  base64: string;
  mediaType: ImageMediaType;
}> {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Image download failed: ${response.status}`);

  const contentType = response.headers.get('content-type') ?? 'image/jpeg';
  const mediaType =
    (contentType.split(';')[0]?.trim() as ImageMediaType) ?? 'image/jpeg';
  const buffer = await response.arrayBuffer();

  return { base64: Buffer.from(buffer).toString('base64'), mediaType };
}

type ImageContentPart = OpenAI.ChatCompletionContentPartImage;

/**
 * Core: LLM call with image input
 */
export async function analyzeImage(
  image: ImageInput,
  prompt: string,
  systemPrompt?: string,
): Promise<string> {
  let imageContent: ImageContentPart;

  if (image.url && !image.base64) {
    // URL mode (model downloads automatically)
    imageContent = {
      type: 'image_url',
      image_url: { url: image.url },
    };
  } else if (image.base64) {
    // base64 mode
    imageContent = {
      type: 'image_url',
      image_url: {
        url: `data:${image.mediaType ?? 'image/jpeg'};base64,${image.base64}`,
      },
    };
  } else {
    throw new Error('Must provide either base64 or url');
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
 * Multi-image analysis (comparison, sequence analysis)
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
