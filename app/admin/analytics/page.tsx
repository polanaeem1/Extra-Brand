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

  useEffect(() => {
    const supabase = createClient();

    Promise.all([
      supabase.from('orders').select('created_at,total,status,order_items(product_name,quantity,line_total)'),
      supabase.from('page_views').select('id,source,visitor_id,created_at').gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
    ]).then(([ordersResult, viewsResult]) => {
      const orders = ordersResult.data || [];
      const pageViews = viewsResult.data || [];

      setMonthlyRevenue(monthlyRevenueData(orders, 6));
      setProductRevenue(productRevenueData(orders, 6));
      setTrafficSources(trafficSourceData(pageViews));
      setDailyVisitors(dailyVisitorsData(pageViews));
    });
  }, []);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-syncopate font-bold tracking-widest">ANALYTICS</h1>
          <p className="text-white/50 mt-2">Deep dive into your store's performance.</p>
        </div>
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
    </div>
  );
}
