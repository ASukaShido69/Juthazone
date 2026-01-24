import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Customer } from '../types'
import useTimer from '../hooks/useTimer'

interface TimerProps {
  customer: Customer
  compact?: boolean
}

const Timer: React.FC<TimerProps> = ({ customer, compact = false }) => {
  const { timeLeft, minutesLeft, hoursLeft, isExpired, progress } = useTimer(customer)

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (compact) {
      return hrs > 0 ? `${hrs}:${mins.toString().padStart(2, '0')}h` : `${mins}:${secs.toString().padStart(2, '0')}`
    }
    
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getColor = () => {
    if (isExpired) return '#ef4444'
    if (minutesLeft <= 5) return '#f97316'
    if (minutesLeft <= 15) return '#eab308'
    return '#22c55e'
  }

  return (
    <View style={[styles.container, compact && styles.compactContainer]}>
      <Text style={[
        styles.time, 
        compact && styles.compactTime,
        { color: getColor() }
      ]}>
        {isExpired ? 'หมดเวลา!' : formatTime(timeLeft)}
      </Text>
      
      {!compact && (
        <>
          <View style={styles.progressBarContainer}>
            <View 
              style={[
                styles.progressBar, 
                { 
                  width: `${progress}%`,
                  backgroundColor: getColor()
                }
              ]} 
            />
          </View>
          
          <Text style={[styles.subtitle, { color: getColor() }]}>
            {isExpired ? 
              'กรุณาตรวจสอบ' : 
              `เหลือ ${minutesLeft} นาที (${Math.floor(progress)}%)`
            }
          </Text>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  compactContainer: {
    padding: 4,
  },
  time: {
    fontSize: 32,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  compactTime: {
    fontSize: 20,
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '600',
  },
})

export default Timer