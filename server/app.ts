import express from 'express';
import { getDb } from './db';
import productRoutes from './routes/products';
import orderRoutes from './routes/orders';
import statsRoutes from './routes/stats';
import authRoutes from './routes/auth';
import postRoutes from './routes/posts';
import { rateLimit } from './middleware/rateLimit';

export function createApp() {
  // Initialize database
  getDb();

  const app = express();

  // Middleware
  app.use(express.json({ limit: '10mb' }));

  // Global rate limit: 60 requests per minute per IP
  app.use('/api', rateLimit(60_000, 60));

  // Stricter rate limit for order creation (POST only): 10 per minute per IP
  app.use('/api/orders', rateLimit(60_000, 10, ['POST']));

  // API routes
  app.use('/api', productRoutes);
  app.use('/api', orderRoutes);
  app.use('/api', statsRoutes);
  app.use('/api', authRoutes);
  app.use('/api', postRoutes);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Error handling
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[Server Error]', err);
    res.status(500).json({ error: '服务器内部错误' });
  });

  return app;
}
