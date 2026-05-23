'use client';
import { useEffect, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { createClient } from '@/lib/supabase/browser';
import {
  dailyVisitorsData,
  monthlyRevenueData,
  productRevenueData,
  trafficSourceData,
  STATUS_COLORS,
} from '@/lib/adminMetrics';

export default function AdminAnalytics() {
  const [monthlyRevenue, setMonthlyRevenue] = useState<any[]>([]);
  const [productRevenue, setProductRevenue] = useState<any[]>([]);
  const [trafficSources, setTrafficSources] = useState<any[]>([]);
  const [dailyVisitors, setDailyVisitors] = useState<any[]>([]);
  const [visitStats, setVisitStats] = useState({ totalVisits: 0, uniqueVisitors: 0, purchases: 0, conversionRate: 0 });
  const [funnelRange, setFunnelRange] = useState<'today' | '7d' | '30d'>('30d');
  const [funnelStats, setFunnelStats] = useState({
    addToCartUsers: 0,
    purchasersAfterAdd: 0,
    abandonedUsers: 0,
    conversionRate: 0,
  });

  useEffect(() => {
    const supabase = createClient();
    const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
    const since180 = new Date(Date.now() - 180 * 86400000).toISOString();

    let cancelled = false;

    const load = async () => {
      const [ordersResult, visitsResult] = await Promise.all([
        supabase
          .from('orders')
          .select('created_at,total,status,order_items(product_name,quantity,line_total)')
          .gte('created_at', since180),
        supabase
          .from('analytics_visits')
          .select('id,traffic_source,visitor_id,visit_date,created_at')
          .gte('created_at', since30)
          .limit(10000),
      ]);

      if (cancelled) return;

      const orders = ordersResult.data || [];
      const visits = visitsResult.data || [];

      setMonthlyRevenue(monthlyRevenueData(orders, 6));
      setProductRevenue(productRevenueData(orders, 6));
      setTrafficSources(trafficSourceData(visits as any));
      setDailyVisitors(dailyVisitorsData(visits as any));

      const uniqueVisitors = new Set(visits.map((v: any) => v.visitor_id).filter(Boolean)).size;
      const purchases = orders
        .filter((o: any) => o.status !== 'Cancelled')
        .filter((o: any) => new Date(o.created_at).toISOString() >= since30).length;
      const conversionRate = uniqueVisitors ? (purchases / uniqueVisitors) * 100 : 0;
      setVisitStats({
        totalVisits: visits.length,
        uniqueVisitors,
        purchases,
        conversionRate,
      });
    };

    load();
    const interval = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const rangeSince = () => {
      const now = new Date();
      if (funnelRange === 'today') {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        return start.toISOString();
      }
      const days = funnelRange === '7d' ? 7 : 30;
      return new Date(Date.now() - days * 86400000).toISOString();
    };

    const loadFunnel = async () => {
      const since = rangeSince();

      const [cartResult, ordersResult] = await Promise.all([
        supabase
          .from('cart_events')
          .select('visitor_id,user_id,created_at')
          .gte('created_at', since)
          .limit(50000),
        supabase
          .from('orders')
          .select('visitor_id,user_id,created_at,status')
          .gte('created_at', since)
          .limit(20000),
      ]);

      if (cancelled) return;

      const cartEvents = cartResult.data || [];
      const orders = ordersResult.data || [];

      const keyFor = (row: any) => {
        if (row?.user_id) return `u:${row.user_id}`;
        if (row?.visitor_id) return `v:${row.visitor_id}`;
        return '';
      };

      const earliestAdd = new Map<string, number>();
      cartEvents.forEach((evt: any) => {
        const key = keyFor(evt);
        if (!key) return;
        const ts = new Date(evt.created_at).getTime();
        const prev = earliestAdd.get(key);
        if (!prev || ts < prev) earliestAdd.set(key, ts);
      });

      const purchasers = new Set<string>();
      orders
        .filter((o: any) => o?.status !== 'Cancelled')
        .forEach((order: any) => {
          const key = keyFor(order);
          if (!key) return;
          const addTs = earliestAdd.get(key);
          if (!addTs) return;
          const orderTs = new Date(order.created_at).getTime();
          if (orderTs >= addTs) purchasers.add(key);
        });

      const addToCartUsers = earliestAdd.size;
      const purchasersAfterAdd = purchasers.size;
      const abandonedUsers = Math.max(0, addToCartUsers - purchasersAfterAdd);
      const conversionRate = addToCartUsers ? (purchasersAfterAdd / addToCartUsers) * 100 : 0;

      setFunnelStats({
        addToCartUsers,
        purchasersAfterAdd,
        abandonedUsers,
        conversionRate,
      });
    };

    loadFunnel();
    const interval = setInterval(loadFunnel, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [funnelRange]);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-syncopate font-bold tracking-widest">ANALYTICS</h1>
          <p className="text-white/50 mt-2">Deep dive into your store's performance.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: 'TOTAL VISITS (30D)', value: visitStats.totalVisits.toLocaleString() },
          { title: 'UNIQUE VISITORS (30D)', value: visitStats.uniqueVisitors.toLocaleString() },
          { title: 'PURCHASES (30D)', value: visitStats.purchases.toLocaleString() },
          { title: 'CONVERSION (30D)', value: `${visitStats.conversionRate.toFixed(1)}%` },
        ].map((stat) => (
          <div key={stat.title} className="bg-[#0a0a0a] border border-white/10 p-6 rounded-xl">
            <p className="text-xs font-syncopate text-white/50 tracking-widest">{stat.title}</p>
            <h3 className="text-3xl font-bold font-inter mt-4">{stat.value}</h3>
            <p className="text-[10px] text-white/30 font-syncopate mt-4 tracking-widest">LIVE FROM SUPABASE</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#0a0a0a] border border-white/10 p-6 rounded-xl">
          <h2 className="text-sm font-syncopate tracking-widest mb-6">MONTHLY REVENUE</h2>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyRevenue}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ffffff" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ffffff" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `LE ${v}`} />
                <Tooltip contentStyle={{ backgroundColor: '#000', borderColor: 'rgba(255,255,255,0.1)' }} />
                <Area type="monotone" dataKey="sales" stroke="#ffffff" fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#0a0a0a] border border-white/10 p-6 rounded-xl">
          <h2 className="text-sm font-syncopate tracking-widest mb-6">PRODUCT REVENUE</h2>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productRevenue} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" stroke="rgba(255,255,255,0.7)" fontSize={10} width={120} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#000', borderColor: 'rgba(255,255,255,0.1)' }} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                <Bar dataKey="revenue" fill="#ffffff" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#0a0a0a] border border-white/10 p-6 rounded-xl">
          <h2 className="text-sm font-syncopate tracking-widest mb-6">TRAFFIC SOURCES</h2>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={trafficSources} cx="50%" cy="50%" innerRadius={80} outerRadius={110} paddingAngle={2} dataKey="value" stroke="none" label>
                  {trafficSources.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#000', borderColor: 'rgba(255,255,255,0.1)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {trafficSources.length === 0 && <p className="text-sm text-white/50 text-center">No traffic data yet.</p>}
        </div>

        <div className="bg-[#0a0a0a] border border-white/10 p-6 rounded-xl">
          <h2 className="text-sm font-syncopate tracking-widest mb-6">DAILY VISITORS (LAST 7 DAYS)</h2>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyVisitors}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="d" stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: '#000', borderColor: 'rgba(255,255,255,0.1)' }} />
                <Line type="monotone" dataKey="v" stroke="#ffffff" strokeWidth={3} dot={{ fill: '#000', stroke: '#fff', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#0a0a0a] border border-white/10 p-6 rounded-xl">
          <div className="flex items-center justify-between gap-4 mb-6">
            <h2 className="text-sm font-syncopate tracking-widest">CART TO PURCHASE FUNNEL</h2>
            <div className="flex items-center gap-2">
              {[
                { key: 'today', label: 'TODAY' },
                { key: '7d', label: '7 DAYS' },
                { key: '30d', label: '30 DAYS' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setFunnelRange(opt.key as any)}
                  className={
                    (funnelRange === opt.key
                      ? 'bg-white text-black '
                      : 'bg-white/5 text-white/70 hover:text-white ') +
                    'border border-white/10 font-syncopate text-[10px] font-bold tracking-widest px-3 py-2 rounded-md transition-colors'
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: 'ADD TO CART', value: funnelStats.addToCartUsers },
                  { name: 'PURCHASED', value: funnelStats.purchasersAfterAdd },
                  { name: 'ABANDONED', value: funnelStats.abandonedUsers },
                ]}
                margin={{ left: 10, right: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: '#000', borderColor: 'rgba(255,255,255,0.1)' }} />
                <Bar dataKey="value" fill="#ffffff" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 flex items-center justify-between gap-4 text-xs">
            <div className="text-white/70 font-syncopate tracking-widest">
              CONVERSION <span className="text-white">{funnelStats.conversionRate.toFixed(1)}%</span>
            </div>
            <div className="text-white/30 font-syncopate tracking-widest text-[10px]">LINKED BY VISITOR_ID / USER_ID</div>
          </div>
        </div>
      </div>
    </div>
  );
}
