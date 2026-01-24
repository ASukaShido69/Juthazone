import { useState, useEffect } from 'react'
import { supabase, fetchCustomers as fetchCustomersAPI, subscribeToCustomers } from '../services/supabase'
import { Customer } from '../types'

const useCustomers = () => {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCustomers = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchCustomersAPI()
      setCustomers(data || [])
    } catch (err: any) {
      console.error('Error fetching customers:', err)
      setError(err.message || 'Unable to load customer data')
    } finally {
      setLoading(false)
    }
  }

  const addCustomer = async (customerData: {
    name: string
    room: string
    phone?: string
    duration_minutes: number
    cost: number
  }) => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([{
          ...customerData,
          start_time: new Date().toISOString(),
          is_active: true,
          is_paid: false,
        }])
        .select()
        .single()

      if (error) throw error
      await fetchCustomers()
      return data
    } catch (err: any) {
      console.error('Error adding customer:', err)
      throw err
    }
  }

  const updateCustomer = async (id: number, updates: Partial<Customer>) => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      await fetchCustomers()
      return data
    } catch (err: any) {
      console.error('Error updating customer:', err)
      throw err
    }
  }

  const deleteCustomer = async (id: number) => {
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id)

      if (error) throw error
      await fetchCustomers()
    } catch (err: any) {
      console.error('Error deleting customer:', err)
      throw err
    }
  }

  useEffect(() => {
    fetchCustomers()

    // Subscribe to realtime changes
    const subscription = subscribeToCustomers((payload) => {
      console.log('Realtime change:', payload)
      fetchCustomers()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return { 
    customers, 
    loading, 
    error, 
    fetchCustomers,
    addCustomer,
    updateCustomer,
    deleteCustomer
  }
}

export default useCustomers