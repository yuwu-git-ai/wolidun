import { Request, Response, NextFunction } from 'express';

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const adminKey = req.headers['x-admin-key'] as string;
  const expectedKey = process.env.ADMIN_KEY || 'admin123';

  if (!adminKey || adminKey !== expectedKey) {
    res.status(403).json({ error: '管理员密钥错误' });
    return;
  }
  next();
}
