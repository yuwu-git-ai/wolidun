import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Product } from '../types';

interface ProductCardProps {
  product: Product;
  onAdd: (product: Product, brewing?: boolean, freezing?: boolean) => void;
  quantityInCart: number;
  isPopular?: boolean;
}

export default function ProductCard({ product, onAdd, quantityInCart, isPopular }: ProductCardProps) {
  const [isBrewing, setIsBrewing] = useState(false);
  const [isFreezing, setIsFreezing] = useState(false);

  useEffect(() => { setIsBrewing(false); setIsFreezing(false); }, [product.id]); // eslint-disable-line react-hooks/set-state-in-effect

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
