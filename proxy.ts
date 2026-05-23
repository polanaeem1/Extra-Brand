import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { supabaseAuthOptions, supabaseCookieOptions } from './lib/supabase/options';

const AUTH_COOLDOWN_COOKIE = 'extra-auth-cooldown-until';
const AUTH_COOLDOWN_MS = 5 * 60 * 1000;

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookieOptions: supabaseCookieOptions,
    auth: supabaseAuthOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const pathname = request.nextUrl.pathname;
  // Admin is protected; the legacy /admin/login route is handled by next.config redirect.
  if (!pathname.startsWith('/admin')) {
    return response;
  }

  const cooldownUntil = Number(request.cookies.get(AUTH_COOLDOWN_COOKIE)?.value || 0);
  if (cooldownUntil && Date.now() < cooldownUntil) {
    return response;
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    const status = (userError as any)?.status;
    const message = String(userError.message || '').toLowerCase();
    if (status === 429 || message.includes('too many') || message.includes('rate limit')) {
      response.cookies.set(AUTH_COOLDOWN_COOKIE, String(Date.now() + AUTH_COOLDOWN_MS), {
        path: '/',
        sameSite: 'lax',
        maxAge: AUTH_COOLDOWN_MS / 1000,
      });
      return response;
    }
  }

  if (!user) {
    const next = encodeURIComponent(pathname + (request.nextUrl.search || ''));
    return NextResponse.redirect(new URL(`/login?next=${next}`, request.url));
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role,status')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'admin' || profile?.status === 'banned') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/admin/:path*'],
};
