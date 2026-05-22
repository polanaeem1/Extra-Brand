import { createClient } from './browser';

export async function getCurrentAdmin() {
  const supabase = createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return { user: null, profile: null, isAdmin: false };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id,email,first_name,last_name,phone,role,status')
    .eq('id', userData.user.id)
    .maybeSingle();

  return {
    user: userData.user,
    profile,
    isAdmin: profile?.role === 'admin' && profile?.status !== 'banned',
  };
}
