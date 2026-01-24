import React, { useEffect, useState } from 'react'
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  RefreshControl,
  ActivityIndicator 
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import CustomerCard from '../components/CustomerCard'
import useCustomers from '../hooks/useCustomers'
import { checkTimersAndNotify } from '../services/notifications'

const CustomerView = () => {
  const { customers, loading, error, fetchCustomers } = useCustomers()
  const [refreshing, setRefreshing] = useState(false)

  // Check timers and send notifications
  useEffect(() => {
    const interval = setInterval(() => {
      if (customers.length > 0) {
        checkTimersAndNotify(customers)
      }
    }, 30000) // Check every 30 seconds

    return () => clearInterval(interval)
  }, [customers])

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchCustomers()
    setRefreshing(false)
  }

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#9333ea" />
        <Text style={styles.loadingText}>กำลังโหลด...</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    )
  }

  const activeCustomers = customers.filter(c => c.is_active)

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🏠 ลูกค้าปัจจุบัน</Text>
        <Text style={styles.subtitle}>
          {activeCustomers.length} ท่าน
        </Text>
      </View>

      {activeCustomers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>😴</Text>
          <Text style={styles.emptyText}>ยังไม่มีลูกค้าใช้บริการ</Text>
          <Text style={styles.emptySubtext}>รอรับลูกค้าท่านถัดไป</Text>
        </View>
      ) : (
        <FlatList
          data={activeCustomers}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <CustomerCard 
              customer={item}
              showTimer={true}
              showActions={false}
            />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#9333ea']}
            />
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  header: {
    backgroundColor: '#9333ea',
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#e9d5ff',
  },
  list: {
    padding: 16,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 18,
    color: '#ef4444',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 80,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#9ca3af',
  },
})

export default CustomerView