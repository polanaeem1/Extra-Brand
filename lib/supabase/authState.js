import { createClient } from './browser';

let initialized = false;
let initialSessionResolved = false;
let initialSessionPromise = null;
let authSubscription = null;
let cachedSession = null;
let lastSessionReadAt = 0;
const subscribers = new Set();

const DEBUG = process.env.NEXT_PUBLIC_SUPABASE_DEBUG === '1';

function log(message, detail) {
  if (!DEBUG || typeof window === 'undefined') return;
  console.info(`[supabase-debug] ${message}`, detail || '');
}

function notify(event = 'SESSION_CACHE') {
  subscribers.forEach((callback) => {
    try {
      callback(cachedSession, event);
    } catch {
      // Ignore subscriber errors so one component cannot break auth state fanout.
    }
  });
}

export function isRateLimitError(error) {
  const status = error?.status || error?.code;
  const message = String(error?.message || '').toLowerCase();
  return status === 429 || message.includes('too many') || message.includes('rate limit');
}

export function authRateLimitMessage() {
  return 'Too many attempts. Please wait a few minutes and try again.';
}

export function initAuthState() {
  if (typeof window === 'undefined') return Promise.resolve(null);

  const supabase = createClient();
  if (initialized) return initialSessionResolved ? Promise.resolve(cachedSession) : initialSessionPromise || Promise.resolve(cachedSession);
  initialized = true;

  log('auth:init');
  initialSessionPromise = supabase.auth
    .getSession()
    .then(({ data, error }) => {
      if (error) {
        log('auth:getSession:error', error);
        return cachedSession;
      }

      cachedSession = data?.session || null;
      lastSessionReadAt = Date.now();
      return cachedSession;
    })
    .catch((error) => {
      log('auth:getSession:catch', error);
      return cachedSession;
    })
    .finally(() => {
      initialSessionResolved = true;
    });

  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    log(`auth:event:${event}`);
    cachedSession = session || null;
    lastSessionReadAt = Date.now();
    notify(event);
  });

  authSubscription = data?.subscription || null;
  return initialSessionPromise;
}

export function subscribeAuthState(callback) {
  if (typeof window === 'undefined') return () => {};

  subscribers.add(callback);
  initAuthState().then((session) => callback(session, 'INITIAL_SESSION')).catch(() => callback(cachedSession, 'INITIAL_SESSION'));

  return () => {
    subscribers.delete(callback);
  };
}

export function getCachedSession() {
  initAuthState();
  return cachedSession;
}

export function getCachedUserId() {
  return getCachedSession()?.user?.id || null;
}

export function getCachedUserEmail() {
  return getCachedSession()?.user?.email || '';
}

export async function getSessionOnce() {
  const now = Date.now();
  if (cachedSession && now - lastSessionReadAt < 60_000) return cachedSession;
  return initAuthState();
}

export async function signOutOnce() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  if (!error) {
    cachedSession = null;
    notify('SIGNED_OUT');
  }
  return { error };
}

export function cleanupAuthStateForTests() {
  authSubscription?.unsubscribe?.();
  authSubscription = null;
  initialized = false;
  initialSessionResolved = false;
  initialSessionPromise = null;
  cachedSession = null;
  subscribers.clear();
}
