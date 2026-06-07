import { useState, useEffect, useRef, useCallback, FormEvent } from 'react';
import { motion } from 'motion/react';
import { Bell, ArrowLeft, Download, Package, Edit3, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import OrderCard from './OrderCard';
import AnalyticsPanel from './AnalyticsPanel';
import {
  fetchOrders, fetchProducts, fetchStats,
  updateOrderStatus, createProduct, updateProduct, deleteProduct,
} from '../api';
import type { Order, Product } from '../types';
import { DEFAULT_CATEGORIES } from '../constants';
import { STATUS_LABELS, getErrorMessage } from '../utils';

const NOTIFICATION_SOUND = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/g';

export default function AdminPanel({ adminKey }: { adminKey: string }) {
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
    fetchOrders().then(setOrders).catch(err => console.warn('Failed to load orders (admin):', err));
  }, []);

  const loadProducts = useCallback(() => {
    fetchProducts().then(setProducts).catch(err => console.warn('Failed to load products (admin):', err));
  }, []);

  useEffect(() => {
    loadOrders();
    loadProducts();
    fetchStats().then(s => { setTodayStats(s.today); }).catch(err => console.warn('Failed to load stats (admin init):', err));
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
          if (audioRef.current) audioRef.current.play().catch(err => console.warn('Audio play failed (autoplay policy):', err));
          try { Notification.requestPermission().then(p => { if (p === 'granted') new Notification('窝里蹲新订单！', { body: `有 ${count} 个待处理订单` }); }); } catch { /* Notification API may not be available */ }
          setTimeout(() => setNotified(false), 5000);
        }
        setPendingCount(count);
      }).catch(err => console.warn('Failed to poll pending orders:', err));
      // Also refresh all orders and stats
      loadOrders();
      fetchStats().then(s => { setTodayStats(s.today); }).catch(err => console.warn('Failed to refresh stats (admin poll):', err));
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
    } catch (err) {
      alert(getErrorMessage(err));
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
    } catch (err) {
      alert(getErrorMessage(err));
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
    } catch (err) {
      alert(getErrorMessage(err));
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
      const items = o.items.map(i => `${i.name}x${i.quantity}`).join(';');
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
        <Link to="/" className="w-9 h-9 flex items-center justify-center bg-orange-500 text-white rounded-xl font-bold text-lg shrink-0">窝</Link>
        <h1 className="font-bold text-lg flex-1">管理后台</h1>
        {notified && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
            className="flex items-center gap-1 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold">
            <Bell size={12} /> 新订单！
          </motion.div>
        )}
        <Link to="/" className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-100 px-3 py-2 rounded-full">
          <ArrowLeft size={14} /> 返回
        </Link>
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
                  {/* Image: paste or URL */}
                  {productForm.image ? (
                    <div className="relative">
                      <img src={productForm.image} className="w-full h-40 object-cover rounded-xl border border-slate-200" />
                      <button type="button" onClick={() => setProductForm(p => ({ ...p, image: '' }))}
                        className="absolute top-2 right-2 w-7 h-7 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 text-xs">✕</button>
                    </div>
                  ) : (
                    <div
                      onPaste={e => {
                        const items = e.clipboardData?.items;
                        if (!items) return;
                        for (let i = 0; i < items.length; i++) {
                          if (items[i].type.startsWith('image/')) {
                            e.preventDefault();
                            const blob = items[i].getAsFile();
                            if (!blob) continue;
                            const reader = new FileReader();
                            reader.onload = () => setProductForm(p => ({ ...p, image: reader.result as string }));
                            reader.readAsDataURL(blob);
                            break;
                          }
                        }
                      }}
                      className="w-full p-8 border-2 border-dashed border-slate-300 rounded-xl text-center cursor-text hover:border-orange-300 transition-colors bg-slate-50"
                    >
                      <p className="text-sm text-slate-400 font-bold">📋 在此处 Ctrl+V 粘贴图片</p>
                      <p className="text-xs text-slate-300 mt-1">或下方输入图片 URL</p>
                    </div>
                  )}
                  <input value={productForm.image} onChange={e => setProductForm(p => ({ ...p, image: e.target.value }))}
                    placeholder="图片URL（也可以在上面粘贴图片）" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-orange-300 text-sm" />
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
