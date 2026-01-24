// TypeScript Types for Juthazone Mobile App

export interface Customer {
  id: number
  name: string
  room: string
  phone?: string
  start_time: string
  expected_end_time?: string
  actual_end_time?: string
  duration_minutes: number
  cost: number
  is_paid: boolean
  is_active: boolean
  payment_method?: 'cash' | 'transfer' | 'credit'
  staff_name?: string
  created_at: string
  updated_at: string
}

export interface HistoryRecord extends Customer {
  original_cost?: number
  shift?: 'morning' | 'afternoon' | 'evening'
}

export interface Analytics {
  totalRevenue: number
  totalCustomers: number
  averageDuration: number
  roomStats: RoomStats[]
  hourlyStats: HourlyStats[]
  paymentMethodStats: PaymentMethodStats[]
  peakHours: { hour: number; count: number }[]
}

export interface RoomStats {
  room: string
  revenue: number
  customers: number
  avgDuration: number
}

export interface HourlyStats {
  hour: number
  revenue: number
  customers: number
}

export interface PaymentMethodStats {
  method: string
  revenue: number
  count: number
}

export interface NotificationData {
  id: string
  customerId: number
  customerName: string
  room: string
  minutesLeft: number
  type: 'warning' | 'alert' | 'info'
  timestamp: string
}

export interface User {
  id: string
  email: string
  role: 'admin' | 'staff'
  display_name?: string
}

export interface Timer {
  isRunning: boolean
  elapsedTime: number
  startTime: Date | null
}

export interface AnalyticsData extends Analytics {}
