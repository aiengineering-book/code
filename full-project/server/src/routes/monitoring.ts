// #book-ref ch23-production/server/src/routes/monitoring.ts

import { Hono } from 'hono';
import { checkCostAlert, generateCostReport } from '../lib/cost-monitor.js';
import { authMiddleware } from '../middleware/auth.js';

const monitoringRouter = new Hono()
  .use('*', authMiddleware)

  .get('/cost-report', async (c) => {
    const days = Number(c.req.query('days') ?? '7');
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const report = await generateCostReport(startDate, endDate);
    return c.json(report);
  })

  .get('/cost-alert', async (c) => {
    const threshold = Number(c.req.query('threshold') ?? '50');
    const status = await checkCostAlert(threshold);
    return c.json(status);
  });

export default monitoringRouter;
