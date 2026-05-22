export const supabaseCookieOptions = {
  name: 'extra-auth',
  maxAge: 400 * 24 * 60 * 60,
  sameSite: 'lax' as const,
  path: '/',
};

export const supabaseAuthOptions = {
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: true,
};
