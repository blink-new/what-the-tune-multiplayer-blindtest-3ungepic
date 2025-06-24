import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Optional: Listen for auth changes if needed for more complex auth flows
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    // console.log('Auth state changed:', event, session?.user?.id)
  } else if (event === 'SIGNED_OUT') {
    // console.log('User signed out')
    localStorage.removeItem('playerId')
    localStorage.removeItem('roomCode')
  }
})
