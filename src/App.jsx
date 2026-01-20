import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import supabase from './firebase'
import LoginPage from './components/LoginPage'
import ZoneSelection from './components/ZoneSelection'
import ProtectedRoute from './components/ProtectedRoute'
import AdminDashboard from './components/AdminDashboard'
import CustomerView from './components/CustomerView'
import HistoryView from './components/HistoryView'
import AnalyticsView from './components/AnalyticsView'
import DailySummaryView from './components/DailySummaryView'
import AppBlue from './AppBlue'
import { logLogout, logActivity } from './utils/authUtils'

function App() {
  const [customers, setCustomers] = useState([])
  const [nextId, setNextId] = useState(1)
  const [isSupabaseReady, setIsSupabaseReady] = useState(false)
  const [channel] = useState(() => new BroadcastChannel('juthazone-sync'))
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check if user is logged in (from localStorage)
  useEffect(() => {
    const storedUser = localStorage.getItem('juthazone_user')
    if (storedUser) {
      setUser(JSON.parse(storedUser))
    }
    setIsLoading(false)
  }, [])

  // Handle logout with logging
  const handleLogout = async () => {
    if (user && user.username) {
      await logLogout(user.username)
    }
    localStorage.removeItem('juthazone_user')
    setUser(null)
    setCustomers([])
  }

  const handleLogin = (userData) => {
    setUser(userData)
  }

  // Initialize Supabase sync with hybrid approach (realtime + polling)
  // OPTIMIZED: Only sync critical fields, compute timeRemaining from timestamps
  useEffect(() => {
    if (!supabase) {
      setIsSupabaseReady(true)
      return
    }

    try {
      // Subscribe to realtime changes - only for isPaid, isRunning changes
      const subscription = supabase
        .channel('customers-channel')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'customers' },
          (payload) => {
            console.log('Realtime update:', payload)
            // Refresh customers list on any change
            fetchCustomers()
          }
        )
        .subscribe()

      // Initial fetch
      fetchCustomers()

      // Poll every 30 seconds for reliability (reduced from 5s for better performance)
      const pollInterval = setInterval(() => {
        fetchCustomers()
      }, 30000)

      setIsSupabaseReady(true)

      return () => {
        subscription.unsubscribe()
        clearInterval(pollInterval)
      }
    } catch (error) {
      console.error('Supabase error:', error)
      setIsSupabaseReady(true)
    }
  }, [channel])

  const fetchCustomers = async () => {
    if (!supabase) return

    try {
      const { data, error } = await supabase
        .from('customers')
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
      console.error('Error fetching customers:', error)
    }
  }

  // Sync state across tabs/windows using BroadcastChannel
  useEffect(() => {
    const handleMessage = (event) => {
      const { type, data } = event.data
      
      switch (type) {
        case 'UPDATE_CUSTOMERS':
          setCustomers(data.customers)
          setNextId(data.nextId)
          break
        default:
          break
      }
    }

    channel.addEventListener('message', handleMessage)
    
    return () => {
      channel.removeEventListener('message', handleMessage)
    }
  }, [channel])

  // Broadcast state changes to other tabs
  const broadcastUpdate = (newCustomers, newNextId) => {
    channel.postMessage({
      type: 'UPDATE_CUSTOMERS',
      data: {
        customers: newCustomers,
        nextId: newNextId || nextId
      }
    })
  }

  // Persist customers to Supabase with explicit try/catch so we do not rely on .catch()
  const updateFirebase = async (customersToSave) => {
    if (!supabase || !isSupabaseReady) return

    try {
      if (customersToSave.length === 0) {
        // Delete all customers
        const { error } = await supabase.from('customers').delete().neq('id', 0)
        if (error) throw error
      } else {
        // Add timestamps and upsert with onConflict
        const customersWithTimestamps = customersToSave.map(c => ({
          ...c,
          updated_at: new Date().toISOString(),
          created_at: c.created_at || new Date().toISOString()
        }))
        
        const { error } = await supabase
          .from('customers')
          .upsert(customersWithTimestamps, { onConflict: 'id' })
        
        if (error) throw error
      }
    } catch (err) {
      console.error('Supabase error:', err)
      alert('ไม่สามารถบันทึกข้อมูลได้: ' + err.message)
    }
  }

  // Update timers with precise 1-second intervals using timestamp tracking
  // OPTIMIZED: Calculate timeRemaining from expectedEndTime, don't sync every second
  useEffect(() => {
    let lastUpdate = Date.now()
    let lastSync = Date.now()
    
    const interval = setInterval(() => {
      const now = Date.now()
      const elapsed = now - lastUpdate
      const timeSinceSync = now - lastSync
      
      // Only update if approximately 1 second has passed (allow 50ms tolerance)
      if (elapsed >= 950 && elapsed <= 1050) {
        lastUpdate = now
        
        setCustomers(prev => {
          // Mark expired customers for removal
          const expired = prev.filter(c => {
            if (c.isRunning && c.expectedEndTime) {
              const endTimeMs = new Date(c.expectedEndTime).getTime()
              return endTimeMs <= now
            }
            return false
          })

          // Save expired customers to history
          expired.forEach(customer => saveToHistory(customer, 'expired'))

          // Filter out expired customers
          const filtered = prev.filter(c => {
            if (c.isRunning && c.expectedEndTime) {
              const endTimeMs = new Date(c.expectedEndTime).getTime()
              return endTimeMs > now
            }
            return true
          })
          
          // Only sync to Supabase when customers expire (30 seconds, not every second)
          if (supabase && isSupabaseReady && timeSinceSync >= 30000 && filtered.length < prev.length) {
            updateFirebase(filtered)
            lastSync = now
          }
          
          // Broadcast to other tabs only when changes happen
          if (filtered.length !== prev.length) {
            channel.postMessage({
              type: 'UPDATE_CUSTOMERS',
              data: {
                customers: filtered,
                nextId
              }
            })
          }
          
          return filtered
        })
      }
    }, 100) // Check every 100ms for precise timing

    return () => clearInterval(interval)
  }, [nextId, channel, isSupabaseReady])

  const addCustomer = async (customerData) => {
    try {
      const now = new Date()
      const nowIso = now.toISOString()
      
      // Calculate expected end time
      const expectedEndTime = new Date(now.getTime() + customerData.minutes * 60 * 1000).toISOString()
      
      // Get session_date from start_time (for daily cutoff at 00:00)
      const sessionDate = nowIso.split('T')[0]
      
      const newCustomer = {
        id: nextId,
        ...customerData,
        timeRemaining: customerData.minutes * 60,
        isRunning: true,
        isPaid: false,
        startTime: nowIso,
        expectedEndTime: expectedEndTime,
        created_at: nowIso,
        updated_at: nowIso
      }
      const newCustomers = [...customers, newCustomer]
      const newNextId = nextId + 1
      
      setCustomers(newCustomers)
      setNextId(newNextId)
      
      // Log activity
      if (user && user.username) {
        await logActivity(
          user.username,
          'ADD_CUSTOMER',
          `Added customer: ${customerData.name} in room ${customerData.room} for ${customerData.minutes} minutes`,
          { name: customerData.name, room: customerData.room, minutes: customerData.minutes, cost: customerData.cost },
          newCustomer.id
        )
      }
      
      // Create initial history record
      if (supabase && isSupabaseReady) {
        await supabase
          .from('customers_history')
          .insert([{
            customer_id: newCustomer.id,
            name: newCustomer.name,
            room: newCustomer.room,
            note: newCustomer.note || '',
            added_by: user?.username || 'Unknown',
            start_time: nowIso,
            end_time: expectedEndTime,
            duration_minutes: customerData.minutes,
            original_cost: customerData.cost,
            final_cost: customerData.cost,
            is_paid: false,
            end_reason: 'in_progress',
            session_date: sessionDate,  // บันทึกวันที่เริ่มใช้บริการ
            shift: customerData.shift || 'all',  // บันทึกกะที่เลือก
            payment_method: customerData.payment_method || 'transfer'  // บันทึกวิธีการจ่าย
          }])
      }
      
      // Update Supabase
      updateFirebase(newCustomers)
      
      // Broadcast to other tabs
      channel.postMessage({
        type: 'UPDATE_CUSTOMERS',
        data: {
          customers: newCustomers,
          nextId: newNextId
        }
      })
    } catch (error) {
      console.error('Error adding customer:', error)
      alert('เกิดข้อผิดพลาด: ' + error.message)
    }
  }

  const toggleTimer = async (id) => {
    try {
      const now = Date.now()

      const newCustomers = customers.map(customer => {
        if (customer.id !== id) return customer

        // Pause
        if (customer.isRunning) {
          const endTimeMs = customer.expectedEndTime
            ? new Date(customer.expectedEndTime).getTime()
            : now + (customer.timeRemaining || 0) * 1000

          const remainingSeconds = Math.max(0, Math.ceil((endTimeMs - now) / 1000))

          return {
            ...customer,
            isRunning: false,
            timeRemaining: remainingSeconds,
            expectedEndTime: null
          }
        }

        // Resume
        const remainingSeconds = customer.timeRemaining || 0
        const newExpectedEnd = new Date(now + remainingSeconds * 1000).toISOString()

        return {
          ...customer,
          isRunning: true,
          expectedEndTime: newExpectedEnd,
          timeRemaining: remainingSeconds
        }
      })

      setCustomers(newCustomers)
      await updateFirebase(newCustomers)
      
      // SYNC: Update history when timer is toggled
      if (supabase && isSupabaseReady) {
        const updatedCustomer = newCustomers.find(c => c.id === id)
        if (updatedCustomer) {
          await supabase
            .from('customers_history')
            .update({
              shift: updatedCustomer.shift || 'all',  // บันทึกกะ
              payment_method: updatedCustomer.payment_method || 'transfer',  // บันทึกวิธีการจ่าย
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
      console.error('Error toggling timer:', error)
    }
  }

  const addTime = async (id, minutesToAdd) => {
    try {
      const newCustomers = customers.map(customer => {
        if (customer.id === id) {
          // Update expectedEndTime when adding time
          const currentEnd = new Date(customer.expectedEndTime)
          const newEnd = new Date(currentEnd.getTime() + (minutesToAdd * 60 * 1000))
          return { 
            ...customer, 
            timeRemaining: customer.timeRemaining + (minutesToAdd * 60),
            expectedEndTime: newEnd.toISOString()
          }
        }
        return customer
      })
      setCustomers(newCustomers)
      await updateFirebase(newCustomers)
      
      // Update history with new expected end time
      if (supabase && isSupabaseReady) {
        const updatedCustomer = newCustomers.find(c => c.id === id)
        if (updatedCustomer) {
          await supabase
            .from('customers_history')
            .update({
              final_cost: updatedCustomer.cost,
              shift: updatedCustomer.shift || 'all',  // บันทึกกะ
              payment_method: updatedCustomer.payment_method || 'transfer',  // บันทึกวิธีการจ่าย
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
      console.error('Error adding time:', error)
    }
  }

  const extendTime = async (id, minutesToExtend = 30) => {
    try {
      // Add to end time when customer wants to extend after time expires
      const newCustomers = customers.map(customer => {
        if (customer.id === id) {
          const currentEnd = new Date(customer.expectedEndTime)
          const newEnd = new Date(currentEnd.getTime() + (minutesToExtend * 60 * 1000))
          return { 
            ...customer, 
            timeRemaining: minutesToExtend * 60,
            expectedEndTime: newEnd.toISOString(),
            isRunning: true // Auto-start the timer again
          }
        }
        return customer
      })
      setCustomers(newCustomers)
      await updateFirebase(newCustomers)
      
      // Update history with extended time
      if (supabase && isSupabaseReady) {
        const updatedCustomer = newCustomers.find(c => c.id === id)
        if (updatedCustomer) {
          // Calculate new duration
          const startTime = new Date(updatedCustomer.startTime)
          const endTime = new Date(updatedCustomer.expectedEndTime)
          const durationMinutes = (endTime - startTime) / (1000 * 60)
          
          await supabase
            .from('customers_history')
            .update({
              duration_minutes: durationMinutes.toFixed(2),
              final_cost: updatedCustomer.cost,
              end_reason: 'in_progress', // Reset to in_progress
              shift: updatedCustomer.shift || 'all',  // บันทึกกะ
              payment_method: updatedCustomer.payment_method || 'transfer',  // บันทึกวิธีการจ่าย
              updated_at: new Date().toISOString()
            })
            .eq('customer_id', id)
        }
      }
      
      alert(`✅ ขยายเวลาเพิ่ม ${minutesToExtend} นาที`)
      
      channel.postMessage({
        type: 'UPDATE_CUSTOMERS',
        data: { customers: newCustomers, nextId }
      })
    } catch (error) {
      console.error('Error extending time:', error)
      alert('เกิดข้อผิดพลาด: ' + error.message)
    }
  }

  const subtractTime = async (id, minutesToSubtract) => {
    try {
      let removedCustomer = null
      const newCustomers = customers.map(customer => {
        if (customer.id === id) {
          const newTime = customer.timeRemaining - (minutesToSubtract * 60)
          // Update expectedEndTime when subtracting time
          const currentEnd = new Date(customer.expectedEndTime)
          const newEnd = new Date(currentEnd.getTime() - (minutesToSubtract * 60 * 1000))
          
          if (newTime <= 0) {
            removedCustomer = customer
            return null
          }
          
          return { 
            ...customer, 
            timeRemaining: Math.max(0, newTime),
            expectedEndTime: newEnd.toISOString()
          }
        }
        return customer
      }).filter(customer => customer !== null)
      
      // Save removed customer to history
      if (removedCustomer) {
        await saveToHistory(removedCustomer, 'completed')
      }
      
      setCustomers(newCustomers)
      await updateFirebase(newCustomers)
      
      // Update history for remaining customer (if not removed)
      if (supabase && isSupabaseReady && !removedCustomer) {
        const updatedCustomer = newCustomers.find(c => c.id === id)
        if (updatedCustomer) {
          await supabase
            .from('customers_history')
            .update({
              final_cost: updatedCustomer.cost,
              shift: updatedCustomer.shift || 'all',  // บันทึกกะ
              payment_method: updatedCustomer.payment_method || 'transfer',  // บันทึกวิธีการจ่าย
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
      console.error('Error subtracting time:', error)
    }
  }

  // Save customer to history when they finish
  const saveToHistory = async (customer, endReason = 'completed') => {
    if (!supabase || !isSupabaseReady) return

    try {
      const endTime = new Date()
      const startTime = new Date(customer.startTime)
      const durationMs = endTime - startTime
      const durationMinutes = durationMs / (1000 * 60)

      // Calculate session_date based on start_time (for daily cutoff at 00:00)
      // Use the date when customer started, not when they ended
      const sessionDate = startTime.toISOString().split('T')[0]

      // Update existing history record with end_time and end_reason
      const { error } = await supabase
        .from('customers_history')
        .update({
          end_time: endTime.toISOString(),
          duration_minutes: durationMinutes.toFixed(2),
          is_paid: customer.isPaid,
          final_cost: customer.cost,
          end_reason: endReason,
          session_date: sessionDate,  // บันทึกวันที่เริ่มใช้บริการ
          shift: customer.shift || 'all',  // บันทึกกะที่เลือก
          payment_method: customer.payment_method || 'transfer'  // บันทึกวิธีการจ่าย
        })
        .eq('customer_id', customer.id)
        .eq('end_reason', 'in_progress')

      if (error) throw error
    } catch (error) {
      console.error('Error saving to history:', error)
    }
  }

  const togglePayment = async (id) => {
    try {
      const newCustomers = customers.map(customer =>
        customer.id === id
          ? { ...customer, isPaid: !customer.isPaid }
          : customer
      )
      setCustomers(newCustomers)
      await updateFirebase(newCustomers)
      
      // SYNC: Update history table immediately when payment status changes
      if (supabase && isSupabaseReady) {
        const updatedCustomer = newCustomers.find(c => c.id === id)
        if (updatedCustomer) {
          const paymentPayload = {
            is_paid: updatedCustomer.isPaid,
            shift: updatedCustomer.shift || 'all',
            payment_method: updatedCustomer.payment_method || 'transfer',
            updated_at: new Date().toISOString()
          }

          console.log('Updating payment status:', { customer_id: id, payload: paymentPayload })

          const { data, error } = await supabase
            .from('customers_history')
            .update(paymentPayload)
            .eq('customer_id', id)
            .eq('end_reason', 'in_progress')
            .select()

          console.log('Payment update result:', { data, error })

          if (error) {
            console.error('Payment update error:', error)
          }
        }
      }
      
      channel.postMessage({
        type: 'UPDATE_CUSTOMERS',
        data: { customers: newCustomers, nextId }
      })
    } catch (error) {
      console.error('Error toggling payment:', error)
    }
  }

  const deleteCustomer = async (id) => {
    try {
      console.log('🗑️ Deleting customer from active list:', id)
      
      // ลบออกจาก Supabase ก่อน
      if (supabase && isSupabaseReady) {
        const { error } = await supabase
          .from('customers')
          .delete()
          .eq('id', id)
        
        if (error) {
          console.error('Error deleting from Supabase:', error)
          throw error
        }
        console.log('✅ Deleted from Supabase successfully')
      }
      
      // ลบออกจาก local state
      const newCustomers = customers.filter(customer => customer.id !== id)
      setCustomers(newCustomers)
      
      // ส่งข้อความไปยัง tabs อื่น
      channel.postMessage({
        type: 'UPDATE_CUSTOMERS',
        data: { customers: newCustomers, nextId }
      })
      
      console.log('✅ Customer removed from active list successfully')
    } catch (error) {
      console.error('Error deleting customer:', error)
      alert('❌ ไม่สามารถลบลูกค้าได้: ' + error.message)
    }
  }

  // Clear all data from both customers and history tables
  const clearAllData = async () => {
    const confirmed = window.confirm(
      '⚠️ คุณแน่ใจหรือไม่ที่จะลบข้อมูลทั้งหมด?\n\n' +
      '- ลูกค้าปัจจุบันทั้งหมด\n' +
      '- ประวัติทั้งหมด\n\n' +
      'การกระทำนี้ไม่สามารถย้อนกลับได้!'
    )

    if (!confirmed) return

    const doubleConfirm = window.confirm(
      '🚨 ยืนยันอีกครั้ง!\n\nข้อมูลทั้งหมดจะถูกลบอย่างถาวร\nพิมพ์ตกลงอีกครั้งเพื่อยืนยัน'
    )

    if (!doubleConfirm) return

    try {
      // Log activity
      if (user && user.username) {
        await logActivity(
          user.username,
          'CLEAR_ALL_DATA',
          `Cleared all data - deleted ${customers.length} customers and all history records`,
          { totalCustomersDeleted: customers.length }
        )
      }

      // Clear local state first
      setCustomers([])
      setNextId(1)

      if (supabase && isSupabaseReady) {
        // Delete all from customers table
        const { error: customersError } = await supabase
          .from('customers')
          .delete()
          .neq('id', 0) // Delete all records

        if (customersError) throw customersError

        // Delete all from history table
        const { error: historyError } = await supabase
          .from('customers_history')
          .delete()
          .neq('id', 0) // Delete all records

        if (historyError) throw historyError

        // Broadcast to other tabs
        channel.postMessage({
          type: 'UPDATE_CUSTOMERS',
          data: { customers: [], nextId: 1 }
        })

        alert('✅ ลบข้อมูลทั้งหมดสำเร็จ!')
      }
    } catch (error) {
      console.error('Error clearing all data:', error)
      alert('❌ เกิดข้อผิดพลาดในการลบข้อมูล: ' + error.message)
    }
  }

  return (
    <BrowserRouter>
      {isLoading ? (
        <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-orange-500 flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4 animate-spin">⏳</div>
            <p className="text-white text-xl font-bold">กำลังโหลด...</p>
          </div>
        </div>
      ) : (
        <Routes>
          {/* Zone Selection */}
          <Route path="/" element={<ZoneSelection />} />
          
          {/* Login */}
          <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
          
          {/* Red Zone Routes (Original) */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute isLoggedIn={!!user}>
                <AdminDashboard
                  customers={customers}
                  addCustomer={addCustomer}
                  toggleTimer={toggleTimer}
                  addTime={addTime}
                  subtractTime={subtractTime}
                  extendTime={extendTime}
                  togglePayment={togglePayment}
                  deleteCustomer={deleteCustomer}
                  user={user}
                  onLogout={handleLogout}
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customer"
            element={<CustomerView customers={customers} />}
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute isLoggedIn={!!user}>
                <HistoryView user={user} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute isLoggedIn={!!user}>
                <AnalyticsView user={user} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/daily-summary"
            element={
              <ProtectedRoute isLoggedIn={!!user}>
                <DailySummaryView user={user} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          
          {/* Blue Zone Routes (Pro-rated pricing) */}
          <Route
            path="/blue/*"
            element={<AppBlue user={user} onLogout={handleLogout} />}
          />
        </Routes>
      )}
    </BrowserRouter>
  )
}

export default App
