// #book ch24-server-index
// full-project/server/src/index.ts
import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { env } from './env.js';
import { mcpManager } from './lib/mcp/manager.js';
import { authMiddleware } from './middleware/auth.js';
import { errorHandler } from './middleware/error-handler.js';
import { injectionGuard } from './middleware/injection-guard.js';
import { rateLimitMiddleware } from './middleware/rate-limiter.js';
import agentRouter from './routes/agent.js';

// Route imports
import authRouter from './routes/auth.js';
import chatbotRouter from './routes/chatbot.js';
import codeReviewRouter from './routes/code-review.js';
import collaborationRouter from './routes/collaboration.js';
import documentsRouter from './routes/documents.js';
import knowledgeBaseRouter from './routes/knowledge-bases.js';
import mcpRouter from './routes/mcp.js';
import monitoringRouter from './routes/monitoring.js';
import multiAgentRouter from './routes/multi-agent.js';
import ragRouter from './routes/rag.js';
import speechRouter from './routes/speech.js';
import ttsRouter from './routes/tts.js';
import visionRouter from './routes/vision.js';
import { bm25Service } from './services/bm25-service.js';

const app = new Hono()
  // Base middleware
  .use('*', logger())
  .use(
    '/api/*',
    cors({
      origin: env.CORS_ORIGIN,
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
    }),
  )

  // Health check (no authentication required)
  .get('/health', (c) =>
    c.json({
      status: 'ok',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    }),
  )

  // Auth routes (no rate limiting)
  .route('/api/auth', authRouter)

  // Protected routes: authentication + injection detection + rate limiting
  .use('/api/*', authMiddleware)
  .use('/api/rag/*', injectionGuard)
  .use('/api/chatbot/*', injectionGuard)
  .use('/api/agent/*', injectionGuard)
  .use('/api/rag/*', rateLimitMiddleware('rag'))
  .use('/api/agent/*', rateLimitMiddleware('agent'))

  // Feature routes
  .route('/api/documents', documentsRouter)
  .route('/api/rag', ragRouter)
  .route('/api/chatbot', chatbotRouter)
  .route('/api/agent', agentRouter)
  .route('/api/multi-agent', multiAgentRouter)
  .route('/api/mcp', mcpRouter)
  .route('/api/knowledge-bases', knowledgeBaseRouter)
  .route('/api/vision', visionRouter)
  .route('/api/speech', speechRouter)
  .route('/api/tts', ttsRouter)
  .route('/api/monitoring', monitoringRouter)
  .route('/api/code-review', codeReviewRouter)
  .route('/api/collaboration', collaborationRouter)

  // Global error handler
  .onError(errorHandler);

// Async initialization (does not block startup)
async function initializeServices() {
  // Start MCP Server connections
  const mcpConfigs = [
    {
      name: 'knowledge-base',
      command: 'node',
      args: ['packages/mcp-server/dist/index.js'],
    },
  ];

  await mcpManager.loadFromConfig(mcpConfigs).catch((err) => {
    console.error('[MCP] Initialization failed:', err.message);
  });

  // Warm up BM25 index
  await bm25Service.build().catch((err) => {
    console.error('[BM25] Initialization failed:', err.message);
  });

  console.log('✅ All services initialized');
}

// Start server
serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`🚀 AI Workbench backend running at http://localhost:${info.port}`);
  initializeServices();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  await mcpManager.disconnectAll();
  process.exit(0);
});

export type AppType = typeof app;
// #endbook
