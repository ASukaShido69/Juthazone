import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Text } from 'react-native'

// Screens
import AdminDashboard from '../screens/AdminDashboard'
import CustomerView from '../screens/CustomerView'
import Analytics from '../screens/Analytics'

const Tab = createBottomTabNavigator()

const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: '#9333ea',
          tabBarInactiveTintColor: '#9ca3af',
          tabBarStyle: {
            backgroundColor: '#ffffff',
            borderTopWidth: 1,
            borderTopColor: '#e5e7eb',
            height: 60,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
          },
          headerShown: false,
        }}
      >
        <Tab.Screen 
          name="Admin" 
          component={AdminDashboard}
          options={{
            tabBarLabel: 'จัดการ',
            tabBarIcon: ({ color, size }) => (
              <Text style={{ fontSize: size, color }}>👨‍💼</Text>
            ),
          }}
        />
        
        <Tab.Screen 
          name="Customer" 
          component={CustomerView}
          options={{
            tabBarLabel: 'ลูกค้า',
            tabBarIcon: ({ color, size }) => (
              <Text style={{ fontSize: size, color }}>🏠</Text>
            ),
          }}
        />
        
        <Tab.Screen 
          name="Analytics" 
          component={Analytics}
          options={{
            tabBarLabel: 'สถิติ',
            tabBarIcon: ({ color, size }) => (
              <Text style={{ fontSize: size, color }}>📊</Text>
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  )
}

export default AppNavigator