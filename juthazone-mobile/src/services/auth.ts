import supabase from './supabase'

export const login = async (email, password) => {
  const { user, error } = await supabase.auth.signIn({
    email,
    password,
  })

  if (error) throw error
  return user
}

export const logout = async () => {
  const { error } = await supabase.auth.signOut()

  if (error) throw error
}

export const getCurrentUser = () => {
  return supabase.auth.user()
}