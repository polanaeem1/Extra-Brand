import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAuthOptions, supabaseCookieOptions } from './options';

export async function createClient() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase public environment variables.');
  }

  return createServerClient(supabaseUrl, supabaseKey, {
    cookieOptions: supabaseCookieOptions,
    auth: supabaseAuthOptions,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies; middleware/route handlers can.
        }
      },
    },
  });
}
