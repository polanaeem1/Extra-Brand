const counters = new Map();

export function logSupabaseRequest(label, detail = '') {
  if (process.env.NEXT_PUBLIC_SUPABASE_DEBUG !== '1' || typeof window === 'undefined') return;
  const count = (counters.get(label) || 0) + 1;
  counters.set(label, count);
  console.info(`[supabase-debug] ${label} #${count}`, detail);
}
