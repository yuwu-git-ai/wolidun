import { lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShoppingBag, Check, Flame, Utensils, Pizza, Coffee, IceCream, Package,
  User as UserIcon, Search, Edit3, X, LogOut, Clock, MessageCircle,
} from 'lucide-react';
import { DEFAULT_CATEGORIES } from './shared/constants';
import ProductCard from './features/ordering/components/ProductCard';
import IdentityForm from './features/ordering/components/IdentityForm';
import ProfileForm from './features/ordering/components/ProfileForm';
import OrderHistory from './features/ordering/components/OrderHistory';
import CartPanel from './features/ordering/components/CartPanel';
import { getItemUnitPrice } from './shared/utils';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import ErrorBoundary from './shared/components/ErrorBoundary';
import { useCustomerApp } from './features/ordering/hooks/useCustomerApp';
import { getIdentity } from './shared/api';

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = { Flame, Utensils, Pizza, Coffee, IceCream, Package };

// ── Loading fallback ──

function PageLoading() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50">
      <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );
}

// ── Square App (lazy-loaded) ──

const SquarePanel = lazy(() => import('./features/square/components/SquarePanel'));

function SquareApp() {
  const identity = getIdentity();
  const navigate = useNavigate();

  if (!identity) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-slate-50 gap-4 p-4">
        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center text-3xl">🔑</div>
        <p className="font-bold text-slate-600">请先在点单页面填写身份信息</p>
        <button onClick={() => navigate('/')}
          className="px-6 py-3 bg-orange-500 text-white rounded-2xl font-bold hover:bg-orange-600 transition-all">
          去填写身份信息
        </button>
      </div>
    );
  }

  return (
    <div className="app-viewport flex flex-col bg-slate-50 text-slate-800 font-sans overflow-hidden h-[100dvh] relative">
      {/* Header */}
      <nav className="h-14 sm:h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-6 shrink-0 shadow-sm relative z-10">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 select-none">
          <Link to="/" className="w-9 h-9 sm:w-10 sm:h-10 bg-purple-500 rounded-xl flex items-center justify-center text-white font-bold text-lg sm:text-xl shrink-0">窝</Link>
          <h1 className="min-w-0 truncate text-base sm:text-xl font-bold tracking-tight">窝里蹲广场</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-100 rounded-full">
            <div className="w-5 h-5 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
              <UserIcon size={10} />
            </div>
            <span className="text-[10px] font-bold text-slate-600 truncate max-w-[60px]">{identity.nickname}</span>
          </div>
          <Link to="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-orange-500 text-white hover:bg-orange-600 transition-all">
            <ShoppingBag size={14} />
            <span className="hidden sm:inline">点单</span>
          </Link>
        </div>
      </nav>

      {/* Square content */}
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<PageLoading />}>
          <SquarePanel identity={identity} />
        </Suspense>
      </div>
    </div>
  );
}

// ── Admin (lazy-loaded) ──

const AdminGate = lazy(() => import('./features/admin/components/AdminGate'));

function AdminPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <AdminGate />
    </Suspense>
  );
}

// ── Customer App ──

function CustomerApp() {
  const { state, actions } = useCustomerApp();

  // Profile editor
  if (state.showProfileForm && state.identity) {
    return (
      <ProfileForm
        identity={state.identity}
        onSave={actions.handleUpdateProfile}
        onClose={() => actions.setShowProfileForm(false)}
      />
    );
  }

  // Order history
  if (state.showOrderHistory && state.identity) {
    return <OrderHistory identity={state.identity} onClose={() => actions.setShowOrderHistory(false)} onReorder={actions.reorder} />;
  }

  return (
    <div className="app-viewport flex flex-col bg-slate-50 text-slate-800 font-sans overflow-hidden h-[100dvh] relative">
      {/* Identity form overlay */}
      {state.showIdentityForm && (
        <div className="absolute inset-0 z-50">
          <IdentityForm onSave={actions.handleSaveIdentity} onSkip={() => actions.setShowIdentityForm(false)} />
        </div>
      )}

      {/* ── Persistent Header ── */}
      <nav className="h-14 sm:h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-6 shrink-0 shadow-sm relative z-10">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 select-none">
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white font-bold text-lg sm:text-xl shrink-0">窝</div>
          <h1 className="min-w-0 truncate text-base sm:text-xl font-bold tracking-tight">窝里蹲点单</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* Square entrance */}
          {state.identity && (
            <Link to="/square"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all">
              <MessageCircle size={14} />
              <span className="hidden sm:inline">广场</span>
            </Link>
          )}
          {state.identity && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-100 rounded-full">
              <div className="w-5 h-5 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
                <UserIcon size={10} />
              </div>
              <span className="text-[10px] font-bold text-slate-600 truncate max-w-[60px]">{state.identity.nickname}</span>
            </div>
          )}
          {state.identity ? (<>
            <button onClick={() => actions.setShowOrderHistory(true)}
              className="w-9 h-9 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-full border border-slate-200 transition-colors"
              title="历史订单">
              <Clock size={16} />
            </button>
            <button onClick={() => { actions.setShowProfileForm(true); }}
              className="w-9 h-9 flex items-center justify-center bg-slate-100 hover:bg-red-50 hover:text-red-500 rounded-full border border-slate-200 transition-colors"
              title="个人信息">
              <Edit3 size={14} />
            </button>
            <button onClick={actions.handleLogout}
              className="w-9 h-9 flex items-center justify-center bg-slate-100 hover:bg-red-50 hover:text-red-500 rounded-full border border-slate-200 transition-colors"
              title="退出登录">
              <LogOut size={14} />
            </button>
          </>) : (
            <button onClick={() => actions.setShowIdentityForm(true)}
              className="px-4 py-2 bg-orange-500 text-white rounded-full font-bold text-sm hover:bg-orange-600 transition-all">
              登录
            </button>
          )}
        </div>
      </nav>

      {/* ── Order view (always shown) ── */}
      <>
        {/* Mobile category bar */}
        <div className="flex md:hidden gap-2 overflow-x-auto px-3 py-2.5 bg-white border-b border-slate-100 shrink-0">
          {DEFAULT_CATEGORIES.map(cat => {
            const Icon = ICON_MAP[cat.icon] || Package;
            const active = state.activeCategory === cat.id;
            return (
              <button key={cat.id} onClick={() => actions.setActiveCategory(cat.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full whitespace-nowrap text-xs font-bold transition-all shrink-0 ${active ? 'bg-orange-500 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200'}`}>
                <Icon size={14} />{cat.name}
              </button>
            );
          })}
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Desktop sidebar categories */}
          <aside className="w-24 bg-white border-r border-slate-200 hidden md:flex flex-col py-6 shrink-0 overflow-y-auto">
            <div className="flex flex-col items-center gap-8">
              {DEFAULT_CATEGORIES.map(cat => {
                const Icon = ICON_MAP[cat.icon] || Package;
                const active = state.activeCategory === cat.id;
                return (
                  <button key={cat.id} onClick={() => actions.setActiveCategory(cat.id)}
                    className={`flex flex-col items-center gap-1 group transition-all ${active ? 'opacity-100' : 'opacity-40 hover:opacity-70'}`}>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform ${active ? 'bg-orange-100 text-orange-600 shadow-sm' : 'bg-slate-100 text-slate-600'}`}>
                      <Icon size={24} />
                    </div>
                    <span className={`text-xs font-bold ${active ? 'text-orange-600' : 'text-slate-600'}`}>{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Search + Main content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search bar */}
            <div className="px-3 sm:px-6 py-2.5 bg-white border-b border-slate-100 shrink-0">
              <div className="relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={state.searchQuery}
                  onChange={e => { actions.setSearchQuery(e.target.value); actions.setActiveCategory(DEFAULT_CATEGORIES[0].id); }}
                  placeholder="搜索商品..."
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-50 rounded-2xl border border-slate-100 outline-none focus:bg-white focus:border-orange-300 transition-all text-sm"
                />
              </div>
            </div>

            {/* Main content */}
            <main className="flex-1 p-3 sm:p-6 overflow-y-auto flex flex-col gap-3 sm:gap-6 pb-32 lg:pb-6">

            {state.searchQuery ? (
              <div className="flex items-center justify-between">
                <h2 className="text-xl sm:text-2xl font-bold">搜索"{state.searchQuery}"</h2>
                <button onClick={() => actions.setSearchQuery('')} className="text-xs text-orange-500 font-bold">清除</button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
                <h2 className="text-xl sm:text-2xl font-bold">
                  {DEFAULT_CATEGORIES.find(c => c.id === state.activeCategory)?.name}
                </h2>
                <div className="self-start text-xs sm:text-sm text-slate-500 bg-white px-3 sm:px-4 py-1.5 rounded-full border border-slate-200 shadow-sm">
                  共 {state.filteredProducts.length} 款
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-6 lg:pb-0">
              <AnimatePresence mode="popLayout">
                {state.filteredProducts.map(product => (
                  <motion.div layout key={product.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <ProductCard product={product} onAdd={actions.addToCart} cart={state.cart} isPopular={state.popularIds.has(product.id)} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <div className="hidden lg:flex mt-4 sm:mt-6 p-4 sm:p-6 bg-gradient-to-br from-orange-500 via-orange-600 to-rose-500 rounded-[24px] sm:rounded-[32px] text-white items-center justify-between shadow-xl shadow-orange-500/20 mb-4 sm:mb-0">
              <div>
                <p className="text-[11px] sm:text-sm font-bold opacity-90 tracking-wide">今日特惠</p>
                <p className="font-black text-base sm:text-2xl mt-0.5">满 ¥20 免配送费</p>
                <p className="text-[10px] sm:text-xs opacity-70 mt-1 hidden sm:block">下单满 20 元，配送到寝不收配送费</p>
              </div>
              <div className="bg-white/25 px-4 sm:px-6 py-2 sm:py-3 rounded-full text-[11px] sm:text-sm font-black backdrop-blur-md shrink-0 ml-2 border border-white/20">
                即刻下单
              </div>
            </div>
          </main>
          </div>

          {/* Desktop cart sidebar */}
          <aside className="w-80 bg-white border-l border-slate-200 hidden lg:flex flex-col shrink-0 shadow-xl">
            <CartPanel
              cart={state.sortedCart} products={state.products}
              identity={state.identity} isDelivery={state.isDelivery} setIsDelivery={actions.setIsDelivery}
              itemsTotal={state.itemsTotal} deliveryFee={state.deliveryFee} totalPrice={state.totalPrice}
              onRemove={actions.removeFromCart} onAdd={(item) => actions.addToCart(item, item.variantId, item.isBrewingSelected, item.isFreezingSelected)}
              onClear={actions.clearCart} onConfirm={() => actions.setShowConfirm(true)}
              onUpdateNote={actions.updateCartNote}
            />
          </aside>
        </div>

        {/* Mobile bottom: promo + cart bar */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40">
          <div className="bg-gradient-to-br from-orange-500 via-orange-600 to-rose-500 text-white px-4 py-2 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold opacity-90 tracking-wide">今日特惠</p>
              <p className="font-black text-sm">满 ¥20 免配送费</p>
            </div>
            <div className="bg-white/25 px-3 py-1 rounded-full text-[10px] font-black backdrop-blur-md shrink-0 ml-2 border border-white/20">
              即刻下单
            </div>
          </div>
          <div className="bg-white/80 backdrop-blur-xl border-t border-slate-200 px-4 py-3 flex items-center justify-between shadow-2xl">
            <button onClick={() => actions.setIsMobileCartOpen(true)}
              className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2.5 rounded-2xl font-bold shadow-lg shadow-orange-500/20 active:scale-[0.98]">
              <ShoppingBag size={18} />
              <span className="text-sm">{state.cartCount} 件</span>
            </button>
            <div className="text-right">
              <p className="text-[10px] text-slate-400">合计</p>
              <p className="font-black text-lg text-orange-600">¥{state.totalPrice.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </>

      {/* Mobile cart bottom sheet */}
      <AnimatePresence>
        {state.isMobileCartOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm lg:hidden"
            onClick={(e) => { if (e.target === e.currentTarget) actions.setIsMobileCartOpen(false); }}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 max-h-[80vh] bg-white rounded-t-[28px] overflow-hidden flex flex-col shadow-2xl">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-lg">购物车</h3>
                <button onClick={() => actions.setIsMobileCartOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <CartPanel
                  cart={state.sortedCart} products={state.products}
                  identity={state.identity} isDelivery={state.isDelivery} setIsDelivery={actions.setIsDelivery}
                  itemsTotal={state.itemsTotal} deliveryFee={state.deliveryFee} totalPrice={state.totalPrice}
                  onRemove={actions.removeFromCart} onAdd={(item) => actions.addToCart(item, item.variantId, item.isBrewingSelected, item.isFreezingSelected)}
                  onClear={actions.clearCart} onConfirm={() => { actions.setIsMobileCartOpen(false); actions.setShowConfirm(true); }}
                  onUpdateNote={actions.updateCartNote}
                  compact
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Order confirmation modal */}
      <AnimatePresence>
        {state.showConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) actions.setShowConfirm(false); }}>
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
              className="w-full max-w-md bg-white rounded-t-[28px] sm:rounded-[28px] p-6 max-h-[80vh] overflow-y-auto shadow-2xl">
              <h3 className="font-black text-xl mb-4">确认订单</h3>
              <div className="space-y-3">
                {state.sortedCart.map((item, i) => {
                  const up = getItemUnitPrice(item);
                  return (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="truncate">{item.name} x{item.quantity}</span>
                      <span className="font-bold ml-2">¥{(up * item.quantity).toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                <div className="flex justify-between text-sm"><span>小计</span><span>¥{state.itemsTotal.toFixed(2)}</span></div>
                {state.isDelivery && <div className="flex justify-between text-sm"><span>配送费</span><span className={state.deliveryFee === 0 ? 'text-green-600' : ''}>{state.deliveryFee === 0 ? '免配送费' : `¥${state.deliveryFee.toFixed(2)}`}</span></div>}
                <div className="flex justify-between font-black text-lg"><span>总计</span><span className="text-orange-600">¥{state.totalPrice.toFixed(2)}</span></div>
              </div>
              <label className="flex items-center gap-2 mt-3 cursor-pointer">
                <input type="checkbox" checked={state.isDelivery} onChange={e => actions.setIsDelivery(e.target.checked)}
                  className="w-4 h-4 rounded-md border-slate-300 text-orange-500" />
                <span className="text-sm font-bold">配送到寝（满¥20免配送费，否则¥1）</span>
              </label>
              <div className="flex gap-3 mt-5">
                <button onClick={() => actions.setShowConfirm(false)}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all">返回</button>
                <button onClick={actions.confirmAndCopy}
                  className="flex-1 py-4 bg-orange-500 text-white rounded-2xl font-black hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20 active:scale-[0.98]">
                  确认下单并复制
                </button>
              </div>
              <p className="text-[10px] text-slate-400 text-center mt-3">下单后自动复制订单内容，可粘贴到微信群</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Copied toast */}
      <AnimatePresence>
        {state.copied && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white px-5 py-3 rounded-2xl font-bold shadow-xl flex items-center gap-2">
            <Check size={16} /> 已复制！发到微信群吧
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── App Router ──

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route path="/" element={<CustomerApp />} />
          <Route path="/square" element={<SquareApp />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
