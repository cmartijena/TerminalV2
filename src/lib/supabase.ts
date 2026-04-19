import { createClient } from '@supabase/supabase-js'

const SUPA_URL = 'https://yfsmisxczwgealtzlxho.supabase.co'
const SUPA_KEY = import.meta.env.VITE_SUPABASE_KEY || ''

export const supa = createClient(SUPA_URL, SUPA_KEY)