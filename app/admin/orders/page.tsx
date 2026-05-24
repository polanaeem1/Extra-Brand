'use client';
import { useEffect, useState } from 'react';
import { Search, Filter, Eye, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { createClient } from '@/lib/supabase/browser';
import { logSupabaseRequest } from '@/lib/supabase/debug';

type OrderStatus = 'Pending' | 'Confirmed' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled';

interface Order {
  id: string;
  dbId: string;
  customer: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  notes: string;
  date: Date;
  subtotal: number;
  shippingFee: number;
  total: number;
  status: OrderStatus;
  payment: string;
  paymentStatus: string;
  receiptUrl: string;
  products: { name: string; qty: number; price: number; size: string; color: string }[];
}

const STATUSES: OrderStatus[] = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
let ordersLoadPromise: Promise<any[] | null> | null = null;

const StatusBadge = ({ status }: { status: OrderStatus }) => {
  const colors = {
    Pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    Confirmed: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    Processing: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    Shipped: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
    Delivered: 'bg-green-500/10 text-green-500 border-green-500/20',
    Cancelled: 'bg-red-500/10 text-red-500 border-red-500/20',
  };
  return <span className={`px-3 py-1 rounded-full text-xs font-bold border ${colors[status]}`}>{status}</span>;
};

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState('');
  const [receiptError, setReceiptError] = useState('');

  const [supabase] = useState(() => createClient());

  const loadOrders = async () => {
    if (!ordersLoadPromise) {
      logSupabaseRequest('admin.orders.loadOrders');
      ordersLoadPromise = Promise.resolve(
        supabase
          .from('orders')
          .select('*, order_items(*)')
          .order('created_at', { ascending: false })
      ).then(({ data }) => data || [])
        .finally(() => {
          ordersLoadPromise = null;
        });
    }

    const data = await ordersLoadPromise;

    setOrders((data || []).map((order: any) => ({
      id: order.order_number || order.id,
      dbId: order.id,
      customer: order.customer_name || '',
      email: order.email || '',
      phone: order.phone || '',
      address: order.address || '',
      city: order.city || '',
      notes: order.notes || '',
      date: new Date(order.created_at),
      subtotal: Number(order.subtotal || 0),
      shippingFee: Number(order.shipping_fee || 0),
      total: Number(order.total || 0),
      status: order.status,
      payment: order.payment_method || 'COD',
      paymentStatus: order.payment_status || 'pending',
      receiptUrl: order.receipt_url || '',
      products: (order.order_items || []).map((item: any) => ({
        name: item.product_name,
        qty: Number(item.quantity || 0),
        price: Number(item.unit_price || 0),
        size: item.size,
        color: item.color || '',
      })),
    })));
  };

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    let refreshTimer: number | null = null;
    const refresh = () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(loadOrders, 750);
    };

    const channel = supabase
      .channel('admin:orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, refresh)
      .subscribe();

    return () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const filteredOrders = orders.filter((order) => {
    const needle = search.toLowerCase();
    const matchesSearch =
      order.customer.toLowerCase().includes(needle) ||
      order.id.toLowerCase().includes(needle) ||
      order.email.toLowerCase().includes(needle) ||
      order.phone.toLowerCase().includes(needle);
    const matchesStatus = statusFilter === 'All' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleStatusChange = (id: string, newStatus: OrderStatus) => {
    const order = orders.find((item) => item.id === id);
    if (!order?.dbId) return;

    supabase
      .from('orders')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', order.dbId)
      .then(() => loadOrders());
  };

  const handleViewOrder = async (order: Order) => {
    setViewOrder(order);
    setReceiptPreviewUrl('');
    setReceiptError('');

    if (order.payment === 'COD' || !order.receiptUrl) return;

    const { data, error } = await supabase.storage
      .from('payment-receipts')
      .createSignedUrl(order.receiptUrl, 60 * 10);

    if (error) {
      setReceiptError(error.message);
      return;
    }

    setReceiptPreviewUrl(data.signedUrl);
  };

  const closeModal = () => {
    setViewOrder(null);
    setReceiptPreviewUrl('');
    setReceiptError('');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-syncopate font-bold tracking-widest">ORDERS</h1>
          <p className="text-white/50 mt-2">Manage and track customer orders.</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between bg-[#0a0a0a] border border-white/10 p-4 rounded-xl">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            placeholder="Search by order ID, customer, email, or phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-md pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-white/30 transition-colors"
          />
        </div>
        <div className="relative">
          <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="appearance-none bg-white/5 border border-white/10 rounded-md pl-10 pr-8 py-2 text-sm focus:outline-none focus:border-white/30 transition-colors text-white"
          >
            <option value="All" className="bg-[#0a0a0a]">All Statuses</option>
            {STATUSES.map(status => (
              <option key={status} value={status} className="bg-[#0a0a0a]">{status}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 border-b border-white/10 text-xs font-syncopate tracking-widest text-white/50">
              <tr>
                <th className="px-6 py-4 font-normal">ORDER ID</th>
                <th className="px-6 py-4 font-normal">DATE</th>
                <th className="px-6 py-4 font-normal">CUSTOMER</th>
                <th className="px-6 py-4 font-normal">PAYMENT</th>
                <th className="px-6 py-4 font-normal">TOTAL</th>
                <th className="px-6 py-4 font-normal">STATUS</th>
                <th className="px-6 py-4 font-normal text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filteredOrders.map(order => (
                <tr key={order.dbId} className="hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4 font-bold">{order.id}</td>
                  <td className="px-6 py-4 text-white/70">{format(order.date, 'MMM dd, yyyy')}</td>
                  <td className="px-6 py-4">
                    <p>{order.customer}</p>
                    <p className="text-xs text-white/40">{order.phone}</p>
                  </td>
                  <td className="px-6 py-4 text-white/70">{order.payment}</td>
                  <td className="px-6 py-4 font-bold">LE {order.total.toFixed(2)}</td>
                  <td className="px-6 py-4"><StatusBadge status={order.status} /></td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleViewOrder(order)}
                        className="p-2 hover:bg-white/10 rounded-md transition-colors text-white/50 hover:text-white"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <select
                        value={order.status}
                        onChange={(e) => handleStatusChange(order.id, e.target.value as OrderStatus)}
                        className="bg-transparent border border-white/10 rounded-md px-2 py-1 text-xs text-white/70 focus:outline-none focus:border-white/30 cursor-pointer"
                      >
                        {STATUSES.map(status => (
                          <option key={status} value={status} className="bg-[#0a0a0a]">{status}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-white/50">No orders found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {viewOrder && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 z-[2000] backdrop-blur-sm"
              onClick={closeModal}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl bg-[#0a0a0a] border border-white/10 rounded-xl p-6 z-[2001] max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <div className="flex justify-between items-start mb-6 pb-6 border-b border-white/10">
                <div>
                  <h2 className="text-xl font-bold font-syncopate tracking-widest mb-2">ORDER DETAILS</h2>
                  <p className="text-white/50 text-sm">ID: {viewOrder.id} - {format(viewOrder.date, 'MMM dd, yyyy')}</p>
                </div>
                <button onClick={closeModal} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div>
                  <h3 className="text-xs font-syncopate tracking-widest text-white/50 mb-4">CUSTOMER INFO</h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-white/50">Name:</span> <span className="font-bold">{viewOrder.customer}</span></p>
                    <p><span className="text-white/50">Email:</span> <span className="text-white/80">{viewOrder.email || '-'}</span></p>
                    <p><span className="text-white/50">Phone:</span> <span className="text-white/80">{viewOrder.phone || '-'}</span></p>
                    <p><span className="text-white/50">City:</span> <span className="text-white/80">{viewOrder.city || '-'}</span></p>
                    <p><span className="text-white/50">Address:</span> <span className="text-white/80">{viewOrder.address || '-'}</span></p>
                    <p><span className="text-white/50">Notes:</span> <span className="text-white/80">{viewOrder.notes || '-'}</span></p>
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-syncopate tracking-widest text-white/50 mb-4">PAYMENT & STATUS</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                      <span className="text-sm text-white/70">Payment Method</span>
                      <span className="font-bold">{viewOrder.payment}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                      <span className="text-sm text-white/70">Payment Status</span>
                      <span className="font-bold uppercase">{viewOrder.paymentStatus}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                      <span className="text-sm text-white/70">Current Status</span>
                      <StatusBadge status={viewOrder.status} />
                    </div>
                  </div>
                </div>
              </div>

              {viewOrder.payment !== 'COD' && (
                <div className="mb-8">
                  <h3 className="text-xs font-syncopate tracking-widest text-white/50 mb-4">TRANSACTION PHOTO</h3>
                  {!viewOrder.receiptUrl && <p className="text-sm text-white/50">No transaction photo was attached.</p>}
                  {receiptError && <p className="text-sm text-red-400">Could not load receipt: {receiptError}</p>}
                  {receiptPreviewUrl && (
                    <a href={receiptPreviewUrl} target="_blank" rel="noreferrer" className="block border border-white/10 rounded-lg overflow-hidden bg-black">
                      <img src={receiptPreviewUrl} alt="Payment transaction receipt" className="w-full max-h-[520px] object-contain" />
                    </a>
                  )}
                </div>
              )}

              <h3 className="text-xs font-syncopate tracking-widest text-white/50 mb-4">ORDER ITEMS</h3>
              <div className="border border-white/10 rounded-lg overflow-hidden mb-6">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/5 border-b border-white/10 text-xs text-white/50">
                    <tr>
                      <th className="px-4 py-3 font-normal">PRODUCT</th>
                      <th className="px-4 py-3 font-normal text-center">SIZE</th>
                      <th className="px-4 py-3 font-normal text-center">COLOR</th>
                      <th className="px-4 py-3 font-normal text-center">QTY</th>
                      <th className="px-4 py-3 font-normal text-right">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {viewOrder.products.map((product, i) => (
                      <tr key={i}>
                        <td className="px-4 py-3 font-bold">{product.name}</td>
                        <td className="px-4 py-3 text-center">{product.size}</td>
                        <td className="px-4 py-3 text-center">{product.color || '-'}</td>
                        <td className="px-4 py-3 text-center">{product.qty}</td>
                        <td className="px-4 py-3 text-right">LE {(product.price * product.qty).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end border-t border-white/10 pt-6">
                <div className="w-64 space-y-3">
                  <div className="flex justify-between text-sm text-white/70">
                    <span>Subtotal</span>
                    <span>LE {viewOrder.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-white/70">
                    <span>Shipping</span>
                    <span>LE {viewOrder.shippingFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg pt-3 border-t border-white/10">
                    <span>Total</span>
                    <span>LE {viewOrder.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
