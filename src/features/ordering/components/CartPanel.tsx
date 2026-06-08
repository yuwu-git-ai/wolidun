import { motion, AnimatePresence } from 'motion/react';
import { Plus, Minus, Trash2 } from 'lucide-react';
import { Product, CartItem } from '../../../shared/types';
import { getCartKey, getItemUnitPrice } from '../../../shared/utils';

interface CartPanelProps {
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
}

export default function CartPanel({ cart, products, identity, isDelivery, setIsDelivery, itemsTotal, deliveryFee, totalPrice, onRemove, onAdd, onClear, onConfirm, onUpdateNote, compact }: CartPanelProps) {
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
                className={`flex items-center gap-3 p-3 rounded-2xl border ${item.comboId ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
                {item.comboId ? (
                  <div className="w-14 h-14 bg-amber-100 rounded-xl overflow-hidden shrink-0 shadow-sm border border-amber-200 flex items-center justify-center">
                    <span className="text-2xl">🍱</span>
                  </div>
                ) : (
                  <div className="w-14 h-14 bg-white rounded-xl overflow-hidden shrink-0 shadow-sm border border-slate-200">
                    <img src={item.image} referrerPolicy="no-referrer" alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  {item.comboId ? (
                    <>
                      <div className="flex justify-between font-bold text-sm mb-1">
                        <span className="truncate">{item.name}</span>
                        <span className="ml-2 text-amber-600">¥{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                      {(item.comboItems || []).map(ci => (
                        <div key={ci.productId} className="text-[9px] text-slate-400 flex justify-between items-center">
                          <span className="flex items-center gap-1">
                            └ {ci.productName}
                            {ci.selectedBrewing && <span className="text-[7px] bg-orange-100 text-orange-600 px-1 py-0.5 rounded font-black">帮泡+¥1</span>}
                            {ci.selectedFreezing && <span className="text-[7px] bg-indigo-100 text-indigo-600 px-1 py-0.5 rounded font-black">冰镇+¥0.5</span>}
                          </span>
                          <span>¥{((ci.productPrice || 0) * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                      {item.comboDiscount && item.comboDiscount > 0 && (
                        <div className="text-[9px] text-green-600 font-bold flex justify-between">
                          <span>  套餐优惠</span>
                          <span>-¥{((item.comboDiscount || 0) * item.quantity).toFixed(2)}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between font-bold text-sm mb-1">
                        <span className="truncate">{item.name}{item.variantName ? ` · ${item.variantName}` : ''}</span>
                        <span className="ml-2">¥{(getItemUnitPrice(item) * item.quantity).toFixed(2)}</span>
                      </div>
                      {item.variantName && (
                        <div className="text-[10px] text-slate-400 mb-1">{item.variantName}</div>
                      )}
                      {(item.isBrewingSelected || item.isFreezingSelected) && (
                        <div className="flex gap-2 mb-1">
                          {item.isBrewingSelected && <span className="text-[8px] bg-orange-100 text-orange-600 px-1 py-0.5 rounded font-black">帮泡+¥1</span>}
                          {item.isFreezingSelected && <span className="text-[8px] bg-indigo-100 text-indigo-600 px-1 py-0.5 rounded font-black">冰镇+¥0.5</span>}
                        </div>
                      )}
                    </>
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
                        if (item.comboId) { onAdd(item); return; }
                        const p = products.find(p => p.id === item.id);
                        const totalInCart = cart.filter(c => c.id === item.id && c.variantId === item.variantId).reduce((s, i) => s + i.quantity, 0);
                        const maxStock = item.variantId && p?.variants
                          ? (p.variants.find(v => v.id === item.variantId)?.stock || 0)
                          : (p?.stock || 0);
                        if (maxStock > totalInCart) onAdd(item);
                      }}
                        className="w-7 h-7 bg-slate-800 text-white hover:bg-slate-700 rounded-lg flex items-center justify-center transition-colors disabled:bg-slate-200 disabled:text-slate-400"
                        disabled={item.comboId ? false : (() => {
                          const p = products.find(p => p.id === item.id);
                          const totalInCart = cart.filter(c => c.id === item.id && c.variantId === item.variantId).reduce((s, i) => s + i.quantity, 0);
                          const maxStock = item.variantId && p?.variants
                            ? (p.variants.find(v => v.id === item.variantId)?.stock || 0)
                            : (p?.stock || 0);
                          return maxStock <= totalInCart;
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
