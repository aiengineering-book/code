// #book ch24-server-index
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

// 路由导入
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
  // 基础中间件
  .use('*', logger())
  .use(
    '/api/*',
    cors({
      origin: env.CORS_ORIGIN,
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
    }),
  )

  // 健康检查（不需要认证）
  .get('/health', (c) =>
    c.json({
      status: 'ok',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    }),
  )

  // 认证路由（不需要限流）
  .route('/api/auth', authRouter)

  // 受保护路由：认证 + 注入检测 + 限流
  .use('/api/*', authMiddleware)
  .use('/api/rag/*', injectionGuard)
  .use('/api/chatbot/*', injectionGuard)
  .use('/api/agent/*', injectionGuard)
  .use('/api/rag/*', rateLimitMiddleware('rag'))
  .use('/api/agent/*', rateLimitMiddleware('agent'))

  // 功能路由
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

  // 全局错误处理
  .onError(errorHandler);

// 异步初始化（不阻塞启动）
async function initializeServices() {
  // 启动 MCP Server 连接
  const mcpConfigs = [
    {
      name: 'knowledge-base',
      command: 'node',
      // args: ['../../ch19-mcp-server/server/dist/index.js'],
      args: ['packages/mcp-server/dist/index.js'],
    },
  ];

  await mcpManager.loadFromConfig(mcpConfigs).catch((err) => {
    console.error('[MCP] 初始化失败：', err.message);
  });

  // 预热 BM25 索引
  await bm25Service.build().catch((err) => {
    console.error('[BM25] 初始化失败：', err.message);
  });

  console.log('✅ 所有服务初始化完成');
}

// 启动服务器
serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`🚀 AI Workbench 后端运行在 http://localhost:${info.port}`);
  initializeServices();
});

// 优雅退出
process.on('SIGTERM', async () => {
  console.log('收到 SIGTERM，正在关闭...');
  await mcpManager.disconnectAll();
  process.exit(0);
});

export type AppType = typeof app;
// #endbook
