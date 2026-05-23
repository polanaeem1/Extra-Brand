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

  return browserClient;
}
