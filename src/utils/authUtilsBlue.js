import supabase from '../firebase'

// Log activity to Blue Zone activity logs
export const logActivityBlue = async (username, actionType, description, dataChanged = null, customerId = null) => {
  if (!supabase) return { success: false, error: 'Supabase not initialized' }

  try {
    const { error } = await supabase
      .from('juthazoneb_activity_logs')
      .insert([{
        username,
        action_type: actionType,
        description,
        data_changed: dataChanged,
        customer_id: customerId,
        created_at: new Date().toISOString()
      }])

    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error('Error logging activity (Blue):', error)
    return { success: false, error: error.message }
  }
}

// Log logout for Blue Zone
export const logLogoutBlue = async (username) => {
  return await logActivityBlue(username, 'LOGOUT', `User ${username} logged out from Blue Zone`)
}

// Authenticate user (shared with Red Zone)
export const authenticateUser = async (username, password) => {
  if (!supabase) {
    return { success: false, error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' }
  }

  try {
    // Query user from database
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .eq('is_active', true)
      .single()

    if (error || !data) {
      return { success: false, error: 'ไม่พบผู้ใช้งาน หรือบัญชีถูกระงับ' }
    }

    // Check password (plain text comparison - in production use bcrypt!)
    if (data.password !== password) {
      return { success: false, error: 'รหัสผ่านไม่ถูกต้อง' }
    }

    // Return user data
    return {
      success: true,
      user: {
        id: data.id,
        username: data.username,
        role: data.role,
        display_name: data.display_name
      }
    }
  } catch (error) {
    console.error('Authentication error:', error)
    return { success: false, error: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' }
  }
}

// Calculate cost based on elapsed time and hourly rate (Blue Zone specific)
export const calculateCostBlue = (startTime, hourlyRate, totalPauseDuration = 0, pauseTime = null, isRunning = true) => {
  const now = isRunning ? new Date() : (pauseTime ? new Date(pauseTime) : new Date())
  const start = new Date(startTime)
  const elapsedMs = now - start - (totalPauseDuration * 1000) // Subtract accumulated pause duration
  const elapsedHours = elapsedMs / (1000 * 60 * 60) // Convert to hours
  
  const cost = Math.max(0, elapsedHours * hourlyRate)
  return parseFloat(cost.toFixed(2))
}

// Format elapsed time for display
export const formatElapsedTime = (startTime, totalPauseDuration = 0, pauseTime = null, isRunning = true) => {
  const now = isRunning ? new Date() : (pauseTime ? new Date(pauseTime) : new Date())
  const start = new Date(startTime)
  const elapsedMs = now - start - (totalPauseDuration * 1000)
  const elapsedSeconds = Math.floor(elapsedMs / 1000)
  
  const hours = Math.floor(elapsedSeconds / 3600)
  const minutes = Math.floor((elapsedSeconds % 3600) / 60)
  const seconds = elapsedSeconds % 60
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// Get duration in minutes
export const getDurationMinutes = (startTime, endTime = null, totalPauseDuration = 0) => {
  const end = endTime ? new Date(endTime) : new Date()
  const start = new Date(startTime)
  const elapsedMs = end - start - (totalPauseDuration * 1000)
  const minutes = elapsedMs / (1000 * 60)
  
  return parseFloat(Math.max(0, minutes).toFixed(2))
}
