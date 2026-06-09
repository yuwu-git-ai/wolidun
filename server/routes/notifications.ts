import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db';
import { requireAdmin } from '../middleware/auth';

const router = Router();

// GET /api/notifications — user's notifications
router.get('/notifications', (req: Request, res: Response) => {
  const db = getDb();
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: '缺少 user_id' });

  const rows = db.prepare(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).all(user_id);
  res.json(rows);
});

// GET /api/notifications/unread-count
router.get('/notifications/unread-count', (req: Request, res: Response) => {
  const db = getDb();
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: '缺少 user_id' });

  const row = db.prepare(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0'
  ).get(user_id) as any;
  res.json({ count: row.count });
});

// PUT /api/notifications/:id/read — mark as read
router.put('/notifications/:id/read', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST /api/notifications — admin creates notification
router.post('/notifications', requireAdmin, (req: Request, res: Response) => {
  const db = getDb();
  const { user_id, title, content } = req.body;
  if (!user_id || !title) return res.status(400).json({ error: '缺少必填字段' });

  const id = uuid();
  db.prepare(
    'INSERT INTO notifications (id, user_id, title, content) VALUES (?, ?, ?, ?)'
  ).run(id, user_id, title, content || '');

  res.status(201).json({ id, user_id, title, content });
});

export default router;
