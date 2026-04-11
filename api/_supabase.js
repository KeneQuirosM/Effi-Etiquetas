import { createClient } from '@supabase/supabase-js';

// 1. CONFIGURACIÓN DE VARIABLES (Vercel leerá estas de tu panel de Settings)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// 2. CLIENTE PÚBLICO (Para el Navegador/Frontend)
// Es vital incluir el objeto 'auth' para que el token se guarde en el navegador
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,      // <--- ESTO ARREGLA EL 401: Guarda el token en LocalStorage
    autoRefreshToken: true,    // Mantiene la sesión viva
    detectSessionInUrl: true   // Útil para redirecciones en Vercel
  }
});

// 3. CLIENTE ADMIN (Para la carpeta /api)
// Este se usa solo en el servidor para saltar reglas de seguridad (RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// 4. EL PUENTE GLOBAL (Para que tu index.html y la consola lo vean)
// Esto soluciona el error "supabase is not defined"
if (typeof window !== 'undefined') {
  window.supabase = supabase;
}
