import { Router, Request, Response } from 'express';
import { getDb } from '../db';

const router = Router();

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// GET /api/stats
// Query params:
//   view=monthly&year=2026&month=6  → all days in that month (filled with 0)
//   view=yearly&year=2026            → all 12 months (filled with 0)
//   (no params)                      → today's stats + popular products (legacy)
router.get('/stats', (req: Request, res: Response) => {
  const db = getDb();
  const { view, year: yearStr, month: monthStr } = req.query as Record<string, string>;

  // Popular products
  const orders = db.prepare(
    `SELECT items FROM orders WHERE datetime(created_at, '+8 hours') > datetime('now', '+8 hours', '-30 days')`
  ).all() as any[];

  const productCounts = new Map<string, number>();
  for (const row of orders) {
    const items = typeof row.items === 'string' ? JSON.parse(row.items) : row.items;
    for (const item of items) {
      productCounts.set(item.id, (productCounts.get(item.id) || 0) + item.quantity);
    }
  }

  const popular = [...productCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => ({ id, count }));

  // Today's stats
  const today = db.prepare(
    `SELECT COUNT(*) as count, COALESCE(SUM(total_price), 0) as revenue
     FROM orders WHERE date(datetime(created_at, '+8 hours')) = date(datetime('now', '+8 hours')) AND status != 'cancelled'`
  ).get() as any;

  // ── Monthly view: all days of a specific month ──
  if (view === 'monthly' && yearStr && monthStr) {
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);
    const totalDays = daysInMonth(year, month);

    // Get actual data for days in this month
    const rows = db.prepare(
      `SELECT date(datetime(created_at, '+8 hours')) as d,
              COUNT(*) as count,
              COALESCE(SUM(total_price), 0) as revenue
       FROM orders
       WHERE status != 'cancelled'
         AND strftime('%Y-%m', datetime(created_at, '+8 hours')) = ?
       GROUP BY d ORDER BY d ASC`
    ).all(`${year}-${String(month).padStart(2, '0')}`) as any[];

    const dataMap = new Map<string, { orders: number; revenue: number }>();
    for (const row of rows) {
      dataMap.set(row.d, { orders: row.count, revenue: row.revenue });
    }

    const daily = Array.from({ length: totalDays }, (_, i) => {
      const day = i + 1;
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const d = dataMap.get(dateStr);
      return {
        label: `${month}/${day}`,
        date: dateStr,
        orders: d ? d.orders : 0,
        revenue: d ? d.revenue : 0,
      };
    });

    return res.json({ popular, today: { orders: today.count, revenue: today.revenue }, daily, monthly: [] });
  }

  // ── Yearly view: all 12 months ──
  if (view === 'yearly' && yearStr) {
    const year = parseInt(yearStr);

    const rows = db.prepare(
      `SELECT strftime('%m', datetime(created_at, '+8 hours')) as m,
              COUNT(*) as count,
              COALESCE(SUM(total_price), 0) as revenue
       FROM orders
       WHERE status != 'cancelled'
         AND strftime('%Y', datetime(created_at, '+8 hours')) = ?
       GROUP BY m ORDER BY m ASC`
    ).all(String(year)) as any[];

    const dataMap = new Map<string, { orders: number; revenue: number }>();
    for (const row of rows) {
      dataMap.set(row.m, { orders: row.count, revenue: row.revenue });
    }

    const monthly = Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, '0');
      const d = dataMap.get(m);
      return {
        label: `${i + 1}月`,
        month: `${year}-${m}`,
        orders: d ? d.orders : 0,
        revenue: d ? d.revenue : 0,
      };
    });

    return res.json({ popular, today: { orders: today.count, revenue: today.revenue }, daily: [], monthly });
  }

  // ── Legacy: all data ──
  const dailyRows = db.prepare(
    `SELECT date(datetime(created_at, '+8 hours')) as d,
            COUNT(*) as count,
            COALESCE(SUM(total_price), 0) as revenue
     FROM orders WHERE status != 'cancelled'
     GROUP BY d ORDER BY d ASC`
  ).all() as any[];

  const daily = dailyRows.map((r: any) => {
    const parts = r.d.split('-');
    return { label: `${parseInt(parts[1])}/${parseInt(parts[2])}`, date: r.d, orders: r.count, revenue: r.revenue };
  });

  const monthlyRows = db.prepare(
    `SELECT strftime('%Y-%m', datetime(created_at, '+8 hours')) as m,
            COUNT(*) as count,
            COALESCE(SUM(total_price), 0) as revenue
     FROM orders WHERE status != 'cancelled'
     GROUP BY m ORDER BY m ASC`
  ).all() as any[];

  const monthly = monthlyRows.map((r: any) => ({
    label: r.m,
    month: r.m,
    orders: r.count,
    revenue: r.revenue,
  }));

  res.json({
    popular,
    today: { orders: today.count, revenue: today.revenue },
    daily,
    monthly,
  });
});

export default router;
