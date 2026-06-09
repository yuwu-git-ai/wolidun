import { useState, useEffect } from 'react';
import { ArrowLeft, Bell, Trash2 } from 'lucide-react';
import { fetchNotifications, markNotificationRead } from '../../../shared/api';

interface NotificationPanelProps {
  nickname: string;
  onClose: () => void;
}

export default function NotificationPanel({ nickname, onClose }: NotificationPanelProps) {
  const [notifs, setNotifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications(nickname)
      .then(setNotifs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [nickname]);

  const markRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    } catch { /* ignore */ }
  };

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
        ) : notifs.length === 0 ? (
          <div className="text-center text-slate-400 py-20">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">🔔</div>
            <p className="font-bold">暂无通知</p>
          </div>
        ) : (
          notifs.map(n => (
            <div key={n.id}
              onClick={() => markRead(n.id)}
              className={`bg-white rounded-2xl border p-4 cursor-pointer transition-colors ${n.is_read ? 'border-slate-100' : 'border-orange-200 bg-orange-50/30'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm">{n.title}</h3>
                    {!n.is_read && <span className="w-2 h-2 bg-orange-500 rounded-full shrink-0" />}
                  </div>
                  {n.content && <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap">{n.content}</p>}
                  <p className="text-[10px] text-slate-400 mt-2">{n.created_at}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
