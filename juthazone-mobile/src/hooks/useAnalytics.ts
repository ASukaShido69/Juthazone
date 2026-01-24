import { useState, useEffect, useMemo } from 'react'
import { fetchHistory } from '../services/supabase'
import { HistoryRecord, Analytics } from '../types'

const useAnalytics = (filters?: {
  dateFrom?: string
  dateTo?: string
  room?: string
  paid?: boolean
}) => {
  const [history, setHistory] = useState<HistoryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchHistory(filters)
      setHistory(data || [])
    } catch (err: any) {
      console.error('Error fetching analytics:', err)
      setError(err.message || 'Unable to load analytics data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [JSON.stringify(filters)])

  const analytics: Analytics = useMemo(() => {
    if (history.length === 0) {
      return {
        totalRevenue: 0,
        totalCustomers: 0,
        averageDuration: 0,
        roomStats: [],
        hourlyStats: [],
        paymentMethodStats: [],
        peakHours: []
      }
    }

    const totalRevenue = history.reduce((sum, h) => sum + (h.cost || 0), 0)
    const totalCustomers = history.length
    const averageDuration = history.reduce((sum, h) => sum + (h.duration_minutes || 0), 0) / totalCustomers

    // Room stats
    const roomMap = new Map()
    history.forEach(h => {
      const room = h.room || 'Unknown'
      if (!roomMap.has(room)) {
        roomMap.set(room, { revenue: 0, customers: 0, totalDuration: 0 })
      }
      const stats = roomMap.get(room)
      stats.revenue += h.cost || 0
      stats.customers += 1
      stats.totalDuration += h.duration_minutes || 0
    })

    const roomStats = Array.from(roomMap.entries()).map(([room, stats]) => ({
      room,
      revenue: stats.revenue,
      customers: stats.customers,
      avgDuration: stats.totalDuration / stats.customers
    }))

    // Hourly stats
    const hourMap = new Map()
    history.forEach(h => {
      const hour = new Date(h.start_time).getHours()
      if (!hourMap.has(hour)) {
        hourMap.set(hour, { revenue: 0, customers: 0 })
      }
      const stats = hourMap.get(hour)
      stats.revenue += h.cost || 0
      stats.customers += 1
    })

    const hourlyStats = Array.from(hourMap.entries())
      .map(([hour, stats]) => ({ hour, ...stats }))
      .sort((a, b) => a.hour - b.hour)

    // Payment method stats
    const paymentMap = new Map()
    history.forEach(h => {
      const method = h.payment_method || 'cash'
      if (!paymentMap.has(method)) {
        paymentMap.set(method, { revenue: 0, count: 0 })
      }
      const stats = paymentMap.get(method)
      stats.revenue += h.cost || 0
      stats.count += 1
    })

    const paymentMethodStats = Array.from(paymentMap.entries()).map(([method, stats]) => ({
      method,
      revenue: stats.revenue,
      count: stats.count
    }))

    // Peak hours
    const peakHours = hourlyStats
      .sort((a, b) => b.customers - a.customers)
      .slice(0, 5)
      .map(h => ({ hour: h.hour, count: h.customers }))

    return {
      totalRevenue,
      totalCustomers,
      averageDuration,
      roomStats,
      hourlyStats,
      paymentMethodStats,
      peakHours
    }
  }, [history])

  return { analytics, history, loading, error, refetch: fetchData }
}

export default useAnalytics