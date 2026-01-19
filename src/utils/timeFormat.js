// Utility functions for time formatting
export const formatTimeWithPeriod = (timestamp, is12Hour = true) => {
  const date = new Date(timestamp)
  
  if (is12Hour) {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true
    })
  } else {
    return date.toLocaleTimeString('th-TH', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false
    })
  }
}

export const formatTimeThai = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('th-TH', { 
    hour: '2-digit', 
    minute: '2-digit'
  })
}

export const formatTimeDisplay = (timestamp) => {
  const date = new Date(timestamp)
  const hours = date.getHours()
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const period = hours >= 12 ? 'PM' : 'AM'
  const hours12 = hours % 12 || 12
  
  return `${hours12.toString().padStart(2, '0')}:${minutes} ${period}`
}

export const getDurationText = (seconds) => {
  if (seconds <= 0) return 'หมดเวลาแล้ว'
  
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  
  if (hours > 0) {
    return `${hours} ชม ${minutes} นาที`
  }
  if (minutes > 0) {
    return `${minutes} นาที ${secs} วิ`
  }
  return `${secs} วิ`
}

export const formatDateTimeThai = (timestamp) => {
  const date = new Date(timestamp)
  const dateStr = date.toLocaleDateString('th-TH', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric'
  })
  const timeStr = date.toLocaleTimeString('th-TH', { 
    hour: '2-digit', 
    minute: '2-digit'
  })
  return `${dateStr} ${timeStr}`
}

// CRITICAL: Calculate real-time remaining seconds based on server timestamps
// This ensures all devices show the same countdown even without constant sync
export const calculateTimeRemaining = (startTime, expectedEndTime) => {
  const now = Date.now()
  const endTimeMs = new Date(expectedEndTime).getTime()
  const remainingMs = endTimeMs - now
  
  // Return seconds (positive or 0 if expired)
  return Math.max(0, Math.ceil(remainingMs / 1000))
}
