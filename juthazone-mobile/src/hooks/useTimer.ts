import { useState, useEffect, useCallback } from 'react'
import { Customer } from '../types'

interface TimerData {
  timeLeft: number
  minutesLeft: number
  hoursLeft: number
  isExpired: boolean
  progress: number
}

const useTimer = (customer: Customer | null): TimerData => {
  const [timeLeft, setTimeLeft] = useState(0)

  const calculateTimeLeft = useCallback(() => {
    if (!customer || !customer.expected_end_time) {
      return 0
    }

    const now = Date.now()
    const endTime = new Date(customer.expected_end_time).getTime()
    const remaining = Math.max(0, endTime - now)
    
    return Math.floor(remaining / 1000) // seconds
  }, [customer])

  useEffect(() => {
    if (!customer) {
      setTimeLeft(0)
      return
    }

    // Initial calculation
    setTimeLeft(calculateTimeLeft())

    // Update every second
    const interval = setInterval(() => {
      const remaining = calculateTimeLeft()
      setTimeLeft(remaining)

      if (remaining === 0) {
        clearInterval(interval)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [customer, calculateTimeLeft])

  const minutesLeft = Math.floor(timeLeft / 60)
  const hoursLeft = Math.floor(minutesLeft / 60)
  const isExpired = timeLeft === 0
  
  const totalDuration = customer?.duration_minutes || 1
  const elapsedMinutes = totalDuration - minutesLeft
  const progress = Math.min(100, (elapsedMinutes / totalDuration) * 100)

  return {
    timeLeft,
    minutesLeft,
    hoursLeft,
    isExpired,
    progress
  }
}

export default useTimer