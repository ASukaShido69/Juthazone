import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import QRCode from 'react-native-qrcode-svg'

interface QRCodeDisplayProps {
  value: string
  size?: number
  title?: string
}

const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({ 
  value, 
  size = 200,
  title = 'Scan QR Code'
}) => {
  return (
    <View style={styles.container}>
      {title && (
        <Text style={styles.title}>{title}</Text>
      )}
      <View style={styles.qrContainer}>
        <QRCode
          value={value}
          size={size}
          color="#000000"
          backgroundColor="#ffffff"
          logo={require('../../assets/icon.png')}
          logoSize={size * 0.2}
          logoBackgroundColor="#ffffff"
          logoMargin={2}
          logoBorderRadius={10}
        />
      </View>
      <Text style={styles.subtitle}>สแกนเพื่อเข้าสู่ระบบลูกค้า</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  qrContainer: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  subtitle: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
})

export default QRCodeDisplay