import { useState, useEffect, FormEvent } from 'react';
import { motion } from 'motion/react';
import { Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import AdminPanel from './AdminPanel';
import { getAdminKey, setAdminKey as saveAdminKey, verifyAdmin } from '../../../shared/api';

export default function AdminGate() {
  const [authorized, setAuthorized] = useState(false);
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const saved = getAdminKey();

  useEffect(() => {
    if (saved) {
      verifyAdmin(saved).then(() => setAuthorized(true)).catch(err => console.warn('Admin verification failed:', err));
    }
  }, [saved]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!key) { setError('请输入管理密钥'); return; }
    setLoading(true);
    try {
      await verifyAdmin(key);
      saveAdminKey(key);
      setAuthorized(true);
    } catch {
      setError('密钥错误');
    } finally {
      setLoading(false);
    }
  };

  if (authorized) {
    return <AdminPanel adminKey={saved || key} />;
  }

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex items-center justify-center px-4 font-sans">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white p-6 sm:p-10 rounded-[28px] sm:rounded-[40px] shadow-xl border border-slate-100">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-indigo-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 mb-4">
            <Settings size={28} />
          </div>
          <h1 className="text-xl sm:text-2xl font-black">管理员后台</h1>
          <p className="text-slate-400 text-sm mt-1">输入管理密钥进入</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-5">
          <input type="password" value={key} onChange={e => setKey(e.target.value)}
            placeholder="管理密钥" autoFocus
            className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent outline-none focus:bg-white focus:border-indigo-200 transition-all" />
          {error && <p className="text-red-500 text-xs font-bold">{error}</p>}
          <button disabled={loading}
            className="w-full py-4 bg-indigo-600 text-white rounded-3xl font-black hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/10 active:scale-[0.98] disabled:opacity-50">
            {loading ? '验证中...' : '进入后台'}
          </button>
          <Link to="/" className="block text-center py-3 bg-slate-100 text-slate-500 rounded-2xl font-bold hover:bg-slate-200 transition-all">
            返回点单页面
          </Link>
        </form>
      </motion.div>
    </div>
  );
}
