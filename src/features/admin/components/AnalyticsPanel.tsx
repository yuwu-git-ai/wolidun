import { useState, useEffect, useCallback } from 'react';
import { ChevronUp } from 'lucide-react';
import BarChart from './BarChart';
import { fetchStats } from '../../../shared/api';

type ChartData = { label: string; orders: number; revenue: number };

export default function AnalyticsPanel(_props: { onClose: () => void }) {
  const now = new Date();
  const [mode, setMode] = useState<'monthly' | 'yearly'>('monthly');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const params = mode === 'monthly'
      ? { view: 'monthly' as const, year, month }
      : { view: 'yearly' as const, year };
    fetchStats(params).then(s => {
      if (mode === 'monthly') {
        setChartData(s.daily.map(d => ({ label: d.label, orders: d.orders, revenue: d.revenue })));
      } else {
        setChartData(s.monthly.map(m => ({ label: m.label, orders: m.orders, revenue: m.revenue })));
      }
    }).catch(err => console.warn('Failed to load stats:', err)).finally(() => setLoading(false));
  }, [mode, year, month]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect
  useEffect(() => { const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  // Available years: from 2025 to current
  const availableYears = Array.from({ length: now.getFullYear() - 2024 }, (_, i) => 2025 + i);

  const totalOrders = chartData.reduce((s, d) => s + d.orders, 0);
  const totalRevenue = chartData.reduce((s, d) => s + d.revenue, 0);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-400 font-bold">累计订单</p>
          <p className="text-2xl font-black">{totalOrders}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-400 font-bold">累计营收</p>
          <p className="text-2xl font-black text-orange-600">¥{totalRevenue.toFixed(2)}</p>
        </div>
      </div>

      {/* Mode toggle + pickers */}
      <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm space-y-3">
        {/* Mode toggle */}
        <div className="flex bg-slate-100 rounded-xl p-1">
          <button onClick={() => setMode('monthly')}
            className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${mode === 'monthly' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}`}>按月查看</button>
          <button onClick={() => setMode('yearly')}
            className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${mode === 'yearly' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}`}>按年查看</button>
        </div>

        {/* Year picker */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 w-8">年份</span>
          <button onClick={() => setYear(y => y - 1)} disabled={year <= 2025}
            className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 disabled:opacity-30 transition-colors">
            <ChevronUp size={16} className="-rotate-90" />
          </button>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))}
            className="px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200 text-sm font-bold outline-none focus:border-orange-300">
            {availableYears.map(y => <option key={y} value={y}>{y}年</option>)}
          </select>
          <button onClick={() => setYear(y => y + 1)} disabled={year >= now.getFullYear()}
            className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 disabled:opacity-30 transition-colors">
            <ChevronUp size={16} className="rotate-90" />
          </button>

          {/* Month picker (only in monthly mode) */}
          {mode === 'monthly' && (<>
            <span className="text-xs font-bold text-slate-400 ml-3 w-8">月份</span>
            <button onClick={() => setMonth(m => m === 1 ? 12 : m - 1)}
              className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
              <ChevronUp size={16} className="-rotate-90" />
            </button>
            <select value={month} onChange={e => setMonth(parseInt(e.target.value))}
              className="px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200 text-sm font-bold outline-none focus:border-orange-300">
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}月</option>)}
            </select>
            <button onClick={() => setMonth(m => m === 12 ? 1 : m + 1)}
              className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
              <ChevronUp size={16} className="rotate-90" />
            </button>
          </>)}
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm overflow-x-auto">
        {loading ? <p className="text-center text-slate-400 py-10">加载中...</p> : <BarChart data={chartData} />}
      </div>

      {/* Data table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-50 text-slate-400">
                <th className="text-left px-4 py-2 font-bold text-xs">{mode === 'monthly' ? '日期' : '月份'}</th>
                <th className="text-center px-4 py-2 font-bold text-xs">订单数</th>
                <th className="text-right px-4 py-2 font-bold text-xs">营业额</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map(d => (
                <tr key={d.label} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-2.5">{d.label}</td>
                  <td className="text-center px-4 py-2.5">{d.orders}</td>
                  <td className="text-right px-4 py-2.5">{d.revenue > 0 ? `¥${d.revenue.toFixed(2)}` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
