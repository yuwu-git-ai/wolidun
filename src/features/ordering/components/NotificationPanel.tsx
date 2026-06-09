import { useState, useEffect } from 'react';
import { ArrowLeft, Bell, Check, X, Clock, Pin, ChevronDown, ChevronUp } from 'lucide-react';
import { fetchNotifications, markNotificationRead, fetchFriends, respondFriendRequest } from '../../../shared/api';
import { getErrorMessage } from '../../../shared/utils';

interface NotificationPanelProps {
  nickname: string;
  onClose: () => void;
}

export default function NotificationPanel({ nickname, onClose }: NotificationPanelProps) {
  const [notifs, setNotifs] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [friendRequests, setFriendRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetchNotifications(nickname).then(r => ({ notifications: r.notifications || [], announcements: r.announcements || [] })).catch(() => ({ notifications: [], announcements: [] })),
      fetchFriends(nickname).then(d => d.received).catch(() => []),
    ]).then(([ns, frs]) => {
      setNotifs(ns.notifications);
      setAnnouncements(ns.announcements);
      setFriendRequests(frs);
    }).finally(() => setLoading(false));
  }, [nickname]);

  const markRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    } catch { /* ignore */ }
  };

  const handleRespond = async (from: string, to: string, action: 'accept' | 'reject') => {
    setActingId(`${from}-${action}`);
    try {
      await respondFriendRequest(from, to, action);
      setFriendRequests(prev => prev.filter(r => !(r.from_user === from && r.to_user === to)));
    } catch (err) { alert(getErrorMessage(err)); }
    finally { setActingId(null); }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const totalItems = announcements.length + friendRequests.length + notifs.length;

  return (
    <div className="min-h-[100dvh] bg-slate-50 font-sans">
      <nav className="h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3 shadow-sm sticky top-0 z-10">
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center bg-slate-100 rounded-full hover:bg-slate-200 transition-colors shrink-0">
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-bold text-lg">消息通知</h1>
        <Bell size={18} className="ml-auto text-slate-400" />
      </nav>

      <div className="max-w-lg mx-auto p-4 space-y-3 pb-20">
        {loading ? (
          <p className="text-center text-slate-400 py-20 font-bold">加载中...</p>
        ) : totalItems === 0 ? (
          <div className="text-center text-slate-400 py-20">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">🔔</div>
            <p className="font-bold">暂无通知</p>
          </div>
        ) : (
          <>
            {/* Global announcements — pinned at top */}
            {announcements.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-400 px-1 flex items-center gap-1"><Pin size={10} />公告</p>
                {announcements.map(a => {
                  const isExpanded = expandedId === a.id;
                  return (
                    <div key={a.id}
                      className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl border border-indigo-200 p-4 cursor-pointer"
                      onClick={() => toggleExpand(a.id)}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Pin size={12} className="text-indigo-400 shrink-0" />
                            <h3 className="font-bold text-sm text-indigo-800">{a.title}</h3>
                            <span className="text-[10px] px-1.5 py-0.5 bg-indigo-200 text-indigo-600 rounded font-bold">公告</span>
                          </div>
                          {isExpanded && (
                            <>
                              {a.content && <p className="text-xs text-slate-600 mt-2 whitespace-pre-wrap">{a.content}</p>}
                              <p className="text-[10px] text-slate-400 mt-2">{a.created_at}</p>
                            </>
                          )}
                          {!isExpanded && a.content && (
                            <p className="text-xs text-slate-400 mt-1 truncate">{a.content}</p>
                          )}
                        </div>
                        <div className="text-slate-400 shrink-0">
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Friend requests section */}
            {friendRequests.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-400 px-1">好友申请</p>
                {friendRequests.map(r => (
                  <div key={r.id} className="bg-white rounded-2xl border border-amber-200 bg-amber-50/30 p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-lg shrink-0">👤</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold">{r.from_user}</p>
                        <p className="text-xs text-amber-500 flex items-center gap-1"><Clock size={10} />请求加为好友</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => handleRespond(r.from_user, r.to_user, 'accept')}
                          disabled={actingId === `${r.from_user}-accept`}
                          className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600 disabled:opacity-50">
                          <Check size={12} />
                        </button>
                        <button onClick={() => handleRespond(r.from_user, r.to_user, 'reject')}
                          disabled={actingId === `${r.from_user}-reject`}
                          className="px-3 py-1.5 bg-slate-200 text-slate-500 rounded-lg text-xs font-bold hover:bg-red-100 hover:text-red-500 disabled:opacity-50">
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* System notifications */}
            {notifs.length > 0 && (
              <div className="space-y-2">
                {(announcements.length > 0 || friendRequests.length > 0) && <p className="text-xs font-bold text-slate-400 px-1">系统通知</p>}
                {notifs.map(n => {
                  const isExpanded = expandedId === n.id;
                  return (
                    <div key={n.id}
                      onClick={() => { toggleExpand(n.id); if (!n.is_read) markRead(n.id); }}
                      className={`bg-white rounded-2xl border p-4 cursor-pointer transition-colors ${n.is_read ? 'border-slate-100' : 'border-orange-200 bg-orange-50/30'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm">{n.title}</h3>
                            {!n.is_read && <span className="w-2 h-2 bg-orange-500 rounded-full shrink-0" />}
                          </div>
                          {isExpanded ? (
                            <>
                              {n.content && <p className="text-xs text-slate-500 mt-2 whitespace-pre-wrap">{n.content}</p>}
                              <p className="text-[10px] text-slate-400 mt-2">{n.created_at}</p>
                            </>
                          ) : (
                            n.content && <p className="text-xs text-slate-400 mt-1 truncate">{n.content}</p>
                          )}
                        </div>
                        <div className="text-slate-400 shrink-0">
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
