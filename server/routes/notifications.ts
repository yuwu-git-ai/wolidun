import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db';
import { requireAdmin } from '../middleware/auth';

const router = Router();

// GET /api/notifications — user's notifications + global announcements
router.get('/notifications', (req: Request, res: Response) => {
  const db = getDb();
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: '缺少 user_id' });

  const rows = db.prepare(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 200'
  ).all(user_id);

  // Also fetch global announcements
  const announcements = db.prepare(
    'SELECT *, 1 as is_announcement FROM announcements WHERE is_global = 1 ORDER BY created_at DESC'
  ).all();

  res.json({ notifications: rows, announcements });
});

// GET /api/notifications/unread-count
router.get('/notifications/unread-count', (req: Request, res: Response) => {
  const db = getDb();
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: '缺少 user_id' });

  const notifRow = db.prepare(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0'
  ).get(user_id) as any;

  const announceRow = db.prepare(
    'SELECT COUNT(*) as count FROM announcements WHERE is_global = 1'
  ).get() as any;

  res.json({ count: notifRow.count, announcement_count: announceRow.count });
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

// POST /api/notifications/broadcast — admin broadcasts (global or to selected users)
router.post('/notifications/broadcast', requireAdmin, (req: Request, res: Response) => {
  const db = getDb();
  const { title, content, is_global, user_ids } = req.body;
  if (!title) return res.status(400).json({ error: '缺少标题' });

  if (is_global) {
    // Create a global announcement (visible to all current + future users)
    const id = uuid();
    db.prepare(
      'INSERT INTO announcements (id, title, content, is_global) VALUES (?, ?, ?, 1)'
    ).run(id, title, content || '');
    res.json({ success: true, count: -1, global: true });
  } else {
    // Send to specific users or all
    const users = (user_ids && user_ids.length > 0)
      ? (user_ids as string[]).map(n => ({ nickname: n }))
      : db.prepare('SELECT nickname FROM users').all() as { nickname: string }[];

    const insertStmt = db.prepare(
      'INSERT INTO notifications (id, user_id, title, content) VALUES (?, ?, ?, ?)'
    );
    const tx = db.transaction(() => {
      for (const u of users) {
        insertStmt.run(uuid(), u.nickname, title, content || '');
      }
    });
    tx();

    res.json({ success: true, count: users.length, global: false });
  }
});

// DELETE /api/notifications/:id — user deletes own notification
router.delete('/notifications/:id', (req: Request, res: Response) => {
  const db = getDb();
  const notification = db.prepare('SELECT * FROM notifications WHERE id = ?').get(req.params.id) as any;
  if (!notification) return res.status(404).json({ error: '通知不存在' });

  db.prepare('DELETE FROM notifications WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// GET /api/announcements — admin lists all global announcements
router.get('/announcements', requireAdmin, (_req: Request, res: Response) => {
  const db = getDb();
  const announcements = db.prepare(
    'SELECT * FROM announcements ORDER BY created_at DESC'
  ).all();
  res.json({ announcements });
});

// GET /api/notifications/recent — admin lists recent notifications (for retract)
router.get('/notifications/recent', requireAdmin, (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100'
  ).all();
  res.json({ notifications: rows });
});

// DELETE /api/announcements/:id — admin deletes an announcement
router.delete('/announcements/:id', requireAdmin, (req: Request, res: Response) => {
  const db = getDb();
  const announcement = db.prepare('SELECT * FROM announcements WHERE id = ?').get(req.params.id) as any;
  if (!announcement) return res.status(404).json({ error: '公告不存在' });

  db.prepare('DELETE FROM announcements WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
