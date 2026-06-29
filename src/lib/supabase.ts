import { createBrowserClient } from '@supabase/ssr'

const getSupabaseClient = () => {
  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_SUPABASE_URL;
  const adminAnonKey = process.env.NEXT_PUBLIC_ADMIN_SUPABASE_ANON_KEY;
  if (!adminUrl || !adminAnonKey) {
    return createBrowserClient('http://localhost:3000', 'dummy-anon-key');
  }
  return createBrowserClient(adminUrl, adminAnonKey);
};

export const supabase = getSupabaseClient();
