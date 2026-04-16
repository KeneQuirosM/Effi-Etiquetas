import { createClient } from '@supabase/supabase-js';

// 🔐 Cliente ADMIN (backend)
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY, // 🔥 CLAVE CORRECTA
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export const supabase = supabaseAdmin;
