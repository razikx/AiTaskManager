import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
  console.warn(
    '[Supabase Config] Missing environmental variables. Verify SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are set.'
  );
}

// 1. Client configured with Standard User privilege mappings (bypasses service authorization, respects RLS)
export const supabaseClient = createClient(
  supabaseUrl || '',
  supabaseAnonKey || ''
);

// 2. Admin client using the service role token (restricted strictly to system/admin tasks that bypass RLS)
export const supabaseAdmin = createClient(
  supabaseUrl || '',
  supabaseServiceRoleKey || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);
