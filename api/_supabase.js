import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

// AGREGA ESTA LÍNEA PARA QUE LA CONSOLA Y EL HTML LA VEAN:
if (typeof window !== 'undefined') {
  window.supabase = supabase;
}
