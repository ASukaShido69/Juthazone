import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import 'react-native-url-polyfill/auto'

// ⚠️ Replace with your actual Supabase credentials
const SUPABASE_URL = 'https://your-project.supabase.co'
const SUPABASE_ANON_KEY = 'your-anon-key'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

// Helper functions
export const fetchCustomers = async () => {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data
}

export const fetchHistory = async (filters?: {
  dateFrom?: string
  dateTo?: string
  room?: string
  paid?: boolean
}) => {
  let query = supabase
    .from('customers_history')
    .select('*')
    .order('created_at', { ascending: false })

  if (filters?.dateFrom) {
    query = query.gte('created_at', filters.dateFrom)
  }
  if (filters?.dateTo) {
    query = query.lte('created_at', filters.dateTo)
  }
  if (filters?.room && filters.room !== 'all') {
    query = query.eq('room', filters.room)
  }
  if (filters?.paid !== undefined) {
    query = query.eq('is_paid', filters.paid)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

export const addCustomer = async (customer: {
  name: string
  room: string
  phone?: string
  duration_minutes: number
  cost: number
}) => {
  const { data, error } = await supabase
    .from('customers')
    .insert([
      {
        ...customer,
        start_time: new Date().toISOString(),
        is_active: true,
        is_paid: false,
      },
    ])
    .select()
    .single()

  if (error) throw error
  return data
}

export const updateCustomer = async (id: number, updates: any) => {
  const { data, error } = await supabase
    .from('customers')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export const deleteCustomer = async (id: number) => {
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id)

  if (error) throw error
}

export const endSession = async (id: number, isPaid: boolean, paymentMethod?: string) => {
  const { data, error } = await supabase
    .from('customers')
    .update({
      actual_end_time: new Date().toISOString(),
      is_active: false,
      is_paid: isPaid,
      payment_method: paymentMethod,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

// Subscribe to realtime changes
export const subscribeToCustomers = (callback: (payload: any) => void) => {
  return supabase
    .channel('customers')
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'customers' 
    }, callback)
    .subscribe()
}

export default supabase
