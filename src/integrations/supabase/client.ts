import { createClient } from '@supabase/supabase-js';

// Hardcoded for reliability - anon key is safe to expose (it's a publishable key)
// TODO: Configure Coolify to pass VITE_* vars at build time, then revert to env vars
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://supabase.orangespace.io';
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjQxNzY5MjAwLCJleHAiOjE3OTk1MzU2MDB9.7LufwxCAJms4a7U6r7NWpKr9eBnhSqWDn8DO85NV320';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
