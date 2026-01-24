import supabase from './supabase'

export const fetchAnalyticsData = async () => {
  try {
    const { data, error } = await supabase
      .from('customers_history')
      .select('*')
      .order('start_time', { ascending: false })
      .limit(1000)

    if (error) throw error
    return data || []
  } catch (err) {
    console.error('Error fetching analytics data:', err)
    throw new Error('Unable to fetch analytics data')
  }
}

export const processAnalyticsData = (history) => {
  if (!history.length) {
    return {
      dailyRevenue: [],
      roomStats: [],
      peakHours: [],
      totalRevenue: 0,
      totalCustomers: 0,
      totalHours: 0,
      avgPerCustomer: 0
    }
  }

  const dailyMap = {}
  const roomMap = {}
  const hourMap = {}
  let totalRevenue = 0
  let totalCustomers = 0
  let totalHours = 0

  history.forEach(record => {
    const startDate = new Date(record.start_time)
    const dateKey = startDate.toLocaleDateString('th-TH')
    const hour = startDate.getHours()
    const cost = parseFloat(record.final_cost) || 0
    const duration = parseFloat(record.duration_minutes) || 0

    dailyMap[dateKey] = (dailyMap[dateKey] || 0) + cost
    roomMap[record.room] = (roomMap[record.room] || 0) + 1
    hourMap[hour] = (hourMap[hour] || 0) + 1

    totalRevenue += cost
    totalCustomers += 1
    totalHours += duration / 60
  })

  const dailyRevenue = Object.entries(dailyMap)
    .sort((a, b) => new Date(a[0]) - new Date(b[0]))
    .slice(-30)
    .map(([date, revenue]) => ({
      date,
      revenue: parseFloat(revenue.toFixed(2))
    }))

  const roomStats = Object.entries(roomMap)
    .map(([room, count]) => {
      const roomRevenue = history
        .filter(r => r.room === room)
        .reduce((sum, r) => sum + (parseFloat(r.final_cost) || 0), 0)
      return {
        name: room,
        value: count,
        revenue: parseFloat(roomRevenue.toFixed(2))
      }
    })
    .sort((a, b) => b.value - a.value)

  const peakHours = Object.entries(hourMap)
    .map(([hour, count]) => ({
      hour: `${String(hour).padStart(2, '0')}:00`,
      customers: count
    }))
    .sort((a, b) => parseInt(b.hour) - parseInt(a.hour))

  return {
    dailyRevenue,
    roomStats,
    peakHours,
    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    totalCustomers,
    totalHours: parseFloat(totalHours.toFixed(1)),
    avgPerCustomer: parseFloat((totalRevenue / (totalCustomers || 1)).toFixed(0))
  }
}