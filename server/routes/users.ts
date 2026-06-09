import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { randomUUID } from 'crypto';

const router = Router();

// Helper: ensure user_profiles row exists
function ensureProfile(db: any, nickname: string) {
  const exists = db.prepare('SELECT 1 FROM user_profiles WHERE user_id = ?').get(nickname);
  if (!exists) {
    db.prepare('INSERT INTO user_profiles (user_id) VALUES (?)').run(nickname);
  }
}

// GET /api/users/:nickname — get user profile + recent posts
router.get('/users/:nickname', (req: Request, res: Response) => {
  const db = getDb();
  const { nickname } = req.params;

  const user = db.prepare('SELECT nickname, dorm, created_at FROM users WHERE nickname = ?').get(nickname) as any;
  if (!user) return res.status(404).json({ error: '用户不存在' });

  ensureProfile(db, nickname);
  const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(nickname) as any;

  // Recent posts
  const posts = db.prepare(
    "SELECT * FROM posts WHERE user_id = ? AND status != 'cancelled' ORDER BY created_at DESC LIMIT 50"
  ).all(nickname);

  // Friend count + friend status for viewer
  const friendCount = (db.prepare(
    "SELECT COUNT(*) as c FROM friendships WHERE (from_user = ? OR to_user = ?) AND status = 'accepted'"
  ).get(nickname, nickname) as any).c;

  // Check friendship with viewer
  let friendship = null;
  const { viewer } = req.query;
  if (viewer && viewer !== nickname) {
    const f = db.prepare(
      "SELECT * FROM friendships WHERE (from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?)"
    ).get(viewer, nickname, nickname, viewer) as any;
    if (f) friendship = f;
  }

  res.json({
    ...user,
    avatar: profile?.avatar || '😊',
    bio: profile?.bio || '',
    skills: JSON.parse(profile?.skills || '[]'),
    contact: JSON.parse(profile?.contact || '{}'),
    status_text: profile?.status_text || '',
    friend_count: friendCount,
    posts,
    friendship,
  });
});

// PUT /api/users/:nickname — update own profile
router.put('/users/:nickname', (req: Request, res: Response) => {
  const db = getDb();
  const { nickname } = req.params;
  const { avatar, bio, skills, contact, status_text } = req.body;

  const user = db.prepare('SELECT nickname FROM users WHERE nickname = ?').get(nickname);
  if (!user) return res.status(404).json({ error: '用户不存在' });

  ensureProfile(db, nickname);
  db.prepare(
    `UPDATE user_profiles SET avatar = ?, bio = ?, skills = ?, contact = ?, status_text = ?, updated_at = datetime('now') WHERE user_id = ?`
  ).run(
    avatar || '😊',
    bio || '',
    JSON.stringify(skills || []),
    JSON.stringify(contact || {}),
    status_text || '',
    nickname
  );

  const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(nickname) as any;
  res.json({
    avatar: profile.avatar,
    bio: profile.bio,
    skills: JSON.parse(profile.skills),
    contact: JSON.parse(profile.contact),
    status_text: profile.status_text,
  });
});

// POST /api/users/search — search users
router.post('/users/search', (req: Request, res: Response) => {
  const db = getDb();
  const { q } = req.body;
  if (!q) return res.json({ users: [] });

  const users = db.prepare(
    'SELECT nickname, dorm, created_at FROM users WHERE nickname LIKE ? LIMIT 20'
  ).all(`%${q}%`);

  res.json({ users });
});

// POST /api/friends/request — send friend request
router.post('/friends/request', (req: Request, res: Response) => {
  const db = getDb();
  const { from, to } = req.body;
  if (!from || !to) return res.status(400).json({ error: '缺少参数' });
  if (from === to) return res.status(400).json({ error: '不能添加自己为好友' });

  const target = db.prepare('SELECT nickname FROM users WHERE nickname = ?').get(to);
  if (!target) return res.status(404).json({ error: '用户不存在' });

  const existing = db.prepare(
    "SELECT * FROM friendships WHERE (from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?)"
  ).get(from, to, to, from) as any;
  if (existing) {
    if (existing.status === 'accepted') return res.status(400).json({ error: '已经是好友' });
    if (existing.status === 'pending' && existing.from_user === from) return res.status(400).json({ error: '已发送过申请' });
    if (existing.status === 'pending' && existing.from_user === to) {
      // Other side already sent request → auto-accept
      db.prepare("UPDATE friendships SET status = 'accepted', accepted_at = datetime('now') WHERE id = ?").run(existing.id);
      return res.json({ ok: true, auto_accepted: true });
    }
    if (existing.status === 'blocked') return res.status(400).json({ error: '无法添加' });
  }

  db.prepare('INSERT INTO friendships (id, from_user, to_user) VALUES (?, ?, ?)').run(randomUUID(), from, to);
  res.json({ ok: true });
});

// PUT /api/friends/respond — accept/reject friend request
router.put('/friends/respond', (req: Request, res: Response) => {
  const db = getDb();
  const { from, to, action } = req.body; // action: 'accept' | 'reject'
  if (!from || !to || !action) return res.status(400).json({ error: '缺少参数' });

  const f = db.prepare(
    "SELECT * FROM friendships WHERE from_user = ? AND to_user = ? AND status = 'pending'"
  ).get(from, to) as any;
  if (!f) return res.status(404).json({ error: '申请不存在或已处理' });

  if (action === 'accept') {
    db.prepare("UPDATE friendships SET status = 'accepted', accepted_at = datetime('now') WHERE id = ?").run(f.id);
  } else {
    db.prepare('DELETE FROM friendships WHERE id = ?').run(f.id);
  }

  res.json({ ok: true });
});

// GET /api/friends — list friends + pending requests for a user
router.get('/friends', (req: Request, res: Response) => {
  const db = getDb();
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: '缺少 user_id' });

  // Accepted friends
  const friends = db.prepare(`
    SELECT f.id, f.from_user, f.to_user, f.accepted_at,
      CASE WHEN f.from_user = ? THEN f.to_user ELSE f.from_user END as friend_nickname
    FROM friendships f
    WHERE (f.from_user = ? OR f.to_user = ?) AND f.status = 'accepted'
  `).all(user_id, user_id, user_id) as any[];

  // Add profile info for each friend
  const friendsWithProfiles = friends.map(f => {
    ensureProfile(db, f.friend_nickname);
    const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(f.friend_nickname) as any;
    return {
      ...f,
      avatar: profile?.avatar || '😊',
      bio: profile?.bio || '',
      status_text: profile?.status_text || '',
    };
  });

  // Pending sent requests (from me)
  const sent = db.prepare(
    "SELECT * FROM friendships WHERE from_user = ? AND status = 'pending'"
  ).all(user_id);

  // Pending received requests (to me)
  const received = db.prepare(
    "SELECT * FROM friendships WHERE to_user = ? AND status = 'pending'"
  ).all(user_id);

  res.json({ friends: friendsWithProfiles, sent, received });
});

// DELETE /api/friends/:nickname — unfriend
router.delete('/friends/:nickname', (req: Request, res: Response) => {
  const db = getDb();
  const { nickname } = req.params;
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: '缺少 user_id' });

  db.prepare(
    "DELETE FROM friendships WHERE (from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?)"
  ).run(user_id, nickname, nickname, user_id);

  res.json({ ok: true });
});

export default router;
