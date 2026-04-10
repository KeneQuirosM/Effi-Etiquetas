import { createClient } from '@supabase/supabase-js';

// Cliente con service key (para operaciones del coordinador desde API)
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Cliente con anon key (para lectura pública)
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
