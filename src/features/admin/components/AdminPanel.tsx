import { useState, useEffect, useRef, useCallback, FormEvent } from 'react';
import { motion } from 'motion/react';
import { Bell, ArrowLeft, Download, Package, Edit3, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import OrderCard from './OrderCard';
import AnalyticsPanel from './AnalyticsPanel';
import {
  fetchOrders, fetchProducts, fetchStats,
  updateOrderStatus, deleteOrder, createProduct, updateProduct, deleteProduct,
} from '../../../shared/api';
import type { Order, Product, Combo } from '../../../shared/types';
import { fetchCombos, createCombo, updateCombo, deleteCombo, fetchAllUsers, broadcastNotification } from '../../../shared/api';
import { DEFAULT_CATEGORIES } from '../../../shared/constants';
import { STATUS_LABELS, getErrorMessage } from '../../../shared/utils';

const NOTIFICATION_SOUND = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/g';

export default function AdminPanel({ adminKey }: { adminKey: string }) {
  const [tab, setTab] = useState<'orders' | 'products' | 'analytics' | 'combos' | 'users' | 'broadcast'>('orders');
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
  interface VariantFormItem { id?: string; name: string; price: string; stock: string; }
  const [productForm, setProductForm] = useState({ name: '', price: '', category: '2', description: '', image: '', stock: '999', allowBrewing: false, allowFreezing: false, isHot: false, variants: [] as VariantFormItem[] });

  // Combo state
  const [combos, setCombos] = useState<Combo[]>([]);
  const [editingCombo, setEditingCombo] = useState<Combo | null>(null);
  const [showComboForm, setShowComboForm] = useState(false);
  const [comboForm, setComboForm] = useState({ name: '', discount: '', items: [] as { productId: string; variantId: string }[] });
  const [users, setUsers] = useState<{ nickname: string; dorm: string; created_at: string; friend_count: number; post_count: number }[]>([]);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastContent, setBroadcastContent] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);

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

  // Load users when tab changes to users
  useEffect(() => {
    if (tab === 'users') {
      fetchAllUsers(adminKey).then(data => setUsers(data.users)).catch(() => {});
    }
  }, [tab, adminKey]);

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

  const handleDeleteOrder = async (orderId: string) => {
    try {
      await deleteOrder(orderId, '', adminKey);
      loadOrders();
      loadProducts();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const handleBroadcast = async () => {
    if (!broadcastTitle.trim()) { alert('请填写标题'); return; }
    if (!confirm(`确定向所有 ${users.length} 个用户发送通知？`)) return;
    setBroadcasting(true);
    try {
      const r = await broadcastNotification(adminKey, broadcastTitle.trim(), broadcastContent.trim());
      alert(`已发送给 ${r.count} 个用户`);
      setBroadcastTitle('');
      setBroadcastContent('');
    } catch (err) { alert(getErrorMessage(err)); }
    finally { setBroadcasting(false); }
  };

  const resetProductForm = () => {
    setProductForm({ name: '', price: '', category: '2', description: '', image: '', stock: '999', allowBrewing: false, allowFreezing: false, isHot: false, variants: [] });
    setEditingProduct(null);
    setShowProductForm(false);
  };

  const handleProductSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const stock = parseInt(productForm.stock);
    if (isNaN(stock) || stock < 0) {
      alert('库存数量不能为负数');
      return;
    }
    const variants = productForm.variants
      .filter(v => v.name.trim())
      .map(v => ({ name: v.name.trim(), price: v.price ? parseFloat(v.price) : undefined, stock: parseInt(v.stock) || 0 }));
    const data = {
      name: productForm.name,
      price: parseFloat(productForm.price),
      category: productForm.category,
      description: productForm.description,
      image: productForm.image,
      stock,
      allowBrewing: productForm.allowBrewing,
      allowFreezing: productForm.allowFreezing,
      isHot: productForm.isHot,
      variants,
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
      allowBrewing: p.allowBrewing || false, allowFreezing: p.allowFreezing || false, isHot: p.isHot || false,
      variants: (p.variants || []).map(v => ({ id: v.id, name: v.name, price: v.price != null ? String(v.price) : '', stock: String(v.stock) })),
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

  // Combo handlers
  const loadCombos = useCallback(() => {
    fetchCombos().then(setCombos).catch(err => console.warn('Failed to load combos:', err));
  }, []);

  useEffect(() => {
    loadCombos();
  }, [loadCombos]);

  const resetComboForm = () => {
    setComboForm({ name: '', discount: '', items: [] });
    setEditingCombo(null);
    setShowComboForm(false);
  };

  const handleComboSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const discount = parseFloat(comboForm.discount);
    if (isNaN(discount) || discount < 0) { alert('请输入有效的优惠金额'); return; }
    if (comboForm.items.length < 2) { alert('至少需要2个子商品'); return; }
    const items = comboForm.items.map(i => ({ productId: i.productId, variantId: i.variantId || null }));
    try {
      if (editingCombo) {
        await updateCombo(editingCombo.id, { name: comboForm.name, discount, items }, adminKey);
      } else {
        await createCombo({ name: comboForm.name, discount, items }, adminKey);
      }
      resetComboForm();
      loadCombos();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const handleDeleteCombo = async (id: string) => {
    if (!confirm('确定删除该套餐？')) return;
    try {
      await deleteCombo(id, adminKey);
      loadCombos();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const addComboItem = () => {
    setComboForm({ ...comboForm, items: [...comboForm.items, { productId: '', variantId: '' }] });
  };

  const removeComboItem = (idx: number) => {
    setComboForm({ ...comboForm, items: comboForm.items.filter((_, i) => i !== idx) });
  };

  const updateComboItem = (idx: number, field: 'productId' | 'variantId', value: string) => {
    const newItems = comboForm.items.map((item, i) =>
      i === idx ? { ...item, [field]: value, ...(field === 'productId' ? { variantId: '' } : {}) } : item
    );
    setComboForm({ ...comboForm, items: newItems });
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
      const items = o.items.map(i => `${i.name}${i.variantName ? `·${i.variantName}` : ''}x${i.quantity}`).join(';');
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
        <button onClick={() => setTab('combos')}
          className={`px-5 py-2.5 rounded-2xl font-bold text-sm transition-all ${tab === 'combos' ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>
          🍱 套餐管理
        </button>
        <button onClick={() => setTab('users')}
          className={`px-5 py-2.5 rounded-2xl font-bold text-sm transition-all ${tab === 'users' ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>
          👥 用户
        </button>
        <button onClick={() => setTab('broadcast')}
          className={`px-5 py-2.5 rounded-2xl font-bold text-sm transition-all ${tab === 'broadcast' ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>
          📢 群发
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
                        onStatusChange={handleStatusChange} onDelete={handleDeleteOrder} />
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
                      onStatusChange={handleStatusChange} onDelete={handleDeleteOrder} />
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
                          onStatusChange={handleStatusChange} onDelete={handleDeleteOrder} />
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
                      {DEFAULT_CATEGORIES.filter(c => c.id !== '1').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
                  {productForm.variants.length > 0 ? (
                    <div className="w-full p-3 bg-slate-100 rounded-xl border border-slate-200 text-sm text-slate-500">
                      总库存（自动计算）：{productForm.variants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0)}
                    </div>
                  ) : (
                    <input type="number" value={productForm.stock} onChange={e => setProductForm(p => ({ ...p, stock: e.target.value }))}
                      placeholder="库存数量" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-orange-300" />
                  )}

                  {/* ── Variant Management ── */}
                  <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex justify-between items-center">
                      <h5 className="font-bold text-sm text-slate-700">选项管理</h5>
                      <button type="button" onClick={() => setProductForm(p => ({
                        ...p, variants: [...p.variants, { name: '', price: '', stock: '0' }]
                      }))}
                        className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-bold hover:bg-orange-600 transition-all">
                        + 添加选项
                      </button>
                    </div>
                    {productForm.variants.length === 0 && (
                      <p className="text-xs text-slate-400">无需选项则留空（如普通商品）。有选项时库存以选项为准。</p>
                    )}
                    {productForm.variants.map((v, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input
                          value={v.name}
                          onChange={e => {
                            const next = [...productForm.variants];
                            next[idx] = { ...next[idx], name: e.target.value };
                            setProductForm(p => ({ ...p, variants: next }));
                          }}
                          placeholder="选项名称（如：红烧牛肉味）"
                          className="flex-1 p-2 bg-white rounded-lg border border-slate-200 text-sm outline-none focus:border-orange-300"
                        />
                        <input
                          type="number" step="0.01"
                          value={v.price}
                          onChange={e => {
                            const next = [...productForm.variants];
                            next[idx] = { ...next[idx], price: e.target.value };
                            setProductForm(p => ({ ...p, variants: next }));
                          }}
                          placeholder="价格（留空=继承基础价）"
                          className="w-28 p-2 bg-white rounded-lg border border-slate-200 text-sm outline-none focus:border-orange-300"
                        />
                        <input
                          type="number"
                          value={v.stock}
                          onChange={e => {
                            const next = [...productForm.variants];
                            next[idx] = { ...next[idx], stock: e.target.value };
                            setProductForm(p => ({ ...p, variants: next }));
                          }}
                          placeholder="库存"
                          className="w-16 p-2 bg-white rounded-lg border border-slate-200 text-sm outline-none focus:border-orange-300"
                        />
                        <button type="button" onClick={() => setProductForm(p => ({
                          ...p, variants: p.variants.filter((_, i) => i !== idx)
                        }))}
                          className="w-8 h-8 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg flex items-center justify-center text-xs font-bold transition-colors shrink-0">
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

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
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={productForm.isHot} onChange={e => setProductForm(p => ({ ...p, isHot: e.target.checked }))}
                        className="w-4 h-4 rounded-md border-slate-300 text-red-500" />
                      <span className="text-sm font-bold">🔥 热销推荐</span>
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
                      <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
                        库存: {p.variants?.length ? p.variants.reduce((s, v) => s + v.stock, 0) : p.stock}
                      </span>
                      {p.variants && p.variants.length > 0 && (
                        <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                          {p.variants.length}个选项
                        </span>
                      )}
                      {p.allowBrewing && <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">帮泡</span>}
                      {p.allowFreezing && <span className="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">冰镇</span>}
                      {p.isHot && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full">🔥热销</span>}
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

        {tab === 'combos' && (
          <div className="space-y-4">
            {/* Combo list */}
            <div className="md:grid md:grid-cols-12 gap-4">
              <div className={`${showComboForm ? 'md:col-span-6' : 'md:col-span-12'} space-y-3`}>
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-lg">套餐列表</h3>
                  <button onClick={() => { setEditingCombo(null); setComboForm({ name: '', discount: '', items: [] }); setShowComboForm(true); }}
                    className="px-4 py-2 bg-amber-500 text-white rounded-xl font-bold text-sm hover:bg-amber-600 transition-all">
                    新增套餐
                  </button>
                </div>

                {combos.length === 0 ? (
                  <p className="text-center text-slate-400 py-10">暂无套餐，点击右上角新增</p>
                ) : (
                  <div className="space-y-2">
                    {combos.map(combo => (
                      <div key={combo.id} className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                        <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
                          <span className="text-xl">🍱</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">{combo.name}</p>
                          <div className="flex gap-2 mt-1 flex-wrap">
                            {combo.items.map(ci => (
                              <span key={ci.productId} className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                                {ci.productName || ci.productId}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs line-through text-slate-300">¥{combo.originalPrice.toFixed(1)}</p>
                          <p className="font-bold text-amber-600">¥{combo.comboPrice.toFixed(1)}</p>
                          <p className="text-[10px] text-green-600 font-bold">省 ¥{combo.discount.toFixed(1)}</p>
                        </div>
                        <div className="flex gap-1.5">
                          <button onClick={() => { setEditingCombo(combo); setComboForm({ name: combo.name, discount: String(combo.discount), items: combo.items.map(ci => ({ productId: ci.productId, variantId: ci.variantId || '' })) }); setShowComboForm(true); }}
                            className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center transition-colors">
                            <Edit3 size={14} /></button>
                          <button onClick={() => handleDeleteCombo(combo.id)}
                            className="w-8 h-8 bg-slate-100 hover:bg-red-50 hover:text-red-500 rounded-lg flex items-center justify-center transition-colors">
                            <X size={14} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Combo form sidebar */}
              {showComboForm && (
                <div className="md:col-span-6">
                  <form onSubmit={handleComboSubmit}
                    className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-6 space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold">{editingCombo ? '编辑套餐' : '新增套餐'}</h4>
                      <button type="button" onClick={resetComboForm} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                    </div>
                    <input value={comboForm.name} onChange={e => setComboForm({ ...comboForm, name: e.target.value })}
                      placeholder="套餐名称" required
                      className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm outline-none focus:border-amber-300" />
                    <input value={comboForm.discount} onChange={e => setComboForm({ ...comboForm, discount: e.target.value })}
                      placeholder="优惠金额（元）" type="number" step="0.1" min="0" required
                      className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm outline-none focus:border-amber-300" />

                    {/* Sub-items */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-slate-600">套餐子商品</span>
                        <button type="button" onClick={addComboItem}
                          className="text-xs font-bold text-amber-600 hover:text-amber-700">+ 添加商品</button>
                      </div>
                      {comboForm.items.map((item, idx) => {
                        const sel = products.find(p => p.id === item.productId);
                        const selVariants = sel?.variants?.filter(v => v.stock > 0) || [];
                        return (
                        <div key={idx} className="flex gap-2 items-center">
                          <select value={item.productId} onChange={e => updateComboItem(idx, 'productId', e.target.value)}
                            className="flex-1 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs outline-none focus:border-amber-300">
                            <option value="">选择商品</option>
                            {products.map(p => (
                              <option key={p.id} value={p.id}>{p.name} (¥{p.price})</option>
                            ))}
                          </select>
                          {selVariants.length > 0 && (
                            <select value={item.variantId} onChange={e => updateComboItem(idx, 'variantId', e.target.value)}
                              className="w-28 px-2 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs outline-none focus:border-amber-300">
                              <option value="" disabled>请选择</option>
                              {selVariants.map(v => (
                                <option key={v.id} value={v.id}>{v.name}{v.price != null ? ` ¥${v.price}` : ''}</option>
                              ))}
                            </select>
                          )}
                          <button type="button" onClick={() => removeComboItem(idx)}
                            className="w-7 h-7 bg-red-50 text-red-400 hover:bg-red-100 rounded-lg flex items-center justify-center shrink-0">
                            <X size={12} /></button>
                        </div>
                      );})}
                      {comboForm.items.length === 0 && (
                        <p className="text-[10px] text-slate-400">请添加至少2个商品组成套餐</p>
                      )}
                    </div>

                    <button type="submit"
                      className="w-full py-3 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-all">
                      {editingCombo ? '保存修改' : '创建套餐'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'users' && (
          <div className="max-w-6xl mx-auto px-4 pb-20">
            <h3 className="font-bold text-lg mb-4">注册用户 ({users.length})</h3>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-left">
                      <th className="px-4 py-3 font-bold text-slate-500">昵称</th>
                      <th className="px-4 py-3 font-bold text-slate-500">宿舍</th>
                      <th className="px-4 py-3 font-bold text-slate-500">注册时间</th>
                      <th className="px-4 py-3 font-bold text-slate-500 text-center">好友</th>
                      <th className="px-4 py-3 font-bold text-slate-500 text-center">帖子</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">暂无注册用户</td></tr>
                    ) : (
                      users.map(u => (
                        <tr key={u.nickname} className="border-b border-slate-50 hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-bold">{u.nickname}</td>
                          <td className="px-4 py-3 text-slate-500">{u.dorm}</td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{u.created_at}</td>
                          <td className="px-4 py-3 text-center">{u.friend_count}</td>
                          <td className="px-4 py-3 text-center">{u.post_count}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === 'broadcast' && (
          <div className="max-w-6xl mx-auto px-4 pb-20">
            <h3 className="font-bold text-lg mb-4">📢 群发通知</h3>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4 max-w-lg">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">标题</label>
                <input value={broadcastTitle} onChange={e => setBroadcastTitle(e.target.value)}
                  placeholder="通知标题" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-slate-400 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">内容</label>
                <textarea value={broadcastContent} onChange={e => setBroadcastContent(e.target.value)}
                  placeholder="通知内容..." rows={4}
                  className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-slate-400 text-sm resize-none" />
              </div>
              <button onClick={handleBroadcast} disabled={broadcasting}
                className="px-6 py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 disabled:opacity-50 transition-all">
                {broadcasting ? '发送中...' : `发送给全部 ${users.length} 个用户`}
              </button>
              <p className="text-xs text-slate-400">所有注册用户都会在铃铛通知中收到此消息</p>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
