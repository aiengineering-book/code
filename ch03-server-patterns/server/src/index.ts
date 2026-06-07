import type { ServerType } from '@hono/node-server';

// server is the ServerType returned by serve() from @hono/node-server in your entry point
declare const server: ServerType;

// #book ch03-index
// ch03-server-patterns/server/src/index.ts

// Catch unhandled Promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // In production: notify a monitoring service (e.g., Sentry) here
  // Then exit cleanly so the process manager (PM2, Docker) can restart
  process.exit(1);
});

// Catch uncaught synchronous exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle SIGTERM (container shutdown signal)
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  // Stop accepting new requests, finish existing ones, then exit
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
// #endbook
