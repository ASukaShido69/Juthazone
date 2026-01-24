import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Customer } from '../types'
import Timer from './Timer'

interface CustomerCardProps {
  customer: Customer
  onPress?: () => void
  showTimer?: boolean
  showActions?: boolean
  onEndSession?: (id: number) => void
  onEdit?: (customer: Customer) => void
}

const CustomerCard: React.FC<CustomerCardProps> = ({ 
  customer, 
  onPress,
  showTimer = true,
  showActions = false,
  onEndSession,
  onEdit
}) => {
  const getBadgeColor = () => {
    if (!customer.is_active) return '#9ca3af'
    if (customer.is_paid) return '#22c55e'
    return '#f59e0b'
  }

  return (
    <TouchableOpacity 
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.name}>{customer.name}</Text>
          <Text style={styles.room}>🏠 {customer.room}</Text>
          {customer.phone && (
            <Text style={styles.phone}>📱 {customer.phone}</Text>
          )}
        </View>
        
        <View style={[styles.badge, { backgroundColor: getBadgeColor() }]}>
          <Text style={styles.badgeText}>
            {customer.is_paid ? '💰 จ่ายแล้ว' : '⏳ รอชำระ'}
          </Text>
        </View>
      </View>

      {showTimer && customer.is_active && customer.expected_end_time && (
        <View style={styles.timerContainer}>
          <Timer customer={customer} />
        </View>
      )}

      <View style={styles.info}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>⏱️ ระยะเวลา:</Text>
          <Text style={styles.infoValue}>{customer.duration_minutes} นาที</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>💵 ค่าบริการ:</Text>
          <Text style={styles.infoValue}>฿{customer.cost}</Text>
        </View>

        {customer.staff_name && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>👤 พนักงาน:</Text>
            <Text style={styles.infoValue}>{customer.staff_name}</Text>
          </View>
        )}
      </View>

      {showActions && (
        <View style={styles.actions}>
          {onEdit && (
            <TouchableOpacity 
              style={[styles.button, styles.editButton]}
              onPress={() => onEdit(customer)}
            >
              <Text style={styles.buttonText}>✏️ แก้ไข</Text>
            </TouchableOpacity>
          )}
          
          {onEndSession && customer.is_active && (
            <TouchableOpacity 
              style={[styles.button, styles.endButton]}
              onPress={() => onEndSession(customer.id)}
            >
              <Text style={styles.buttonText}>🏁 จบเซสชัน</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  room: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 2,
  },
  phone: {
    fontSize: 14,
    color: '#9ca3af',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  timerContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  info: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#3b82f6',
  },
  endButton: {
    backgroundColor: '#10b981',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
})

export default CustomerCard