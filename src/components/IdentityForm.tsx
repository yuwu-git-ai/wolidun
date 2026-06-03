import { useState, FormEvent } from 'react';
import { motion } from 'motion/react';
import { register, login, setIdentity as saveIdentity } from '../api';
import { getErrorMessage } from '../utils';

interface IdentityFormProps {
  onSave: (nickname: string, dorm: string) => void;
  onSkip: () => void;
}

export default function IdentityForm({ onSave, onSkip }: IdentityFormProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [nickname, setNickname] = useState('');
  const [dorm, setDorm] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const n = nickname.trim();
    const d = dorm.trim();
    const p = password.trim();
    if (!n || !p) { setError('请填写昵称和密码'); return; }
    if (mode === 'register' && !d) { setError('请填写宿舍号'); return; }
    setChecking(true);
    setError('');
    try {
      if (mode === 'register') {
        await register(n, d, p);
      }
      const result = await login(n, p);
      saveIdentity(result.nickname, result.dorm);
      onSave(result.nickname, result.dorm);
    } catch (err) {
      setError(getErrorMessage(err) || '操作失败');
    } finally {
      setChecking(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
    setPassword('');
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex items-center justify-center px-4 font-sans">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white p-6 sm:p-10 rounded-[28px] sm:rounded-[40px] shadow-xl border border-slate-100"
      >
        <div className="flex flex-col items-center mb-6 sm:mb-8">
          <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-orange-500/20 mb-4">
            窝
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">欢迎光临窝里蹲</h1>
          <p className="text-slate-400 text-sm mt-1">{mode === 'login' ? '登录你的账号' : '注册新账号'}</p>
        </div>

        {/* Login/Register tabs */}
        <div className="flex bg-slate-100 rounded-2xl p-1 mb-5">
          <button onClick={() => switchMode()}
            className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${mode === 'login' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}`}>
            登录
          </button>
          <button onClick={() => switchMode()}
            className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${mode === 'register' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}`}>
            注册
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 ml-1">昵称</label>
            <input
              value={nickname}
              onChange={e => { setNickname(e.target.value); setError(''); }}
              placeholder="怎么称呼你？"
              autoFocus
              className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent outline-none focus:bg-white focus:border-orange-200 transition-all mt-1"
            />
          </div>
          {mode === 'register' && (
            <div>
              <label className="text-xs font-bold text-slate-500 ml-1">宿舍号</label>
              <input
                value={dorm}
                onChange={e => setDorm(e.target.value)}
                placeholder="例如：D701"
                className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent outline-none focus:bg-white focus:border-orange-200 transition-all mt-1"
              />
            </div>
          )}
          <div>
            <label className="text-xs font-bold text-slate-500 ml-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder={mode === 'login' ? '输入密码' : '设置密码'}
              className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent outline-none focus:bg-white focus:border-orange-200 transition-all mt-1"
            />
          </div>
          {error && <p className="text-red-500 text-xs font-bold text-center">{error}</p>}
          <button type="submit" disabled={checking}
            className="w-full py-4 bg-orange-500 text-white rounded-3xl font-black hover:bg-orange-600 transition-all shadow-xl shadow-orange-500/20 active:scale-[0.98] disabled:opacity-50">
            {checking ? '验证中...' : mode === 'login' ? '登录' : '注册并登录'}
          </button>
          <button type="button" onClick={onSkip}
            className="w-full py-3 text-slate-400 text-sm font-bold hover:text-slate-600 transition-colors">
            先逛逛
          </button>
        </form>
      </motion.div>
    </div>
  );
}
