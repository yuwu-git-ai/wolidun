import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Combo, CartItem } from '../../../shared/types';

interface ComboCardProps {
  combo: Combo;
  cart: CartItem[];
  onAddCombo: (combo: Combo, brewingIds: Set<string>, freezingIds: Set<string>) => void;
}

export default function ComboCard({ combo, cart, onAddCombo }: ComboCardProps) {
  const [brewingIds, setBrewingIds] = useState<Set<string>>(new Set());
  const [freezingIds, setFreezingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setBrewingIds(new Set());
    setFreezingIds(new Set());
  }, [combo.id]);

  const toggleBrewing = (productId: string) => {
    setBrewingIds(prev => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId); else next.add(productId);
      return next;
    });
  };

  const toggleFreezing = (productId: string) => {
    setFreezingIds(prev => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId); else next.add(productId);
      return next;
    });
  };

  const hasBrewingOrFreezing = combo.items.some(ci => ci.allowBrewing || ci.allowFreezing);

  return (
    <div className="bg-white p-2.5 sm:p-4 rounded-[16px] sm:rounded-[32px] shadow-sm border border-amber-200 flex flex-col gap-2 sm:gap-4 group hover:shadow-md transition-all duration-300">
      {/* Image area — show first sub-item image */}
      <div className="aspect-square sm:aspect-video bg-slate-100 rounded-xl sm:rounded-3xl overflow-hidden relative">
        {combo.items[0]?.image ? (
          <img src={combo.items[0].image} alt={combo.name} referrerPolicy="no-referrer"
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl sm:text-4xl">🍱</div>
        )}
        <div className="absolute top-2 sm:top-3 left-2 sm:left-3">
          <span className="text-[10px] sm:text-xs">🍱 套餐</span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 sm:gap-2">
        <div className="flex justify-between items-start gap-1">
          <div className="min-w-0">
            <h3 className="font-bold text-xs sm:text-lg leading-tight group-hover:text-orange-600 transition-colors line-clamp-2">{combo.name}</h3>
            {/* Sub-items as compact pills */}
            <div className="flex flex-wrap gap-1 mt-0.5">
              {combo.items.map(ci => (
                <span key={ci.productId} className="text-[9px] sm:text-[10px] bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded-md border border-slate-100">
                  {ci.productName}
                </span>
              ))}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <span className="text-[10px] sm:text-xs text-slate-300 line-through block">¥{combo.originalPrice.toFixed(1)}</span>
            <span className="font-bold text-orange-600 text-base sm:text-xl tracking-tight">¥{combo.comboPrice.toFixed(1)}</span>
          </div>
        </div>

        {/* Brewing / Freezing options per sub-item */}
        {hasBrewingOrFreezing && (
          <div className="flex flex-col gap-1.5 mt-1.5 pt-1.5 border-t border-slate-50">
            {combo.items.map(ci => (
              <div key={ci.productId} className="flex gap-2">
                {ci.allowBrewing && (
                  <label className="flex items-center gap-1 sm:gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={brewingIds.has(ci.productId)}
                      onChange={() => toggleBrewing(ci.productId)}
                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-md border-slate-300 text-orange-500" />
                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-500">{ci.productName} 帮泡 (+¥1)</span>
                  </label>
                )}
                {ci.allowFreezing && (
                  <label className="flex items-center gap-1 sm:gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={freezingIds.has(ci.productId)}
                      onChange={() => toggleFreezing(ci.productId)}
                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-md border-slate-300 text-indigo-500" />
                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-500">{ci.productName} 冰镇 (+¥0.5)</span>
                  </label>
                )}
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => onAddCombo(combo, brewingIds, freezingIds)}
          className="w-full min-h-10 bg-orange-500 text-white py-2.5 sm:py-3 rounded-xl sm:rounded-2xl font-bold text-[11px] sm:text-base hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20 active:scale-[0.98] mt-1 sm:mt-2 flex items-center justify-center gap-1 sm:gap-2"
        >
          <Plus size={16} /> 加入购物车
        </button>
      </div>
    </div>
  );
}
