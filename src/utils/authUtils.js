import supabase from '../firebase'

/**
 * Authenticate user with database
 */
export const authenticateUser = async (username, password) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, password, role, display_name, is_active')
      .eq('username', username)
      .single()

    if (error || !data) {
      await logLoginAttempt(username, false, 'User not found')
      return { success: false, error: 'ชื่อผู้ใช้ไม่ถูกต้อง' }
    }

    if (!data.is_active) {
      await logLoginAttempt(username, false, 'Account inactive')
      return { success: false, error: 'บัญชีนี้ถูกปิดใช้งาน' }
    }

    // Simple password check (in production, use bcrypt)
    if (data.password !== password) {
      await logLoginAttempt(username, false, 'Invalid password')
      return { success: false, error: 'รหัสผ่านไม่ถูกต้อง' }
    }

    // Login successful
    const userData = {
      id: data.id,
      username: data.username,
      displayName: data.display_name,
      role: data.role,
      loginTime: new Date().toISOString()
    }

    await logLoginAttempt(username, true, 'Login successful')
    await logActivity(username, 'LOGIN', `User ${username} logged in`)

    return { success: true, user: userData }
  } catch (error) {
    console.error('Authentication error:', error)
    return { success: false, error: 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์' }
  }
}

/**
 * Log login attempt to database
 */
export const logLoginAttempt = async (username, isSuccess, message = '') => {
  try {
    const userAgent = navigator.userAgent
    
    await supabase
      .from('login_logs')
      .insert({
        username,
        is_success: isSuccess,
        error_message: !isSuccess ? message : null,
        user_agent: userAgent
      })
  } catch (error) {
    console.error('Failed to log login attempt:', error)
  }
}

/**
 * Log logout
 */
export const logLogout = async (username) => {
  try {
    const userAgent = navigator.userAgent
    
    // Update the most recent login_log to add logout_time
    const { data: lastLog } = await supabase
      .from('login_logs')
      .select('id, login_time')
      .eq('username', username)
      .eq('is_success', true)
      .order('login_time', { ascending: false })
      .limit(1)
      .single()

    if (lastLog && lastLog.id) {
      const loginTime = new Date(lastLog.login_time)
      const logoutTime = new Date()
      const durationMinutes = Math.round((logoutTime - loginTime) / (1000 * 60))

      await supabase
        .from('login_logs')
        .update({
          logout_time: logoutTime.toISOString(),
          duration_minutes: durationMinutes
        })
        .eq('id', lastLog.id)
    }

    await logActivity(username, 'LOGOUT', `User ${username} logged out`)
  } catch (error) {
    console.error('Failed to log logout:', error)
  }
}

/**
 * Log user activity
 */
export const logActivity = async (username, actionType, description, dataChanged = null, customerId = null) => {
  try {
    const userAgent = navigator.userAgent
    
    await supabase
      .from('activity_logs')
      .insert({
        username,
        action_type: actionType,
        description,
        data_changed: dataChanged,
        customer_id: customerId,
        user_agent: userAgent
      })
  } catch (error) {
    console.error('Failed to log activity:', error)
  }
}

/**
 * Get login history for a user
 */
export const getLoginHistory = async (username) => {
  try {
    const { data, error } = await supabase
      .from('login_logs')
      .select('*')
      .eq('username', username)
      .order('login_time', { ascending: false })
      .limit(50)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Failed to fetch login history:', error)
    return []
  }
}

/**
 * Get activity history for a user
 */
export const getActivityHistory = async (username, limit = 100) => {
  try {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('username', username)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Failed to fetch activity history:', error)
    return []
  }
}

/**
 * Get all login statistics (admin only)
 */
export const getLoginStatistics = async () => {
  try {
    const { data, error } = await supabase
      .from('login_statistics')
      .select('*')

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Failed to fetch login statistics:', error)
    return []
  }
}
