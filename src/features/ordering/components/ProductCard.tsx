import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Product, CartItem } from '../../../shared/types';

interface ProductCardProps {
  product: Product;
  onAdd: (product: Product, variantId?: string, brewing?: boolean, freezing?: boolean) => void;
  cart: CartItem[];
  isPopular?: boolean;
}

export default function ProductCard({ product, onAdd, cart, isPopular }: ProductCardProps) {
  const [isBrewing, setIsBrewing] = useState(false);
  const [isFreezing, setIsFreezing] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(undefined);

  useEffect(() => {
    /* eslint-disable */
    setIsBrewing(false);
    setIsFreezing(false);
    setSelectedVariantId(undefined);
    /* eslint-enable */
  }, [product.id]);

  const hasVariants = product.variants && product.variants.length > 0;
  const selectedVariant = hasVariants ? product.variants!.find(v => v.id === selectedVariantId) : undefined;

  const displayPrice = selectedVariant?.price != null ? selectedVariant.price : product.price;

  const quantityInCart = hasVariants && selectedVariantId
    ? cart.filter(c => c.id === product.id && c.variantId === selectedVariantId).reduce((s, i) => s + i.quantity, 0)
    : !hasVariants
    ? cart.filter(c => c.id === product.id).reduce((s, i) => s + i.quantity, 0)
    : 0;

  const availableStock = hasVariants
    ? (selectedVariant ? Math.max(0, selectedVariant.stock - quantityInCart) : 0)
    : Math.max(0, (product.stock || 0) - quantityInCart);

  const canAdd = hasVariants ? (!!selectedVariantId && availableStock > 0) : availableStock > 0;

  return (
    <div className="bg-white p-2.5 sm:p-4 rounded-[16px] sm:rounded-[32px] shadow-sm border border-slate-100 flex flex-col gap-2 sm:gap-4 group hover:shadow-md transition-all duration-300 h-full">
      <div className="aspect-square sm:aspect-video bg-slate-100 rounded-xl sm:rounded-3xl overflow-hidden relative">
        {product.image ? (
          <img src={product.image} alt={product.name} referrerPolicy="no-referrer"
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl sm:text-4xl">🍕</div>
        )}
        <div className="absolute top-2 sm:top-3 left-2 sm:left-3 right-2 sm:right-3 flex justify-between">
          {isPopular && <span className="text-[10px] sm:text-xs">🔥 热门</span>}
          {/* Only show stock badge for non-variant products, or variant products after selection */}
          {!hasVariants && availableStock > 0 && availableStock <= 10 ? (
            <div className="px-2 py-0.5 bg-orange-500/90 backdrop-blur-md text-white text-[9px] sm:text-[10px] font-bold rounded-full shadow-lg">仅剩 {availableStock} 件</div>
          ) : !hasVariants && availableStock <= 0 ? (
            <div className="px-2 py-0.5 bg-slate-500/90 backdrop-blur-md text-white text-[9px] sm:text-[10px] font-bold rounded-full shadow-lg">已售罄</div>
          ) : hasVariants && selectedVariantId && availableStock <= 0 ? (
            <div className="px-2 py-0.5 bg-slate-500/90 backdrop-blur-md text-white text-[9px] sm:text-[10px] font-bold rounded-full shadow-lg">已售罄</div>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col gap-1.5 sm:gap-2 flex-1">
        <div className="flex justify-between items-start gap-1">
          <div className="min-w-0">
            <h3 className="font-bold text-xs sm:text-lg leading-tight group-hover:text-orange-600 transition-colors line-clamp-2">{product.name}</h3>
            <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 line-clamp-1">{product.description}</p>
          </div>
          <span className="font-bold text-orange-600 text-base sm:text-xl tracking-tight shrink-0">¥{displayPrice}</span>
        </div>

        {/* Variant selector */}
        {hasVariants && (
          <div className="flex flex-col gap-1 mt-1 pt-1.5 border-t border-slate-50">
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-500">选择规格</span>
            <div className="flex flex-wrap gap-1 sm:gap-1.5">
              {product.variants!.map(v => {
                const vStock = v.stock;
                const vPrice = v.price != null ? `¥${v.price}` : '';
                return (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariantId(v.id)}
                    disabled={vStock <= 0}
                    className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all border ${
                      selectedVariantId === v.id
                        ? 'bg-orange-500 text-white border-orange-500'
                        : vStock <= 0
                        ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-orange-300 hover:text-orange-600'
                    }`}
                  >
                    {v.name}{vPrice ? ` ${vPrice}` : ''}{vStock <= 10 && vStock > 0 ? ` (剩${vStock})` : ''}{vStock <= 0 ? ' (售罄)' : ''}
                  </button>
                );
              })}
            </div>
          </div>
        )}

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
      </div>

      <button
        onClick={() => onAdd(product, selectedVariantId, isBrewing, isFreezing)}
        disabled={!canAdd}
        className="w-full min-h-10 bg-orange-500 text-white py-2.5 sm:py-3 rounded-xl sm:rounded-2xl font-bold text-[11px] sm:text-base hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20 active:scale-[0.98] mt-auto flex items-center justify-center gap-1 sm:gap-2 disabled:bg-slate-200 disabled:shadow-none disabled:text-slate-400"
      >
        {canAdd ? <><Plus size={16} /> 加入购物车</> : hasVariants && !selectedVariantId ? '请选择规格' : '暂时缺货'}
      </button>
    </div>
  );
}
