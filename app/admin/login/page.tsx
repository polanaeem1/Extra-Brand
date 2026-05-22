'use client';

import { useState } from 'react';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  Lock,
  Mail,
  Server,
  ShieldCheck,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/browser';
import { getCurrentAdmin } from '@/lib/supabase/admin';

export default function AdminLogin() {
  const [email, setEmail] = useState('admin@extra.com');
  const [password, setPassword] = useState('admin');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      setError('Enter your admin email and passcode.');
      return;
    }

    setError('');
    setIsLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setIsLoading(false);
      setError(signInError.message);
      return;
    }

    await supabase.auth.getSession();
    const { isAdmin } = await getCurrentAdmin();
    if (!isAdmin) {
      await supabase.auth.signOut();
      setIsLoading(false);
      setError('This account does not have admin access.');
      return;
    }

    window.location.href = '/admin';
  };

  return (
    <main className="min-h-screen bg-black text-white font-inter overflow-hidden">
      <div className="min-h-screen grid lg:grid-cols-[1fr_480px]">
        <section className="relative hidden lg:flex flex-col justify-between border-r border-white/10 px-12 py-10">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:44px_44px] opacity-50 pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.09),transparent_45%)] pointer-events-none" />

          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="font-syncopate text-[10px] tracking-[0.35em] text-white/45">CONTROL ROOM</p>
              <h1 className="mt-4 font-syncopate text-3xl font-bold tracking-[0.22em]">EXTRA</h1>
            </div>
            <div className="h-12 w-12 rounded-lg border border-white/15 bg-white/5 flex items-center justify-center">
              <ShieldCheck className="h-6 w-6" strokeWidth={1.6} />
            </div>
          </div>

          <div className="relative z-10 max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="mb-5 font-syncopate text-xs tracking-[0.3em] text-white/45">ADMIN ACCESS</p>
              <h2 className="max-w-xl font-syncopate text-5xl font-bold tracking-[0.12em] leading-tight">
                OPERATIONS DASHBOARD
              </h2>
              <div className="mt-10 grid max-w-xl grid-cols-3 border border-white/10 bg-black/40">
                {[
                  ['ORDERS', 'LIVE'],
                  ['STOCK', 'SYNCED'],
                  ['USERS', 'ACTIVE'],
                ].map(([label, value]) => (
                  <div key={label} className="border-r border-white/10 px-5 py-5 last:border-r-0">
                    <p className="font-syncopate text-[9px] tracking-[0.25em] text-white/35">{label}</p>
                    <p className="mt-3 font-syncopate text-xs font-bold tracking-[0.2em]">{value}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          <div className="relative z-10 grid max-w-xl grid-cols-2 gap-3">
            <div className="border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-3 text-green-500">
                <Activity className="h-4 w-4" />
                <span className="font-syncopate text-[10px] font-bold tracking-[0.2em]">ONLINE</span>
              </div>
              <p className="mt-3 text-xs text-white/45">Inventory and order services are responding.</p>
            </div>
            <div className="border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-3 text-blue-500">
                <Server className="h-4 w-4" />
                <span className="font-syncopate text-[10px] font-bold tracking-[0.2em]">SECURE</span>
              </div>
              <p className="mt-3 text-xs text-white/45">Session access is limited to admin users.</p>
            </div>
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center px-5 py-8 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[420px]"
          >
            <div className="mb-8 flex items-center justify-between lg:hidden">
              <div>
                <p className="font-syncopate text-[9px] tracking-[0.3em] text-white/45">CONTROL ROOM</p>
                <h1 className="mt-3 font-syncopate text-2xl font-bold tracking-[0.2em]">EXTRA</h1>
              </div>
              <div className="h-11 w-11 rounded-lg border border-white/15 bg-white/5 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5" strokeWidth={1.6} />
              </div>
            </div>

            <div className="border border-white/10 bg-[#050505] p-6 shadow-2xl sm:p-8">
              <div className="mb-8">
                <div className="mb-5 inline-flex items-center gap-2 border border-white/10 bg-white/[0.03] px-3 py-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="font-syncopate text-[9px] font-bold tracking-[0.25em] text-white/60">
                    VERIFIED ROUTE
                  </span>
                </div>
                <h2 className="font-syncopate text-2xl font-bold tracking-[0.18em]">ADMIN LOGIN</h2>
                <p className="mt-3 text-sm leading-6 text-white/45">
                  Sign in to manage products, orders, customers, and analytics.
                </p>
              </div>

              <form onSubmit={handleLogin} className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <label htmlFor="admin-email" className="text-[10px] font-syncopate text-white/50 tracking-[0.22em]">
                    EMAIL ID
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                    <input
                      id="admin-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-14 w-full rounded-lg border border-white/10 bg-white/[0.04] pl-11 pr-4 text-sm text-white outline-none transition-colors placeholder:text-white/20 focus:border-white/35 focus:bg-white/[0.07]"
                      placeholder="admin@extra.com"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="admin-password"
                    className="text-[10px] font-syncopate text-white/50 tracking-[0.22em]"
                  >
                    PASSCODE
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                    <input
                      id="admin-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-14 w-full rounded-lg border border-white/10 bg-white/[0.04] pl-11 pr-12 text-sm text-white outline-none transition-colors placeholder:text-white/20 focus:border-white/35 focus:bg-white/[0.07]"
                      placeholder="passcode"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-white/45 transition-colors hover:bg-white/10 hover:text-white"
                      aria-label={showPassword ? 'Hide passcode' : 'Show passcode'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-500">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="group mt-2 flex h-14 w-full items-center justify-center gap-3 rounded-lg bg-white px-5 font-syncopate text-xs font-bold tracking-[0.22em] text-black transition-all hover:bg-white/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isLoading ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      CHECKING
                    </>
                  ) : (
                    <>
                      AUTHORIZE
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-8 border-t border-white/10 pt-5">
                <div className="flex items-center justify-between gap-4 text-[10px] text-white/35">
                  <span className="font-syncopate tracking-[0.22em]">RESTRICTED SYSTEM</span>
                  <span className="font-syncopate tracking-[0.22em]">v1.0</span>
                </div>
              </div>
            </div>
          </motion.div>
        </section>
      </div>
    </main>
  );
}
