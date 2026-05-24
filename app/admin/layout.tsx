'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/browser';
import { getCurrentAdmin } from '@/lib/supabase/admin';
import { logSupabaseRequest } from '@/lib/supabase/debug';
import { authRateLimitMessage, signOutOnce } from '@/lib/supabase/authState';
import { 
  LayoutDashboard, ShoppingBag, Package, 
  Users, LineChart, LogOut, Bell, Search, Menu, Tag, MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const navItems = [
  { name: 'Overview', href: '/admin', icon: LayoutDashboard },
  { name: 'Orders', href: '/admin/orders', icon: ShoppingBag },
  { name: 'Products', href: '/admin/products', icon: Package },
  { name: 'Promo Codes', href: '/admin/promos', icon: Tag },
  { name: 'Messages', href: '/admin/messages', icon: MessageSquare },
  { name: 'Users', href: '/admin/users', icon: Users },
  { name: 'Analytics', href: '/admin/analytics', icon: LineChart },
];

let notificationsLoadPromise: Promise<{ orders: any[]; messages: any[] } | null> | null = null;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authMessage, setAuthMessage] = useState('');
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifOrders, setNotifOrders] = useState<any[]>([]);
  const [notifMessages, setNotifMessages] = useState<any[]>([]);
  const [notifError, setNotifError] = useState('');
  const notifRef = useRef<HTMLDivElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioUnlockedRef = useRef(false);
  const notifKeysRef = useRef<Set<string>>(new Set());
  const didLoadNotificationsRef = useRef(false);
  const [supabase] = useState(() => createClient());

  const playNotificationSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass || !audioUnlockedRef.current) return;

      const context = audioContextRef.current || new AudioContextClass();
      audioContextRef.current = context;
      if (context.state === 'suspended') context.resume();

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1320, context.currentTime + 0.08);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.2);
    } catch {
      // Browser audio can be blocked until a user gesture; notification UI still works.
    }
  };

  useEffect(() => {
    let isMounted = true;
    let retryTimer: number | null = null;

    const verifyAdmin = (allowRetry = true) => getCurrentAdmin().then(({ isAdmin, rateLimited }) => {
      if (!isMounted) return;

      if (rateLimited) {
        setAuthMessage(authRateLimitMessage());
        setIsLoading(false);
        return;
      }

      if (!isAdmin) {
        if (allowRetry) {
          retryTimer = window.setTimeout(() => verifyAdmin(false), 2000);
          return;
        }
        const next = encodeURIComponent(pathname || '/admin');
        window.location.href = `/login?next=${next}`;
        return;
      }

      setIsAuthenticated(true);
      setIsLoading(false);
      setAuthMessage('');
    });

    verifyAdmin(true);

    return () => {
      isMounted = false;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [pathname]);

  useEffect(() => {
    // Close mobile nav when navigating.
    setIsMobileNavOpen(false);
    setIsNotifOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const unlockAudio = () => {
      audioUnlockedRef.current = true;
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;
        const context = audioContextRef.current || new AudioContextClass();
        audioContextRef.current = context;
        if (context.state === 'suspended') context.resume();
      } catch {
        // ignore
      }
    };
    window.addEventListener('pointerdown', unlockAudio, { once: true });

    const loadNotifications = async () => {
      if (!notificationsLoadPromise) {
        logSupabaseRequest('admin.notifications.load');
        notificationsLoadPromise = Promise.all([
          supabase
            .from('orders')
            .select('id,order_number,customer_name,status,created_at,total')
            .order('created_at', { ascending: false })
            .limit(6),
          supabase
            .from('contact_messages')
            .select('id,name,email,message,is_read,created_at')
            .order('created_at', { ascending: false })
            .limit(6),
        ]).then(([ordersResult, messagesResult]) => {
          if (ordersResult.error) throw ordersResult.error;
          if (messagesResult.error) throw messagesResult.error;
          return {
            orders: ordersResult.data || [],
            messages: messagesResult.data || [],
          };
        }).finally(() => {
          notificationsLoadPromise = null;
        });
      }

      let result: { orders: any[]; messages: any[] } | null = null;
      try {
        result = await notificationsLoadPromise;
      } catch (error: any) {
        setNotifError(error?.message || 'Could not load notifications.');
        return;
      }

      setNotifError('');
      const nextOrders = result?.orders || [];
      const nextMessages = result?.messages || [];
      const nextKeys = new Set([
        ...nextOrders.map((order: any) => `order:${order.id}`),
        ...nextMessages.map((msg: any) => `message:${msg.id}`),
      ]);
      const hasNewNotification = didLoadNotificationsRef.current
        && [...nextKeys].some((key) => !notifKeysRef.current.has(key));

      notifKeysRef.current = nextKeys;
      didLoadNotificationsRef.current = true;
      setNotifOrders(nextOrders);
      setNotifMessages(nextMessages);

      if (hasNewNotification) playNotificationSound();
    };

    loadNotifications();

    let refreshTimer: number | null = null;
    const refresh = () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(loadNotifications, 750);
    };

    const channel = supabase
      .channel('admin:notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_messages' }, refresh)
      .subscribe();

    const handleClickOutside = (event: MouseEvent) => {
      if (!notifRef.current) return;
      if (!notifRef.current.contains(event.target as Node)) setIsNotifOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('pointerdown', unlockAudio);
    };
  }, [isAuthenticated, supabase]);

  const timeAgo = (value: string) => {
    const diffMs = Date.now() - new Date(value).getTime();
    if (!Number.isFinite(diffMs) || diffMs < 0) return 'Just now';
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes === 1) return '1 minute ago';
    if (minutes < 60) return `${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 hour ago';
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
  };

  if (isLoading) return <div className="min-h-screen bg-black text-white font-inter" />;

  if (authMessage) {
    return (
      <div className="min-h-screen bg-black text-white font-inter flex items-center justify-center p-6 text-center">
        <p className="text-sm text-white/70">{authMessage}</p>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-[#000] text-white font-inter flex">
      {/* SIDEBAR */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="flex-shrink-0 border-r border-white/10 bg-[#050505] hidden md:flex flex-col"
          >
            <div className="h-20 flex items-center px-8 border-b border-white/10">
              <span className="font-syncopate font-bold tracking-[0.3em] text-sm">EXTRA ADMIN</span>
            </div>
            
            <nav className="flex-1 py-8 px-4 space-y-2">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link 
                    key={item.name} 
                    href={item.href}
                    className={`flex items-center gap-4 px-4 py-3 rounded-lg transition-colors ${
                      isActive 
                        ? 'bg-white/10 text-white' 
                        : 'text-white/50 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-syncopate text-xs tracking-widest font-bold">{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-white/10">
              <button 
                onClick={async () => {
                  await signOutOnce();
                  window.location.href = '/';
                }}
                className="flex items-center gap-4 px-4 py-3 w-full text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-syncopate text-xs tracking-widest font-bold">LOGOUT</span>
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* MOBILE NAV DRAWER */}
      <AnimatePresence>
        {isMobileNavOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setIsMobileNavOpen(false)}
            />
            <motion.aside
              initial={{ x: -320, opacity: 0.9 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -320, opacity: 0.9 }}
              transition={{ type: 'tween', duration: 0.18 }}
              className="fixed inset-y-0 left-0 w-[280px] border-r border-white/10 bg-[#050505] z-50 md:hidden flex flex-col"
            >
              <div className="h-20 flex items-center px-6 border-b border-white/10">
                <span className="font-syncopate font-bold tracking-[0.3em] text-sm">EXTRA ADMIN</span>
              </div>

              <nav className="flex-1 py-6 px-4 space-y-2 overflow-auto">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setIsMobileNavOpen(false)}
                      className={`flex items-center gap-4 px-4 py-3 rounded-lg transition-colors ${
                        isActive ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="font-syncopate text-xs tracking-widest font-bold">{item.name}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="p-4 border-t border-white/10">
                <button
                  onClick={async () => {
                    await signOutOnce();
                    window.location.href = '/';
                  }}
                  className="flex items-center gap-4 px-4 py-3 w-full text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="font-syncopate text-xs tracking-widest font-bold">LOGOUT</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* TOPBAR */}
        <header className="h-20 border-b border-white/10 bg-[#050505] flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMobileNavOpen(true)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors md:hidden"
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors hidden md:block"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            <div className="relative hidden sm:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input 
                type="text" 
                placeholder="Search anything..." 
                className="bg-white/5 border border-white/10 rounded-full pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-white/30 w-64 transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative z-30" ref={notifRef}>
              <button
                className="relative p-2 hover:bg-white/10 rounded-full transition-colors"
                onClick={() => setIsNotifOpen((value) => !value)}
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
                {(notifOrders.length > 0 || notifMessages.some((m) => !m.is_read)) && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                )}
              </button>

              <AnimatePresence>
                {isNotifOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.98 }}
                    transition={{ duration: 0.16 }}
                    className="absolute right-0 mt-3 z-40 w-[360px] overflow-hidden rounded-xl border border-white/10 bg-[#050505] shadow-2xl"
                  >
                    <div className="border-b border-white/10 px-4 py-3">
                      <p className="text-xs font-syncopate tracking-widest text-white/60">NOTIFICATIONS</p>
                    </div>

                    {notifError ? (
                      <div className="px-4 py-4 text-sm text-red-400">{notifError}</div>
                    ) : notifOrders.length === 0 && notifMessages.length === 0 ? (
                      <div className="px-4 py-5 text-sm text-white/50">No notifications yet.</div>
                    ) : (
                      <div className="max-h-[360px] overflow-auto">
                        {notifOrders.length > 0 && (
                          <div className="px-4 pt-4 pb-2 text-[10px] text-white/40 font-syncopate tracking-widest">
                            RECENT ORDERS
                          </div>
                        )}
                        {notifOrders.map((order) => (
                          <Link
                            key={order.id}
                            href="/admin/orders"
                            onClick={() => setIsNotifOpen(false)}
                            className="block border-b border-white/5 px-4 py-3 hover:bg-white/5 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <p className="text-sm font-bold truncate">
                                  {order.order_number || order.id.slice(0, 8)} - {order.customer_name}
                                </p>
                                <p className="mt-1 text-xs text-white/50 truncate">
                                  {order.status} - LE {Number(order.total || 0).toFixed(2)}
                                </p>
                              </div>
                              <p className="text-[10px] text-white/35 font-syncopate tracking-widest whitespace-nowrap">
                                {timeAgo(order.created_at)}
                              </p>
                            </div>
                          </Link>
                        ))}

                        {notifMessages.length > 0 && (
                          <div className="px-4 pt-4 pb-2 text-[10px] text-white/40 font-syncopate tracking-widest">
                            CONTACT MESSAGES
                          </div>
                        )}
                        {notifMessages.map((msg) => (
                          <Link
                            key={msg.id}
                            href="/admin/messages"
                            onClick={() => setIsNotifOpen(false)}
                            className="block border-b border-white/5 px-4 py-3 hover:bg-white/5 transition-colors last:border-b-0"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <p className="text-sm font-bold truncate">
                                  {!msg.is_read ? 'NEW - ' : ''}
                                  {msg.name} ({msg.email})
                                </p>
                                <p className="mt-1 text-xs text-white/50 truncate">{msg.message}</p>
                              </div>
                              <p className="text-[10px] text-white/35 font-syncopate tracking-widest whitespace-nowrap">
                                {timeAgo(msg.created_at)}
                              </p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <div className="flex items-center gap-3 pl-6 border-l border-white/10">
              <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center font-syncopate font-bold text-xs">
                AD
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-bold">Admin User</p>
                <p className="text-xs text-white/50">admin@extra.com</p>
              </div>
            </div>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <div className="flex-1 overflow-auto bg-[#000] p-6 lg:p-10">
          {children}
        </div>
      </main>
    </div>
  );
}
