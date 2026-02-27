import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import supabase from './firebase'
import ProtectedRoute from './components/ProtectedRoute'
import ProductHistoryView from './components/ProductHistoryView'
import AdminDashboardBlue from './components/AdminDashboardBlue'
import CustomerViewBlue from './components/CustomerViewBlue'
import HistoryViewBlue from './components/HistoryViewBlue'
import AnalyticsViewBlue from './components/AnalyticsViewBlue'
import { logLogoutBlue, logActivityBlue, calculateCostBlue, getDurationMinutes } from './utils/authUtilsBlue'

function AppBlue({ user, onLogout }) {
  const [customers, setCustomers] = useState([])
  const [nextId, setNextId] = useState(1)
  const [isSupabaseReady, setIsSupabaseReady] = useState(false)
  const [channel] = useState(() => new BroadcastChannel('juthazone-blue-sync'))
  const navigate = useNavigate()

  // Initialize Supabase sync
  useEffect(() => {
    if (!supabase) {
      setIsSupabaseReady(true)
      return
    }

    try {
      const subscription = supabase
        .channel('customers-channel-blue')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'juthazoneb_customers' },
          (payload) => {
            console.log('Realtime update (Blue):', payload)
            fetchCustomers()
          }
        )
        .subscribe()

      fetchCustomers()

      const pollInterval = setInterval(() => {
        fetchCustomers()
      }, 30000)

      setIsSupabaseReady(true)

      return () => {
        subscription.unsubscribe()
        clearInterval(pollInterval)
      }
    } catch (error) {
      console.error('Supabase error (Blue):', error)
      setIsSupabaseReady(true)
    }
  }, [channel])

  const fetchCustomers = async () => {
    if (!supabase) return

    try {
      const { data, error } = await supabase
        .from('juthazoneb_customers')
        .select('*')
        .order('id', { ascending: true })

      if (error) throw error

      if (data && data.length > 0) {
        setCustomers(data)
        const maxId = Math.max(...data.map(c => c.id), 0)
        setNextId(maxId + 1)

        channel.postMessage({
          type: 'UPDATE_CUSTOMERS',
          data: {
            customers: data,
            nextId: maxId + 1
          }
        })
      } else {
        setCustomers([])
        setNextId(1)
      }
    } catch (error) {
      console.error('Error fetching customers (Blue):', error)
    }
  }

  // Sync state across tabs
  useEffect(() => {
    const handleMessage = (event) => {
      const { type, data } = event.data
      
      if (type === 'UPDATE_CUSTOMERS') {
        setCustomers(data.customers)
        setNextId(data.nextId)
      }
    }

    channel.addEventListener('message', handleMessage)
    
    return () => {
      channel.removeEventListener('message', handleMessage)
    }
  }, [channel])

  // Update Firebase
  const updateFirebase = async (customersToSave) => {
    if (!supabase || !isSupabaseReady) return

    try {
      if (customersToSave.length === 0) {
        const { error } = await supabase.from('juthazoneb_customers').delete().neq('id', 0)
        if (error) throw error
      } else {
        // Only include columns that exist in `juthazoneb_customers` to avoid schema errors
        const nowIso = new Date().toISOString()
        const customersForDb = customersToSave.map(c => ({
          id: c.id,
          name: c.name,
          room: c.room,
          note: c.note || '',
          // Ensure hourly_rate is never null to satisfy DB constraint
          hourly_rate: (c.hourly_rate != null ? c.hourly_rate : 0),
          current_cost: (c.current_cost ?? 0),
          is_running: !!c.is_running,
          is_paid: !!c.is_paid,
          start_time: c.start_time || nowIso,
          pause_time: c.pause_time || null,
          total_pause_duration: c.total_pause_duration || 0,
          created_at: c.created_at || nowIso,
          updated_at: nowIso
        }))

        const { error } = await supabase
          .from('juthazoneb_customers')
          .upsert(customersForDb, { onConflict: 'id' })

        if (error) throw error
      }
    } catch (err) {
      console.error('Supabase error (Blue):', err)
      alert('ไม่สามารถบันทึกข้อมูลได้: ' + err.message)
    }
  }

  // Update cost every second for running customers
  useEffect(() => {
    const interval = setInterval(() => {
      setCustomers(prev => {
        const updated = prev.map(customer => {
          if (customer.is_running) {
            const currentCost = calculateCostBlue(
              customer.start_time,
              customer.hourly_rate,
              customer.total_pause_duration
            )
            return { ...customer, current_cost: currentCost }
          }
          return customer
        })
        return updated
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const addCustomer = async (customerData) => {
    try {
      const now = new Date()
      const nowIso = now.toISOString()
      // Always create Blue (pro-rated) customer
      const newCustomer = {
        id: nextId,
        name: customerData.name,
        room: customerData.room,
        note: customerData.note || '',
        hourly_rate: (customerData.hourlyRate != null ? customerData.hourlyRate : 0),
        current_cost: 0.00,
        is_running: true,
        is_paid: false,
        start_time: nowIso,
        pause_time: null,
        total_pause_duration: 0,
        created_at: nowIso,
        updated_at: nowIso
      }

      const newCustomers = [...customers, newCustomer]
      const newNextId = nextId + 1
      
      setCustomers(newCustomers)
      setNextId(newNextId)
      
      // Log activity
      if (user && user.username) {
        await logActivityBlue(
          user.username,
          'ADD_CUSTOMER',
          `Added customer: ${customerData.name} in room ${customerData.room} with hourly rate ${customerData.hourlyRate}`,
          { name: customerData.name, room: customerData.room, hourlyRate: customerData.hourlyRate },
          newCustomer.id
        )
      }
      
      // Create initial history record as in-progress (Blue)
      if (supabase && isSupabaseReady) {
        try {
          const historyRecord = {
            customer_id: newCustomer.id,
            name: newCustomer.name,
            room: newCustomer.room,
            note: newCustomer.note,
            added_by: user?.username || 'Unknown',
            start_time: nowIso,
            end_time: null,
            duration_minutes: 0,
            hourly_rate: customerData.hourlyRate,
            final_cost: 0.00,
            is_paid: false,
            end_reason: 'in_progress'
          }
          await supabase.from('juthazoneb_customers_history').insert([historyRecord])
        } catch (err) {
          console.warn('Failed to insert history record (Blue addCustomer):', err)
        }
      }
      
      await updateFirebase(newCustomers)
      
      channel.postMessage({
        type: 'UPDATE_CUSTOMERS',
        data: {
          customers: newCustomers,
          nextId: newNextId
        }
      })
    } catch (error) {
      console.error('Error adding customer (Blue):', error)
      alert('เกิดข้อผิดพลาด: ' + error.message)
    }
  }

  const toggleTimer = async (id) => {
    try {
      const now = new Date()
      const newCustomers = customers.map(customer => {
        if (customer.id === id) {
          if (customer.is_running) {
            // Currently running -> Pause
            return {
              ...customer,
              is_running: false,
              pause_time: now.toISOString()
            }
          } else {
            // Currently paused -> Resume
            if (customer.pause_time) {
              const pauseDuration = Math.floor((now - new Date(customer.pause_time)) / 1000)
              return {
                ...customer,
                is_running: true,
                pause_time: null,
                total_pause_duration: (customer.total_pause_duration || 0) + pauseDuration
              }
            } else {
              // Just resume without pause calculation
              return {
                ...customer,
                is_running: true,
                pause_time: null
              }
            }
          }
        }
        return customer
      })
      
      setCustomers(newCustomers)
      await updateFirebase(newCustomers)
      
      // Update history
      if (supabase && isSupabaseReady) {
        const updatedCustomer = newCustomers.find(c => c.id === id)
        if (updatedCustomer) {
          const currentCost = calculateCostBlue(
            updatedCustomer.start_time,
            updatedCustomer.hourly_rate,
            updatedCustomer.total_pause_duration,
            updatedCustomer.pause_time,
            updatedCustomer.is_running
          )
          await supabase
            .from('juthazoneb_customers_history')
            .update({
              final_cost: currentCost,
              updated_at: new Date().toISOString()
            })
            .eq('customer_id', id)
            .eq('end_reason', 'in_progress')
        }
      }
      
      channel.postMessage({
        type: 'UPDATE_CUSTOMERS',
        data: { customers: newCustomers, nextId }
      })
    } catch (error) {
      console.error('Error toggling timer (Blue):', error)
    }
  }

  const togglePayment = async (id) => {
    try {
      const newCustomers = customers.map(customer =>
        customer.id === id
          ? { ...customer, is_paid: !customer.is_paid }
          : customer
      )
      setCustomers(newCustomers)
      await updateFirebase(newCustomers)
      
      // Update history
      if (supabase && isSupabaseReady) {
        const updatedCustomer = newCustomers.find(c => c.id === id)
        if (updatedCustomer) {
          await supabase
            .from('juthazoneb_customers_history')
            .update({
              is_paid: updatedCustomer.is_paid,
              updated_at: new Date().toISOString()
            })
            .eq('customer_id', id)
            .eq('end_reason', 'in_progress')
        }
      }
      
      channel.postMessage({
        type: 'UPDATE_CUSTOMERS',
        data: { customers: newCustomers, nextId }
      })
    } catch (error) {
      console.error('Error toggling payment (Blue):', error)
    }
  }

  const completeCustomer = async (id) => {
    try {
      const customerToComplete = customers.find(c => c.id === id)
      if (customerToComplete) {
        // Log activity
        if (user && user.username) {
          await logActivityBlue(
            user.username,
            'COMPLETE_CUSTOMER',
            `Completed customer: ${customerToComplete.name} from room ${customerToComplete.room}`,
            { 
              name: customerToComplete.name, 
              room: customerToComplete.room,
              finalCost: calculateCostBlue(customerToComplete.start_time, customerToComplete.hourly_rate, customerToComplete.total_pause_duration)
            },
            customerToComplete.id
          )
        }
        
        // Save to history as completed
        await saveToHistory(customerToComplete, 'completed')
      }

      if (supabase && isSupabaseReady) {
        const { error } = await supabase
          .from('juthazoneb_customers')
          .delete()
          .eq('id', id)
        if (error) throw error
      }

      const newCustomers = customers.filter(customer => customer.id !== id)
      setCustomers(newCustomers)
      await updateFirebase(newCustomers)
      
      channel.postMessage({
        type: 'UPDATE_CUSTOMERS',
        data: { customers: newCustomers, nextId }
      })
    } catch (error) {
      console.error('Error completing customer (Blue):', error)
    }
  }

  const deleteCustomer = async (id) => {
    try {
      const customerToDelete = customers.find(c => c.id === id)
      if (customerToDelete) {
        // Log activity
        if (user && user.username) {
          await logActivityBlue(
            user.username,
            'DELETE_CUSTOMER',
            `Deleted customer: ${customerToDelete.name} from room ${customerToDelete.room}`,
            { name: customerToDelete.name, room: customerToDelete.room },
            customerToDelete.id
          )
        }
        
        // Save to history
        await saveToHistory(customerToDelete, 'deleted')
      }

      if (supabase && isSupabaseReady) {
        const { error } = await supabase
          .from('juthazoneb_customers')
          .delete()
          .eq('id', id)
        if (error) throw error
      }

      const newCustomers = customers.filter(customer => customer.id !== id)
      setCustomers(newCustomers)
      await updateFirebase(newCustomers)
      
      channel.postMessage({
        type: 'UPDATE_CUSTOMERS',
        data: { customers: newCustomers, nextId }
      })
    } catch (error) {
      console.error('Error deleting customer (Blue):', error)
    }
  }

  const saveToHistory = async (customer, endReason = 'completed') => {
    if (!supabase || !isSupabaseReady) return

    try {
      const endTime = new Date()
      const durationMinutes = getDurationMinutes(customer.start_time, endTime, customer.total_pause_duration)
      const finalCost = calculateCostBlue(
        customer.start_time,
        customer.hourly_rate,
        customer.total_pause_duration,
        customer.pause_time,
        customer.is_running
      )

      const { error } = await supabase
        .from('juthazoneb_customers_history')
        .update({
          end_time: endTime.toISOString(),
          duration_minutes: durationMinutes,
          is_paid: customer.is_paid,
          final_cost: finalCost,
          end_reason: endReason
        })
        .eq('customer_id', customer.id)
        .eq('end_reason', 'in_progress')

      if (error) throw error
    } catch (error) {
      console.error('Error saving to history (Blue):', error)
    }
  }

  const handleLogout = async () => {
    if (user && user.username) {
      await logLogoutBlue(user.username)
    }
    onLogout()
  }

  return (
    <Routes>
      <Route
        path="/admin"
        element={
          <ProtectedRoute isLoggedIn={!!user}>
            <AdminDashboardBlue
              customers={customers}
              addCustomer={addCustomer}
              toggleTimer={toggleTimer}
              togglePayment={togglePayment}
              completeCustomer={completeCustomer}
              deleteCustomer={deleteCustomer}
              user={user}
              onLogout={handleLogout}
            />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer"
        element={<CustomerViewBlue customers={customers} />}
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute isLoggedIn={!!user}>
            <HistoryViewBlue user={user} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/product-history"
        element={
          <ProtectedRoute isLoggedIn={!!user}>
            <ProductHistoryView />
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute isLoggedIn={!!user}>
            <AnalyticsViewBlue user={user} />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/blue/admin" replace />} />
    </Routes>
  )
}

export default AppBlue
