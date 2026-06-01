import { useState, useEffect, useMemo, useRef, FormEvent, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShoppingBag, Plus, Minus, Trash2, Copy, Check, Settings,
  ArrowLeft, Flame, Utensils, Pizza, Coffee, IceCream, Package,
  User as UserIcon, Home, ChevronDown, ChevronUp, Bell, Search,
  Edit3, X, LogOut, Clock, Download
} from 'lucide-react';
import { Product, CartItem, Order } from './types';
import { DEFAULT_PRODUCTS, DEFAULT_CATEGORIES } from './constants';
import {
  getIdentity, setIdentity as saveIdentity, clearIdentity,
  getAdminKey, setAdminKey as saveAdminKey,
  fetchProducts, createProduct, updateProduct, deleteProduct,
  createOrder, fetchOrders, fetchOrderById, updateOrderStatus,
  verifyAdmin,
  fetchStats,
  register,
  login,
  updateProfile,
  changePassword
} from './api';

const ICON_MAP: Record<string, any> = { Flame, Utensils, Pizza, Coffee, IceCream, Package };

const STATUS_LABELS: Record<string, string> = {
  pending: '待处理',
  preparing: '备货中',
  delivered: '已送达',
  cancelled: '已取消',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-orange-100 text-orange-700',
  preparing: 'bg-blue-100 text-blue-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-slate-100 text-slate-500',
};

// ── Helpers ──

function getCartKey(item: { id: string; isBrewingSelected?: boolean; isFreezingSelected?: boolean }): string {
  return `${item.id}-${item.isBrewingSelected ? 'b' : ''}-${item.isFreezingSelected ? 'f' : ''}`;
}

function getItemUnitPrice(item: { price: number; isBrewingSelected?: boolean; isFreezingSelected?: boolean }): number {
  return item.price + (item.isBrewingSelected ? 1 : 0) + (item.isFreezingSelected ? 0.5 : 0);
}

// ── Cart Storage ──

function getCartStorageKey(): string {
  const id = getIdentity();
  return id ? `wolidun_cart_${id.nickname}_${id.dorm}` : 'wolidun_cart';
}

function loadCartFromStorage(): CartItem[] {
  try {
    const raw = localStorage.getItem(getCartStorageKey());
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveCartToStorage(items: CartItem[]) {
  try {
    if (items.length > 0) {
      localStorage.setItem(getCartStorageKey(), JSON.stringify(items));
    } else {
      localStorage.removeItem(getCartStorageKey());
    }
  } catch {}
}

// ── Profile Form ──

function ProfileForm({ identity, onSave, onClose }: {
  identity: { nickname: string; dorm: string };
  onSave: (nickname: string, dorm: string) => void;
  onClose: () => void;
}) {
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
    } catch (err: any) {
      setError(err.message);
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
    } catch (err: any) {
      setError(err.message);
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

// ── Identity Form ──

function IdentityForm({ onSave, onSkip }: { onSave: (nickname: string, dorm: string) => void; onSkip: () => void }) {
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
    } catch (err: any) {
      setError(err.message || '操作失败');
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

// ── Product Card ──

function ProductCard({ product, onAdd, quantityInCart, isPopular }: {
  product: Product;
  onAdd: (product: Product, brewing?: boolean, freezing?: boolean) => void;
  quantityInCart: number;
  isPopular?: boolean;
}) {
  const [isBrewing, setIsBrewing] = useState(false);
  const [isFreezing, setIsFreezing] = useState(false);

  useEffect(() => { setIsBrewing(false); setIsFreezing(false); }, [product.id]);

  const availableStock = Math.max(0, (product.stock || 0) - quantityInCart);

  return (
    <div className="bg-white p-2.5 sm:p-4 rounded-[16px] sm:rounded-[32px] shadow-sm border border-slate-100 flex flex-col gap-2 sm:gap-4 group hover:shadow-md transition-all duration-300">
      <div className="aspect-square sm:aspect-video bg-slate-100 rounded-xl sm:rounded-3xl overflow-hidden relative">
        {product.image ? (
          <img src={product.image} alt={product.name} referrerPolicy="no-referrer"
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl sm:text-4xl">🍕</div>
        )}
        <div className="absolute top-2 sm:top-3 left-2 sm:left-3 right-2 sm:right-3 flex justify-between">
          {isPopular && <span className="text-[10px] sm:text-xs">🔥 热门</span>}
          {availableStock > 0 && availableStock <= 10 ? (
            <div className="px-2 py-0.5 bg-orange-500/90 backdrop-blur-md text-white text-[9px] sm:text-[10px] font-bold rounded-full shadow-lg">仅剩 {availableStock} 件</div>
          ) : availableStock <= 0 ? (
            <div className="px-2 py-0.5 bg-slate-500/90 backdrop-blur-md text-white text-[9px] sm:text-[10px] font-bold rounded-full shadow-lg">已售罄</div>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col gap-1.5 sm:gap-2">
        <div className="flex justify-between items-start gap-1">
          <div className="min-w-0">
            <h3 className="font-bold text-xs sm:text-lg leading-tight group-hover:text-orange-600 transition-colors line-clamp-2">{product.name}</h3>
            <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 line-clamp-1">{product.description}</p>
          </div>
          <span className="font-bold text-orange-600 text-base sm:text-xl tracking-tight shrink-0">¥{product.price}</span>
        </div>

        {(product.allowBrewing || product.allowFreezing) && (
          <div className="flex flex-col gap-1.5 mt-1.5 pt-1.5 border-t border-slate-50">
            {product.allowBrewing && (
              <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                <input type="checkbox" checked={isBrewing} onChange={e => setIsBrewing(e.target.checked)}
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-md border-slate-300 text-orange-500 focus:ring-orange-500" />
                <span className="text-[10px] sm:text-xs font-bold text-slate-600">帮泡 (+¥1)</span>
              </label>
            )}
            {product.allowFreezing && (
              <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                <input type="checkbox" checked={isFreezing} onChange={e => setIsFreezing(e.target.checked)}
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-md border-slate-300 text-indigo-500 focus:ring-indigo-500" />
                <span className="text-[10px] sm:text-xs font-bold text-slate-600">冰镇 (+¥0.5)</span>
              </label>
            )}
          </div>
        )}

        <button
          onClick={() => onAdd(product, isBrewing, isFreezing)}
          disabled={availableStock <= 0}
          className="w-full min-h-10 bg-orange-500 text-white py-2.5 sm:py-3 rounded-xl sm:rounded-2xl font-bold text-[11px] sm:text-base hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20 active:scale-[0.98] mt-1 sm:mt-2 flex items-center justify-center gap-1 sm:gap-2 disabled:bg-slate-200 disabled:shadow-none disabled:text-slate-400"
        >
          {availableStock > 0 ? <><Plus size={16} /> 加入购物车</> : '暂时缺货'}
        </button>
      </div>
    </div>
  );
}

// ── Order Tracker ──

function OrderTracker({ onClose }: { onClose: () => void }) {
  const [orderId, setOrderId] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLookup = async (e: FormEvent) => {
    e.preventDefault();
    const id = orderId.trim();
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const result = await fetchOrderById(id);
      setOrder(result);
    } catch (err: any) {
      setError(err.message || '找不到该订单');
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 font-sans">
      <nav className="h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3 shadow-sm">
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center bg-slate-100 rounded-full hover:bg-slate-200 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-bold text-lg">订单追踪</h1>
      </nav>
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <form onSubmit={handleLookup} className="flex gap-2">
          <input
            value={orderId}
            onChange={e => setOrderId(e.target.value)}
            placeholder="输入订单号"
            autoFocus
            className="flex-1 p-4 bg-white rounded-2xl border border-slate-200 outline-none focus:border-orange-300 transition-colors"
          />
          <button disabled={loading} className="px-6 py-4 bg-orange-500 text-white rounded-2xl font-bold hover:bg-orange-600 transition-all disabled:opacity-50">
            {loading ? '查询中' : <Search size={20} />}
          </button>
        </form>
        {error && <p className="text-red-500 text-sm font-bold text-center">{error}</p>}
        {order && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg">订单详情</h3>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[order.status]}`}>
                {STATUS_LABELS[order.status] || order.status}
              </span>
            </div>
            <p className="text-xs text-slate-400">订单号：{order.id}</p>
            <div className="space-y-2">
              {order.items.map((item: any, i: number) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>{item.name} x{item.quantity}</span>
                  <span className="font-bold">¥{(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 pt-3 flex justify-between font-bold">
              <span>总计</span>
              <span className="text-orange-600">¥{order.totalPrice.toFixed(2)}</span>
            </div>
            <p className="text-xs text-slate-400">
              下单时间：{new Date(order.createdAt).toLocaleString('zh-CN')}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ── Order History ──

function OrderHistory({ identity, onClose, onReorder }: {
  identity: { nickname: string; dorm: string };
  onClose: () => void;
  onReorder: (items: CartItem[]) => void;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [changedIds, setChangedIds] = useState<Set<string>>(new Set());

  // Initial load
  useEffect(() => {
    fetchOrders({ nickname: identity.nickname, dorm: identity.dorm })
      .then(setOrders)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [identity]);

  // Auto-refresh every 10s, detect status changes
  useEffect(() => {
    const t = setInterval(() => {
      fetchOrders({ nickname: identity.nickname, dorm: identity.dorm })
        .then(newOrders => {
          setOrders(prev => {
            const prevMap = new Map(prev.map(o => [o.id, o.status]));
            const changed = new Set<string>();
            for (const o of newOrders) {
              if (prevMap.has(o.id) && prevMap.get(o.id) !== o.status) {
                changed.add(o.id);
              }
            }
            if (changed.size > 0) {
              setChangedIds(changed);
              setTimeout(() => setChangedIds(new Set()), 5000);
            }
            return newOrders;
          });
        })
        .catch(() => {});
    }, 10000);
    return () => clearInterval(t);
  }, [identity]);

  return (
    <div className="min-h-[100dvh] bg-slate-50 font-sans">
      <nav className="h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3 shadow-sm">
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center bg-slate-100 rounded-full hover:bg-slate-200 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-bold text-lg">我的订单</h1>
        {!loading && <span className="text-xs text-slate-400 ml-auto">{orders.length} 单</span>}
      </nav>
      <div className="max-w-lg mx-auto p-4 space-y-3 pb-20">
        {loading ? (
          <div className="text-center text-slate-400 py-20">
            <p className="font-bold">加载中...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center text-slate-400 py-20">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">📋</div>
            <p className="font-bold">暂无订单</p>
            <p className="text-xs mt-1">下单后在这里查看订单状态</p>
          </div>
        ) : (
          orders.map(order => (
            <div key={order.id} className={`bg-white rounded-2xl border transition-all ${changedIds.has(order.id) ? 'ring-2 ring-orange-400 shadow-lg' : ''} ${order.status === 'pending' ? 'border-orange-200' : 'border-slate-100'}`}>
              <div className="p-4 cursor-pointer" onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[order.status]}`}>
                      {STATUS_LABELS[order.status]}
                    </span>
                    <span className="text-xs text-slate-400">{order.isDelivery ? '配送' : '自提'}</span>
                  </div>
                  <span className="font-bold text-orange-600">¥{order.totalPrice.toFixed(2)}</span>
                </div>
                <p className="text-sm text-slate-600 truncate">
                  {order.items.map((i: any) => `${i.name}x${i.quantity}`).join('、')}
                </p>
                <div className="flex items-center gap-1 mt-1.5 text-[10px] text-slate-400">
                  <Clock size={10} />
                  {new Date(order.createdAt).toLocaleString('zh-CN')}
                </div>
              </div>
              {expandedId === order.id && (
                <div className="px-4 pb-4 border-t border-slate-50 pt-3 space-y-2">
                  <p className="text-xs text-slate-400">订单号：{order.id}</p>
                  {order.items.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span>{item.name} x{item.quantity}</span>
                      <span className="font-bold">¥{(getItemUnitPrice(item) * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold text-sm pt-2 border-t border-slate-50">
                    <span>总计</span>
                    <span className="text-orange-600">¥{order.totalPrice.toFixed(2)}</span>
                  </div>
                  <button
                    onClick={() => onReorder(order.items)}
                    className="w-full py-2.5 mt-2 bg-orange-500 text-white rounded-xl font-bold text-sm hover:bg-orange-600 transition-all active:scale-[0.98]">
                    再来一单
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Customer App ──

function CustomerApp() {
  const [identity, setIdentityState] = useState(getIdentity());
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>(loadCartFromStorage);
  const [activeCategory, setActiveCategory] = useState('1');
  const [copied, setCopied] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showIdentityForm, setShowIdentityForm] = useState(!getIdentity());
  const [showOrderTracker, setShowOrderTracker] = useState(false);
  const [showOrderHistory, setShowOrderHistory] = useState(false);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [isDelivery, setIsDelivery] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [popularIds, setPopularIds] = useState<Set<string>>(new Set());

  // Load products
  const loadProducts = useCallback(() => {
    fetchProducts()
      .then(setProducts)
      .catch(() => setProducts(DEFAULT_PRODUCTS.map(p => ({ ...p, stock: p.stock || 999 }))));
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  // Load popular products
  useEffect(() => {
    fetchStats().then(s => setPopularIds(new Set(s.popular.map(p => p.id)))).catch(() => {});
  }, []);

  // Persist cart to localStorage
  useEffect(() => {
    saveCartToStorage(cart);
  }, [cart]);

  // Auto-refresh stock every 30s
  useEffect(() => {
    const t = setInterval(() => {
      fetchProducts().then(setProducts).catch(() => {});
    }, 30000);
    return () => clearInterval(t);
  }, []);

  const handleSaveIdentity = (nickname: string, dorm: string) => {
    setIdentityState({ nickname, dorm });
    setShowIdentityForm(false);
    // Load cart for the new identity
    setCart(loadCartFromStorage());
  };

  const handleLogout = () => {
    clearIdentity();
    setIdentityState(null);
    setCart([]);
    setShowIdentityForm(true);
  };

  const addToCart = (product: Product, isBrewing?: boolean, isFreezing?: boolean) => {
    setCart(prev => {
      const key = getCartKey({ id: product.id, isBrewingSelected: isBrewing, isFreezingSelected: isFreezing });
      const existing = prev.find(item => getCartKey(item) === key);
      if (existing) {
        return prev.map(item =>
          getCartKey(item) === key
            ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1, isBrewingSelected: isBrewing, isFreezingSelected: isFreezing }];
    });
  };

  const removeFromCart = (item: CartItem) => {
    setCart(prev => {
      const key = getCartKey(item);
      const existing = prev.find(i => getCartKey(i) === key);
      if (existing && existing.quantity > 1) {
        return prev.map(i =>
          getCartKey(i) === key
            ? { ...i, quantity: i.quantity - 1 } : i
        );
      }
      return prev.filter(i => getCartKey(i) !== key);
    });
  };

  const clearCart = () => setCart([]);

  const handleReorder = (items: CartItem[]) => {
    setCart(prev => {
      const merged = [...prev];
      for (const item of items) {
        const key = getCartKey(item);
        const existing = merged.find(i => getCartKey(i) === key);
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          merged.push({ ...item });
        }
      }
      return merged;
    });
    setShowOrderHistory(false);
  };

  const updateCartNote = (item: CartItem, note: string) => {
    setCart(prev => prev.map(i =>
      getCartKey(i) === getCartKey(item) ? { ...i, note: note || undefined } : i
    ));
  };

  const sortedCart = useMemo(() =>
    [...cart].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')),
    [cart]
  );

  const itemsTotal = useMemo(() =>
    sortedCart.reduce((sum, item) => {
      let p = item.price;
      if (item.isBrewingSelected) p += 1;
      if (item.isFreezingSelected) p += 0.5;
      return sum + p * item.quantity;
    }, 0),
    [sortedCart]
  );

  const deliveryFee = isDelivery && itemsTotal < 20 ? 1 : 0;
  const totalPrice = itemsTotal + deliveryFee;

  // Robust clipboard copy — works in WeChat browser, HTTP, and HTTPS
  const copyToClipboard = (text: string): boolean => {
    // Try modern API first
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).catch(() => {});
      return true;
    }
    // Fallback for WeChat / HTTP / older browsers
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) {}
    document.body.removeChild(ta);
    return ok;
  };

  const confirmAndCopy = async () => {
    if (cart.length === 0 || !identity) return;
    try {
      const result = await createOrder({
        nickname: identity.nickname,
        dorm: identity.dorm,
        isDelivery,
        items: sortedCart.map(item => ({
          id: item.id, name: item.name, price: item.price,
          quantity: item.quantity,
          isBrewingSelected: item.isBrewingSelected,
          isFreezingSelected: item.isFreezingSelected,
        })),
      });

      const orderLines = sortedCart.map(item => {
        const svc: string[] = [];
        if (item.isBrewingSelected) svc.push('帮泡+¥1');
        if (item.isFreezingSelected) svc.push('冰镇+¥0.5');
        const svcStr = svc.length > 0 ? ` [${svc.join(', ')}]` : '';
        const noteStr = item.note ? ` (${item.note})` : '';
        const up = getItemUnitPrice(item);
        return `${item.name}${svcStr}${noteStr} x${item.quantity} - ¥${(up * item.quantity).toFixed(2)}`;
      });
      const dInfo = isDelivery
        ? `配送: 送到 ${identity.dorm} (${deliveryFee === 0 ? '免配送费' : '¥1.00'})`
        : '取餐方式: 自提';
      const text = `--- 窝里蹲点单 ---\n下单人: ${identity.nickname}\n${dInfo}\n---\n${orderLines.join('\n')}${isDelivery ? `\n配送费: ¥${deliveryFee.toFixed(2)}` : ''}\n---\n总计: ¥${totalPrice.toFixed(2)}\n订单号: ${result.id}`;

      copyToClipboard(text);
      loadProducts();
      setCopied(true);
      setShowConfirm(false);
      setCart([]);
      setTimeout(() => setCopied(false), 2000);
    } catch (err: any) {
      alert(err.message || '下单失败');
    }
  };

  const filteredProducts = useMemo(() => {
    const list = searchQuery
      ? products.filter(p =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.description.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : products.filter(p => p.category === activeCategory);
    return list.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  }, [products, activeCategory, searchQuery]);

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  // Profile editor
  if (showProfileForm && identity) {
    return (
      <ProfileForm
        identity={identity}
        onSave={(nickname, dorm) => { setIdentityState({ nickname, dorm }); setShowProfileForm(false); }}
        onClose={() => setShowProfileForm(false)}
      />
    );
  }

  // Order history
  if (showOrderHistory && identity) {
    return <OrderHistory identity={identity} onClose={() => setShowOrderHistory(false)} onReorder={handleReorder} />;
  }

  // Order tracker modal
  if (showOrderTracker) {
    return <OrderTracker onClose={() => setShowOrderTracker(false)} />;
  }

  return (
    <div className="app-viewport flex flex-col bg-slate-50 text-slate-800 font-sans overflow-hidden h-[100dvh] relative">
      {/* Identity form overlay */}
      {showIdentityForm && (
        <div className="absolute inset-0 z-50">
          <IdentityForm onSave={handleSaveIdentity} onSkip={() => setShowIdentityForm(false)} />
        </div>
      )}

      {/* Header */}
      <nav className="h-14 sm:h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-6 shrink-0 shadow-sm relative z-10">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 select-none">
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white font-bold text-lg sm:text-xl shrink-0">窝</div>
          <h1 className="min-w-0 truncate text-base sm:text-xl font-bold tracking-tight">窝里蹲点单</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {identity && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-100 rounded-full">
              <div className="w-5 h-5 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
                <UserIcon size={10} />
              </div>
              <span className="text-[10px] font-bold text-slate-600 truncate max-w-[60px]">{identity.nickname}</span>
            </div>
          )}
          {identity ? (<>
            <button onClick={() => setShowOrderHistory(true)}
              className="w-9 h-9 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-full border border-slate-200 transition-colors"
              title="我的订单">
              <Clock size={16} />
            </button>
            <button onClick={() => setShowOrderTracker(true)}
              className="w-9 h-9 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-full border border-slate-200 transition-colors"
              title="查订单">
              <Search size={16} />
            </button>
            <button onClick={() => { setShowProfileForm(true); }}
              className="w-9 h-9 flex items-center justify-center bg-slate-100 hover:bg-red-50 hover:text-red-500 rounded-full border border-slate-200 transition-colors"
              title="个人信息">
              <Edit3 size={14} />
            </button>
            <button onClick={handleLogout}
              className="w-9 h-9 flex items-center justify-center bg-slate-100 hover:bg-red-50 hover:text-red-500 rounded-full border border-slate-200 transition-colors"
              title="退出登录">
              <LogOut size={14} />
            </button>
          </>) : (
            <button onClick={() => setShowIdentityForm(true)}
              className="px-4 py-2 bg-orange-500 text-white rounded-full font-bold text-sm hover:bg-orange-600 transition-all">
              登录
            </button>
          )}
        </div>
      </nav>

      {/* Mobile category bar — outside scroll, always visible below header */}
      <div className="flex md:hidden gap-2 overflow-x-auto px-3 py-2.5 bg-white border-b border-slate-100 shrink-0">
        {DEFAULT_CATEGORIES.map(cat => {
          const Icon = ICON_MAP[cat.icon] || Package;
          const active = activeCategory === cat.id;
          return (
            <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full whitespace-nowrap text-xs font-bold transition-all shrink-0 ${active ? 'bg-orange-500 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200'}`}>
              <Icon size={14} />{cat.name}
            </button>
          );
        })}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar categories */}
        <aside className="w-24 bg-white border-r border-slate-200 hidden md:flex flex-col py-6 shrink-0 overflow-y-auto">
          <div className="flex flex-col items-center gap-8">
            {DEFAULT_CATEGORIES.map(cat => {
              const Icon = ICON_MAP[cat.icon] || Package;
              const active = activeCategory === cat.id;
              return (
                <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                  className={`flex flex-col items-center gap-1 group transition-all ${active ? 'opacity-100' : 'opacity-40 hover:opacity-70'}`}>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform ${active ? 'bg-orange-100 text-orange-600 shadow-sm' : 'bg-slate-100 text-slate-600'}`}>
                    <Icon size={24} />
                  </div>
                  <span className={`text-xs font-bold ${active ? 'text-orange-600' : 'text-slate-600'}`}>{cat.name}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Search + Main content (aligned with sidebar on desktop) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search bar — fixed, aligned with content */}
          <div className="px-3 sm:px-6 py-2.5 bg-white border-b border-slate-100 shrink-0">
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setActiveCategory(DEFAULT_CATEGORIES[0].id); }}
                placeholder="搜索商品..."
                className="w-full pl-11 pr-4 py-2.5 bg-slate-50 rounded-2xl border border-slate-100 outline-none focus:bg-white focus:border-orange-300 transition-all text-sm"
              />
            </div>
          </div>

          {/* Main content */}
          <main className="flex-1 p-3 sm:p-6 overflow-y-auto flex flex-col gap-3 sm:gap-6 pb-28 lg:pb-6">

          {searchQuery ? (
            <div className="flex items-center justify-between">
              <h2 className="text-xl sm:text-2xl font-bold">搜索"{searchQuery}"</h2>
              <button onClick={() => setSearchQuery('')} className="text-xs text-orange-500 font-bold">清除</button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
              <h2 className="text-xl sm:text-2xl font-bold">
                {DEFAULT_CATEGORIES.find(c => c.id === activeCategory)?.name}
              </h2>
              <div className="self-start text-xs sm:text-sm text-slate-500 bg-white px-3 sm:px-4 py-1.5 rounded-full border border-slate-200 shadow-sm">
                共 {filteredProducts.length} 款
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-6 pb-36 lg:pb-0">
            <AnimatePresence mode="popLayout">
              {filteredProducts.map(product => {
                const qty = cart.filter(item => item.id === product.id).reduce((s, i) => s + i.quantity, 0);
                return (
                  <motion.div layout key={product.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <ProductCard product={product} onAdd={addToCart} quantityInCart={qty} isPopular={popularIds.has(product.id)} />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          <div className="hidden lg:flex mt-4 sm:mt-6 p-4 sm:p-6 bg-gradient-to-br from-orange-500 via-orange-600 to-rose-500 rounded-[24px] sm:rounded-[32px] text-white items-center justify-between shadow-xl shadow-orange-500/20 mb-4 sm:mb-0">
            <div>
              <p className="text-[11px] sm:text-sm font-bold opacity-90 tracking-wide">今日特惠</p>
              <p className="font-black text-base sm:text-2xl mt-0.5">满 ¥20 免配送费</p>
              <p className="text-[10px] sm:text-xs opacity-70 mt-1 hidden sm:block">下单满 20 元，配送到寝不收配送费</p>
            </div>
            <div className="bg-white/25 px-4 sm:px-6 py-2 sm:py-3 rounded-full text-[11px] sm:text-sm font-black backdrop-blur-md shrink-0 ml-2 border border-white/20">
              即刻下单
            </div>
          </div>
        </main>
        </div>

        {/* Desktop cart sidebar */}
        <aside className="w-80 bg-white border-l border-slate-200 hidden lg:flex flex-col shrink-0 shadow-xl">
          <CartPanel
            cart={sortedCart} products={products}
            identity={identity} isDelivery={isDelivery} setIsDelivery={setIsDelivery}
            itemsTotal={itemsTotal} deliveryFee={deliveryFee} totalPrice={totalPrice}
            onRemove={removeFromCart} onAdd={(item) => addToCart(item, item.isBrewingSelected, item.isFreezingSelected)}
            onClear={clearCart} onConfirm={() => setShowConfirm(true)}
            onUpdateNote={updateCartNote}
          />
        </aside>
      </div>

      {/* Mobile bottom: promo + cart bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-20">
        <div className="bg-gradient-to-br from-orange-500 via-orange-600 to-rose-500 text-white px-4 py-2 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold opacity-90 tracking-wide">今日特惠</p>
            <p className="font-black text-sm">满 ¥20 免配送费</p>
          </div>
          <div className="bg-white/25 px-3 py-1 rounded-full text-[10px] font-black backdrop-blur-md shrink-0 ml-2 border border-white/20">
            即刻下单
          </div>
        </div>
        <div className="bg-white/80 backdrop-blur-xl border-t border-slate-200 px-4 py-3 flex items-center justify-between shadow-2xl">
          <button onClick={() => setIsMobileCartOpen(true)}
            className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2.5 rounded-2xl font-bold shadow-lg shadow-orange-500/20 active:scale-[0.98]">
            <ShoppingBag size={18} />
            <span className="text-sm">{cartCount} 件</span>
          </button>
          <div className="text-right">
            <p className="text-[10px] text-slate-400">合计</p>
            <p className="font-black text-lg text-orange-600">¥{totalPrice.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Mobile cart bottom sheet */}
      <AnimatePresence>
        {isMobileCartOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
            onClick={(e) => { if (e.target === e.currentTarget) setIsMobileCartOpen(false); }}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 max-h-[80vh] bg-white rounded-t-[28px] overflow-hidden flex flex-col shadow-2xl">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-lg">购物车</h3>
                <button onClick={() => setIsMobileCartOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <CartPanel
                  cart={sortedCart} products={products}
                  identity={identity} isDelivery={isDelivery} setIsDelivery={setIsDelivery}
                  itemsTotal={itemsTotal} deliveryFee={deliveryFee} totalPrice={totalPrice}
                  onRemove={removeFromCart} onAdd={(item) => addToCart(item, item.isBrewingSelected, item.isFreezingSelected)}
                  onClear={clearCart} onConfirm={() => { setIsMobileCartOpen(false); setShowConfirm(true); }}
                  onUpdateNote={updateCartNote}
                  compact
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Order confirmation modal */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setShowConfirm(false); }}>
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
              className="w-full max-w-md bg-white rounded-t-[28px] sm:rounded-[28px] p-6 max-h-[80vh] overflow-y-auto shadow-2xl">
              <h3 className="font-black text-xl mb-4">确认订单</h3>
              <div className="space-y-3">
                {sortedCart.map((item, i) => {
                  const up = getItemUnitPrice(item);
                  return (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="truncate">{item.name} x{item.quantity}</span>
                      <span className="font-bold ml-2">¥{(up * item.quantity).toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                <div className="flex justify-between text-sm"><span>小计</span><span>¥{itemsTotal.toFixed(2)}</span></div>
                {isDelivery && <div className="flex justify-between text-sm"><span>配送费</span><span className={deliveryFee === 0 ? 'text-green-600' : ''}>{deliveryFee === 0 ? '免配送费' : `¥${deliveryFee.toFixed(2)}`}</span></div>}
                <div className="flex justify-between font-black text-lg"><span>总计</span><span className="text-orange-600">¥{totalPrice.toFixed(2)}</span></div>
              </div>
              <label className="flex items-center gap-2 mt-3 cursor-pointer">
                <input type="checkbox" checked={isDelivery} onChange={e => setIsDelivery(e.target.checked)}
                  className="w-4 h-4 rounded-md border-slate-300 text-orange-500" />
                <span className="text-sm font-bold">配送到寝（满¥20免配送费，否则¥1）</span>
              </label>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowConfirm(false)}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all">返回</button>
                <button onClick={confirmAndCopy}
                  className="flex-1 py-4 bg-orange-500 text-white rounded-2xl font-black hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20 active:scale-[0.98]">
                  确认下单并复制
                </button>
              </div>
              <p className="text-[10px] text-slate-400 text-center mt-3">下单后自动复制订单内容，可粘贴到微信群</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Copied toast */}
      <AnimatePresence>
        {copied && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white px-5 py-3 rounded-2xl font-bold shadow-xl flex items-center gap-2">
            <Check size={16} /> 已复制！发到微信群吧
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Cart Panel (shared between desktop sidebar and mobile sheet) ──

function CartPanel({ cart, products, identity, isDelivery, setIsDelivery, itemsTotal, deliveryFee, totalPrice, onRemove, onAdd, onClear, onConfirm, onUpdateNote, compact }: {
  cart: CartItem[];
  products: Product[];
  identity: { nickname: string; dorm: string } | null;
  isDelivery: boolean;
  setIsDelivery: (v: boolean) => void;
  itemsTotal: number;
  deliveryFee: number;
  totalPrice: number;
  onRemove: (item: CartItem) => void;
  onAdd: (item: CartItem) => void;
  onClear: () => void;
  onConfirm: () => void;
  onUpdateNote: (item: CartItem, note: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col h-full ${compact ? '' : ''}`}>
      <div className={`${compact ? 'p-4' : 'p-6'} border-b border-slate-100 flex items-center justify-between`}>
        <h2 className="font-bold text-xl flex items-center gap-2">
          购物车
          <span className="text-xs font-normal text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
            {cart.reduce((s, i) => s + i.quantity, 0)} 件
          </span>
        </h2>
        {cart.length > 0 && (
          <button onClick={onClear} className="text-slate-400 text-sm hover:text-red-500 transition-colors p-1">
            <Trash2 size={18} />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence initial={false}>
          {cart.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-3xl">🛒</div>
              <p className="text-sm font-medium">购物车是空的</p>
            </motion.div>
          ) : (
            cart.map(item => (
              <motion.div key={getCartKey(item)}
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="w-14 h-14 bg-white rounded-xl overflow-hidden shrink-0 shadow-sm border border-slate-200">
                  <img src={item.image} referrerPolicy="no-referrer" alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between font-bold text-sm mb-1">
                    <span className="truncate">{item.name}</span>
                    <span className="ml-2">¥{(getItemUnitPrice(item) * item.quantity).toFixed(2)}</span>
                  </div>
                  {(item.isBrewingSelected || item.isFreezingSelected) && (
                    <div className="flex gap-2 mb-1">
                      {item.isBrewingSelected && <span className="text-[8px] bg-orange-100 text-orange-600 px-1 py-0.5 rounded font-black">帮泡+¥1</span>}
                      {item.isFreezingSelected && <span className="text-[8px] bg-indigo-100 text-indigo-600 px-1 py-0.5 rounded font-black">冰镇+¥0.5</span>}
                    </div>
                  )}
                  <input
                    value={item.note || ''}
                    onChange={e => onUpdateNote(item, e.target.value)}
                    placeholder="备注（选填）"
                    className="w-full text-[10px] px-2 py-1 mb-1.5 bg-white rounded-md border border-slate-200 outline-none focus:border-orange-300 placeholder:text-slate-300"
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-400 font-medium px-2 py-0.5 bg-white rounded-md border border-slate-200">x{item.quantity}</span>
                    <div className="flex gap-1.5">
                      <button onClick={() => onRemove(item)}
                        className="w-7 h-7 border border-slate-200 bg-white hover:bg-slate-100 rounded-lg flex items-center justify-center transition-colors">
                        <Minus size={12} />
                      </button>
                      <button onClick={() => {
                        const p = products.find(p => p.id === item.id);
                        const totalInCart = cart.filter(c => c.id === item.id).reduce((s, i) => s + i.quantity, 0);
                        if (!p || (p.stock || 0) > totalInCart) onAdd(item);
                      }}
                        className="w-7 h-7 bg-slate-800 text-white hover:bg-slate-700 rounded-lg flex items-center justify-center transition-colors disabled:bg-slate-200 disabled:text-slate-400"
                        disabled={(() => {
                          const p = products.find(p => p.id === item.id);
                          const totalInCart = cart.filter(c => c.id === item.id).reduce((s, i) => s + i.quantity, 0);
                          return !p || (p.stock || 0) <= totalInCart;
                        })()}>
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
      {cart.length > 0 && (
        <div className={`${compact ? 'p-4' : 'p-6'} border-t border-slate-100 space-y-3`}>
          <div className="flex justify-between text-sm"><span>小计</span><span>¥{itemsTotal.toFixed(2)}</span></div>
          {isDelivery && <div className="flex justify-between text-sm"><span>配送费</span><span className={deliveryFee === 0 ? 'text-green-600' : ''}>{deliveryFee === 0 ? '免' : `¥${deliveryFee.toFixed(2)}`}</span></div>}
          <div className="flex justify-between font-black text-lg"><span>总计</span><span className="text-orange-600">¥{totalPrice.toFixed(2)}</span></div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isDelivery} onChange={e => setIsDelivery(e.target.checked)}
              className="w-4 h-4 rounded-md border-slate-300 text-orange-500" />
            <span className="text-xs font-bold">配送到寝（满¥20免¥1配送费）</span>
          </label>
          {!identity && <p className="text-xs text-red-500 font-bold">请先填写身份信息</p>}
          <button onClick={onConfirm} disabled={!identity}
            className="w-full py-4 bg-orange-500 text-white rounded-2xl font-black hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20 active:scale-[0.98] disabled:bg-slate-200 disabled:shadow-none disabled:text-slate-400">
            确认下单
          </button>
        </div>
      )}
    </div>
  );
}

// ── Analytics Panel ──

type ChartData = { label: string; orders: number; revenue: number };

function BarChart({ data }: { data: ChartData[] }) {
  if (data.length === 0) return <p className="text-center text-slate-400 py-10">暂无数据</p>;

  const W = Math.max(500, data.length * 32);
  const H = 220;
  const PAD = { top: 24, right: 52, bottom: 36, left: 44 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const maxOrders = Math.max(...data.map(d => d.orders), 1);
  const maxRevenue = Math.max(...data.map(d => d.revenue), 1);
  const yMaxOrders = Math.ceil(maxOrders / 5) * 5 || 5;
  const yMaxRevenue = Math.ceil(maxRevenue / 5) * 5 || 5;

  const scaleYOrders = (v: number) => PAD.top + innerH - (v / yMaxOrders) * innerH;
  const scaleYRevenue = (v: number) => PAD.top + innerH - (v / yMaxRevenue) * innerH;

  const barGroupW = innerW / data.length;
  const gap = barGroupW * 0.3;
  const barW = (barGroupW - gap * 3) / 2;
  const yTicks = 5;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ maxHeight: '280px' }}>
      {/* Grid lines */}
      {Array.from({ length: yTicks + 1 }, (_, i) => (
        <line key={`g${i}`}
          x1={PAD.left} x2={W - PAD.right}
          y1={PAD.top + (innerH / yTicks) * i} y2={PAD.top + (innerH / yTicks) * i}
          stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4,3" />
      ))}
      {/* X axis */}
      <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} stroke="#e2e8f0" strokeWidth="1" />

      {/* Bars */}
      {data.map((d, i) => {
        const gx = PAD.left + barGroupW * i;
        const ox = gx + gap;
        const rx = ox + barW + gap;
        const oh = Math.max(1, (d.orders / yMaxOrders) * innerH);
        const rh = Math.max(1, (d.revenue / yMaxRevenue) * innerH);
        return (
          <g key={i}>
            <rect x={ox} y={PAD.top + innerH - oh} width={barW} height={oh} rx="2" fill="#6366f1" opacity="0.75">
              <title>{d.label} 订单: {d.orders} 单</title>
            </rect>
            <rect x={rx} y={PAD.top + innerH - rh} width={barW} height={rh} rx="2" fill="#f59e0b" opacity="0.75">
              <title>{d.label} 营收: ¥{d.revenue.toFixed(2)}</title>
            </rect>
          </g>
        );
      })}

      {/* X labels */}
      {data.map((d, i) => {
        const interval = data.length <= 7 ? 1 : data.length <= 15 ? 2 : data.length <= 31 ? 5 : Math.ceil(data.length / 12);
        const show = i % interval === 0 || i === data.length - 1;
        if (!show) return null;
        const gx = PAD.left + barGroupW * i + barGroupW / 2;
        return <text key={`xl${i}`} x={gx} y={H - 4} textAnchor="middle" fontSize="10" fill="#94a3b8" fontFamily="system-ui">{d.label}</text>;
      })}

      {/* Y labels - orders (left) */}
      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const v = Math.round((yMaxOrders / yTicks) * i);
        return <text key={`yl${i}`} x={PAD.left - 6} y={scaleYOrders(v) + 3} textAnchor="end" fontSize="10" fill="#94a3b8" fontFamily="system-ui">{v}</text>;
      })}
      {/* Y labels - revenue (right) */}
      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const v = Math.round((yMaxRevenue / yTicks) * i);
        return <text key={`yr${i}`} x={W - PAD.right + 6} y={scaleYRevenue(v) + 3} textAnchor="start" fontSize="10" fill="#94a3b8" fontFamily="system-ui">¥{v}</text>;
      })}

      {/* Legend */}
      <g transform={`translate(${PAD.left}, 6)`}>
        <rect x="0" y="0" width="10" height="10" rx="2" fill="#6366f1" opacity="0.75" />
        <text x="14" y="9" fontSize="11" fill="#64748b" fontWeight="600" fontFamily="system-ui">订单</text>
        <rect x="44" y="0" width="10" height="10" rx="2" fill="#f59e0b" opacity="0.75" />
        <text x="58" y="9" fontSize="11" fill="#64748b" fontWeight="600" fontFamily="system-ui">营收</text>
      </g>
    </svg>
  );
}

function AnalyticsPanel({ onClose }: { onClose: () => void }) {
  const now = new Date();
  const [mode, setMode] = useState<'monthly' | 'yearly'>('monthly');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const params = mode === 'monthly'
      ? { view: 'monthly' as const, year, month }
      : { view: 'yearly' as const, year };
    fetchStats(params).then(s => {
      if (mode === 'monthly') {
        setChartData(s.daily.map(d => ({ label: d.label, orders: d.orders, revenue: d.revenue })));
      } else {
        setChartData(s.monthly.map(m => ({ label: m.label, orders: m.orders, revenue: m.revenue })));
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [mode, year, month]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  // Available years: from 2025 to current
  const availableYears = Array.from({ length: now.getFullYear() - 2024 }, (_, i) => 2025 + i);

  const totalOrders = chartData.reduce((s, d) => s + d.orders, 0);
  const totalRevenue = chartData.reduce((s, d) => s + d.revenue, 0);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-400 font-bold">累计订单</p>
          <p className="text-2xl font-black">{totalOrders}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-400 font-bold">累计营收</p>
          <p className="text-2xl font-black text-orange-600">¥{totalRevenue.toFixed(2)}</p>
        </div>
      </div>

      {/* Mode toggle + pickers */}
      <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm space-y-3">
        {/* Mode toggle */}
        <div className="flex bg-slate-100 rounded-xl p-1">
          <button onClick={() => setMode('monthly')}
            className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${mode === 'monthly' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}`}>按月查看</button>
          <button onClick={() => setMode('yearly')}
            className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${mode === 'yearly' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}`}>按年查看</button>
        </div>

        {/* Year picker */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 w-8">年份</span>
          <button onClick={() => setYear(y => y - 1)} disabled={year <= 2025}
            className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 disabled:opacity-30 transition-colors">
            <ChevronUp size={16} className="-rotate-90" />
          </button>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))}
            className="px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200 text-sm font-bold outline-none focus:border-orange-300">
            {availableYears.map(y => <option key={y} value={y}>{y}年</option>)}
          </select>
          <button onClick={() => setYear(y => y + 1)} disabled={year >= now.getFullYear()}
            className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 disabled:opacity-30 transition-colors">
            <ChevronUp size={16} className="rotate-90" />
          </button>

          {/* Month picker (only in monthly mode) */}
          {mode === 'monthly' && (<>
            <span className="text-xs font-bold text-slate-400 ml-3 w-8">月份</span>
            <button onClick={() => setMonth(m => m === 1 ? 12 : m - 1)}
              className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
              <ChevronUp size={16} className="-rotate-90" />
            </button>
            <select value={month} onChange={e => setMonth(parseInt(e.target.value))}
              className="px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200 text-sm font-bold outline-none focus:border-orange-300">
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}月</option>)}
            </select>
            <button onClick={() => setMonth(m => m === 12 ? 1 : m + 1)}
              className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
              <ChevronUp size={16} className="rotate-90" />
            </button>
          </>)}
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm overflow-x-auto">
        {loading ? <p className="text-center text-slate-400 py-10">加载中...</p> : <BarChart data={chartData} />}
      </div>

      {/* Data table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-50 text-slate-400">
                <th className="text-left px-4 py-2 font-bold text-xs">{mode === 'monthly' ? '日期' : '月份'}</th>
                <th className="text-center px-4 py-2 font-bold text-xs">订单数</th>
                <th className="text-right px-4 py-2 font-bold text-xs">营业额</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map(d => (
                <tr key={d.label} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-2.5">{d.label}</td>
                  <td className="text-center px-4 py-2.5">{d.orders}</td>
                  <td className="text-right px-4 py-2.5">{d.revenue > 0 ? `¥${d.revenue.toFixed(2)}` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Admin App ──

const NOTIFICATION_SOUND = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/g';

function AdminPanel({ adminKey }: { adminKey: string }) {
  const [tab, setTab] = useState<'orders' | 'products' | 'analytics'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [notified, setNotified] = useState(false);
  const [titleFlashing, setTitleFlashing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [todayStats, setTodayStats] = useState({ orders: 0, revenue: 0 });

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Editing product state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [productForm, setProductForm] = useState({ name: '', price: '', category: '1', description: '', image: '', stock: '999', allowBrewing: false, allowFreezing: false });

  const loadOrders = useCallback(() => {
    fetchOrders().then(setOrders).catch(() => {});
  }, []);

  const loadProducts = useCallback(() => {
    fetchProducts().then(setProducts).catch(() => {});
  }, []);

  useEffect(() => {
    loadOrders();
    loadProducts();
    fetchStats().then(s => { setTodayStats(s.today); }).catch(() => {});
  }, [loadOrders, loadProducts]);

  // Poll for new orders every 5 seconds
  useEffect(() => {
    const t = setInterval(() => {
      fetchOrders({ status: 'pending' }).then((rows: Order[]) => {
        const count = rows.length;
        if (count > pendingCount && pendingCount > 0) {
          // New order!
          setNotified(true);
          setTitleFlashing(true);
          if (audioRef.current) audioRef.current.play().catch(() => {});
          try { Notification.requestPermission().then(p => { if (p === 'granted') new Notification('窝里蹲新订单！', { body: `有 ${count} 个待处理订单` }); }); } catch {}
          setTimeout(() => setNotified(false), 5000);
        }
        setPendingCount(count);
      }).catch(() => {});
      // Also refresh all orders and stats
      loadOrders();
      fetchStats().then(s => { setTodayStats(s.today); }).catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [pendingCount, loadOrders]);

  // Title flashing
  useEffect(() => {
    if (!titleFlashing) return;
    const orig = document.title;
    let flashing = true;
    const t = setInterval(() => {
      document.title = flashing ? '🔔 新订单！窝里蹲' : orig;
      flashing = !flashing;
    }, 1000);
    const stop = setTimeout(() => { clearInterval(t); document.title = orig; setTitleFlashing(false); }, 10000);
    return () => { clearInterval(t); clearTimeout(stop); document.title = orig; };
  }, [titleFlashing]);

  const handleStatusChange = async (orderId: string, status: string) => {
    try {
      await updateOrderStatus(orderId, status, adminKey);
      loadOrders();
      loadProducts();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const resetProductForm = () => {
    setProductForm({ name: '', price: '', category: '1', description: '', image: '', stock: '999', allowBrewing: false, allowFreezing: false });
    setEditingProduct(null);
    setShowProductForm(false);
  };

  const handleProductSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const data = {
      name: productForm.name,
      price: parseFloat(productForm.price),
      category: productForm.category,
      description: productForm.description,
      image: productForm.image,
      stock: parseInt(productForm.stock) || 999,
      allowBrewing: productForm.allowBrewing,
      allowFreezing: productForm.allowFreezing,
    };
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, data, adminKey);
      } else {
        await createProduct(data, adminKey);
      }
      resetProductForm();
      loadProducts();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleEditProduct = (p: Product) => {
    setEditingProduct(p);
    setProductForm({
      name: p.name, price: String(p.price), category: p.category,
      description: p.description, image: p.image || '', stock: String(p.stock),
      allowBrewing: p.allowBrewing || false, allowFreezing: p.allowFreezing || false,
    });
    setShowProductForm(true);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('确定删除该商品？')) return;
    try {
      await deleteProduct(id, adminKey);
      loadProducts();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const pendingOrders = orders.filter(o => o.status === 'pending');
  const otherOrders = orders.filter(o => o.status !== 'pending');

  // Apply admin filters
  const filteredOrders = orders.filter(o => {
    if (statusFilter && o.status !== statusFilter) return false;
    if (searchQuery && !o.nickname.includes(searchQuery) && !o.dorm.includes(searchQuery) && !o.id.includes(searchQuery)) return false;
    return true;
  });

  const exportCSV = () => {
    const header = '订单号,昵称,宿舍,方式,商品,总价,状态,时间\n';
    const rows = orders.map(o => {
      const items = o.items.map((i: any) => `${i.name}x${i.quantity}`).join(';');
      return [o.id, o.nickname, o.dorm, o.isDelivery ? '配送' : '自提', `"${items}"`, o.totalPrice.toFixed(2), STATUS_LABELS[o.status], new Date(o.createdAt).toLocaleString('zh-CN')].join(',');
    }).join('\n');
    const BOM = '﻿';
    const blob = new Blob([BOM + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `窝里蹲订单_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 font-sans">
      <audio ref={audioRef} src={NOTIFICATION_SOUND} preload="auto" />
      <nav className="h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3 shadow-sm sticky top-0 z-10">
        <a href="/" className="w-9 h-9 flex items-center justify-center bg-orange-500 text-white rounded-xl font-bold text-lg shrink-0">窝</a>
        <h1 className="font-bold text-lg flex-1">管理后台</h1>
        {notified && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
            className="flex items-center gap-1 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold">
            <Bell size={12} /> 新订单！
          </motion.div>
        )}
        <a href="/" className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-100 px-3 py-2 rounded-full">
          <ArrowLeft size={14} /> 返回
        </a>
      </nav>

      {/* Stats bar */}
      <div className="max-w-6xl mx-auto px-4 pt-4">
        <div className="bg-gradient-to-br from-orange-50 to-white rounded-2xl p-4 border border-orange-100 shadow-sm max-w-xs">
          <p className="text-xs text-slate-400 font-bold mb-1">今日营业额</p>
          <p className="text-2xl font-black text-orange-600">¥{todayStats.revenue.toFixed(2)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-4 max-w-6xl mx-auto">
        <button onClick={() => setTab('orders')}
          className={`px-5 py-2.5 rounded-2xl font-bold text-sm transition-all ${tab === 'orders' ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>
          订单管理
          {pendingOrders.length > 0 && <span className="ml-1.5 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{pendingOrders.length}</span>}
        </button>
        <button onClick={() => setTab('products')}
          className={`px-5 py-2.5 rounded-2xl font-bold text-sm transition-all ${tab === 'products' ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>
          商品管理
        </button>
        <button onClick={() => setTab('analytics')}
          className={`px-5 py-2.5 rounded-2xl font-bold text-sm transition-all ${tab === 'analytics' ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>
          数据分析
        </button>
      </div>

      {tab === 'analytics' ? (
        <div className="max-w-6xl mx-auto px-4 pb-20">
          <AnalyticsPanel onClose={() => setTab('orders')} />
        </div>
      ) : (
      <div className="max-w-6xl mx-auto px-4 pb-20">
        {tab === 'orders' && (
          <div className="space-y-4">
            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-2xl border border-slate-100">
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:border-orange-300">
                <option value="">全部状态</option>
                <option value="pending">待处理</option>
                <option value="preparing">备货中</option>
                <option value="delivered">已送达</option>
                <option value="cancelled">已取消</option>
              </select>
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="搜索昵称/宿舍/订单号"
                className="flex-1 min-w-[160px] px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-sm outline-none focus:border-orange-300" />
              <button onClick={exportCSV} disabled={orders.length === 0}
                className="px-3 py-2 bg-green-500 text-white rounded-xl font-bold text-xs hover:bg-green-600 transition-all disabled:bg-slate-200 disabled:text-slate-400 flex items-center gap-1">
                <Download size={14} /> 导出 CSV
              </button>
            </div>

            {/* Filtered count */}
            {(statusFilter || searchQuery) && (
              <p className="text-xs text-slate-400">
                筛选结果：{filteredOrders.length} / {orders.length} 单
              </p>
            )}

            {/* Pending orders — show only when no filter active */}
            {!statusFilter && !searchQuery && pendingOrders.length > 0 && (
              <div>
                <h3 className="font-bold text-red-500 mb-3 flex items-center gap-2">
                  <Bell size={16} /> 待处理 ({pendingOrders.length})
                </h3>
                <div className="space-y-3">
                  {pendingOrders.map((order: Order) => (
                    <div key={order.id}>
                      <OrderCard order={order} expanded={expandedOrder === order.id}
                        onToggle={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                        onStatusChange={handleStatusChange} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Filtered or all other orders */}
            {(statusFilter || searchQuery) ? (
              <div className="space-y-3">
                {filteredOrders.map((order: Order) => (
                  <div key={order.id}>
                    <OrderCard order={order} expanded={expandedOrder === order.id}
                      onToggle={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                      onStatusChange={handleStatusChange} />
                  </div>
                ))}
              </div>
            ) : (
              otherOrders.length > 0 && (
                <div>
                  <h3 className="font-bold text-slate-500 mb-3 mt-6">全部订单</h3>
                  <div className="space-y-3">
                    {otherOrders.map((order: Order) => (
                      <div key={order.id}>
                        <OrderCard order={order} expanded={expandedOrder === order.id}
                          onToggle={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                          onStatusChange={handleStatusChange} />
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}

            {orders.length === 0 && (
              <div className="text-center text-slate-400 py-20">
                <Package size={48} className="mx-auto mb-4 opacity-50" />
                <p className="font-bold">暂无订单</p>
              </div>
            )}
          </div>
        )}

        {tab === 'products' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">商品列表 ({products.length})</h3>
              <button onClick={() => { resetProductForm(); setShowProductForm(true); }}
                className="px-4 py-2 bg-orange-500 text-white rounded-2xl font-bold text-sm hover:bg-orange-600 transition-all active:scale-[0.98]">
                + 新增商品
              </button>
            </div>

            {/* Product form modal */}
            {showProductForm && (
              <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
                onClick={e => { if (e.target === e.currentTarget) resetProductForm(); }}>
                <form onSubmit={handleProductSubmit}
                  className="bg-white p-6 rounded-3xl max-w-lg w-full max-h-[80vh] overflow-y-auto space-y-4 shadow-2xl">
                  <h4 className="font-black text-lg">{editingProduct ? '编辑商品' : '新增商品'}</h4>
                  <input value={productForm.name} onChange={e => setProductForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="商品名称" required className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-orange-300" />
                  <div className="flex gap-3">
                    <input type="number" step="0.01" value={productForm.price} onChange={e => setProductForm(p => ({ ...p, price: e.target.value }))}
                      placeholder="价格" required className="flex-1 p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-orange-300" />
                    <select value={productForm.category} onChange={e => setProductForm(p => ({ ...p, category: e.target.value }))}
                      className="flex-1 p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none">
                      {DEFAULT_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <input value={productForm.description} onChange={e => setProductForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="商品描述" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-orange-300" />
                  <input value={productForm.image} onChange={e => setProductForm(p => ({ ...p, image: e.target.value }))}
                    placeholder="图片URL" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-orange-300" />
                  <input type="number" value={productForm.stock} onChange={e => setProductForm(p => ({ ...p, stock: e.target.value }))}
                    placeholder="库存数量" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-orange-300" />
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={productForm.allowBrewing} onChange={e => setProductForm(p => ({ ...p, allowBrewing: e.target.checked }))}
                        className="w-4 h-4 rounded-md border-slate-300 text-orange-500" />
                      <span className="text-sm font-bold">支持帮泡 (+¥1)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={productForm.allowFreezing} onChange={e => setProductForm(p => ({ ...p, allowFreezing: e.target.checked }))}
                        className="w-4 h-4 rounded-md border-slate-300 text-indigo-500" />
                      <span className="text-sm font-bold">支持冰镇 (+¥0.5)</span>
                    </label>
                  </div>
                  <div className="flex gap-3">
                    <button type="button" onClick={resetProductForm}
                      className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold">取消</button>
                    <button type="submit"
                      className="flex-1 py-3 bg-orange-500 text-white rounded-2xl font-black hover:bg-orange-600 transition-all">
                      {editingProduct ? '保存修改' : '新增商品'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Product list */}
            <div className="space-y-3">
              {products.map(p => (
                <div key={p.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center gap-4">
                  <div className="w-16 h-16 bg-slate-50 rounded-xl overflow-hidden shrink-0">
                    {p.image ? <img src={p.image} referrerPolicy="no-referrer" className="w-full h-full object-cover" /> :
                      <div className="w-full h-full flex items-center justify-center text-2xl">📦</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-sm">{p.name}</h4>
                        <p className="text-xs text-slate-400 truncate">{p.description}</p>
                      </div>
                      <span className="font-black text-orange-600">¥{p.price}</span>
                    </div>
                    <div className="flex gap-2 mt-1.5">
                      <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
                        {DEFAULT_CATEGORIES.find(c => c.id === p.category)?.name}
                      </span>
                      <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">库存: {p.stock}</span>
                      {p.allowBrewing && <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">帮泡</span>}
                      {p.allowFreezing && <span className="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">冰镇</span>}
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => handleEditProduct(p)}
                      className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center transition-colors">
                      <Edit3 size={14} /></button>
                    <button onClick={() => handleDeleteProduct(p.id)}
                      className="w-8 h-8 bg-slate-100 hover:bg-red-50 hover:text-red-500 rounded-lg flex items-center justify-center transition-colors">
                      <X size={14} /></button>
                  </div>
                </div>
              ))}
              {products.length === 0 && <p className="text-center text-slate-400 py-10">暂无商品</p>}
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}

// ── Order Card (admin) ──

function OrderCard({ order, expanded, onToggle, onStatusChange }: {
  order: Order;
  expanded: boolean;
  onToggle: () => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  const nextStatus = order.status === 'pending' ? 'preparing' : order.status === 'preparing' ? 'delivered' : null;

  return (
    <div className={`bg-white rounded-2xl border transition-all ${order.status === 'pending' ? 'border-orange-200 shadow-sm' : 'border-slate-100'}`}>
      <div className="p-4 flex items-center gap-3 cursor-pointer" onClick={onToggle}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">{order.nickname}</span>
            <span className="text-xs text-slate-400">{order.dorm}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[order.status]}`}>
              {STATUS_LABELS[order.status]}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {order.items.map((i: any) => `${i.name}x${i.quantity}`).join('、')}
          </p>
          <p className="text-[10px] text-slate-300 mt-0.5">
            {new Date(order.createdAt).toLocaleString('zh-CN')} · ¥{order.totalPrice}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {nextStatus && (
            <button onClick={e => { e.stopPropagation(); onStatusChange(order.id, nextStatus); }}
              className="px-3 py-1.5 bg-slate-800 text-white rounded-full text-xs font-bold hover:bg-slate-700 transition-all">
              {nextStatus === 'preparing' ? '开始备货' : '标记送达'}
            </button>
          )}
          {order.status === 'pending' && (
            <button onClick={e => { e.stopPropagation(); if (confirm('确定取消订单？库存将恢复。')) onStatusChange(order.id, 'cancelled'); }}
              className="px-3 py-1.5 bg-slate-100 text-slate-500 rounded-full text-xs font-bold hover:bg-red-50 hover:text-red-500 transition-all">
              取消
            </button>
          )}
          {expanded ? <ChevronUp size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-50 pt-3 space-y-2">
          <p className="text-xs text-slate-400">订单号: {order.id}</p>
          {order.items.map((item: any, i: number) => (
            <div key={i} className="flex justify-between text-sm">
              <span>{item.name} x{item.quantity}</span>
              <span className="font-bold">¥{(getItemUnitPrice(item) * item.quantity).toFixed(2)}</span>
            </div>
          ))}
          <div className="flex justify-between font-bold text-sm pt-2 border-t border-slate-50">
            <span>总计</span>
            <span className="text-orange-600">¥{order.totalPrice}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── App Router ──

export default function App() {
  const isAdminRoute = window.location.pathname.startsWith('/admin');

  if (isAdminRoute) {
    return <AdminGate />;
  }
  return <CustomerApp />;
}

function AdminGate() {
  const [authorized, setAuthorized] = useState(false);
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const saved = getAdminKey();

  useEffect(() => {
    if (saved) {
      verifyAdmin(saved).then(() => setAuthorized(true)).catch(() => {});
    }
  }, []);

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
          <a href="/" className="block text-center py-3 bg-slate-100 text-slate-500 rounded-2xl font-bold hover:bg-slate-200 transition-all">
            返回点单页面
          </a>
        </form>
      </motion.div>
    </div>
  );
}
