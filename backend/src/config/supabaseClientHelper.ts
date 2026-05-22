import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Creates a standard user-scoped Supabase client instance using the client's current JWT.
 * This ensures that Row-Level Security (RLS) policies are evaluated correctly against the user's sub claim.
 * 
 * @param authHeader The raw HTTP Authorization header containing the Bearer token.
 * @returns An authenticated Supabase client instance.
 */
export function getUserSupabaseClient(authHeader: string | undefined): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL and Anon Key must be configured in environment variables.');
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Authorization header with Bearer token is required to build client.');
  }

  const token = authHeader.split(' ')[1];

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

