import { useState, useEffect, useCallback } from 'react';
import { X, UserX, UserPlus, Check, Clock, MessageCircle, Users, Search, Compass } from 'lucide-react';
import { fetchFriends, respondFriendRequest, deleteFriend, searchUsers, sendFriendRequest } from '../../../shared/api';
import type { FriendInfo } from '../../../shared/api';
import { getErrorMessage } from '../../../shared/utils';

interface Props {
  userId: string;
  onClose: () => void;
  onViewProfile: (nickname: string) => void;
  onChat?: (partner: string) => void;
}

export default function FriendsPanel({ userId, onClose, onViewProfile, onChat }: Props) {
  const [friends, setFriends] = useState<FriendInfo[]>([]);
  const [received, setReceived] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'friends' | 'requests' | 'discover'>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ nickname: string; dorm: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingUser, setAddingUser] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchFriends(userId)
      .then(data => {
        setFriends(data.friends);
        setReceived(data.received);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handleRespond = async (from: string, to: string, action: 'accept' | 'reject') => {
    try {
      await respondFriendRequest(from, to, action);
      load();
    } catch (err) { alert(getErrorMessage(err)); }
  };

  const handleDelete = async (nickname: string) => {
    if (!confirm(`确定删除好友 ${nickname}？`)) return;
    try {
      await deleteFriend(userId, nickname);
      load();
    } catch (err) { alert(getErrorMessage(err)); }
  };

  const handleSearch = useCallback(async () => {
    setSearching(true);
    try {
      const data = await searchUsers(searchQuery.trim());
      setSearchResults(data.users.filter((u: any) => u.nickname !== userId));
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  }, [searchQuery, userId]);

  // Debounced search + load all users on tab enter
  useEffect(() => {
    if (tab !== 'discover') return;
    if (searchQuery.trim()) {
      const timer = setTimeout(handleSearch, 300);
      return () => clearTimeout(timer);
    } else {
      handleSearch(); // Load all users when no query
    }
  }, [searchQuery, handleSearch, tab]);

  const handleAddFriend = async (to: string) => {
    setAddingUser(to);
    try {
      const r = await sendFriendRequest(userId, to);
      if (r.auto_accepted) alert('对方已向你发过申请，自动成为好友！');
      else alert('好友申请已发送');
      setSearchResults(prev => prev.filter(u => u.nickname !== to));
      load();
    } catch (err) { alert(getErrorMessage(err)); }
    finally { setAddingUser(null); }
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md bg-white rounded-[28px] p-6 max-h-[85vh] overflow-y-auto shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Users size={20} className="text-slate-600" />
          <h2 className="font-black text-lg flex-1">好友</h2>
          <div className="flex bg-slate-100 rounded-xl p-0.5">
            <button onClick={() => setTab('friends')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${tab === 'friends' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}`}>好友</button>
            <button onClick={() => setTab('requests')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${tab === 'requests' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}`}>
              申请{received.length > 0 ? ` ${received.length}` : ''}
            </button>
            <button onClick={() => { setTab('discover'); setSearchQuery(''); setSearchResults([]); }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${tab === 'discover' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}`}>
              <Compass size={12} className="inline mr-0.5" />发现
            </button>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        {loading ? (
          <p className="text-center text-slate-400 py-10 text-sm">加载中...</p>
        ) : tab === 'discover' ? (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Fixed search bar */}
            <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100 shrink-0 mb-3">
              <Search size={14} className="text-slate-400 shrink-0" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="搜索用户昵称..."
                autoFocus
                className="flex-1 bg-transparent outline-none text-sm text-slate-600 placeholder-slate-400"
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="text-slate-400 hover:text-slate-600 shrink-0">
                  <X size={14} />
                </button>
              )}
            </div>
            {/* Fixed-height results area */}
            <div className="min-h-[280px]">
              {searching ? (
                <p className="text-center text-slate-400 py-10 text-sm">搜索中...</p>
              ) : searchResults.length > 0 ? (
                // Show results (either from search or all users)
                <div className="space-y-2">
                  {!searchQuery && <p className="text-xs font-bold text-slate-400 px-1">所有用户</p>}
                  {searchResults.map(u => (
                    <div key={u.nickname} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                      <button onClick={() => onViewProfile(u.nickname)}
                        className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-lg shrink-0 hover:ring-2 hover:ring-orange-300 transition-all">👤</button>
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onViewProfile(u.nickname)}>
                        <p className="text-sm font-bold">{u.nickname}</p>
                        <p className="text-xs text-slate-400">{u.dorm}</p>
                      </div>
                      <button onClick={() => handleAddFriend(u.nickname)} disabled={addingUser === u.nickname}
                        className="px-3 py-1.5 bg-indigo-500 text-white rounded-lg text-xs font-bold hover:bg-indigo-600 disabled:opacity-50 flex items-center gap-1 shrink-0">
                        <UserPlus size={12} />{addingUser === u.nickname ? '发送中' : '加好友'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : searchQuery ? (
                <div className="text-center py-10">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">🔍</div>
                  <p className="font-bold text-slate-400 text-sm">未找到用户</p>
                  <p className="text-xs text-slate-300 mt-1">换个关键词试试</p>
                </div>
              ) : (
                <div className="text-center py-10">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">🌍</div>
                  <p className="font-bold text-slate-400 text-sm">暂无其他用户</p>
                </div>
              )}
            </div>
          </div>
        ) : tab === 'friends' ? (
          friends.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">👥</div>
              <p className="font-bold text-slate-400 text-sm">还没有好友</p>
              <p className="text-xs text-slate-300 mt-1">去广场找人加好友吧</p>
            </div>
          ) : (
            <div className="space-y-2">
              {friends.map(f => (
                <div key={f.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                  <button onClick={() => onViewProfile(f.friend_nickname)} className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-xl shrink-0">{f.avatar}</button>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onViewProfile(f.friend_nickname)}>
                    <p className="text-sm font-bold truncate">{f.friend_nickname}</p>
                    {f.status_text && <p className="text-xs text-orange-400 truncate">{f.status_text}</p>}
                    {!f.status_text && f.bio && <p className="text-xs text-slate-400 truncate">{f.bio}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => onChat?.(f.friend_nickname)}
                      className="p-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors" title="发消息">
                      <MessageCircle size={14} />
                    </button>
                    <button onClick={() => handleDelete(f.friend_nickname)}
                      className="p-2 text-slate-300 hover:text-red-500 transition-colors" title="删除好友">
                      <UserX size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          received.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">📭</div>
              <p className="font-bold text-slate-400 text-sm">没有待处理的申请</p>
            </div>
          ) : (
            <div className="space-y-2">
              {received.map(r => (
                <div key={r.id} className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl">
                  <button onClick={() => onViewProfile(r.from_user)} className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-xl shrink-0">👤</button>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onViewProfile(r.from_user)}>
                    <p className="text-sm font-bold">{r.from_user}</p>
                    <p className="text-xs text-amber-500 flex items-center gap-1"><Clock size={10} />请求加为好友</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => handleRespond(r.from_user, r.to_user, 'accept')}
                      className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600"><Check size={12} /></button>
                    <button onClick={() => handleRespond(r.from_user, r.to_user, 'reject')}
                      className="px-3 py-1.5 bg-slate-200 text-slate-500 rounded-lg text-xs font-bold hover:bg-red-100 hover:text-red-500"><X size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
