import { useState, useEffect, useCallback, useRef, FormEvent } from 'react';
import { Plus, Heart, MessageCircle, HelpCircle, Wrench, MessageSquareText, Users, X, Send, Search, List } from 'lucide-react';
import {
  fetchPosts, createPost, updatePost, toggleLike,
  addComment, joinPost, fetchPostById, fetchJoinedPostIds
} from '../../../shared/api';
import type { Post } from '../../../shared/api';
import { getErrorMessage } from '../../../shared/utils';

const SQUARE_TABS = [
  { key: 'help', label: '求助', icon: HelpCircle, color: 'text-rose-500', bg: 'bg-rose-50' },
  { key: 'skill', label: '技能', icon: Wrench, color: 'text-indigo-500', bg: 'bg-indigo-50' },
  { key: 'feedback', label: '反馈', icon: MessageSquareText, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { key: 'teamup', label: '组队', icon: Users, color: 'text-amber-500', bg: 'bg-amber-50' },
] as const;

const TYPE_LABELS: Record<string, string> = { help: '求助', skill: '技能', feedback: '反馈', teamup: '组队' };
const TYPE_COLORS: Record<string, string> = { help: 'bg-rose-50 text-rose-600', skill: 'bg-indigo-50 text-indigo-600', feedback: 'bg-emerald-50 text-emerald-600', teamup: 'bg-amber-50 text-amber-600' };

export default function SquarePanel({ identity }: { identity: { nickname: string; dorm: string } }) {
  const [activeTab, setActiveTab] = useState<string>('help');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const initialLoadRef = useRef(true);
  const formRef = useRef<HTMLFormElement>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [sort, setSort] = useState<'newest' | 'hot'>('newest');
  const [statusFilter, setStatusFilter] = useState<'active' | 'history'>('active');
  const [search, setSearch] = useState('');

  // Create form
  const [createType, setCreateType] = useState('help');
  const [createTitle, setCreateTitle] = useState('');
  const [createContent, setCreateContent] = useState('');
  const [createPrice, setCreatePrice] = useState('');
  const [createMaxPlayers, setCreateMaxPlayers] = useState('');
  const [createAnonymous, setCreateAnonymous] = useState(false);
  const [createError, setCreateError] = useState('');

  // Like & join tracking
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [joinedPostIds, setJoinedPostIds] = useState<Set<string>>(new Set());

  // Comment
  const [commentText, setCommentText] = useState('');

  const loadPosts = useCallback(() => {
    if (initialLoadRef.current) setLoading(true);
    const params: { type?: string; sort?: string; status?: string; search?: string } = { type: activeTab, sort };
    if (statusFilter === 'history') params.status = 'done';
    if (search.trim()) params.search = search.trim();
    fetchPosts(params).then(r => setPosts(r.posts as Post[])).catch(err => console.warn('Failed to load posts:', err)).finally(() => {
      setLoading(false);
      initialLoadRef.current = false;
    });
    // Refresh joined status in background
    fetchJoinedPostIds(identity.nickname).then(ids => setJoinedPostIds(new Set(ids))).catch(() => {});
  }, [activeTab, sort, identity.nickname, statusFilter, search]);

  useEffect(() => { initialLoadRef.current = true; loadPosts(); }, [loadPosts]);
  useEffect(() => { const t = setInterval(loadPosts, 15000); return () => clearInterval(t); }, [loadPosts]);

  // Load joined teamup IDs
  useEffect(() => {
    fetchJoinedPostIds(identity.nickname).then(ids => setJoinedPostIds(new Set(ids))).catch(() => {});
  }, [identity.nickname]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim()) { setCreateError('请填写标题'); return; }
    try {
      await createPost({
        user_id: identity.nickname,
        type: createType,
        title: createTitle.trim(),
        content: createContent.trim(),
        price: createPrice.trim(),
        anonymous: createAnonymous,
        max_players: createMaxPlayers ? parseInt(createMaxPlayers) : 0,
        players: createMaxPlayers ? 1 : undefined,
      });
      setShowCreate(false);
      setCreateTitle(''); setCreateContent(''); setCreatePrice(''); setCreateMaxPlayers('');
      setCreateAnonymous(false); setCreateError('');
      loadPosts();
    } catch (err) { setCreateError(getErrorMessage(err)); }
  };

  const handleClaim = async (post: Post) => {
    try {
      await updatePost(post.id, { status: 'claimed', user_id: identity.nickname });
      loadPosts();
    } catch (err) { alert(getErrorMessage(err)); }
  };

  const handleDone = async (post: Post) => {
    try {
      await updatePost(post.id, { status: 'done', user_id: identity.nickname });
      setSelectedPost(prev => prev?.id === post.id ? { ...prev, status: 'done' } : prev);
      loadPosts();
    } catch (err) { alert(getErrorMessage(err)); }
  };

  const handleLike = async (postId: string) => {
    try {
      const r = await toggleLike(postId, identity.nickname);
      const updateCount = (prev: Post[]) => prev.map(p => p.id === postId ? { ...p, likes_count: p.likes_count + (r.liked ? 1 : -1) } : p);
      setPosts(updateCount);
      setSelectedPost(prev => prev?.id === postId ? { ...prev, likes_count: prev.likes_count + (r.liked ? 1 : -1) } : prev);
      setLikedPostIds(prev => {
        const next = new Set(prev);
        if (r.liked) next.add(postId); else next.delete(postId);
        return next;
      });
    } catch { /* toggle failed, ignore */ }
  };

  const handleComment = async (postId: string) => {
    if (!commentText.trim()) return;
    try {
      await addComment(postId, { user_id: identity.nickname, content: commentText.trim() });
      setCommentText('');
      // Reload post detail
      const updated = await fetchPostById(postId);
      setSelectedPost(updated);
    } catch (err) { alert(getErrorMessage(err)); }
  };

  const handleJoin = async (postId: string) => {
    try {
      await joinPost(postId, identity.nickname);
      setJoinedPostIds(prev => new Set(prev).add(postId));
      loadPosts();
    } catch (err) { alert(getErrorMessage(err)); }
  };

  const openDetail = async (post: Post) => {
    try {
      const full = await fetchPostById(post.id, identity.nickname);
      setSelectedPost(full);
      // Sync joined status from server response
      if (full.joined) {
        setJoinedPostIds(prev => new Set(prev).add(post.id));
      }
    } catch { setSelectedPost(post); }
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts + 'Z');
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };



  return (
    <div className="flex flex-col h-full">
      {/* Sub tabs */}
      <div className="flex gap-1 px-3 py-2.5 bg-white border-b border-slate-100 overflow-x-auto shrink-0">
        {SQUARE_TABS.map(t => {
          const Icon = t.icon;
          const active = activeTab === t.key;
          return (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${active ? `${t.bg} ${t.color} shadow-sm` : 'text-slate-400 hover:text-slate-600'}`}>
              <Icon size={14} />{t.label}
            </button>
          );
        })}
        <div className="flex-1" />
        <button onClick={() => { setStatusFilter(f => f === 'active' ? 'history' : 'active'); }}
          className={`text-xs px-2 py-0.5 rounded-lg font-bold transition-colors ${statusFilter === 'history' ? 'bg-slate-100 text-slate-500' : 'text-slate-400 hover:text-slate-600'}`}>
          {statusFilter === 'active' ? '历史' : '进行中'}
        </button>
        <button onClick={() => setSort(sort === 'newest' ? 'hot' : 'newest')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${sort === 'newest' ? 'bg-slate-100 text-slate-600' : 'bg-orange-50 text-orange-500'}`}>
          <List size={12} />{sort === 'newest' ? '最新' : '最热'}
        </button>
      </div>

      {/* Search bar */}
      <div className="px-3 pb-2 shrink-0">
        <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
          <Search size={14} className="text-slate-400 shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索标题或用户名..."
            className="flex-1 bg-transparent outline-none text-sm text-slate-600 placeholder-slate-400"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600 shrink-0">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Post list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {/* Desktop create post card */}
        <button
          onClick={() => { setCreateType(activeTab); setShowCreate(true); }}
          className="hidden lg:flex items-center gap-3 w-full bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md hover:border-orange-200 transition-all text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
            <Plus size={20} className="text-slate-400" />
          </div>
          <span className="text-sm text-slate-400 font-medium">发布{activeTab === 'help' ? '求助' : activeTab === 'skill' ? '技能' : activeTab === 'feedback' ? '反馈' : '组队'}帖...</span>
        </button>

        {loading ? (
          <p className="text-center text-slate-400 py-10 text-sm">加载中...</p>
        ) : posts.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">📭</div>
            <p className="font-bold text-slate-400 text-sm">还没有帖子</p>
            <p className="text-xs text-slate-300 mt-1">成为第一个发帖的人吧</p>
          </div>
        ) : (
          posts.map(post => (
            <div key={post.id} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => openDetail(post)}>
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${TYPE_COLORS[post.type]?.split(' ')[0] || 'bg-slate-50'}`}>
                  {post.type === 'help' ? <HelpCircle size={16} className={TYPE_COLORS[post.type]?.split(' ')[1] || 'text-slate-400'} /> :
                   post.type === 'skill' ? <Wrench size={16} className={TYPE_COLORS[post.type]?.split(' ')[1] || 'text-slate-400'} /> :
                   post.type === 'feedback' ? <MessageSquareText size={16} className={TYPE_COLORS[post.type]?.split(' ')[1] || 'text-slate-400'} /> :
                   <Users size={16} className={TYPE_COLORS[post.type]?.split(' ')[1] || 'text-slate-400'} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${TYPE_COLORS[post.type]}`}>{TYPE_LABELS[post.type]}</span>
                    {post.price && <span className="text-[10px] font-bold text-orange-500">{post.price}</span>}
                    {post.type === 'teamup' && (
                      <span className="text-[10px] text-slate-400">
                        {post.players}/{post.max_players || '∞'}人
                        {post.max_players > 0 && post.players < post.max_players && (
                          <span className="text-amber-500 ml-0.5">差{post.max_players - post.players}人</span>
                        )}
                      </span>
                    )}
                    {post.type === 'teamup' && post.user_id === identity.nickname && <span className="text-[10px] text-slate-400 font-bold">我的队伍</span>}
                    {post.type === 'teamup' && post.user_id !== identity.nickname && joinedPostIds.has(post.id) && <span className="text-[10px] text-amber-500 font-bold">已加入</span>}
                    {post.status === 'done' && <span className="text-[10px] text-green-500 font-bold">已完成</span>}
                    {post.status === 'claimed' && <span className="text-[10px] text-blue-500 font-bold">已接单</span>}
                  </div>
                  <h4 className="font-bold text-sm mt-1 truncate">{post.anonymous ? '🕶️ 匿名' : post.user_id}：{post.title}</h4>
                  {post.content && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{post.content}</p>}
                  <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-400">
                    <span>{formatTime(post.created_at)}</span>
                    <span className={`flex items-center gap-1 ${likedPostIds.has(post.id) ? 'text-red-500' : ''}`}><Heart size={10} fill={likedPostIds.has(post.id) ? 'currentColor' : 'none'} />{post.likes_count}</span>
                    <span className="flex items-center gap-1"><MessageCircle size={10} />{post.comments_count}</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* FAB - create post */}
      <button onClick={() => { setCreateType(activeTab); setShowCreate(true); }}
        className="fixed bottom-20 right-4 w-12 h-12 bg-slate-800 text-white rounded-2xl shadow-xl flex items-center justify-center hover:bg-slate-700 transition-all active:scale-95 z-20 lg:hidden">
        <Plus size={24} />
      </button>

      {/* Create post modal */}
      {showCreate && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}>
          <form ref={formRef} onSubmit={handleCreate} className="w-full max-w-md bg-white rounded-t-[28px] sm:rounded-[28px] p-6 max-h-[85vh] overflow-y-auto shadow-2xl">
            <h3 className="font-black text-lg mb-4">发布帖子</h3>
            <div className="space-y-3">
              {/* Type selector */}
              <div className="flex gap-2">
                {SQUARE_TABS.map(t => (
                  <button key={t.key} type="button" onClick={() => setCreateType(t.key)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${createType === t.key ? `${t.bg} ${t.color}` : 'text-slate-400 bg-slate-50'}`}>
                    <t.icon size={14} />{t.label}
                  </button>
                ))}
              </div>
              <input value={createTitle} onChange={e => { setCreateTitle(e.target.value); setCreateError(''); }}
                placeholder="标题 *" required
                className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-orange-300 text-sm" />
              <textarea value={createContent} onChange={e => setCreateContent(e.target.value)}
                placeholder="描述（选填）" rows={3}
                className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-orange-300 text-sm resize-none" />
              {createType === 'help' || createType === 'skill' ? (
                <input value={createPrice} onChange={e => setCreatePrice(e.target.value)}
                  placeholder="赏金，如：¥5 或 一杯奶茶" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-orange-300 text-sm" />
              ) : null}
              {createType === 'teamup' ? (
                <input type="number" value={createMaxPlayers} onChange={e => setCreateMaxPlayers(e.target.value)}
                  placeholder="需要几人？" min="2" max="20"
                  className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-orange-300 text-sm" />
              ) : null}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={createAnonymous} onChange={e => setCreateAnonymous(e.target.checked)}
                  className="w-4 h-4 rounded-md border-slate-300 text-slate-800" />
                <span className="text-xs font-bold text-slate-500">匿名发布</span>
              </label>
              {createError && <p className="text-red-500 text-xs font-bold">{createError}</p>}
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm">取消</button>
                <button type="button" onClick={(e) => {
                    const form = formRef.current || (e.target as HTMLElement).closest('form');
                    if (form && typeof form.requestSubmit === 'function') {
                      form.requestSubmit();
                    } else if (form) {
                      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                    }
                  }}
                  className="flex-1 py-3 bg-slate-800 text-white rounded-2xl font-bold text-sm hover:bg-slate-700 transition-all">发布</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Post detail modal */}
      {selectedPost && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setSelectedPost(null); }}>
          <div className="w-full max-w-md bg-white rounded-t-[28px] sm:rounded-[28px] p-6 max-h-[85vh] overflow-y-auto shadow-2xl space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${TYPE_COLORS[selectedPost.type]?.split(' ')[0] || 'bg-slate-50'}`}>
                {selectedPost.type === 'help' ? <HelpCircle size={18} className={TYPE_COLORS[selectedPost.type]?.split(' ')[1]} /> :
                 selectedPost.type === 'skill' ? <Wrench size={18} className={TYPE_COLORS[selectedPost.type]?.split(' ')[1]} /> :
                 selectedPost.type === 'feedback' ? <MessageSquareText size={18} className={TYPE_COLORS[selectedPost.type]?.split(' ')[1]} /> :
                 <Users size={18} className={TYPE_COLORS[selectedPost.type]?.split(' ')[1]} />}
              </div>
              <div className="flex-1">
                <h3 className="font-black text-base">{selectedPost.anonymous ? '🕶️ 匿名' : selectedPost.user_id}：{selectedPost.title}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${TYPE_COLORS[selectedPost.type]}`}>{TYPE_LABELS[selectedPost.type]}</span>
                  {selectedPost.price && <span className="text-[10px] font-bold text-orange-500">{selectedPost.price}</span>}
                  {selectedPost.type === 'teamup' && (
                    <span className="text-[10px] text-slate-400">
                      {selectedPost.players}/{selectedPost.max_players || '∞'}人
                      {selectedPost.max_players > 0 && selectedPost.players < selectedPost.max_players && (
                        <span className="text-amber-500 ml-0.5 font-bold">差{selectedPost.max_players - selectedPost.players}人</span>
                      )}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400">{formatTime(selectedPost.created_at)}</span>
                </div>
              </div>
              <button onClick={() => setSelectedPost(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>

            {/* Content */}
            {selectedPost.content && <p className="text-sm text-slate-600 whitespace-pre-wrap">{selectedPost.content}</p>}

            {/* Actions */}
            <div className="flex items-center gap-4 border-t border-b border-slate-100 py-2">
              <button onClick={() => handleLike(selectedPost.id)}
                className={`flex items-center gap-1 text-xs font-bold transition-colors ${likedPostIds.has(selectedPost.id) ? 'text-red-500' : 'text-slate-400 hover:text-rose-500'}`}>
                <Heart size={16} fill={likedPostIds.has(selectedPost.id) ? 'currentColor' : 'none'} /> {selectedPost.likes_count}
              </button>
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <MessageCircle size={16} /> {selectedPost.comments_count}
              </span>
              {selectedPost.type === 'help' && selectedPost.status === 'open' && selectedPost.user_id !== identity.nickname && (
                <button onClick={() => handleClaim(selectedPost)} className="ml-auto px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-700">我能搞定</button>
              )}
              {selectedPost.user_id === identity.nickname && (
                selectedPost.status === 'done' ? (
                  <span className="ml-auto px-3 py-1.5 bg-slate-200 text-slate-400 rounded-lg text-xs font-bold">已完成</span>
                ) : (
                  <button onClick={() => handleDone(selectedPost)} className="ml-auto px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600 active:scale-95 transition-all">标记完成</button>
                )
              )}
              {selectedPost.type === 'teamup' && (
                selectedPost.user_id === identity.nickname ? (
                  <span className="ml-auto px-3 py-1.5 bg-slate-100 text-slate-400 rounded-lg text-xs font-bold">我的队伍</span>
                ) : joinedPostIds.has(selectedPost.id) ? (
                  <span className="ml-auto px-3 py-1.5 bg-amber-50 text-amber-600 rounded-lg text-xs font-bold">已加入</span>
                ) : selectedPost.status === 'open' ? (
                  <button onClick={() => handleJoin(selectedPost.id)} className="ml-auto px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600 active:scale-95 transition-all">加入</button>
                ) : null
              )}
            </div>

            {/* Comments */}
            <div className="space-y-3">
              <h4 className="font-bold text-sm">评论</h4>
              {selectedPost.comments && selectedPost.comments.length > 0 ? (
                selectedPost.comments.map(c => (
                  <div key={c.id} className="flex gap-2">
                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0">
                      {(c.anonymous ? '匿' : c.user_id || '?')[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold">{c.anonymous ? '匿名' : c.user_id}</span>
                        <span className="text-[10px] text-slate-400">{formatTime(c.created_at)}</span>
                      </div>
                      <p className="text-sm text-slate-600">{c.content}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 text-center py-4">暂无评论</p>
              )}
              {/* Comment input */}
              <div className="flex gap-2">
                <input value={commentText} onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleComment(selectedPost.id); }}
                  placeholder="写评论..." className="flex-1 p-2.5 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-orange-300 text-sm" />
                <button onClick={() => handleComment(selectedPost.id)}
                  className="px-3 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-colors">
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
