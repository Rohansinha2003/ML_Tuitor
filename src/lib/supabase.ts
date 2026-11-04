import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigured = Boolean(url && anonKey)

// Browser client. Uses only the public anon key; protect data with Row Level Security.
export const supabase = supabaseConfigured ? createClient(url, anonKey) : null
