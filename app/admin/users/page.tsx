'use client';
import { useEffect, useState } from 'react';
import { Search, Eye, X, UserX, UserCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { createClient } from '@/lib/supabase/browser';

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  joined: Date;
  orders: number;
  spent: number;
  status: 'Active' | 'Banned';
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [viewUser, setViewUser] = useState<User | null>(null);

  const [supabase] = useState(() => createClient());

  const loadUsers = async () => {
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profileError) return;

    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('email,total,status');

    if (ordersError) return;

    const spendByEmail = new Map<string, { orders: number; spent: number }>();

    (orders || []).forEach((order: any) => {
      const email = String(order.email || '').trim().toLowerCase();
      if (!email) return;
      if (order.status === 'Cancelled') return;

      const current = spendByEmail.get(email) || { orders: 0, spent: 0 };
      current.orders += 1;
      current.spent += Number(order.total || 0);
      spendByEmail.set(email, current);
    });

    setUsers((profiles || []).map((profile: any) => {
      const emailKey = String(profile.email || '').trim().toLowerCase();
      const totals = spendByEmail.get(emailKey) || { orders: 0, spent: 0 };

      return ({
        id: profile.id,
        name: [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.email || 'Customer',
        email: profile.email || '',
        phone: profile.phone || '',
        joined: new Date(profile.created_at),
        orders: totals.orders,
        spent: totals.spent,
        status: profile.status === 'banned' ? 'Banned' : 'Active',
      });
    }));
  };

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    const refresh = () => loadUsers();

    const channel = supabase
      .channel('admin:users-spend')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, refresh)
      .subscribe();

    const intervalId = window.setInterval(refresh, 30000);

    return () => {
      window.clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const toggleBan = async (id: string) => {
    const user = users.find(u => u.id === id);
    const nextStatus = user?.status === 'Active' ? 'banned' : 'active';
    await supabase.from('profiles').update({ status: nextStatus, updated_at: new Date().toISOString() }).eq('id', id);
    await loadUsers();
    if (viewUser && viewUser.id === id) {
      setViewUser({ ...viewUser, status: viewUser.status === 'Active' ? 'Banned' : 'Active' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-syncopate font-bold tracking-widest">USERS</h1>
          <p className="text-white/50 mt-2">Manage customer accounts and access.</p>
        </div>
      </div>

      <div className="flex bg-[#0a0a0a] border border-white/10 p-4 rounded-xl">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input 
            type="text" placeholder="Search users..." 
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-md pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-white/30 transition-colors"
          />
        </div>
      </div>

      <div className="bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 border-b border-white/10 text-xs font-syncopate tracking-widest text-white/50">
              <tr>
                <th className="px-6 py-4 font-normal">USER</th>
                <th className="px-6 py-4 font-normal">JOINED</th>
                <th className="px-6 py-4 font-normal">ORDERS</th>
                <th className="px-6 py-4 font-normal">SPENT</th>
                <th className="px-6 py-4 font-normal">STATUS</th>
                <th className="px-6 py-4 font-normal text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filteredUsers.map(user => (
                <tr key={user.id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4">
                    <p className="font-bold">{user.name}</p>
                    <p className="text-xs text-white/50">{user.email}</p>
                  </td>
                  <td className="px-6 py-4 text-white/70">{format(user.joined, 'MMM dd, yyyy')}</td>
                  <td className="px-6 py-4">{user.orders}</td>
                  <td className="px-6 py-4 font-bold">LE {user.spent.toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${user.status === 'Active' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => setViewUser(user)} className="p-2 hover:bg-white/10 rounded-md transition-colors text-white/50 hover:text-white" title="View Details">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => toggleBan(user.id)} 
                        className={`p-2 rounded-md transition-colors ${user.status === 'Active' ? 'hover:bg-red-500/10 text-white/50 hover:text-red-500' : 'hover:bg-green-500/10 text-white/50 hover:text-green-500'}`}
                        title={user.status === 'Active' ? 'Ban User' : 'Unban User'}
                      >
                        {user.status === 'Active' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {viewUser && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 z-[2000] backdrop-blur-sm" onClick={() => setViewUser(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-xl p-6 z-[2001] shadow-2xl">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-bold font-syncopate tracking-widest">{viewUser.name}</h2>
                  <p className="text-white/50 text-sm">{viewUser.id}</p>
                </div>
                <button onClick={() => setViewUser(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-white/50">Email</span><span>{viewUser.email}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-white/50">Phone</span><span>{viewUser.phone}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-white/50">Joined</span><span>{format(viewUser.joined, 'MMM dd, yyyy')}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-white/50">Total Orders</span><span>{viewUser.orders}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-white/50">Total Spent</span><span className="font-bold">LE {viewUser.spent.toFixed(2)}</span>
                </div>
              </div>

              <button 
                onClick={() => toggleBan(viewUser.id)}
                className={`w-full font-syncopate font-bold text-xs tracking-widest py-3 rounded-md transition-colors ${viewUser.status === 'Active' ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20' : 'bg-green-500/10 text-green-500 hover:bg-green-500/20 border border-green-500/20'}`}
              >
                {viewUser.status === 'Active' ? 'BAN USER' : 'UNBAN USER'}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
