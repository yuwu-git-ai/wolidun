import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { randomUUID } from 'crypto';

const router = Router();

// POST /api/messages — send a message
router.post('/messages', (req: Request, res: Response) => {
  const db = getDb();
  const { from, to, content } = req.body;
  if (!from || !to || !content?.trim()) return res.status(400).json({ error: '缺少参数' });
  if (from === to) return res.status(400).json({ error: '不能给自己发消息' });

  const target = db.prepare('SELECT nickname FROM users WHERE nickname = ?').get(to);
  if (!target) return res.status(404).json({ error: '用户不存在' });

  const id = randomUUID();
  db.prepare('INSERT INTO messages (id, from_user, to_user, content) VALUES (?, ?, ?, ?)')
    .run(id, from, to, content.trim());

  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
  res.status(201).json(msg);
});

// GET /api/messages/:nickname — conversation with a specific user
router.get('/messages/:nickname', (req: Request, res: Response) => {
  const db = getDb();
  const { nickname } = req.params;
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: '缺少 user_id' });

  // Mark messages from this user as read
  db.prepare(
    'UPDATE messages SET is_read = 1 WHERE from_user = ? AND to_user = ? AND is_read = 0'
  ).run(nickname, user_id);

  // Get conversation (both directions)
  const messages = db.prepare(`
    SELECT * FROM messages
    WHERE (from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?)
    ORDER BY created_at ASC
    LIMIT 200
  `).all(user_id, nickname, nickname, user_id);

  res.json({ messages });
});

// GET /api/messages — list recent conversations
router.get('/messages', (req: Request, res: Response) => {
  const db = getDb();
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: '缺少 user_id' });

  // Find all unique conversation partners and their last message
  const partners = db.prepare(`
    SELECT DISTINCT
      CASE WHEN from_user = ? THEN to_user ELSE from_user END as partner,
      MAX(created_at) as last_at
    FROM messages
    WHERE from_user = ? OR to_user = ?
    GROUP BY partner
    ORDER BY last_at DESC
  `).all(user_id, user_id, user_id) as any[];

  // For each partner, get last message and unread count
  const conversations = partners.map(p => {
    const lastMsg = db.prepare(
      "SELECT * FROM messages WHERE (from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?) ORDER BY created_at DESC LIMIT 1"
    ).get(user_id, p.partner, p.partner, user_id);

    const unread = (db.prepare(
      "SELECT COUNT(*) as c FROM messages WHERE from_user = ? AND to_user = ? AND is_read = 0"
    ).get(p.partner, user_id) as any).c;

    // Get partner profile
    const user = db.prepare('SELECT nickname, dorm FROM users WHERE nickname = ?').get(p.partner) as any;
    const profile = db.prepare('SELECT avatar FROM user_profiles WHERE user_id = ?').get(p.partner) as any;

    return {
      partner: p.partner,
      dorm: user?.dorm || '',
      avatar: profile?.avatar || '😊',
      last_message: lastMsg,
      unread,
    };
  });

  res.json({ conversations });
});

export default router;
