// #book-ref ch22-tts-route

import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { textToSpeechLong } from '../lib/text-to-speech.js';
import { authMiddleware } from '../middleware/auth.js';

const ttsRouter = new Hono()
  .use('*', authMiddleware)

  .post(
    '/',
    zValidator(
      'json',
      z.object({
        text: z.string().min(1).max(10000),
        voice: z
          .enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'])
          .default('nova'),
        speed: z.number().min(0.25).max(4.0).default(1.0),
        quality: z.enum(['standard', 'hd']).default('standard'),
      }),
    ),
    async (c) => {
      const { text, voice, speed, quality } = c.req.valid('json');

      const audioBuffer = await textToSpeechLong(text, {
        voice,
        speed,
        model: quality === 'hd' ? 'tts-1-hd' : 'tts-1',
      });

      return new Response(audioBuffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': audioBuffer.length.toString(),
          'Content-Disposition': 'inline; filename="speech.mp3"',
        },
      });
    },
  );

export default ttsRouter;
// #endbook-ref
