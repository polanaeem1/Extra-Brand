'use client';
import { useEffect, useState } from 'react';
import {
  DollarSign, ShoppingBag, Users, Activity,
  ArrowUpRight, ArrowDownRight, Package
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/browser';
import {
  monthlyRevenueData,
  productRevenueData,
  recentActivity,
  statusBreakdown,
  STATUS_COLORS,
} from '@/lib/adminMetrics';
import { logSupabaseRequest } from '@/lib/supabase/debug';

let overviewCache: {
  value: any;
  expiresAt: number;
  promise: Promise<any> | null;
} = { value: null, expiresAt: 0, promise: null };

const OVERVIEW_CACHE_MS = 30_000;

export default function AdminOverview() {
  const [stats, setStats] = useState({ revenue: 0, orders: 0, users: 0, products: 0 });
  const [salesData, setSalesData] = useState<any[]>([]);
  const [statusData, setStatusData] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const loadOverview = () => {
      const now = Date.now();
      if (overviewCache.value && overviewCache.expiresAt > now) {
        return Promise.resolve(overviewCache.value);
      }
      if (overviewCache.promise) return overviewCache.promise;

      logSupabaseRequest('admin.overview.load');
      overviewCache.promise = Promise.all([
        supabase.from('orders').select('id,order_number,customer_name,total,status,created_at,order_items(product_name,quantity,line_total)'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('products').select('id', { count: 'exact', head: true }),
      ]).then(([ordersResult, usersResult, productsResult]) => {
        const value = { ordersResult, usersResult, productsResult };
        overviewCache.value = value;
        overviewCache.expiresAt = Date.now() + OVERVIEW_CACHE_MS;
        return value;
      }).finally(() => {
        overviewCache.promise = null;
      });

      return overviewCache.promise;
    };

    loadOverview().then(({ ordersResult, usersResult, productsResult }) => {
      if (cancelled) return;
      const orders = ordersResult.data || [];
      const revenueOrders = orders.filter((order: any) => order.status !== 'Cancelled');

      setStats({
        revenue: revenueOrders.reduce((sum: number, order: any) => sum + Number(order.total || 0), 0),
        orders: orders.length,
        users: usersResult.count || 0,
        products: productsResult.count || 0,
      });
      setSalesData(monthlyRevenueData(orders, 6));
      setStatusData(statusBreakdown(orders));
      setTopProducts(productRevenueData(orders, 4));
      setActivities(recentActivity(orders, 4));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const totalStatusOrders = statusData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="space-y-8 pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-syncopate font-bold tracking-widest">OVERVIEW</h1>
          <p className="text-white/50 mt-2">Welcome back, Admin. Here's what's happening today.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: 'TOTAL REVENUE', value: `LE ${stats.revenue.toLocaleString()}`, icon: DollarSign, trend: 'LIVE', up: true },
          { title: 'TOTAL ORDERS', value: stats.orders.toLocaleString(), icon: ShoppingBag, trend: 'LIVE', up: true },
          { title: 'TOTAL USERS', value: stats.users.toLocaleString(), icon: Users, trend: 'LIVE', up: true },
          { title: 'PRODUCTS', value: stats.products.toLocaleString(), icon: Activity, trend: 'LIVE', up: true },
        ].map((stat, i) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-[#0a0a0a] border border-white/10 p-6 rounded-xl relative overflow-hidden group"
          >
            <div className="flex justify-between items-start mb-4">
              <p className="text-xs font-syncopate text-white/50 tracking-widest">{stat.title}</p>
              <stat.icon className="w-5 h-5 text-white/40" />
            </div>
            <h3 className="text-3xl font-bold font-inter">{stat.value}</h3>
            <div className={`flex items-center gap-1 mt-4 text-xs font-bold ${stat.up ? 'text-green-500' : 'text-red-500'}`}>
              {stat.up ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              {stat.trend} <span className="text-white/30 font-normal ml-1">from Supabase</span>
            </div>
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-colors" />
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#0a0a0a] border border-white/10 p-6 rounded-xl">
          <h2 className="text-sm font-syncopate tracking-widest mb-6">REVENUE OVERVIEW</h2>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ffffff" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ffffff" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `LE ${value}`} />
                <Tooltip contentStyle={{ backgroundColor: '#000', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }} itemStyle={{ color: '#fff' }} />
                <Area type="monotone" dataKey="total" stroke="#ffffff" fillOpacity={1} fill="url(#colorTotal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#0a0a0a] border border-white/10 p-6 rounded-xl flex flex-col">
          <h2 className="text-sm font-syncopate tracking-widest mb-6">ORDERS BY STATUS</h2>
          <div className="flex-1 h-[200px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#000', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col">
              <span className="text-3xl font-bold">{totalStatusOrders}</span>
              <span className="text-[10px] text-white/50 font-syncopate tracking-widest">TOTAL</span>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-4 justify-center">
            {statusData.length === 0 && <p className="text-sm text-white/50">No orders yet.</p>}
            {statusData.map((item, i) => (
              <div key={item.name} className="flex items-center gap-2 text-xs text-white/70">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[i % STATUS_COLORS.length] }}></div>
                {item.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#0a0a0a] border border-white/10 p-6 rounded-xl">
          <h2 className="text-sm font-syncopate tracking-widest mb-6">RECENT ACTIVITY</h2>
          <div className="space-y-6">
            {activities.length === 0 && <p className="text-sm text-white/50">No order activity yet.</p>}
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 flex-shrink-0">
                  <ShoppingBag className="w-4 h-4 text-white/70" />
                </div>
                <div>
                  <p className="text-sm font-bold">{activity.title}</p>
                  <p className="text-xs text-white/50 mt-1">{activity.detail}</p>
                  <p className="text-[10px] text-white/30 font-syncopate mt-2">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#0a0a0a] border border-white/10 p-6 rounded-xl">
          <h2 className="text-sm font-syncopate tracking-widest mb-6">TOP SELLING PRODUCTS</h2>
          <div className="space-y-4">
            {topProducts.length === 0 && <p className="text-sm text-white/50">No product sales yet.</p>}
            {topProducts.map((prod, i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#050505] rounded-md flex items-center justify-center border border-white/10">
                    <Package className="w-5 h-5 text-white/50" />
                  </div>
                  <div>
                    <p className="text-sm font-bold line-clamp-1">{prod.name}</p>
                    <p className="text-xs text-white/50 mt-1">{prod.sales} sales</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">LE {Number(prod.revenue || 0).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
