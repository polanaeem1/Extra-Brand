const counters = new Map();
const requestCounters = new Map();
let summaryTimer = null;
let realtimePatched = false;

const SUMMARY_INTERVAL_MS = 30_000;
const DEFAULT_LIMIT = 6;

function isDebugEnabled() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_DEBUG === '1' &&
    (typeof window !== 'undefined' || process.env.NODE_ENV === 'development')
  );
}

function nowIso() {
  return new Date().toISOString();
}

function getRequestKey(input, init) {
  const method = String(init?.method || input?.method || 'GET').toUpperCase();
  const rawUrl = typeof input === 'string' ? input : input?.url || '';

  try {
    const url = new URL(rawUrl);
    const path = url.pathname;

    if (path.includes('/auth/v1/token')) return `auth:token:${method}`;
    if (path.includes('/auth/v1/user')) return `auth:user:${method}`;
    if (path.includes('/auth/v1/logout')) return `auth:logout:${method}`;
    if (path.includes('/auth/v1/signup')) return `auth:signup:${method}`;
    if (path.includes('/auth/v1/')) return `auth:${path.split('/auth/v1/')[1] || 'unknown'}:${method}`;

    if (path.includes('/rest/v1/')) {
      const table = path.split('/rest/v1/')[1]?.split('/')[0] || 'unknown';
      return `rest:${table}:${method}`;
    }

    if (path.includes('/storage/v1/object/sign/')) {
      const bucket = path.split('/storage/v1/object/sign/')[1]?.split('/')[0] || 'unknown';
      return `storage:signed-url:${bucket}:${method}`;
    }

    if (path.includes('/storage/v1/object/list/')) {
      const bucket = path.split('/storage/v1/object/list/')[1]?.split('/')[0] || 'unknown';
      return `storage:list:${bucket}:${method}`;
    }

    if (path.includes('/storage/v1/object/')) {
      const bucket = path.split('/storage/v1/object/')[1]?.split('/')[0] || 'unknown';
      return `storage:object:${bucket}:${method}`;
    }

    if (path.includes('/functions/v1/')) {
      const fn = path.split('/functions/v1/')[1]?.split('/')[0] || 'unknown';
      return `function:${fn}:${method}`;
    }

    if (path.includes('/realtime/v1')) return `realtime:http:${method}`;
    return `${path}:${method}`;
  } catch {
    return `unknown:${method}`;
  }
}

function expectedLimitFor(key) {
  if (key.startsWith('auth:token')) return 2;
  if (key.startsWith('auth:user')) return 2;
  if (key.startsWith('rest:products')) return 3;
  if (key.startsWith('rest:orders')) return 4;
  if (key.startsWith('rest:profiles')) return 3;
  if (key.startsWith('rest:analytics_visits')) return 2;
  if (key.startsWith('rest:cart_events')) return 2;
  if (key.startsWith('storage:list')) return 1;
  if (key.startsWith('storage:signed-url')) return 2;
  if (key.startsWith('realtime:subscribe')) return 3;
  return DEFAULT_LIMIT;
}

function recordRequest(key, detail = '') {
  if (!isDebugEnabled()) return;

  const count = (requestCounters.get(key)?.count || 0) + 1;
  const windowCount = (requestCounters.get(key)?.windowCount || 0) + 1;
  requestCounters.set(key, {
    key,
    count,
    windowCount,
    detail,
    lastAt: nowIso(),
  });

  const limit = expectedLimitFor(key);
  if (windowCount === limit + 1) {
    console.warn(
      `[supabase-debug] ${nowIso()} repeated request warning: ${key} exceeded ${limit} calls in the current 30s window`,
      detail
    );
  }

  ensureSummaryTimer();
}

function ensureSummaryTimer() {
  if (!isDebugEnabled() || summaryTimer) return;
  summaryTimer = globalThis.setInterval(printSupabaseRequestSummary, SUMMARY_INTERVAL_MS);
}

export function printSupabaseRequestSummary() {
  if (!isDebugEnabled()) return;

  const rows = [...requestCounters.values()]
    .sort((a, b) => b.windowCount - a.windowCount || b.count - a.count)
    .slice(0, 12)
    .map((entry) => ({
      request: entry.key,
      last_30s: entry.windowCount,
      total: entry.count,
      expected_30s: expectedLimitFor(entry.key),
      last_at: entry.lastAt,
    }));

  if (!rows.length) return;

  console.groupCollapsed(`[supabase-debug] ${nowIso()} Supabase request summary`);
  console.table(rows);
  rows
    .filter((row) => row.last_30s > row.expected_30s)
    .forEach((row) => {
      console.warn(`[supabase-debug] request above expected limit`, row);
    });
  console.groupEnd();

  requestCounters.forEach((entry, key) => {
    requestCounters.set(key, { ...entry, windowCount: 0 });
  });
}

export function supabaseDebugFetch(input, init) {
  const key = getRequestKey(input, init);
  recordRequest(key, typeof input === 'string' ? input : input?.url || '');
  return fetch(input, init);
}

export function installSupabaseDebugClient(client) {
  if (!isDebugEnabled() || !client || realtimePatched) return client;
  realtimePatched = true;

  const originalChannel = client.channel?.bind(client);
  if (!originalChannel) return client;

  client.channel = (topic, opts) => {
    recordRequest(`realtime:channel:${topic}`, topic);
    const channel = originalChannel(topic, opts);
    const originalSubscribe = channel.subscribe?.bind(channel);

    if (originalSubscribe) {
      channel.subscribe = (...args) => {
        recordRequest(`realtime:subscribe:${topic}`, topic);
        return originalSubscribe(...args);
      };
    }

    return channel;
  };

  return client;
}

export function logSupabaseRequest(label, detail = '') {
  if (!isDebugEnabled()) return;
  const count = (counters.get(label) || 0) + 1;
  counters.set(label, count);
  recordRequest(`manual:${label}`, detail);
  console.info(`[supabase-debug] ${nowIso()} ${label} #${count}`, detail);
}
