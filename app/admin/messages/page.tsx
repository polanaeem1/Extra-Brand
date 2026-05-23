'use client';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { Search, Trash2, Eye, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import { logSupabaseRequest } from '@/lib/supabase/debug';

type ContactMessage = {
  id: string;
  name: string;
  email: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

export default function AdminMessages() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [search, setSearch] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [active, setActive] = useState<ContactMessage | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContactMessage | null>(null);
  const [isDeletingId, setIsDeletingId] = useState('');
  const [supabase] = useState(() => createClient());

  const loadMessages = async () => {
    logSupabaseRequest('admin.messages.loadMessages');
    const { data, error } = await supabase
      .from('contact_messages')
      .select('id,name,email,message,is_read,created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      setStatusMessage(error.message);
      return;
    }

    setStatusMessage('');
    setMessages((data || []) as ContactMessage[]);
  };

  useEffect(() => {
    loadMessages();
    let refreshTimer: number | null = null;
    const refresh = () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(loadMessages, 750);
    };

    const channel = supabase
      .channel('admin:contact_messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_messages' }, refresh)
      .subscribe();

    return () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => {
      return (
        (m.name || '').toLowerCase().includes(q) ||
        (m.email || '').toLowerCase().includes(q) ||
        (m.message || '').toLowerCase().includes(q)
      );
    });
  }, [messages, search]);

  const markRead = async (msg: ContactMessage) => {
    if (msg.is_read) return;
    const { error } = await supabase.from('contact_messages').update({ is_read: true }).eq('id', msg.id);
    if (!error) {
      setMessages((current) => current.map((m) => (m.id === msg.id ? { ...m, is_read: true } : m)));
    }
  };

  const doDelete = async (id: string) => {
    setIsDeletingId(id);
    setStatusMessage('');
    const { error } = await supabase.from('contact_messages').delete().eq('id', id);
    setIsDeletingId('');

    if (error) {
      setStatusMessage(error.message);
      return;
    }

    setMessages((current) => current.filter((m) => m.id !== id));
    setStatusMessage('Message deleted.');
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-syncopate font-bold tracking-widest">MESSAGES</h1>
          <p className="text-white/50 mt-2">Customer contact messages.</p>
        </div>
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
            placeholder="Search messages..."
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
                <th className="px-6 py-4 font-normal">STATUS</th>
                <th className="px-6 py-4 font-normal">NAME</th>
                <th className="px-6 py-4 font-normal">EMAIL</th>
                <th className="px-6 py-4 font-normal">MESSAGE</th>
                <th className="px-6 py-4 font-normal">DATE</th>
                <th className="px-6 py-4 font-normal text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-white/50">
                    No messages yet.
                  </td>
                </tr>
              ) : (
                filtered.map((m) => (
                  <tr key={m.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold border ${
                          m.is_read
                            ? 'bg-white/5 text-white/60 border-white/10'
                            : 'bg-green-500/10 text-green-500 border-green-500/20'
                        }`}
                      >
                        {m.is_read ? 'READ' : 'NEW'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold">{m.name}</td>
                    <td className="px-6 py-4 text-white/70">{m.email}</td>
                    <td className="px-6 py-4 text-white/70 max-w-[420px] truncate">{m.message}</td>
                    <td className="px-6 py-4 text-white/60 text-xs">{new Date(m.created_at).toLocaleString()}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            setActive(m);
                            await markRead(m);
                          }}
                          className="p-2 hover:bg-white/10 rounded-md transition-colors text-white/50 hover:text-white"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(m)}
                          className="p-2 hover:bg-red-500/10 rounded-md transition-colors text-white/50 hover:text-red-500"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {active && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
              onClick={() => setActive(null)}
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
                    <div>
                      <h2 className="text-xl font-bold font-syncopate tracking-widest">MESSAGE</h2>
                      <p className="text-sm text-white/50 mt-2">
                        {active.name} - {active.email}
                      </p>
                    </div>
                    <button
                      onClick={() => setActive(null)}
                      className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="text-sm text-white/80 whitespace-pre-wrap leading-6">{active.message}</div>

                  <div className="mt-8 text-xs text-white/40 font-syncopate tracking-widest">
                    {new Date(active.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={!!deleteTarget}
        title="DELETE MESSAGE"
        message={deleteTarget ? `Delete message from ${deleteTarget.name}?` : ''}
        confirmText="DELETE"
        danger
        busy={!!isDeletingId}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          const id = deleteTarget?.id;
          setDeleteTarget(null);
          if (id) await doDelete(id);
        }}
      />
    </div>
  );
}
