import { createClient } from '@supabase/supabase-js';

// Supabase client is initialised once per app to reuse the connection
// The URL and anon key should be provided via environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;