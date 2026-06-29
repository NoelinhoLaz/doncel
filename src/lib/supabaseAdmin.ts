import { createBrowserClient } from '@supabase/ssr'

const adminUrl = process.env.NEXT_PUBLIC_ADMIN_SUPABASE_URL!
const adminAnonKey = process.env.NEXT_PUBLIC_ADMIN_SUPABASE_ANON_KEY!

export const supabaseAdmin = createBrowserClient(
  adminUrl,
  adminAnonKey
)
