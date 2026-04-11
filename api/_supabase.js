import { createClient } from '@supabase/supabase-js';

// 1. Cliente Admin (Service Role) - SOLO para el servidor/API
// Este se usa en tus funciones de la carpeta /api para saltar RLS
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// 2. Cliente Público (Anon Key) - Para el Navegador/Frontend
// Aquí es donde activamos la persistencia para que el token se guarde
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,      // <--- Crucial: Guarda el token en LocalStorage
      autoRefreshToken: true,   // <--- Mantiene la sesión activa
      detectSessionInUrl: true  // <--- Necesario para flujos de auth en Vercel
    }
  }
);

// 3. EXPORTACIÓN GLOBAL (El "Puente" para el index.html)
// Esto soluciona el error "supabase is not defined" en tu consola y scripts
if (typeof window !== 'undefined') {
  window.supabase = supabase;
}
