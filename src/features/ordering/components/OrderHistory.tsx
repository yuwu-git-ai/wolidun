import { useState, useEffect, FormEvent } from 'react';
import { ArrowLeft, Clock, Search, Trash2, Copy } from 'lucide-react';
import { Order, CartItem } from '../../../shared/types';
import { fetchOrders, fetchOrderById, deleteOrder } from '../../../shared/api';
import { STATUS_LABELS, STATUS_COLORS, getItemUnitPrice, getErrorMessage } from '../../../shared/utils';

interface OrderHistoryProps {
  identity: { nickname: string; dorm: string };
  onClose: () => void;
  onReorder: (items: CartItem[]) => void;
}

export default function OrderHistory({ identity, onClose, onReorder }: OrderHistoryProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [changedIds, setChangedIds] = useState<Set<string>>(new Set());

  // Copy state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyOrderText = (order: Order) => {
    const orderLines = order.items.map(item => {
      if (item.comboId && item.comboItems) {
        const subLines = item.comboItems.map(ci => {
          const subP = ci.productPrice || 0;
          return `  - ${ci.productName || '商品'} x${item.quantity}  ¥${(subP * item.quantity).toFixed(2)}`;
        }).join('\n');
        return `🍱套餐: ${item.name}\n${subLines}\n  套餐优惠  -¥${((item.comboDiscount || 0) * item.quantity).toFixed(2)}`;
      }
      const svc: string[] = [];
      if (item.isBrewingSelected) svc.push('帮泡+¥1');
      if (item.isFreezingSelected) svc.push('冰镇+¥0.5');
      const svcStr = svc.length > 0 ? ` [${svc.join(', ')}]` : '';
      const variantStr = item.variantName ? ` · ${item.variantName}` : '';
      const up = getItemUnitPrice(item);
      return `${item.name}${variantStr}${svcStr} x${item.quantity} - ¥${(up * item.quantity).toFixed(2)}`;
    });
    const dInfo = order.isDelivery
      ? `配送: 送到 ${order.dorm}`
      : '取餐方式: 自提';
    const text = `--- 窝里蹲点单 ---\n下单人: ${order.nickname}\n${dInfo}\n---\n${orderLines.join('\n')}\n---\n总计: ¥${order.totalPrice.toFixed(2)}\n订单号: ${order.id}`;

    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(order.id);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => {});
  };

  // Order tracker state
  const [trackId, setTrackId] = useState('');
  const [trackedOrder, setTrackedOrder] = useState<Order | null>(null);
  const [trackError, setTrackError] = useState('');
  const [trackLoading, setTrackLoading] = useState(false);
  const [showTracker, setShowTracker] = useState(false);

  // Initial load
  useEffect(() => {
    fetchOrders({ nickname: identity.nickname, dorm: identity.dorm })
      .then(setOrders)
      .catch(err => console.warn('Failed to load order history:', err))
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
        .catch(err => console.warn('Failed to load order history:', err));
    }, 10000);
    return () => clearInterval(t);
  }, [identity]);

  const handleTrack = async (e: FormEvent) => {
    e.preventDefault();
    const id = trackId.trim();
    if (!id) return;
    setTrackLoading(true);
    setTrackError('');
    try {
      const result = await fetchOrderById(id);
      setTrackedOrder(result);
    } catch (err) {
      setTrackError(getErrorMessage(err) || '找不到该订单');
      setTrackedOrder(null);
    } finally {
      setTrackLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 font-sans">
      <nav className="h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3 shadow-sm sticky top-0 z-10">
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center bg-slate-100 rounded-full hover:bg-slate-200 transition-colors shrink-0">
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-bold text-lg">历史订单</h1>
        {!loading && <span className="text-xs text-slate-400">{orders.length} 单</span>}
        <button
          onClick={() => setShowTracker(!showTracker)}
          className={`ml-auto w-9 h-9 flex items-center justify-center rounded-full transition-colors ${showTracker ? 'bg-orange-100 text-orange-500' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          title="查找订单"
        >
          <Search size={16} />
        </button>
      </nav>

      {/* Order tracker — collapsible */}
      {showTracker && (
        <div className="bg-white border-b border-slate-100 px-4 py-3">
          <form onSubmit={handleTrack} className="flex gap-2">
            <input
              value={trackId}
              onChange={e => setTrackId(e.target.value)}
              placeholder="输入订单号查找..."
              className="flex-1 p-2.5 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-orange-300 transition-colors text-sm"
            />
            <button
              type="submit"
              disabled={trackLoading}
              className="px-4 py-2.5 bg-orange-500 text-white rounded-xl font-bold text-sm hover:bg-orange-600 transition-all disabled:opacity-50 shrink-0"
            >
              {trackLoading ? '查询中...' : '查找'}
            </button>
          </form>
          {trackError && <p className="text-red-500 text-xs font-bold mt-2">{trackError}</p>}
          {trackedOrder && (
            <div className="mt-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">订单号：{trackedOrder.id.slice(0, 8)}...</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[trackedOrder.status]}`}>
                  {STATUS_LABELS[trackedOrder.status] || trackedOrder.status}
                </span>
              </div>
              {trackedOrder.items.map((item, i: number) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>{item.name}{item.variantName ? ` · ${item.variantName}` : ''} x{item.quantity}</span>
                  <span className="font-bold">¥{(getItemUnitPrice(item) * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-sm pt-2 border-t border-slate-200">
                <span>总计</span>
                <span className="text-orange-600">¥{trackedOrder.totalPrice.toFixed(2)}</span>
              </div>
              <p className="text-[10px] text-slate-400">
                {new Date(trackedOrder.createdAt).toLocaleString('zh-CN')}
              </p>
            </div>
          )}
        </div>
      )}

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
                  {order.items.map(i => `${i.name}x${i.quantity}`).join('、')}
                </p>
                <div className="flex items-center gap-1 mt-1.5 text-[10px] text-slate-400">
                  <Clock size={10} />
                  {new Date(order.createdAt).toLocaleString('zh-CN')}
                </div>
              </div>
              {expandedId === order.id && (
                <div className="px-4 pb-4 border-t border-slate-50 pt-3 space-y-2">
                  <p className="text-xs text-slate-400">订单号：{order.id}</p>
                  {order.items.map((item, i: number) => (
                    <div key={i} className={item.comboId ? 'p-2 bg-amber-50/50 rounded-xl border border-amber-100' : ''}>
                      {item.comboId ? (
                        <>
                          <div className="flex justify-between text-sm font-bold">
                            <span>🍱 {item.name}</span>
                            <span className="text-amber-600">¥{(getItemUnitPrice(item) * item.quantity).toFixed(2)}</span>
                          </div>
                          {(item.comboItems || []).map((ci, si) => (
                            <div key={si} className="ml-3 flex justify-between text-[11px] text-slate-500 mt-0.5">
                              <span className="flex items-center gap-1">
                                └ {ci.productName || ci.productId}
                                {ci.variantName && <span className="text-[10px] text-slate-400">·{ci.variantName}</span>}
                                {ci.selectedBrewing && <span className="text-[9px] bg-orange-100 text-orange-600 px-1 py-0.5 rounded font-black">帮泡+¥1</span>}
                                {ci.selectedFreezing && <span className="text-[9px] bg-indigo-100 text-indigo-600 px-1 py-0.5 rounded font-black">冰镇+¥0.5</span>}
                              </span>
                            </div>
                          ))}
                        </>
                      ) : (
                        <div className="flex justify-between text-sm">
                          <span className="flex items-center gap-1 flex-wrap">
                            {item.name}{item.variantName ? ` · ${item.variantName}` : ''} x{item.quantity}
                            {item.isBrewingSelected && <span className="text-[9px] bg-orange-100 text-orange-600 px-1 py-0.5 rounded font-black">帮泡+¥1</span>}
                            {item.isFreezingSelected && <span className="text-[9px] bg-indigo-100 text-indigo-600 px-1 py-0.5 rounded font-black">冰镇+¥0.5</span>}
                          </span>
                          <span className="font-bold">¥{(getItemUnitPrice(item) * item.quantity).toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="flex justify-between font-bold text-sm pt-2 border-t border-slate-50">
                    <span>总计</span>
                    <span className="text-orange-600">¥{order.totalPrice.toFixed(2)}</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {order.isDelivery ? `配送到寝${order.totalPrice >= 20 ? '（已满20免配送费）' : ''}` : '自提'}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => copyOrderText(order)}
                      className={`px-3 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1 ${copiedId === order.id ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                      title="复制订单">
                      <Copy size={14} /> {copiedId === order.id ? '已复制' : '复制'}
                    </button>
                    <button
                      onClick={() => onReorder(order.items)}
                      className="flex-1 py-2.5 bg-orange-500 text-white rounded-xl font-bold text-sm hover:bg-orange-600 transition-all active:scale-[0.98]">
                      再来一单
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm('确定删除该订单？')) return;
                        try {
                          await deleteOrder(order.id, identity.nickname);
                          setOrders(prev => prev.filter(o => o.id !== order.id));
                        } catch (err) { alert(getErrorMessage(err)); }
                      }}
                      className="px-3 py-2.5 bg-red-50 text-red-400 hover:bg-red-100 rounded-xl transition-all"
                      title="删除订单">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
