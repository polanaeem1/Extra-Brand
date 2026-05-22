'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/browser';
import { getCurrentAdmin } from '@/lib/supabase/admin';
import { 
  LayoutDashboard, ShoppingBag, Package, 
  Users, LineChart, LogOut, Bell, Search, Menu
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const navItems = [
  { name: 'Overview', href: '/admin', icon: LayoutDashboard },
  { name: 'Orders', href: '/admin/orders', icon: ShoppingBag },
  { name: 'Products', href: '/admin/products', icon: Package },
  { name: 'Users', href: '/admin/users', icon: Users },
  { name: 'Analytics', href: '/admin/analytics', icon: LineChart },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/admin/login';
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(!isLoginPage);

  useEffect(() => {
    let isMounted = true;

    // Login should render immediately instead of showing the admin shell loader.
    if (isLoginPage) {
      setIsLoading(false);
      return;
    }

    getCurrentAdmin().then(({ isAdmin }) => {
      if (!isMounted) return;

      if (!isAdmin) {
        window.location.href = '/admin/login';
        return;
      }

      setIsAuthenticated(true);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [isLoginPage, pathname]);

  if (isLoading) return <div className="min-h-screen bg-black text-white font-inter" />;

  // Render children normally if on login page
  if (isLoginPage) {
    return <div className="min-h-screen bg-black text-white font-inter">{children}</div>;
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
                  const supabase = createClient();
                  await supabase.auth.signOut();
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

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* TOPBAR */}
        <header className="h-20 border-b border-white/10 bg-[#050505] flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-4">
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
            <button className="relative p-2 hover:bg-white/10 rounded-full transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            
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
