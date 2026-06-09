import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Send, ChevronLeft, MessageCircle, Search } from 'lucide-react';
import { fetchConversations, fetchConversation, sendMessage, fetchUserProfile } from '../../../shared/api';
import type { Conversation, Message, UserProfile } from '../../../shared/api';
import { getErrorMessage } from '../../../shared/utils';

interface Props {
  userId: string;
  initialPartner?: string;
  onClose: () => void;
  onViewProfile: (nickname: string) => void;
}

export default function ChatPanel({ userId, initialPartner, onClose, onViewProfile }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activePartner, setActivePartner] = useState<string | null>(initialPartner || null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [partnerProfile, setPartnerProfile] = useState<UserProfile | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const listEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(() => {
    fetchConversations(userId)
      .then(data => setConversations(data.conversations))
      .catch(() => {});
  }, [userId]);

  const loadMessages = useCallback((partner: string) => {
    fetchConversation(userId, partner).then(data => setMessages(data.messages)).catch(() => {});
    fetchUserProfile(partner).then(p => setPartnerProfile(p)).catch(() => {});
  }, [userId]);

  useEffect(() => { fetchConversations(userId).then(data => setConversations(data.conversations)).catch(() => {}).finally(() => setLoading(false)); }, [userId]);

  useEffect(() => {
    if (activePartner) loadMessages(activePartner);
  }, [activePartner, loadMessages]);

  // Poll for new messages
  useEffect(() => {
    if (!activePartner) return;
    const t = setInterval(() => {
      loadConversations();
      loadMessages(activePartner);
    }, 5000);
    return () => clearInterval(t);
  }, [activePartner, loadConversations, loadMessages]);

  // Scroll to bottom
  useEffect(() => { listEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Auto-open initial partner
  useEffect(() => {
    if (initialPartner) setActivePartner(initialPartner);
  }, [initialPartner]);

  const handleSend = async () => {
    if (!text.trim() || !activePartner) return;
    try {
      await sendMessage(userId, activePartner, text.trim());
      setText('');
      loadMessages(activePartner);
      loadConversations();
    } catch (err) { alert(getErrorMessage(err)); }
  };

  const filtered = conversations.filter(c => c.partner.toLowerCase().includes(searchTerm.toLowerCase()));

  const formatTime = (ts: string) => {
    if (!ts) return '';
    const d = new Date(ts + 'Z');
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md bg-white rounded-t-[28px] sm:rounded-[28px] max-h-[85vh] shadow-2xl flex flex-col overflow-hidden" style={{ height: '80vh' }}>
        {activePartner ? (
          /* Chat window */
          <>
            <div className="flex items-center gap-3 p-4 border-b border-slate-100 shrink-0">
              <button onClick={() => { setActivePartner(null); setMessages([]); }}
                className="text-slate-400 hover:text-slate-600"><ChevronLeft size={20} /></button>
              <button onClick={() => onViewProfile(activePartner)} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-lg shrink-0">
                {partnerProfile?.avatar || '😊'}
              </button>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onViewProfile(activePartner)}>
                <p className="text-sm font-bold truncate">{activePartner}</p>
                {partnerProfile?.status_text && <p className="text-xs text-orange-400 truncate">{partnerProfile.status_text}</p>}
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
              {messages.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-10">发送第一条消息吧</p>
              ) : (
                messages.map(m => {
                  const isMe = m.from_user === userId;
                  return (
                    <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl ${isMe ? 'bg-slate-800 text-white rounded-br-md' : 'bg-white text-slate-700 rounded-bl-md shadow-sm'}`}>
                        <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
                        <p className={`text-[10px] mt-1 ${isMe ? 'text-slate-400' : 'text-slate-400'}`}>{formatTime(m.created_at)}</p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={listEndRef} />
            </div>
            <div className="p-3 border-t border-slate-100 shrink-0 flex gap-2">
              <input value={text} onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
                placeholder="输入消息..." className="flex-1 p-2.5 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-orange-300 text-sm" />
              <button onClick={handleSend} className="px-4 py-2.5 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-colors">
                <Send size={16} />
              </button>
            </div>
          </>
        ) : (
          /* Conversation list */
          <>
            <div className="flex items-center gap-3 p-4 border-b border-slate-100 shrink-0">
              <MessageCircle size={20} className="text-slate-600" />
              <h2 className="font-black text-lg flex-1">消息</h2>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            {/* Search */}
            {conversations.length > 0 && (
              <div className="px-4 pt-3 shrink-0">
                <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                  <Search size={14} className="text-slate-400 shrink-0" />
                  <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    placeholder="搜索对话..." className="flex-1 bg-transparent outline-none text-sm text-slate-600 placeholder-slate-400" />
                  {searchTerm && <button onClick={() => setSearchTerm('')} className="text-slate-400"><X size={14} /></button>}
                </div>
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <p className="text-center text-slate-400 py-10 text-sm">加载中...</p>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">💬</div>
                  <p className="font-bold text-slate-400 text-sm">{searchTerm ? '无匹配对话' : '暂无消息'}</p>
                  <p className="text-xs text-slate-300 mt-1">接单后或加好友后可以聊天</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map(c => (
                    <button key={c.partner}
                      onClick={() => setActivePartner(c.partner)}
                      className="flex items-center gap-3 w-full p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors text-left">
                      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-xl shrink-0">{c.avatar}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold truncate">{c.partner}</span>
                          {c.last_message && <span className="text-[10px] text-slate-400 shrink-0 ml-2">{formatTime(c.last_message.created_at)}</span>}
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-xs text-slate-400 truncate">{c.last_message?.content || ''}</span>
                          {c.unread > 0 && <span className="shrink-0 ml-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold">{c.unread}</span>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
