import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import { createApp } from './app';

const app = createApp();
const PORT = parseInt(process.env.PORT || '3001', 10);

// In production, serve the built frontend
const isProd = process.env.NODE_ENV === 'production';
if (isProd) {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  // SPA fallback: all non-API routes go to index.html
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
  console.log(`[Server] Serving static files from ${distPath}`);
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Running on http://0.0.0.0:${PORT}`);
  console.log(`[Server] Mode: ${isProd ? 'production' : 'development'}`);
  console.log(`[Server] DB path: ${process.env.DB_PATH || './data/ordering.db'}`);
});

export default app;
