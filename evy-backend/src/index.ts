import 'express-async-errors';
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import { PORT } from './config';
import { getDb } from './db/client';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';

import { ticketsRouter } from './routes/tickets';
import { pipelineRouter } from './routes/pipeline';
import { knowledgeRouter } from './routes/knowledge';
import { analyticsRouter, usageRouter } from './routes/analytics';

// ─── App Setup ────────────────────────────────────────────────────────────────

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now(), service: 'SupportPilot API' });
});

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/tickets', ticketsRouter);
app.use('/api/pipeline', pipelineRouter);
app.use('/api/knowledge', knowledgeRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/usage', usageRouter);

// ─── 404 Fallback ─────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Error Handler (must be last) ────────────────────────────────────────────

app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────

// Initialize DB eagerly on startup
getDb();

app.listen(PORT, () => {
  console.log(`\n🚀 SupportPilot API running at http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Tickets: http://localhost:${PORT}/api/tickets`);
  console.log(`   Analytics: http://localhost:${PORT}/api/analytics/stats`);
  console.log(`   Usage: http://localhost:${PORT}/api/usage\n`);
});

export default app;
