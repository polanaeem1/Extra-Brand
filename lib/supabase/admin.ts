import { createClient } from './browser';
import { getSessionOnce, isRateLimitError } from './authState';

let cachedAdminResult: {
  user: any;
  profile: any;
  isAdmin: boolean;
  rateLimited?: boolean;
} | null = null;
let cachedAt = 0;
let inFlight: Promise<any> | null = null;

const CACHE_MS = 60_000;

export async function getCurrentAdmin() {
  const now = Date.now();
  if (cachedAdminResult && now - cachedAt < CACHE_MS) {
    return cachedAdminResult;
  }
  if (inFlight) return inFlight;

  inFlight = loadCurrentAdmin().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

async function loadCurrentAdmin() {
  const supabase = createClient();
  const session = await getSessionOnce();
  const sessionUser = session?.user || null;

  if (!sessionUser) {
    const result = { user: null, profile: null, isAdmin: false };
    cachedAdminResult = result;
    cachedAt = Date.now();
    return result;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id,email,first_name,last_name,phone,role,status')
    .eq('id', sessionUser.id)
    .maybeSingle();

  const result = {
    user: sessionUser,
    profile,
    isAdmin: profile?.role === 'admin' && profile?.status !== 'banned',
  };

  cachedAdminResult = result;
  cachedAt = Date.now();
  return result;
}

export function clearCurrentAdminCache() {
  cachedAdminResult = null;
  cachedAt = 0;
}

export function adminAuthErrorMessage(error: any) {
  if (isRateLimitError(error)) return 'Too many attempts. Please wait a few minutes and try again.';
  return error?.message || 'Unable to check admin session.';
}
