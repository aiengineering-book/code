// #book-ref ch22-multimodal/server/src/routes/speech.ts

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { ValidationError } from '../errors.js';
import { transcribeAudio } from '../lib/speech-to-text.js';
import { authMiddleware } from '../middleware/auth.js';

const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB (Whisper per-request limit)

const speechRouter = new Hono()
  .use('*', authMiddleware)

  // Standard transcription: upload a complete audio file and wait for result
  .post('/transcribe', async (c) => {
    const formData = await c.req.formData();
    const audio = formData.get('audio') as File | null;

    if (!audio) throw new ValidationError('Please upload an audio file');
    if (audio.size > MAX_AUDIO_SIZE)
      throw new ValidationError('Audio must not exceed 25MB');

    const buffer = Buffer.from(await audio.arrayBuffer());
    const opts: { language?: string; timestamps?: boolean } = {
      timestamps: formData.get('timestamps') === 'true',
    };
    const lang = formData.get('language') as string | null;
    if (lang) opts.language = lang;
    const result = await transcribeAudio(buffer, audio.name, opts);

    return c.json(result);
  })

  // Streaming transcription: POST one audio chunk at a time, immediately return
  // that chunk's transcription result (SSE). Use this endpoint when the frontend
  // records in chunks with MediaRecorder.
  .post('/transcribe-stream', async (c) => {
    const formData = await c.req.formData();
    const chunk = formData.get('chunk') as File | null;
    const chunkIndex = Number(formData.get('chunkIndex') ?? 0);

    if (!chunk) throw new ValidationError('Please upload an audio chunk');
    if (chunk.size > MAX_AUDIO_SIZE)
      throw new ValidationError('Audio chunk must not exceed 25MB');

    return streamSSE(c, async (stream) => {
      const buffer = Buffer.from(await chunk.arrayBuffer());

      await stream.writeSSE({
        event: 'transcribing',
        data: JSON.stringify({ chunkIndex }),
      });

      const streamOpts: { language?: string } = {};
      const streamLang = formData.get('language') as string | null;
      if (streamLang) streamOpts.language = streamLang;
      const result = await transcribeAudio(
        buffer,
        `chunk-${chunkIndex}.webm`,
        streamOpts,
      );

      await stream.writeSSE({
        event: 'result',
        data: JSON.stringify({ chunkIndex, text: result.text }),
      });

      await stream.writeSSE({ event: 'done', data: '' });
    });
  });

export default speechRouter;
