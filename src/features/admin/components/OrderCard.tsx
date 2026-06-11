import { ChevronUp, ChevronDown, Trash2, Edit3 } from 'lucide-react';
import { Order } from '../../../shared/types';
import { STATUS_LABELS, STATUS_COLORS, getItemUnitPrice } from '../../../shared/utils';

interface OrderCardProps {
  order: Order;
  expanded: boolean;
  onToggle: () => void;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  onEdit?: (id: string, isDelivery: boolean) => void;
}

export default function OrderCard({ order, expanded, onToggle, onStatusChange, onDelete, onEdit }: OrderCardProps) {
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
          {order.items.map((item, i: number) => (
            <div key={i} className="flex justify-between text-sm">
              <span>{item.name}{item.variantName ? ` · ${item.variantName}` : ''} x{item.quantity}</span>
              <span className="font-bold">¥{(getItemUnitPrice(item) * item.quantity).toFixed(2)}</span>
            </div>
          ))}
          <div className="flex justify-between font-bold text-sm pt-2 border-t border-slate-50">
            <span>总计</span>
            <span className="text-orange-600">¥{order.totalPrice}</span>
          </div>
          {order.status === 'pending' && onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(order.id, !order.isDelivery); }}
              className="w-full mt-1 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1">
              <Edit3 size={12} /> {order.isDelivery ? '改为自提' : '补配送（+¥1，满20免）'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
