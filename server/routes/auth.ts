import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { getDb } from '../db';

const router = Router();

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// POST /api/auth/register
router.post('/auth/register', (req: Request, res: Response) => {
  const { nickname, dorm, password } = req.body;
  if (!nickname || !dorm || !password) {
    res.status(400).json({ error: '请填写所有字段' });
    return;
  }
  if (password.length < 2) {
    res.status(400).json({ error: '密码至少2位' });
    return;
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE nickname = ?').get(nickname);
  if (existing) {
    res.status(409).json({ error: '该昵称已被注册' });
    return;
  }

  const id = crypto.randomUUID();
  db.prepare('INSERT INTO users (id, nickname, dorm, password_hash) VALUES (?, ?, ?, ?)')
    .run(id, nickname, dorm, hashPassword(password));

  res.json({ ok: true, nickname, dorm });
});

// POST /api/auth/login
router.post('/auth/login', (req: Request, res: Response) => {
  const { nickname, password } = req.body;
  if (!nickname || !password) {
    res.status(400).json({ error: '请输入昵称和密码' });
    return;
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE nickname = ?').get(nickname) as any;
  if (!user || user.password_hash !== hashPassword(password)) {
    res.status(403).json({ error: '昵称或密码错误' });
    return;
  }

  res.json({ ok: true, nickname: user.nickname, dorm: user.dorm });
});

// PUT /api/auth/profile — update nickname/dorm (verify password)
router.put('/auth/profile', (req: Request, res: Response) => {
  const { nickname, dorm, password } = req.body;
  if (!nickname || !dorm || !password) {
    res.status(400).json({ error: '请填写所有字段' });
    return;
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE nickname = ?').get(nickname) as any;
  if (!user || user.password_hash !== hashPassword(password)) {
    res.status(403).json({ error: '密码错误' });
    return;
  }

  db.prepare('UPDATE users SET dorm = ? WHERE nickname = ?').run(dorm, nickname);
  res.json({ ok: true, nickname, dorm });
});

// PUT /api/auth/password — change password
router.put('/auth/password', (req: Request, res: Response) => {
  const { nickname, oldPassword, newPassword } = req.body;
  if (!nickname || !oldPassword || !newPassword) {
    res.status(400).json({ error: '请填写所有字段' });
    return;
  }
  if (newPassword.length < 2) {
    res.status(400).json({ error: '新密码至少2位' });
    return;
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE nickname = ?').get(nickname) as any;
  if (!user || user.password_hash !== hashPassword(oldPassword)) {
    res.status(403).json({ error: '原密码错误' });
    return;
  }

  db.prepare('UPDATE users SET password_hash = ? WHERE nickname = ?').run(hashPassword(newPassword), nickname);
  res.json({ ok: true });
});

export default router;
