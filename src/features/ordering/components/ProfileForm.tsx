import { useState, FormEvent } from 'react';
import { ArrowLeft } from 'lucide-react';
import { updateProfile, changePassword, setIdentity as saveIdentity } from '../../../shared/api';
import { getErrorMessage } from '../../../shared/utils';

interface ProfileFormProps {
  identity: { nickname: string; dorm: string };
  onSave: (nickname: string, dorm: string) => void;
  onClose: () => void;
}

export default function ProfileForm({ identity, onSave, onClose }: ProfileFormProps) {
  const [dorm, setDorm] = useState(identity.dorm);
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSaveInfo = async (e: FormEvent) => {
    e.preventDefault();
    if (!dorm.trim() || !password) { setError('请填写宿舍号和密码'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      await updateProfile(identity.nickname, dorm.trim(), password);
      saveIdentity(identity.nickname, dorm.trim());
      onSave(identity.nickname, dorm.trim());
      setSuccess('信息已更新');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally { setSaving(false); }
  };

  const handleChangePwd = async (e: FormEvent) => {
    e.preventDefault();
    if (!password || !newPassword) { setError('请填写新旧密码'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      await changePassword(identity.nickname, password, newPassword);
      setSuccess('密码已修改');
      setPassword(''); setNewPassword('');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally { setSaving(false); }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 font-sans">
      <nav className="h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3 shadow-sm">
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center bg-slate-100 rounded-full hover:bg-slate-200 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-bold text-lg">个人信息</h1>
      </nav>
      <div className="max-w-md mx-auto p-4 space-y-6">
        {/* Info edit */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="font-bold text-sm mb-4">修改信息</h3>
          <form onSubmit={handleSaveInfo} className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-500 ml-1">昵称</label>
              <input value={identity.nickname} disabled
                className="w-full p-3 bg-slate-100 rounded-xl text-slate-500 text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 ml-1">宿舍号</label>
              <input value={dorm} onChange={e => setDorm(e.target.value)}
                className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-orange-300 text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 ml-1">当前密码（确认身份）</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-orange-300 text-sm mt-1" />
            </div>
            {error && <p className="text-red-500 text-xs font-bold">{error}</p>}
            {success && <p className="text-green-500 text-xs font-bold">{success}</p>}
            <button type="submit" disabled={saving}
              className="w-full py-3 bg-orange-500 text-white rounded-xl font-bold text-sm hover:bg-orange-600 transition-all disabled:opacity-50">
              {saving ? '保存中...' : '保存信息'}
            </button>
          </form>
        </div>

        {/* Password change */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="font-bold text-sm mb-4">修改密码</h3>
          <form onSubmit={handleChangePwd} className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-500 ml-1">原密码</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-orange-300 text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 ml-1">新密码</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-orange-300 text-sm mt-1" />
            </div>
            <button type="submit" disabled={saving}
              className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-slate-700 transition-all disabled:opacity-50">
              {saving ? '保存中...' : '修改密码'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
