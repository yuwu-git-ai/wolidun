import { useState, useEffect, useCallback } from 'react';
import { X, Edit3, Save, UserPlus, MessageCircle, Users, MapPin, Copy, Check, UserX, Clock, Trash2 } from 'lucide-react';
import { fetchUserProfile, updateUserProfile, sendFriendRequest, respondFriendRequest, deleteFriend, fetchFriends, deletePost } from '../../../shared/api';
import type { UserProfile } from '../../../shared/api';
import { getErrorMessage } from '../../../shared/utils';

interface Props {
  nickname: string; // target user to view
  myIdentity: { nickname: string; dorm: string };
  onClose: () => void;
  onChat?: (partner: string) => void;
}

export default function ProfilePanel({ nickname, myIdentity, onClose, onChat }: Props) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState('');

  // Edit form
  const [editAvatar, setEditAvatar] = useState('😊');
  const [editBio, setEditBio] = useState('');
  const [editSkills, setEditSkills] = useState('');
  const [editWechat, setEditWechat] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editQq, setEditQq] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editError, setEditError] = useState('');
  const [friendActionLoading, setFriendActionLoading] = useState(false);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);

  const isMe = nickname === myIdentity.nickname;

  const loadProfile = useCallback(() => {
    fetchUserProfile(nickname, myIdentity.nickname)
      .then(p => {
        setProfile(p);
        setEditAvatar(p.avatar);
        setEditBio(p.bio);
        setEditSkills(p.skills.join('、'));
        setEditWechat(p.contact?.wechat || '');
        setEditPhone(p.contact?.phone || '');
        setEditQq(p.contact?.qq || '');
        setEditStatus(p.status_text);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [nickname, myIdentity.nickname]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const handleSave = async () => {
    try {
      const skills = editSkills.split(/[,，、\s]+/).filter(Boolean);
      await updateUserProfile(nickname, {
        avatar: editAvatar,
        bio: editBio,
        skills,
        contact: { wechat: editWechat, phone: editPhone, qq: editQq },
        status_text: editStatus,
      });
      setEditing(false);
      setEditError('');
      loadProfile();
    } catch (err) { setEditError(getErrorMessage(err)); }
  };

  const handleFriendAction = async () => {
    if (!profile) return;
    setFriendActionLoading(true);
    try {
      const f = profile.friendship;
      if (!f) {
        await sendFriendRequest(myIdentity.nickname, nickname);
      } else if (f.status === 'pending' && f.to_user === myIdentity.nickname) {
        // I received a request from this user → accept
        await respondFriendRequest(f.from_user, f.to_user, 'accept');
      } else if (f.status === 'pending' && f.from_user === myIdentity.nickname) {
        // I sent a request → ignore (do nothing for now)
      } else if (f.status === 'accepted') {
        if (!confirm('确定删除好友？')) return;
        await deleteFriend(myIdentity.nickname, nickname);
      }
      loadProfile();
    } catch (err) { alert(getErrorMessage(err)); }
    finally { setFriendActionLoading(false); }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(''), 1500);
    }).catch(() => {});
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('确定删除这条帖子？')) return;
    try {
      await deletePost(postId, myIdentity.nickname);
      loadProfile();
    } catch (err) { alert(getErrorMessage(err)); }
  };

  const getFriendButton = () => {
    if (!profile || isMe) return null;
    const f = profile.friendship;
    if (!f) return { text: '加好友', icon: UserPlus, cls: 'bg-indigo-500 hover:bg-indigo-600 text-white' };
    if (f.status === 'pending' && f.from_user === myIdentity.nickname) return { text: '已申请', icon: Clock, cls: 'bg-slate-200 text-slate-500 cursor-not-allowed' };
    if (f.status === 'pending' && f.to_user === myIdentity.nickname) return { text: '接受申请', icon: UserPlus, cls: 'bg-green-500 hover:bg-green-600 text-white' };
    if (f.status === 'accepted') return { text: '已好友', icon: UserX, cls: 'bg-slate-200 hover:bg-red-100 hover:text-red-500 text-slate-600' };
    return null;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-[28px] p-6"><p className="text-center text-slate-400 py-10">加载中...</p></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-[28px] p-6 text-center">
          <p className="text-slate-400 py-10">用户不存在</p>
          <button onClick={onClose} className="px-4 py-2 bg-slate-100 rounded-xl text-sm font-bold">关闭</button>
        </div>
      </div>
    );
  }

  const friendBtn = getFriendButton();

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md bg-white rounded-[28px] p-6 max-h-[85vh] overflow-y-auto shadow-2xl space-y-4">
        {/* Close */}
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={20} /></button>

        {/* Avatar & Name */}
        <div className="text-center">
          {editing ? (
            <div className="text-center mb-2">
              <p className="text-xs text-slate-400 mb-1">选择头像</p>
              <div className="flex flex-wrap justify-center gap-2">
                {['😊','😎','🤓','🥳','😺','🐱','🐼','🦊','🐨','🐸','🌟','🔥','💪','🎯','🍕','☕','🎮','📚'].map(e => (
                  <button key={e} onClick={() => setEditAvatar(e)}
                    className={`w-10 h-10 text-xl rounded-xl flex items-center justify-center ${editAvatar === e ? 'bg-orange-100 ring-2 ring-orange-400' : 'bg-slate-50 hover:bg-slate-100'}`}>{e}</button>
                ))}
              </div>
            </div>
          ) : (
            <div className="w-20 h-20 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-4xl">{profile.avatar}</div>
          )}
          <h2 className="font-black text-lg mt-2">{profile.nickname}</h2>
          <p className="text-xs text-slate-400 flex items-center justify-center gap-1"><MapPin size={12} />{profile.dorm}</p>
          {profile.status_text && !editing && <p className="text-xs text-orange-500 font-bold mt-1">"{profile.status_text}"</p>}
          {editing && (
            <input value={editStatus} onChange={e => setEditStatus(e.target.value)}
              placeholder="状态（如：有空接单中）" className="mt-2 w-full p-2 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-orange-300 text-xs text-center" />
          )}
        </div>

        {/* Bio */}
        {editing ? (
          <textarea value={editBio} onChange={e => setEditBio(e.target.value)} placeholder="个人简介..."
            rows={2} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-orange-300 text-sm resize-none" />
        ) : (
          profile.bio ? <p className="text-sm text-slate-600 text-center">{profile.bio}</p> : null
        )}

        {/* Skills */}
        {editing ? (
          <input value={editSkills} onChange={e => setEditSkills(e.target.value)}
            placeholder="技能标签（用逗号或空格分隔）" className="w-full p-2 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-orange-300 text-sm" />
        ) : profile.skills.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-1.5">
            {profile.skills.map((s, i) => (
              <span key={i} className="px-2.5 py-1 bg-orange-50 text-orange-600 rounded-lg text-xs font-bold">{s}</span>
            ))}
          </div>
        ) : null}

        {/* Contact */}
        {(editing || profile.contact?.wechat || profile.contact?.phone || profile.contact?.qq) && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-400 text-center">联系方式</p>
            {editing ? (
              <div className="space-y-2">
                <input value={editWechat} onChange={e => setEditWechat(e.target.value)}
                  placeholder="微信号" className="w-full p-2 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-orange-300 text-sm" />
                <input value={editPhone} onChange={e => setEditPhone(e.target.value)}
                  placeholder="手机号" className="w-full p-2 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-orange-300 text-sm" />
                <input value={editQq} onChange={e => setEditQq(e.target.value)}
                  placeholder="QQ号" className="w-full p-2 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-orange-300 text-sm" />
              </div>
            ) : (
              <div className="flex flex-wrap justify-center gap-2">
                {profile.contact?.wechat && (
                  <button onClick={() => handleCopy(profile.contact!.wechat!, '微信')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs font-bold hover:bg-green-100">
                    {copied === '微信' ? <Check size={12} /> : <Copy size={12} />}微信：{profile.contact!.wechat}
                  </button>
                )}
                {profile.contact?.phone && (
                  <button onClick={() => handleCopy(profile.contact!.phone!, '手机')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100">
                    {copied === '手机' ? <Check size={12} /> : <Copy size={12} />}手机：{profile.contact!.phone}
                  </button>
                )}
                {profile.contact?.qq && (
                  <button onClick={() => handleCopy(profile.contact!.qq!, 'QQ')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg text-xs font-bold hover:bg-purple-100">
                    {copied === 'QQ' ? <Check size={12} /> : <Copy size={12} />}QQ：{profile.contact!.qq}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Friend count */}
        <div className="flex items-center justify-center gap-1 text-xs text-slate-400">
          <Users size={12} />{profile.friend_count} 位好友
        </div>

        {/* Error */}
        {editError && <p className="text-red-500 text-xs text-center font-bold">{editError}</p>}

        {/* Action buttons */}
        <div className="flex gap-2 justify-center">
          {isMe ? (
            editing ? (
              <button onClick={handleSave} className="flex items-center gap-1 px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-700"><Save size={14} />保存</button>
            ) : (
              <button onClick={() => setEditing(true)} className="flex items-center gap-1 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200"><Edit3 size={14} />编辑名片</button>
            )
          ) : (
            <>
              {friendBtn && (
                <button onClick={handleFriendAction} disabled={friendActionLoading || friendBtn.text === '已申请'}
                  className={`flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${friendBtn.cls}`}>
                  <friendBtn.icon size={14} />{friendBtn.text}
                </button>
              )}
              <button onClick={() => onChat?.(nickname)}
                className="flex items-center gap-1 px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-700">
                <MessageCircle size={14} />发消息
              </button>
            </>
          )}
          {editing && (
            <button onClick={() => { setEditing(false); setEditError(''); }} className="px-4 py-2 bg-slate-100 text-slate-500 rounded-xl text-sm font-bold">取消</button>
          )}
        </div>

        {/* Posts */}
        <div>
          <p className="text-xs font-bold text-slate-400 mb-2">历史帖子 ({profile.posts?.length || 0})</p>
          {profile.posts && profile.posts.length > 0 ? (
            <div className="space-y-2">
              {profile.posts.map(p => (
                <div key={p.id}>
                  <button onClick={() => setExpandedPost(expandedPost === p.id ? null : p.id)}
                    className="p-3 bg-slate-50 rounded-xl w-full text-left hover:bg-slate-100 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-slate-200 text-slate-500">{p.type}</span>
                      <span className="text-sm font-bold truncate flex-1">{p.title}</span>
                      <span className={`text-[10px] ${p.status === 'done' ? 'text-green-500' : p.status === 'claimed' ? 'text-blue-500' : 'text-slate-400'}`}>
                        {p.status === 'open' ? '进行中' : p.status === 'claimed' ? '已接单' : p.status === 'done' ? '已完成' : ''}
                      </span>
                      {isMe && (
                        <button onClick={(e) => { e.stopPropagation(); handleDeletePost(p.id); }}
                          className="text-slate-300 hover:text-red-500 transition-colors shrink-0" title="删除帖子">
                          <Trash2 size={14} />
                      </button>
                    )}
                    </div>
                  </button>
                  {/* Expanded content */}
                  {expandedPost === p.id && (
                    <div className="mt-1 p-3 bg-white border border-slate-100 rounded-xl text-sm text-slate-600 whitespace-pre-wrap">
                      {p.content || <span className="text-slate-400 italic">无正文内容</span>}
                      <p className="text-[10px] text-slate-400 mt-2">
                        {p.created_at ? new Date(p.created_at + 'Z').toLocaleDateString('zh-CN') : ''}
                        {' · '}{p.likes_count} 赞 · {p.comments_count} 评论
                        {p.price ? ` · ${p.price}` : ''}
                        {p.claimed_by ? ` · 接单人: ${p.claimed_by}` : ''}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-4">暂无帖子</p>
          )}
        </div>
      </div>
    </div>
  );
}
