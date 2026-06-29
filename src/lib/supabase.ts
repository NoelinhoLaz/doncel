import { createBrowserClient } from '@supabase/ssr'

// Cliente único apuntando a la BD Admin
// Cada agencia tiene sus propias credenciales guardadas en la tabla `agencias`
const adminUrl = process.env.NEXT_PUBLIC_ADMIN_SUPABASE_URL!
const adminAnonKey = process.env.NEXT_PUBLIC_ADMIN_SUPABASE_ANON_KEY!

export const supabase = createBrowserClient(adminUrl, adminAnonKey)
