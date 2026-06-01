import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { randomUUID } from 'crypto';

const router = Router();

// GET /api/posts — list posts with pagination + filters
router.get('/posts', (req: Request, res: Response) => {
  const db = getDb();
  const { type, status, page = '1', limit = '20', sort = 'newest' } = req.query as Record<string, string>;

  let sql = 'SELECT * FROM posts WHERE 1=1';
  const params: any[] = [];

  if (type) { sql += ' AND type = ?'; params.push(type); }
  if (status) { sql += ' AND status = ?'; params.push(status); }

  // Count total
  const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
  const { total } = db.prepare(countSql).get(...params) as any;

  // Sort
  if (sort === 'hot') sql += ' ORDER BY likes_count DESC, created_at DESC';
  else sql += ' ORDER BY created_at DESC';

  // Paginate
  const offset = (parseInt(page) - 1) * parseInt(limit);
  sql += ' LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);

  const posts = db.prepare(sql).all(...params);

  res.json({ posts, total, page: parseInt(page), limit: parseInt(limit) });
});

// GET /api/posts/:id — single post with comments
router.get('/posts/:id', (req: Request, res: Response) => {
  const db = getDb();
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id) as any;
  if (!post) return res.status(404).json({ error: '帖子不存在' });

  const comments = db.prepare(
    'SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC'
  ).all(req.params.id);

  res.json({ ...post, comments });
});

// POST /api/posts — create a post
router.post('/posts', (req: Request, res: Response) => {
  const db = getDb();
  const { user_id, type, title, content, tags, price, anonymous, players, max_players } = req.body;

  if (!user_id || !type || !title) {
    return res.status(400).json({ error: '缺少必填字段' });
  }
  if (!['help', 'skill', 'treehole', 'teamup'].includes(type)) {
    return res.status(400).json({ error: '无效的帖子类型' });
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO posts (id, user_id, type, title, content, tags, price, anonymous, players, max_players)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, user_id, type, title, content || '', tags || '', price || '', anonymous ? 1 : 0, players || 1, max_players || 0);

  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
  res.status(201).json(post);
});

// PUT /api/posts/:id — update post (claim, done, cancel)
router.put('/posts/:id', (req: Request, res: Response) => {
  const db = getDb();
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id) as any;
  if (!post) return res.status(404).json({ error: '帖子不存在' });

  const { status, claimed_by, user_id } = req.body;

  if (status === 'claimed') {
    if (post.status !== 'open') return res.status(400).json({ error: '帖子已被接单' });
    db.prepare('UPDATE posts SET status = ?, claimed_by = ? WHERE id = ?')
      .run('claimed', claimed_by || user_id, req.params.id);
  } else if (status === 'done') {
    if (post.user_id !== user_id) return res.status(403).json({ error: '只有发帖人可以标记完成' });
    db.prepare('UPDATE posts SET status = ? WHERE id = ?').run('done', req.params.id);
  } else if (status === 'cancelled') {
    if (post.user_id !== user_id && post.claimed_by !== user_id)
      return res.status(403).json({ error: '无权取消' });
    db.prepare('UPDATE posts SET status = ? WHERE id = ?').run('cancelled', req.params.id);
  } else {
    return res.status(400).json({ error: '无效的状态变更' });
  }

  const updated = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// POST /api/posts/:id/comments
router.post('/posts/:id/comments', (req: Request, res: Response) => {
  const db = getDb();
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id) as any;
  if (!post) return res.status(404).json({ error: '帖子不存在' });

  const { user_id, content, anonymous } = req.body;
  if (!user_id || !content) return res.status(400).json({ error: '缺少必填字段' });

  const id = randomUUID();
  db.prepare(
    'INSERT INTO comments (id, post_id, user_id, content, anonymous) VALUES (?, ?, ?, ?, ?)'
  ).run(id, req.params.id, user_id, content, anonymous ? 1 : 0);

  db.prepare('UPDATE posts SET comments_count = comments_count + 1 WHERE id = ?').run(req.params.id);

  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(id);
  res.status(201).json(comment);
});

// POST /api/posts/:id/like — toggle like
router.post('/posts/:id/like', (req: Request, res: Response) => {
  const db = getDb();
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id) as any;
  if (!post) return res.status(404).json({ error: '帖子不存在' });

  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: '缺少 user_id' });

  const existing = db.prepare(
    'SELECT * FROM likes WHERE post_id = ? AND user_id = ?'
  ).get(req.params.id, user_id) as any;

  if (existing) {
    // Unlike
    db.prepare('DELETE FROM likes WHERE post_id = ? AND user_id = ?').run(req.params.id, user_id);
    db.prepare('UPDATE posts SET likes_count = MAX(0, likes_count - 1) WHERE id = ?').run(req.params.id);
    res.json({ liked: false });
  } else {
    // Like
    db.prepare('INSERT INTO likes (id, post_id, user_id) VALUES (?, ?, ?)').run(randomUUID(), req.params.id, user_id);
    db.prepare('UPDATE posts SET likes_count = likes_count + 1 WHERE id = ?').run(req.params.id);
    res.json({ liked: true });
  }
});

// POST /api/posts/:id/join — join a teamup post
router.post('/posts/:id/join', (req: Request, res: Response) => {
  const db = getDb();
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id) as any;
  if (!post) return res.status(404).json({ error: '帖子不存在' });
  if (post.type !== 'teamup') return res.status(400).json({ error: '仅组队帖支持加入' });
  if (post.status !== 'open') return res.status(400).json({ error: '队伍已满或已结束' });

  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: '缺少 user_id' });

  const newPlayers = post.players + 1;
  if (newPlayers >= post.max_players) {
    db.prepare('UPDATE posts SET players = ?, status = ? WHERE id = ?').run(newPlayers, 'done', req.params.id);
  } else {
    db.prepare('UPDATE posts SET players = ? WHERE id = ?').run(newPlayers, req.params.id);
  }

  const updated = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  res.json(updated);
});

export default router;
