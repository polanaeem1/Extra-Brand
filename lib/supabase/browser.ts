import { createBrowserClient } from '@supabase/ssr';
import { supabaseAuthOptions, supabaseCookieOptions } from './options';
import type { SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase public environment variables.');
  }

  if (browserClient) return browserClient;

  browserClient = createBrowserClient(supabaseUrl, supabaseKey, {
    cookieOptions: supabaseCookieOptions,
    auth: supabaseAuthOptions,
  });

  if (typeof window !== 'undefined') {
    try {
      const cooldownUntil = Number(localStorage.getItem('extra_auth_cooldown_until') || 0);
      if (cooldownUntil && Date.now() < cooldownUntil) {
        browserClient.auth.stopAutoRefresh();
      }
    } catch {
      // ignore
    }
  }

  return browserClient;
}
