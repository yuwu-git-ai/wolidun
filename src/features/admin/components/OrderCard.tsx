import { useState } from 'react';
import { ChevronUp, ChevronDown, Trash2, Edit3, Save, X } from 'lucide-react';
import { Order, Product, CartItem } from '../../../shared/types';
import { STATUS_LABELS, STATUS_COLORS, getItemUnitPrice } from '../../../shared/utils';

interface OrderCardProps {
  order: Order;
  products: Product[];
  expanded: boolean;
  onToggle: () => void;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  onSaveEdit: (orderId: string, items: CartItem[], isDelivery: boolean) => Promise<void>;
}

export default function OrderCard({ order, products, expanded, onToggle, onStatusChange, onDelete, onSaveEdit }: OrderCardProps) {
  const [editing, setEditing] = useState(false);
  const [editItems, setEditItems] = useState<CartItem[]>([]);
  const [editIsDelivery, setEditIsDelivery] = useState(false);
  const [saving, setSaving] = useState(false);

  const nextStatus = order.status === 'pending' ? 'preparing' : order.status === 'preparing' ? 'delivered' : null;

  const startEditing = () => {
    setEditItems(order.items.map(item => ({
      ...item,
      comboItems: item.comboItems ? item.comboItems.map(ci => ({ ...ci })) : undefined,
    })));
    setEditIsDelivery(order.isDelivery);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setEditItems([]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveEdit(order.id, editItems, editIsDelivery);
      setEditing(false);
    } catch (err) {
      alert('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const toggleBrewing = (idx: number) => {
    setEditItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, isBrewingSelected: !item.isBrewingSelected } : item
    ));
  };

  const toggleFreezing = (idx: number) => {
    setEditItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, isFreezingSelected: !item.isFreezingSelected } : item
    ));
  };

  const setVariant = (idx: number, variantId: string) => {
    setEditItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const p = products.find(pr => pr.id === item.id);
      const v = p?.variants?.find(vr => vr.id === variantId);
      return { ...item, variantId, variantName: v?.name, price: v?.price != null ? v.price : (p?.price || item.price) };
    }));
  };

  const toggleComboBrewing = (itemIdx: number, subIdx: number) => {
    setEditItems(prev => prev.map((item, i) => {
      if (i !== itemIdx || !item.comboItems) return item;
      return { ...item, comboItems: item.comboItems.map((ci, j) =>
        j === subIdx ? { ...ci, selectedBrewing: !ci.selectedBrewing } : ci
      )};
    }));
  };

  const toggleComboFreezing = (itemIdx: number, subIdx: number) => {
    setEditItems(prev => prev.map((item, i) => {
      if (i !== itemIdx || !item.comboItems) return item;
      return { ...item, comboItems: item.comboItems.map((ci, j) =>
        j === subIdx ? { ...ci, selectedFreezing: !ci.selectedFreezing } : ci
      )};
    }));
  };

  const setComboVariant = (itemIdx: number, subIdx: number, variantId: string) => {
    setEditItems(prev => prev.map((item, i) => {
      if (i !== itemIdx || !item.comboItems) return item;
      const ci = item.comboItems[subIdx];
      const p = products.find(pr => pr.id === ci.productId);
      const v = p?.variants?.find(vr => vr.id === variantId);
      return { ...item, comboItems: item.comboItems.map((ci2, j) =>
        j === subIdx ? { ...ci2, variantId, variantName: v?.name, productPrice: v?.price != null ? v.price : ci2.productPrice } : ci2
      )};
    }));
  };

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
            {order.items.map(i => `${i.name}${i.variantName ? `·${i.variantName}` : ''}x${i.quantity}`).join('、')}
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
          <button onClick={e => { e.stopPropagation(); if (confirm('确定永久删除该订单？此操作不可撤销。')) onDelete(order.id); }}
            className="p-1.5 text-slate-300 hover:text-red-500 transition-colors" title="删除订单">
            <Trash2 size={14} />
          </button>
          {expanded ? <ChevronUp size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-50 pt-3 space-y-2">
          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-400">订单号: {order.id}</p>
            <span className="text-xs text-slate-400">{order.isDelivery ? '配送' : '自提'}</span>
          </div>

          {editing ? (
            /* ── Edit Mode ── */
            <div className="space-y-3">
              {editItems.map((item, i) => (
                <div key={i} className="p-3 bg-amber-50/50 rounded-xl border border-amber-100 space-y-2">
                  {item.comboId ? (
                    <>
                      <div className="flex justify-between text-sm font-bold">
                        <span>🍱 {item.name}</span>
                        <span>x{item.quantity}</span>
                      </div>
                      {(item.comboItems || []).map((ci, si) => (
                        <div key={si} className="ml-3 p-2 bg-white rounded-lg text-xs space-y-1">
                          <div className="flex justify-between font-bold">
                            <span>{ci.productName || ci.productId}</span>
                            {ci.variantName && <span className="text-slate-400">{ci.variantName}</span>}
                          </div>
                          {(() => {
                            const p = products.find(pr => pr.id === ci.productId);
                            const vars = p?.variants;
                            if (vars && vars.length > 0) {
                              return (
                                <select value={ci.variantId || ''}
                                  onChange={e => setComboVariant(i, si, e.target.value)}
                                  className="w-full px-2 py-1 bg-slate-50 rounded border border-slate-200 text-[10px] outline-none focus:border-amber-300">
                                  <option value="">默认</option>
                                  {vars.map(v => (
                                    <option key={v.id} value={v.id} disabled={(v.stock || 0) <= 0}>
                                      {v.name}{v.price != null ? ` ¥${v.price}` : ''}{v.stock <= 0 ? ' (售罄)' : ''}
                                    </option>
                                  ))}
                                </select>
                              );
                            }
                            return null;
                          })()}
                          <div className="flex gap-3">
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input type="checkbox" checked={!!ci.selectedBrewing}
                                onChange={() => toggleComboBrewing(i, si)}
                                className="w-3 h-3 rounded border-slate-300 text-orange-500" />
                              <span className="text-[10px]">帮泡 +¥1</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input type="checkbox" checked={!!ci.selectedFreezing}
                                onChange={() => toggleComboFreezing(i, si)}
                                className="w-3 h-3 rounded border-slate-300 text-indigo-500" />
                              <span className="text-[10px]">冰镇 +¥0.5</span>
                            </label>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between text-sm font-bold">
                        <span>{item.name}{item.variantName ? ` · ${item.variantName}` : ''}</span>
                        <span>x{item.quantity}</span>
                      </div>
                      {(() => {
                        const p = products.find(pr => pr.id === item.id);
                        const vars = p?.variants;
                        if (vars && vars.length > 0) {
                          return (
                            <select value={item.variantId || ''}
                              onChange={e => setVariant(i, e.target.value)}
                              className="w-full px-2 py-1.5 bg-white rounded-lg border border-slate-200 text-xs outline-none focus:border-orange-300">
                              <option value="">默认</option>
                              {vars.map(v => (
                                <option key={v.id} value={v.id} disabled={(v.stock || 0) <= 0}>
                                  {v.name}{v.price != null ? ` ¥${v.price}` : ''}{v.stock <= 0 ? ' (售罄)' : ''}
                                </option>
                              ))}
                            </select>
                          );
                        }
                        return null;
                      })()}
                      <div className="flex gap-3">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input type="checkbox" checked={!!item.isBrewingSelected}
                            onChange={() => toggleBrewing(i)}
                            className="w-3 h-3 rounded border-slate-300 text-orange-500" />
                          <span className="text-[10px]">帮泡 +¥1</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input type="checkbox" checked={!!item.isFreezingSelected}
                            onChange={() => toggleFreezing(i)}
                            className="w-3 h-3 rounded border-slate-300 text-indigo-500" />
                          <span className="text-[10px]">冰镇 +¥0.5</span>
                        </label>
                      </div>
                    </>
                  )}
                </div>
              ))}
              <label className="flex items-center gap-2 cursor-pointer py-2">
                <input type="checkbox" checked={editIsDelivery}
                  onChange={e => setEditIsDelivery(e.target.checked)}
                  className="w-4 h-4 rounded-md border-slate-300 text-orange-500" />
                <span className="text-xs font-bold">配送到寝（满¥20免¥1）</span>
              </label>
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-2.5 bg-green-500 text-white rounded-xl font-bold text-sm hover:bg-green-600 transition-all disabled:opacity-50 flex items-center justify-center gap-1">
                  <Save size={14} /> {saving ? '保存中...' : '保存修改'}
                </button>
                <button onClick={cancelEditing}
                  className="px-3 py-2.5 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-all">
                  <X size={16} />
                </button>
              </div>
            </div>
          ) : (
            /* ── View Mode ── */
            <>
              {order.items.map((item, i: number) => (
                <div key={i} className={item.comboId ? 'p-2 bg-amber-50/50 rounded-lg border border-amber-100' : ''}>
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
                <span className="text-orange-600">¥{order.totalPrice}</span>
              </div>
              <button
                onClick={e => { e.stopPropagation(); startEditing(); }}
                className="w-full mt-2 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1">
                <Edit3 size={12} /> 修改订单
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
