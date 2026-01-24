import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { Customer } from '../types'

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

export const registerForPushNotificationsAsync = async () => {
  let token

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#9333ea',
    })
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }
    
    if (finalStatus !== 'granted') {
      alert('Failed to get push notification token!')
      return
    }
    
    token = (await Notifications.getExpoPushTokenAsync()).data
    console.log('Expo Push Token:', token)
  } else {
    alert('Must use physical device for Push Notifications')
  }

  return token
}

export const scheduleTimerNotification = async (
  customer: Customer,
  minutesLeft: number
) => {
  const urgencyLevel = minutesLeft <= 5 ? 'high' : minutesLeft <= 10 ? 'medium' : 'low'
  const emoji = minutesLeft <= 5 ? '🚨' : minutesLeft <= 10 ? '⏰' : '⏳'
  
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${emoji} แจ้งเตือนเวลาใกล้หมด!`,
      body: `${customer.name} (${customer.room}) เหลือเวลาอีก ${minutesLeft} นาที`,
      data: { 
        customerId: customer.id,
        customerName: customer.name,
        room: customer.room,
        minutesLeft,
        urgencyLevel
      },
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.HIGH,
      vibrate: [0, 250, 250, 250],
      badge: 1,
    },
    trigger: null, // Show immediately
  })
}

export const scheduleExpiredNotification = async (customer: Customer) => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🔴 เวลาหมดแล้ว!',
      body: `${customer.name} (${customer.room}) หมดเวลาแล้ว กรุณาตรวจสอบ`,
      data: { 
        customerId: customer.id,
        customerName: customer.name,
        room: customer.room,
        expired: true
      },
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.MAX,
      vibrate: [0, 500, 200, 500],
      badge: 1,
    },
    trigger: null,
  })
}

export const cancelAllNotifications = async () => {
  await Notifications.cancelAllScheduledNotificationsAsync()
}

export const checkTimersAndNotify = async (customers: Customer[]) => {
  const now = Date.now()
  const notifiedIds = new Set<string>()

  for (const customer of customers) {
    if (!customer.expected_end_time || !customer.is_active) continue

    const endTime = new Date(customer.expected_end_time).getTime()
    const timeLeft = endTime - now
    const minutesLeft = Math.floor(timeLeft / 60000)

    const notifyKey = `${customer.id}-${minutesLeft}`
    
    // Notify at 15, 10, 5, 1 minutes
    if ([15, 10, 5, 1].includes(minutesLeft) && !notifiedIds.has(notifyKey)) {
      await scheduleTimerNotification(customer, minutesLeft)
      notifiedIds.add(notifyKey)
    }

    // Notify when expired
    if (minutesLeft <= 0 && !notifiedIds.has(`${customer.id}-expired`)) {
      await scheduleExpiredNotification(customer)
      notifiedIds.add(`${customer.id}-expired`)
    }
  }
}
