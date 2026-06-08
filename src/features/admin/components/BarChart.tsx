type ChartData = { label: string; orders: number; revenue: number };

interface BarChartProps {
  data: ChartData[];
}

export default function BarChart({ data }: BarChartProps) {
  if (data.length === 0) return <p className="text-center text-slate-400 py-10">暂无数据</p>;

  const W = Math.max(500, data.length * 32);
  const H = 220;
  const PAD = { top: 24, right: 52, bottom: 36, left: 44 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const maxOrders = Math.max(...data.map(d => d.orders), 1);
  const maxRevenue = Math.max(...data.map(d => d.revenue), 1);
  const yMaxOrders = Math.ceil(maxOrders / 5) * 5 || 5;
  const yMaxRevenue = Math.ceil(maxRevenue / 5) * 5 || 5;

  const scaleYOrders = (v: number) => PAD.top + innerH - (v / yMaxOrders) * innerH;
  const scaleYRevenue = (v: number) => PAD.top + innerH - (v / yMaxRevenue) * innerH;

  const barGroupW = innerW / data.length;
  const gap = barGroupW * 0.3;
  const barW = (barGroupW - gap * 3) / 2;
  const yTicks = 5;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ maxHeight: '280px' }}>
      {/* Grid lines */}
      {Array.from({ length: yTicks + 1 }, (_, i) => (
        <line key={`g${i}`}
          x1={PAD.left} x2={W - PAD.right}
          y1={PAD.top + (innerH / yTicks) * i} y2={PAD.top + (innerH / yTicks) * i}
          stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4,3" />
      ))}
      {/* X axis */}
      <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} stroke="#e2e8f0" strokeWidth="1" />

      {/* Bars */}
      {data.map((d, i) => {
        const gx = PAD.left + barGroupW * i;
        const ox = gx + gap;
        const rx = ox + barW + gap;
        const oh = Math.max(1, (d.orders / yMaxOrders) * innerH);
        const rh = Math.max(1, (d.revenue / yMaxRevenue) * innerH);
        return (
          <g key={i}>
            <rect x={ox} y={PAD.top + innerH - oh} width={barW} height={oh} rx="2" fill="#6366f1" opacity="0.75">
              <title>{d.label} 订单: {d.orders} 单</title>
            </rect>
            <rect x={rx} y={PAD.top + innerH - rh} width={barW} height={rh} rx="2" fill="#f59e0b" opacity="0.75">
              <title>{d.label} 营收: ¥{d.revenue.toFixed(2)}</title>
            </rect>
          </g>
        );
      })}

      {/* X labels */}
      {data.map((d, i) => {
        const interval = data.length <= 7 ? 1 : data.length <= 15 ? 2 : data.length <= 31 ? 5 : Math.ceil(data.length / 12);
        const show = i % interval === 0 || i === data.length - 1;
        if (!show) return null;
        const gx = PAD.left + barGroupW * i + barGroupW / 2;
        return <text key={`xl${i}`} x={gx} y={H - 4} textAnchor="middle" fontSize="10" fill="#94a3b8" fontFamily="system-ui">{d.label}</text>;
      })}

      {/* Y labels - orders (left) */}
      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const v = Math.round((yMaxOrders / yTicks) * i);
        return <text key={`yl${i}`} x={PAD.left - 6} y={scaleYOrders(v) + 3} textAnchor="end" fontSize="10" fill="#94a3b8" fontFamily="system-ui">{v}</text>;
      })}
      {/* Y labels - revenue (right) */}
      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const v = Math.round((yMaxRevenue / yTicks) * i);
        return <text key={`yr${i}`} x={W - PAD.right + 6} y={scaleYRevenue(v) + 3} textAnchor="start" fontSize="10" fill="#94a3b8" fontFamily="system-ui">¥{v}</text>;
      })}

      {/* Legend */}
      <g transform={`translate(${PAD.left}, 6)`}>
        <rect x="0" y="0" width="10" height="10" rx="2" fill="#6366f1" opacity="0.75" />
        <text x="14" y="9" fontSize="11" fill="#64748b" fontWeight="600" fontFamily="system-ui">订单</text>
        <rect x="44" y="0" width="10" height="10" rx="2" fill="#f59e0b" opacity="0.75" />
        <text x="58" y="9" fontSize="11" fill="#64748b" fontWeight="600" fontFamily="system-ui">营收</text>
      </g>
    </svg>
  );
}
