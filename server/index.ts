import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import { getDb } from './db';
import productRoutes from './routes/products';
import orderRoutes from './routes/orders';
import { rateLimit } from './middleware/rateLimit';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// Initialize database
getDb();

// Middleware
app.use(express.json({ limit: '10mb' }));

// Global rate limit: 60 requests per minute per IP
app.use('/api', rateLimit(60_000, 60));

// Stricter rate limit for order creation (POST only): 10 per minute per IP
app.use('/api/orders', rateLimit(60_000, 10, ['POST']));

// API routes
app.use('/api', productRoutes);
app.use('/api', orderRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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

// Error handling
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Running on http://0.0.0.0:${PORT}`);
  console.log(`[Server] Mode: ${isProd ? 'production' : 'development'}`);
  console.log(`[Server] DB path: ${process.env.DB_PATH || './data/ordering.db'}`);
});
