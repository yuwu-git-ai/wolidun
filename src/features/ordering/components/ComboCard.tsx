import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Combo, CartItem, Product } from '../../../shared/types';

interface ComboCardProps {
  combo: Combo;
  cart: CartItem[];
  products: Product[];
  onAddCombo: (combo: Combo, brewingIds: Set<string>, freezingIds: Set<string>, variantIds: Map<string, string>) => void;
}

export default function ComboCard({ combo, cart, products, onAddCombo }: ComboCardProps) {
  const [brewingIds, setBrewingIds] = useState<Set<string>>(new Set());
  const [freezingIds, setFreezingIds] = useState<Set<string>>(new Set());
  const [variantIds, setVariantIds] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    setBrewingIds(new Set());
    setFreezingIds(new Set());
    setVariantIds(new Map());
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

  const setVariant = (productId: string, variantId: string) => {
    setVariantIds(prev => {
      const next = new Map(prev);
      if (variantId) next.set(productId, variantId); else next.delete(productId);
      return next;
    });
  };

  const getItemPrice = (ci: Combo['items'][0]) => {
    const vid = variantIds.get(ci.productId) || ci.variantId;
    if (vid) {
      const product = products.find(p => p.id === ci.productId);
      const v = product?.variants?.find(v => v.id === vid);
      if (v && v.price != null) return v.price;
    }
    return ci.productPrice || 0;
  };

  const allRequiredSelected = combo.items.every(ci => {
    const product = products.find(p => p.id === ci.productId);
    const hasVariants = (product?.variants?.filter(v => v.stock > 0) || []).length > 0;
    if (!hasVariants) return true;
    return !!(variantIds.get(ci.productId) || ci.variantId);
  });

  return (
    <div className="bg-white p-2.5 sm:p-4 rounded-[16px] sm:rounded-[32px] shadow-sm border border-amber-200 flex flex-col gap-2 sm:gap-4 group hover:shadow-md transition-all duration-300 ring-1 ring-amber-100 h-full">
      <div className="flex items-center gap-2">
        <span className="text-sm">🍱</span>
        <span className="text-[9px] sm:text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">套餐</span>
      </div>

      <div className="flex flex-col gap-2 sm:gap-4 flex-1">
        <h3 className="font-bold text-xs sm:text-lg leading-tight group-hover:text-amber-600 transition-colors">
          {combo.name}
        </h3>

        {/* Sub-items */}
        <div className="flex flex-col gap-2">
        {combo.items.map(ci => {
          const product = products.find(p => p.id === ci.productId);
          const productVariants = product?.variants?.filter(v => v.stock > 0) || [];
          const itemPrice = getItemPrice(ci);
          return (
          <div key={ci.productId} className="flex flex-col gap-1">
            <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl">
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
              <span className="text-[10px] sm:text-xs text-slate-400">¥{itemPrice}</span>
            </div>
            {/* Variant selector */}
            {productVariants.length > 0 && (
              <select
                value={variantIds.get(ci.productId) || ci.variantId || ''}
                onChange={e => setVariant(ci.productId, e.target.value)}
                className="w-full px-2 py-1.5 bg-white rounded-lg border border-slate-200 text-[10px] outline-none focus:border-amber-300"
              >
                <option value="" disabled>请选择</option>
                {productVariants.map(v => (
                  <option key={v.id} value={v.id}>{v.name}{v.price != null ? ` ¥${v.price}` : ''}</option>
                ))}
              </select>
            )}
            {/* Brewing / Freezing options per sub-item */}
            {(ci.allowBrewing || ci.allowFreezing) && (
              <div className="flex gap-3 px-1">
                {ci.allowBrewing && (
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" checked={brewingIds.has(ci.productId)}
                      onChange={() => toggleBrewing(ci.productId)}
                      className="w-3 h-3 rounded border-slate-300 text-orange-500" />
                    <span className="text-[9px] font-bold text-slate-500">帮泡 +¥1</span>
                  </label>
                )}
                {ci.allowFreezing && (
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" checked={freezingIds.has(ci.productId)}
                      onChange={() => toggleFreezing(ci.productId)}
                      className="w-3 h-3 rounded border-slate-300 text-indigo-500" />
                    <span className="text-[9px] font-bold text-slate-500">冰镇 +¥0.5</span>
                  </label>
                )}
              </div>
            )}
          </div>
        );})}
      </div>

      {/* Price — dynamic based on variant selections */}
      {(() => {
        const actualTotal = combo.items.reduce((s, ci) => s + getItemPrice(ci), 0);
        const actualComboPrice = Math.max(0, actualTotal - combo.discount);
        const actualSavings = combo.discount;
        return (
          <div className="flex items-baseline gap-2">
            <span className="text-slate-400 line-through text-[10px] sm:text-xs">¥{actualTotal.toFixed(1)}</span>
            <span className="font-bold text-amber-600 text-base sm:text-xl">¥{actualComboPrice.toFixed(1)}</span>
            <span className="text-[9px] sm:text-[10px] text-green-600 font-bold">省 ¥{actualSavings.toFixed(1)}</span>
          </div>
        );
      })()}
      </div>

      <button
        disabled={!allRequiredSelected}
        onClick={() => onAddCombo(combo, brewingIds, freezingIds, variantIds)}
        className={`w-full min-h-10 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl font-bold text-[11px] sm:text-base transition-all flex items-center justify-center gap-1 sm:gap-2 ${allRequiredSelected ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-lg shadow-amber-500/20 active:scale-[0.98]' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
      >
        <Plus size={16} /> {allRequiredSelected ? '加入购物车' : '请选择规格'}
      </button>
    </div>
  );
}
