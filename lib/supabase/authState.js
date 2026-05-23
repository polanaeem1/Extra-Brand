import { createClient } from './browser';

let initialized = false;
let initialSessionResolved = false;
let initialSessionPromise = null;
let authSubscription = null;
let cachedSession = null;
let lastSessionReadAt = 0;
const subscribers = new Set();
const COOLDOWN_KEY = 'extra_auth_cooldown_until';
const BASE_COOLDOWN_MS = 5 * 60_000;
const MAX_COOLDOWN_MS = 30 * 60_000;

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
  return 'Too many login/session attempts. Please wait before trying again.';
}

function readCooldownUntil() {
  if (typeof window === 'undefined') return 0;
  try {
    return Number(localStorage.getItem(COOLDOWN_KEY) || 0);
  } catch {
    return 0;
  }
}

function writeCooldownUntil(value) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(COOLDOWN_KEY, String(value));
    const maxAge = value > Date.now() ? Math.ceil((value - Date.now()) / 1000) : 0;
    document.cookie = `extra-auth-cooldown-until=${value}; path=/; max-age=${maxAge}; samesite=lax`;
  } catch {
    // ignore
  }
}

export function getAuthCooldownUntil() {
  return readCooldownUntil();
}

export function isAuthCoolingDown() {
  return Date.now() < readCooldownUntil();
}

export function clearAuthCooldown() {
  writeCooldownUntil(0);
}

export function setAuthCooldown(previousUntil = readCooldownUntil()) {
  const now = Date.now();
  const previousRemaining = Math.max(0, Number(previousUntil || 0) - now);
  const nextDelay = previousRemaining ? Math.min(previousRemaining * 2, MAX_COOLDOWN_MS) : BASE_COOLDOWN_MS;
  const nextUntil = now + nextDelay;
  writeCooldownUntil(nextUntil);
  return nextUntil;
}

export function handleAuthRateLimit(error) {
  if (!isRateLimitError(error)) return false;
  const until = setAuthCooldown();
  try {
    createClient().auth.stopAutoRefresh();
  } catch {
    // ignore
  }
  log('auth:rate-limit-cooldown', new Date(until).toISOString());
  return true;
}

export function initAuthState() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (isAuthCoolingDown()) {
    log('auth:init:cooldown-skip');
    return Promise.resolve(cachedSession);
  }

  const supabase = createClient();
  try {
    supabase.auth.startAutoRefresh();
  } catch {
    // ignore
  }
  if (initialized) return initialSessionResolved ? Promise.resolve(cachedSession) : initialSessionPromise || Promise.resolve(cachedSession);
  initialized = true;

  log('auth:init');
  initialSessionPromise = supabase.auth
    .getSession()
    .then(({ data, error }) => {
      if (error) {
        log('auth:getSession:error', error);
        handleAuthRateLimit(error);
        return cachedSession;
      }

      cachedSession = data?.session || null;
      lastSessionReadAt = Date.now();
      return cachedSession;
    })
    .catch((error) => {
      log('auth:getSession:catch', error);
      handleAuthRateLimit(error);
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
  if (!isAuthCoolingDown()) initAuthState();
  return cachedSession;
}

export function getCachedUserId() {
  return getCachedSession()?.user?.id || null;
}

export function getCachedUserEmail() {
  return getCachedSession()?.user?.email || '';
}

export async function getSessionOnce() {
  if (isAuthCoolingDown()) return cachedSession;
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
