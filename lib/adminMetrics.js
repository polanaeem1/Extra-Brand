const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const STATUS_COLORS = ['#ffffff', '#888888', '#444444', '#666666', '#aaaaaa', '#ff4444'];

export function isRevenueOrder(order) {
  return order.status !== 'Cancelled';
}

export function lastMonths(count = 6) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      name: MONTHS[date.getMonth()],
      year: date.getFullYear(),
      month: date.getMonth(),
    };
  });
}

export function monthlyRevenueData(orders, count = 6) {
  const months = lastMonths(count);
  const totals = new Map(months.map((month) => [month.key, 0]));

  orders.filter(isRevenueOrder).forEach((order) => {
    const date = new Date(order.created_at);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    if (totals.has(key)) {
      totals.set(key, totals.get(key) + Number(order.total || 0));
    }
  });

  return months.map((month) => ({
    name: month.name,
    total: totals.get(month.key) || 0,
    sales: totals.get(month.key) || 0,
  }));
}

export function statusBreakdown(orders) {
  const statusOrder = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
  const counts = new Map(statusOrder.map((status) => [status, 0]));

  orders.forEach((order) => {
    counts.set(order.status || 'Pending', (counts.get(order.status || 'Pending') || 0) + 1);
  });

  return Array.from(counts.entries())
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({ name, value }));
}

export function productRevenueData(orders, limit = 6) {
  const products = new Map();

  orders.filter(isRevenueOrder).forEach((order) => {
    (order.order_items || []).forEach((item) => {
      const current = products.get(item.product_name) || { name: item.product_name, sales: 0, revenue: 0 };
      current.sales += Number(item.quantity || 0);
      current.revenue += Number(item.line_total || 0);
      products.set(item.product_name, current);
    });
  });

  return Array.from(products.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

export function recentActivity(orders, limit = 4) {
  return [...orders]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit)
    .map((order) => {
      const firstItem = order.order_items?.[0];
      return {
        id: order.id,
        title: `Order ${order.order_number || order.id.slice(0, 8)} received`,
        detail: `${order.customer_name} ordered ${firstItem?.product_name || 'products'} — LE ${Number(order.total || 0).toFixed(2)}`,
        time: timeAgo(order.created_at),
      };
    });
}

export function trafficSourceData(pageViews) {
  const counts = new Map();
  pageViews.forEach((view) => {
    const source = view.source || 'Direct';
    counts.set(source, (counts.get(source) || 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function dailyVisitorsData(pageViews) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return {
      key: date.toISOString().slice(0, 10),
      d: date.toLocaleDateString('en', { weekday: 'short' }),
      visitors: new Set(),
    };
  });

  const byKey = new Map(days.map((day) => [day.key, day]));
  pageViews.forEach((view) => {
    const key = new Date(view.created_at).toISOString().slice(0, 10);
    const day = byKey.get(key);
    if (day) day.visitors.add(view.visitor_id || view.id);
  });

  return days.map((day) => ({
    d: day.d,
    v: day.visitors.size,
  }));
}

function timeAgo(value) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(diffMs / 60000));
  if (minutes < 60) return `${minutes} MINS AGO`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} HOURS AGO`;
  return `${Math.round(hours / 24)} DAYS AGO`;
}
