import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { randomUUID } from 'crypto';

const router = Router();

// GET /api/posts — list posts with pagination + filters
router.get('/posts', (req: Request, res: Response) => {
  const db = getDb();
  const { type, status, page = '1', limit = '20', sort = 'newest', search } = req.query as Record<string, string>;

  let sql = 'SELECT * FROM posts WHERE 1=1';
  const params: any[] = [];

  if (type) { sql += ' AND type = ?'; params.push(type); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  else { sql += " AND status NOT IN ('done','cancelled')"; }
  if (search) { sql += ' AND (title LIKE ? OR user_id LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

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

  // For teamup posts, attach member lists
  const postsWithMembers = posts.map((post: any) => {
    if (post.type === 'teamup') {
      const members = db.prepare(
        'SELECT user_id FROM teamup_members WHERE post_id = ? ORDER BY rowid ASC'
      ).all(post.id) as { user_id: string }[];
      return { ...post, team_members: members };
    }
    return post;
  });

  res.json({ posts: postsWithMembers, total, page: parseInt(page), limit: parseInt(limit) });
});

// GET /api/posts/joined — get IDs of teamup posts a user has joined
router.get('/posts/joined', (req: Request, res: Response) => {
  const db = getDb();
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: '缺少 user_id' });

  const rows = db.prepare(`
    SELECT tm.post_id FROM teamup_members tm
    JOIN posts p ON tm.post_id = p.id
    WHERE tm.user_id = ?
  `).all(user_id) as { post_id: string }[];

  res.json({ joined_ids: rows.map(r => r.post_id) });
});

// GET /api/posts/:id — single post with comments
router.get('/posts/:id', (req: Request, res: Response) => {
  const db = getDb();
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id) as any;
  if (!post) return res.status(404).json({ error: '帖子不存在' });

  const comments = db.prepare(
    'SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC'
  ).all(req.params.id);

  // Check if requesting user has joined this teamup post
  let joined = false;
  const { user_id } = req.query;
  if (user_id && post.type === 'teamup') {
    const member = db.prepare(
      'SELECT 1 FROM teamup_members WHERE post_id = ? AND user_id = ?'
    ).get(req.params.id, user_id);
    joined = !!member;
  }

  // For teamup posts, fetch member list
  let team_members: { user_id: string }[] = [];
  if (post.type === 'teamup') {
    team_members = db.prepare(
      'SELECT user_id FROM teamup_members WHERE post_id = ? ORDER BY rowid ASC'
    ).all(req.params.id) as { user_id: string }[];
  }

  res.json({ ...post, comments, joined, team_members });
});

// POST /api/posts — create a post
router.post('/posts', (req: Request, res: Response) => {
  const db = getDb();
  const { user_id, type, title, content, tags, price, anonymous, players, max_players } = req.body;

  if (!user_id || !type || !title) {
    return res.status(400).json({ error: '缺少必填字段' });
  }
  if (!['help', 'skill', 'feedback', 'teamup', 'chat'].includes(type)) {
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
  } else if (status === 'open' && post.status === 'claimed') {
    // Unclaim: claimed_by user gives up, post goes back to open
    if (post.claimed_by !== user_id) return res.status(403).json({ error: '只有接单人才能取消接单' });
    db.prepare('UPDATE posts SET status = ?, claimed_by = ? WHERE id = ?')
      .run('open', '', req.params.id);
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

// DELETE /api/posts/:postId/comments/:commentId — author or admin
router.delete('/posts/:postId/comments/:commentId', (req: Request, res: Response) => {
  const db = getDb();
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.commentId) as any;
  if (!comment) return res.status(404).json({ error: '评论不存在' });
  if (comment.post_id !== req.params.postId) return res.status(400).json({ error: '评论不属于该帖子' });

  const { user_id, reason } = req.body;
  const adminKey = req.headers['x-admin-key'] as string;
  const expectedKey = process.env.ADMIN_KEY || 'admin123';
  const isAdmin = adminKey === expectedKey;
  if (!isAdmin && comment.user_id !== user_id) return res.status(403).json({ error: '只能删除自己的评论' });

  // If admin deletes with reason, notify comment author
  if (isAdmin && reason && comment.user_id !== user_id) {
    const notifId = randomUUID();
    db.prepare(
      'INSERT INTO notifications (id, user_id, title, content) VALUES (?, ?, ?, ?)'
    ).run(notifId, comment.user_id, '评论被删除', reason);
  }

  db.prepare('DELETE FROM comments WHERE id = ?').run(req.params.commentId);
  db.prepare('UPDATE posts SET comments_count = MAX(0, comments_count - 1) WHERE id = ?').run(req.params.postId);
  res.json({ success: true });
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

  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: '缺少 user_id' });

  // Prevent creator from joining own teamup
  if (post.user_id === user_id) return res.status(400).json({ error: '不能加入自己创建的队伍' });

  // Check if user already joined this post (before status check, for clearer error)
  const alreadyInPost = db.prepare(
    'SELECT * FROM teamup_members WHERE post_id = ? AND user_id = ?'
  ).get(req.params.id, user_id);
  if (alreadyInPost) return res.status(400).json({ error: '你已经在这个队伍里了' });

  // Check if user already joined any other open teamup
  const otherTeam = db.prepare(`
    SELECT tm.* FROM teamup_members tm
    JOIN posts p ON tm.post_id = p.id
    WHERE tm.user_id = ? AND p.status = 'open' AND p.id != ?
  `).get(user_id, req.params.id);
  if (otherTeam) return res.status(400).json({ error: '你已经加入了一个队伍，不能同时加入多个' });

  if (post.status !== 'open') return res.status(400).json({ error: '队伍已满或已结束' });

  // Record membership
  db.prepare('INSERT INTO teamup_members (id, post_id, user_id) VALUES (?, ?, ?)')
    .run(randomUUID(), req.params.id, user_id);

  const newPlayers = post.players + 1;
  if (newPlayers >= post.max_players) {
    db.prepare('UPDATE posts SET players = ?, status = ? WHERE id = ?').run(newPlayers, 'done', req.params.id);
  } else {
    db.prepare('UPDATE posts SET players = ? WHERE id = ?').run(newPlayers, req.params.id);
  }

  const updated = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// POST /api/posts/:id/leave — leave a teamup post
router.post('/posts/:id/leave', (req: Request, res: Response) => {
  const db = getDb();
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id) as any;
  if (!post) return res.status(404).json({ error: '帖子不存在' });
  if (post.type !== 'teamup') return res.status(400).json({ error: '仅组队帖支持退出' });

  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: '缺少 user_id' });

  if (post.user_id === user_id) return res.status(400).json({ error: '创建者不能退出，请标记完成或取消' });

  const membership = db.prepare(
    'SELECT * FROM teamup_members WHERE post_id = ? AND user_id = ?'
  ).get(req.params.id, user_id);
  if (!membership) return res.status(400).json({ error: '你不在这个队伍里' });

  if (post.status !== 'open') return res.status(400).json({ error: '队伍已结束' });

  db.prepare('DELETE FROM teamup_members WHERE post_id = ? AND user_id = ?')
    .run(req.params.id, user_id);

  const newPlayers = Math.max(1, post.players - 1);
  db.prepare('UPDATE posts SET players = ? WHERE id = ?').run(newPlayers, req.params.id);

  const updated2 = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  res.json(updated2);
});

// DELETE /api/posts/:id — creator or admin deletes post
router.delete('/posts/:id', (req: Request, res: Response) => {
  const db = getDb();
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id) as any;
  if (!post) return res.status(404).json({ error: '帖子不存在' });

  const { user_id, reason } = req.body;
  if (!user_id) return res.status(400).json({ error: '缺少 user_id' });

  const adminKey = req.headers['x-admin-key'] as string;
  const expectedKey = process.env.ADMIN_KEY || 'admin123';
  const isAdmin = adminKey && adminKey === expectedKey;

  if (!isAdmin && post.user_id !== user_id) {
    return res.status(403).json({ error: '只有发帖人或管理员可以删除' });
  }

  // If admin deletes someone else's post with reason, notify the author
  if (isAdmin && reason && post.user_id !== user_id) {
    const notifId = randomUUID();
    db.prepare(
      'INSERT INTO notifications (id, user_id, title, content) VALUES (?, ?, ?, ?)'
    ).run(notifId, post.user_id, '帖子被撤回', `你的帖子「${post.title}」已被管理员撤回。原因：${reason}`);
  }

  // CASCADE will clean up comments, likes, teamup_members
  db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
