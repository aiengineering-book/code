// #book-ref ch22-speech-route
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { ValidationError } from '../errors.js';
import { transcribeAudio } from '../lib/speech-to-text.js';
import { authMiddleware } from '../middleware/auth.js';

const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB（Whisper 单次限制）

const speechRouter = new Hono()
  .use('*', authMiddleware)

  // 普通转录：上传完整音频文件，等待结果
  .post('/transcribe', async (c) => {
    const formData = await c.req.formData();
    const audio = formData.get('audio') as File | null;

    if (!audio) throw new ValidationError('请上传音频文件');
    if (audio.size > MAX_AUDIO_SIZE)
      throw new ValidationError('音频不能超过 25MB');

    const buffer = Buffer.from(await audio.arrayBuffer());
    const opts: { language?: string; timestamps?: boolean } = {
      timestamps: formData.get('timestamps') === 'true',
    };
    const lang = formData.get('language') as string | null;
    if (lang) opts.language = lang;
    const result = await transcribeAudio(buffer, audio.name, opts);

    return c.json(result);
  })

  // 流式转录：每次 POST 一块音频，立即返回该块的转录结果（SSE）
  // 前端用 MediaRecorder 分块录音时使用此端点
  .post('/transcribe-stream', async (c) => {
    const formData = await c.req.formData();
    const chunk = formData.get('chunk') as File | null;
    const chunkIndex = Number(formData.get('chunkIndex') ?? 0);

    if (!chunk) throw new ValidationError('请上传音频块');
    if (chunk.size > MAX_AUDIO_SIZE)
      throw new ValidationError('音频块不能超过 25MB');

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
// #endbook-ref
