'use client';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { Plus, Search, Edit2, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import { logSupabaseRequest } from '@/lib/supabase/debug';

type PromoCodeRow = {
  id: string;
  code: string;
  discount_percentage: number;
  starts_at: string;
  expires_at: string | null;
  is_active: boolean;
  usage_limit: number | null;
  used_count: number;
  minimum_order_amount: number | null;
  created_at: string;
  updated_at: string;
};

function toDateTimeLocal(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
}

function toISOStringOrNull(localValue: string) {
  if (!localValue) return null;
  const date = new Date(localValue);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString();
}

export default function AdminPromoCodes() {
  const [promos, setPromos] = useState<PromoCodeRow[]>([]);
  const [search, setSearch] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<PromoCodeRow | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<PromoCodeRow | null>(null);

  const [form, setForm] = useState({
    code: '',
    discount_percentage: '10',
    starts_at: '',
    expires_at: '',
    is_active: true,
    usage_limit: '',
    minimum_order_amount: '',
  });

  const supabase = useMemo(() => createClient(), []);

  const loadPromos = async () => {
    logSupabaseRequest('admin.promos.loadPromos');
    const { data, error } = await supabase
      .from('promo_codes')
      .select(
        'id,code,discount_percentage,starts_at,expires_at,is_active,usage_limit,used_count,minimum_order_amount,created_at,updated_at'
      )
      .order('created_at', { ascending: false });

    if (error) {
      setStatusMessage(error.message);
      return;
    }

    setStatusMessage('');
    setPromos((data || []) as PromoCodeRow[]);
  };

  useEffect(() => {
    loadPromos();
    let refreshTimer: number | null = null;
    const refresh = () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(loadPromos, 750);
    };

    const channel = supabase
      .channel('admin:promo_codes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'promo_codes' }, refresh)
      .subscribe();

    return () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase();
    if (!q) return promos;
    return promos.filter((p) => (p.code || '').toUpperCase().includes(q));
  }, [promos, search]);

  const openModal = (promo?: PromoCodeRow | null) => {
    setEditing(promo || null);
    setStatusMessage('');
    setForm({
      code: promo?.code || '',
      discount_percentage: String(promo?.discount_percentage ?? '10'),
      starts_at: toDateTimeLocal(promo?.starts_at) || toDateTimeLocal(new Date().toISOString()),
      expires_at: toDateTimeLocal(promo?.expires_at),
      is_active: promo?.is_active ?? true,
      usage_limit: promo?.usage_limit == null ? '' : String(promo.usage_limit),
      minimum_order_amount: promo?.minimum_order_amount == null ? '' : String(promo.minimum_order_amount),
    });
    setIsModalOpen(true);
  };

  const canSave = useMemo(() => {
    const code = form.code.trim().toUpperCase();
    const pct = Number(form.discount_percentage);
    const starts = toISOStringOrNull(form.starts_at);
    const expires = toISOStringOrNull(form.expires_at);
    if (!code) return false;
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return false;
    if (!starts) return false;
    if (expires && new Date(expires).getTime() <= new Date(starts).getTime()) return false;
    if (form.usage_limit && (!Number.isFinite(Number(form.usage_limit)) || Number(form.usage_limit) < 0)) return false;
    if (
      form.minimum_order_amount &&
      (!Number.isFinite(Number(form.minimum_order_amount)) || Number(form.minimum_order_amount) < 0)
    )
      return false;
    return true;
  }, [form]);

  const handleSave = async () => {
    if (!canSave || isSaving) return;
    setIsSaving(true);
    setStatusMessage('');

    const payload: any = {
      code: form.code.trim().toUpperCase(),
      discount_percentage: Number(form.discount_percentage),
      starts_at: toISOStringOrNull(form.starts_at),
      expires_at: toISOStringOrNull(form.expires_at),
      is_active: !!form.is_active,
      usage_limit: form.usage_limit === '' ? null : Number(form.usage_limit),
      minimum_order_amount: form.minimum_order_amount === '' ? null : Number(form.minimum_order_amount),
    };

    const query = editing
      ? supabase.from('promo_codes').update(payload).eq('id', editing.id)
      : supabase.from('promo_codes').insert({ ...payload, used_count: 0 });

    const { error } = await query;
    setIsSaving(false);

    if (error) {
      setStatusMessage(error.message);
      return;
    }

    setIsModalOpen(false);
    await loadPromos();
    setStatusMessage(editing ? 'Promo code updated.' : 'Promo code created.');
  };

  const confirmDelete = async (id: string) => {
    if (!id || isDeletingId) return;
    setIsDeletingId(id);
    setStatusMessage('');
    const { error } = await supabase.from('promo_codes').delete().eq('id', id);
    setIsDeletingId('');

    if (error) {
      setStatusMessage(error.message);
      return;
    }

    await loadPromos();
    setStatusMessage('Promo code deleted.');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-syncopate font-bold tracking-widest">PROMO CODES</h1>
          <p className="text-white/50 mt-2">Create and manage discount codes.</p>
        </div>
        <button
          onClick={() => openModal(null)}
          className="bg-white text-black font-syncopate text-xs font-bold tracking-widest px-6 py-3 rounded-md hover:bg-white/90 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> ADD PROMO
        </button>
      </div>

      {statusMessage && (
        <div className="rounded-md border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
          {statusMessage}
        </div>
      )}

      <div className="flex bg-[#0a0a0a] border border-white/10 p-4 rounded-xl">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            placeholder="Search promo codes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-md pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-white/30 transition-colors"
          />
        </div>
      </div>

      <div className="bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 border-b border-white/10 text-xs font-syncopate tracking-widest text-white/50">
              <tr>
                <th className="px-6 py-4 font-normal">CODE</th>
                <th className="px-6 py-4 font-normal">DISCOUNT</th>
                <th className="px-6 py-4 font-normal">STATUS</th>
                <th className="px-6 py-4 font-normal">DATES</th>
                <th className="px-6 py-4 font-normal">LIMIT</th>
                <th className="px-6 py-4 font-normal">MIN ORDER</th>
                <th className="px-6 py-4 font-normal text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-white/50">
                    No promo codes yet.
                  </td>
                </tr>
              ) : (
                filtered.map((promo) => {
                  const limitLabel =
                    promo.usage_limit == null ? 'UNLIMITED' : `${promo.used_count}/${promo.usage_limit}`;
                  const start = new Date(promo.starts_at);
                  const end = promo.expires_at ? new Date(promo.expires_at) : null;
                  return (
                    <tr key={promo.id} className="hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-4 font-bold">{promo.code}</td>
                      <td className="px-6 py-4 font-bold">{Number(promo.discount_percentage).toFixed(0)}%</td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold border ${
                            promo.is_active
                              ? 'bg-green-500/10 text-green-500 border-green-500/20'
                              : 'bg-red-500/10 text-red-500 border-red-500/20'
                          }`}
                        >
                          {promo.is_active ? 'ACTIVE' : 'DISABLED'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-white/70">
                        <div className="text-xs">
                          <div>START: {Number.isFinite(start.getTime()) ? start.toLocaleDateString() : '-'}</div>
                          <div>END: {end && Number.isFinite(end.getTime()) ? end.toLocaleDateString() : 'NONE'}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-white/70">{limitLabel}</td>
                      <td className="px-6 py-4 text-white/70">
                        {promo.minimum_order_amount == null ? 'NONE' : `LE ${Number(promo.minimum_order_amount).toFixed(2)}`}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openModal(promo)}
                            className="p-2 hover:bg-white/10 rounded-md transition-colors text-white/50 hover:text-white"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(promo)}
                            disabled={isDeletingId === promo.id}
                            className="p-2 hover:bg-red-500/10 rounded-md transition-colors text-white/50 hover:text-red-500 disabled:opacity-40"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-6"
            >
              <div className="w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-6 pb-6 border-b border-white/10">
                    <h2 className="text-xl font-bold font-syncopate tracking-widest">
                      {editing ? 'EDIT PROMO' : 'ADD PROMO'}
                    </h2>
                    <button
                      onClick={() => setIsModalOpen(false)}
                      className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-syncopate text-white/70 tracking-widest mb-2">CODE</label>
                        <input
                          type="text"
                          value={form.code}
                          onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                          className="w-full bg-black border border-white/10 rounded-md px-4 py-2 text-sm focus:outline-none focus:border-white/40 transition-colors"
                          placeholder="EXTRA20"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-syncopate text-white/70 tracking-widest mb-2">
                          DISCOUNT (%)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          step="1"
                          value={form.discount_percentage}
                          onChange={(e) => setForm({ ...form, discount_percentage: e.target.value })}
                          className="w-full bg-black border border-white/10 rounded-md px-4 py-2 text-sm focus:outline-none focus:border-white/40 transition-colors"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-syncopate text-white/70 tracking-widest mb-2">
                          START DATE
                        </label>
                        <input
                          type="datetime-local"
                          value={form.starts_at}
                          onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                          className="w-full bg-black border border-white/10 rounded-md px-4 py-2 text-sm focus:outline-none focus:border-white/40 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-syncopate text-white/70 tracking-widest mb-2">
                          EXPIRY DATE (OPTIONAL)
                        </label>
                        <input
                          type="datetime-local"
                          value={form.expires_at}
                          onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                          className="w-full bg-black border border-white/10 rounded-md px-4 py-2 text-sm focus:outline-none focus:border-white/40 transition-colors"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-syncopate text-white/70 tracking-widest mb-2">
                          USAGE LIMIT (OPTIONAL)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={form.usage_limit}
                          onChange={(e) => setForm({ ...form, usage_limit: e.target.value })}
                          className="w-full bg-black border border-white/10 rounded-md px-4 py-2 text-sm focus:outline-none focus:border-white/40 transition-colors"
                          placeholder="e.g. 100"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-syncopate text-white/70 tracking-widest mb-2">
                          MIN ORDER (LE) (OPTIONAL)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={form.minimum_order_amount}
                          onChange={(e) => setForm({ ...form, minimum_order_amount: e.target.value })}
                          className="w-full bg-black border border-white/10 rounded-md px-4 py-2 text-sm focus:outline-none focus:border-white/40 transition-colors"
                          placeholder="e.g. 1000"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        id="isActive"
                        type="checkbox"
                        checked={form.is_active}
                        onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                        className="h-4 w-4"
                      />
                      <label htmlFor="isActive" className="text-xs font-syncopate tracking-widest text-white/70">
                        ACTIVE
                      </label>
                      {editing && (
                        <span className="ml-auto text-xs text-white/40">
                          USED: {editing.used_count}
                          {editing.usage_limit != null ? ` / ${editing.usage_limit}` : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-4 border-t border-white/10 pt-6 mt-8">
                    <button
                      onClick={() => setIsModalOpen(false)}
                      className="px-6 py-2 rounded-md font-syncopate text-xs tracking-widest font-bold text-white/70 hover:text-white transition-colors"
                    >
                      CANCEL
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={!canSave || isSaving}
                      className="bg-white text-black font-syncopate text-xs font-bold tracking-widest px-8 py-2 rounded-md hover:bg-white/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isSaving ? 'SAVING...' : 'SAVE PROMO'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={!!deleteTarget}
        title="DELETE PROMO"
        message={deleteTarget ? `Delete promo code ${deleteTarget.code}? This cannot be undone.` : ''}
        confirmText="DELETE"
        danger
        busy={!!isDeletingId}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          const id = deleteTarget?.id;
          setDeleteTarget(null);
          if (id) await confirmDelete(id);
        }}
      />
    </div>
  );
}
