import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Combo, CartItem } from '../../../shared/types';

interface ComboCardProps {
  combo: Combo;
  cart: CartItem[];
  onAddCombo: (combo: Combo, selections: { productId: string; variantId?: string }[]) => void;
}

export default function ComboCard({ combo, cart, onAddCombo }: ComboCardProps) {
  const [, setSelections] = useState<{ productId: string; variantId?: string }[]>([]);

  useEffect(() => {
    setSelections([]);
  }, [combo.id]);

  const comboQtyInCart = cart
    .filter(c => c.comboId === combo.id)
    .reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="bg-white p-2.5 sm:p-4 rounded-[16px] sm:rounded-[32px] shadow-sm border border-amber-200 flex flex-col gap-2 sm:gap-4 group hover:shadow-md transition-all duration-300 ring-1 ring-amber-100">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-sm">🍱</span>
        <span className="text-[9px] sm:text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">套餐</span>
      </div>

      <h3 className="font-bold text-xs sm:text-lg leading-tight group-hover:text-amber-600 transition-colors">
        {combo.name}
      </h3>

      {/* Sub-items */}
      <div className="flex flex-col gap-2">
        {combo.items.map(ci => (
          <div key={ci.productId} className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl">
            <div className="w-10 h-10 bg-white rounded-lg overflow-hidden shrink-0 border border-slate-200">
              {ci.image ? (
                <img src={ci.image} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-lg">📦</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] sm:text-xs font-bold truncate">{ci.productName}</p>
            </div>
            <span className="text-[10px] sm:text-xs text-slate-400">¥{ci.productPrice}</span>
          </div>
        ))}
      </div>

      {/* Price */}
      <div className="flex items-baseline gap-2">
        <span className="text-slate-400 line-through text-[10px] sm:text-xs">¥{combo.originalPrice.toFixed(1)}</span>
        <span className="font-bold text-amber-600 text-base sm:text-xl">¥{combo.comboPrice.toFixed(1)}</span>
        <span className="text-[9px] sm:text-[10px] text-green-600 font-bold">省 ¥{combo.discount.toFixed(1)}</span>
      </div>

      <button
        onClick={() => onAddCombo(combo, [])}
        className="w-full min-h-10 bg-amber-500 text-white py-2.5 sm:py-3 rounded-xl sm:rounded-2xl font-bold text-[11px] sm:text-base hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20 active:scale-[0.98] flex items-center justify-center gap-1 sm:gap-2 disabled:bg-slate-200 disabled:shadow-none disabled:text-slate-400"
      >
        <Plus size={16} /> 加入购物车
      </button>
    </div>
  );
}
