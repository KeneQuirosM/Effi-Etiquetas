import { createClient } from '@supabase/supabase-js';

// Cliente configurado con persistencia
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

// --- ESTA ES LA PIEZA QUE FALTA ---
// Esto hace que 'supabase' sea visible para la consola y el index.html
if (typeof window !== 'undefined') {
    window.supabase = supabase;
}
