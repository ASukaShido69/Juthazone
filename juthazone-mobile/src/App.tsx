import React, { useEffect, useRef } from 'react'
import { StatusBar } from 'expo-status-bar'
import * as Notifications from 'expo-notifications'
import AppNavigator from './navigation/AppNavigator'
import { registerForPushNotificationsAsync } from './services/notifications'

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

const App = () => {
  const notificationListener = useRef<any>()
  const responseListener = useRef<any>()

  useEffect(() => {
    // Register for push notifications
    registerForPushNotificationsAsync()

    // Listen for incoming notifications
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('🔔 Notification received:', notification)
    })

    // Listen for notification responses (user taps notification)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('👆 Notification tapped:', response)
    })

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current)
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current)
      }
    }
  }, [])

  return (
    <>
      <StatusBar style="auto" />
      <AppNavigator />
    </>
  )
}

export default App