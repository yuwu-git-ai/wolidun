import { Request, Response, NextFunction } from 'express';
import { getDb } from '../db';

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const adminKey = req.headers['x-admin-key'] as string;
  const expectedKey = process.env.ADMIN_KEY || 'admin123';

  if (adminKey && adminKey === expectedKey) {
    return next();
  }

  // Also check X-User header for admin users
  const xUser = req.headers['x-user'] as string;
  if (xUser) {
    const db = getDb();
    const user = db.prepare('SELECT is_admin FROM users WHERE nickname = ?').get(xUser) as any;
    if (user && user.is_admin) {
      return next();
    }
  }

  res.status(403).json({ error: '管理员密钥错误' });
  return;
}
