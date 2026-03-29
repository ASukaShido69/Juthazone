// Gracefully handle missing dependencies with dynamic imports
let XLSX = null
let jsPDF = null
let html2canvas = null
let importsInitialized = false

// Initialize imports asynchronously
const initializeImports = async () => {
  if (importsInitialized) return
  
  try {
    XLSX = (await import('xlsx')).default || (await import('xlsx'))
  } catch (e) {
    console.warn('xlsx not available:', e.message)
  }

  try {
    const jsPDFModule = await import('jspdf')
    jsPDF = jsPDFModule.jsPDF || jsPDFModule.default
  } catch (e) {
    console.warn('jspdf not available:', e.message)
  }

  try {
    const html2canvasModule = await import('html2canvas')
    html2canvas = html2canvasModule.default || html2canvasModule
  } catch (e) {
    console.warn('html2canvas not available:', e.message)
  }

  importsInitialized = true
}

// Initialize on module load
initializeImports().catch(err => console.warn('Failed to initialize imports:', err))

// Format datetime helper
const formatDateTime = (timestamp) => {
  if (!timestamp) return '-'
  const date = new Date(timestamp)
  return date.toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// Format date only
const formatDate = (timestamp) => {
  if (!timestamp) return '-'
  const date = new Date(timestamp)
  return date.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

// Format time only
const formatTime = (timestamp) => {
  if (!timestamp) return '-'
  const date = new Date(timestamp)
  return date.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Format duration
const formatDuration = (minutes) => {
  if (!minutes) return '-'
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  if (hours > 0) {
    return `${hours} ชม. ${mins} นาที`
  }
  return `${mins} นาที`
}

// Format currency
const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return '-'
  return `฿${parseFloat(amount).toFixed(2)}`
}

// Get end reason text
const getEndReasonText = (reason) => {
  const reasonMap = {
    'completed': '✅ เสร็จแล้ว',
    'expired': '⏰ หมดเวลา',
    'deleted': '🗑️ ลบแล้ว',
    'in_progress': '⏳ ดำเนินการ'
  }
  return reasonMap[reason] || reason
}

// Get room statistics
const getRoomStats = (data) => {
  const stats = {}
  data.forEach(item => {
    if (!stats[item.room]) {
      stats[item.room] = { count: 0, revenue: 0 }
    }
    stats[item.room].count += 1
    stats[item.room].revenue += parseFloat(item.final_cost)
  })
  return stats
}

/**
 * Export History to Excel - Enhanced Version
 */
export const exportToExcel = async (data, fileName = 'juthazone-report', options = {}) => {
  // Ensure imports are loaded
  await initializeImports()

  if (!XLSX) {
    alert('❌ Excel export not available. Please try again later.')
    return
  }

  if (!data || data.length === 0) {
    alert('⚠️ ไม่มีข้อมูลให้ส่งออก')
    return
  }

  try {
    const now = new Date()
    const timestamp = now.toISOString().slice(0, 10)
    const { zone = 'red', includeCharts = false } = options

    // Enhanced data preparation
    const excelData = data.map((item, index) => ({
      'ลำดับที่': index + 1,
      'รหัสลูกค้า': item.id || `CUST-${String(index + 1).padStart(6, '0')}`,
      'ชื่อลูกค้า': item.name || '-',
      'ห้อง/โซน': item.room || '-',
      'วันที่เริ่ม': formatDate(item.start_time),
      'เวลาเริ่ม': formatTime(item.start_time),
      'วันที่สิ้นสุด': formatDate(item.end_time),
      'เวลาสิ้นสุด': formatTime(item.end_time),
      'ระยะเวลา (นาที)': item.duration_minutes || 0,
      'ระยะเวลา (ชม.และนาที)': formatDuration(item.duration_minutes),
      'อัตราต่อชั่วโมง': item.hourly_rate || '-',
      'ค่าใช้จ่าย': parseFloat(item.final_cost || 0).toFixed(2),
      'สถานะการจ่าย': item.is_paid ? '✅ จ่ายแล้ว' : '❌ ยังไม่จ่าย',
      'วิธีการจ่าย': item.payment_method === 'cash' ? '💵 เงินสด' : '🏦 โอนเงิน',
      'กะทำงาน': item.shift ? `กะ ${item.shift}` : 'ไม่ระบุ',
      'พนักงาน': item.added_by || '-',
      'สถานะการใช้งาน': getEndReasonText(item.end_reason),
      'หมายเหตุ': item.note || '-',
      'วันที่สร้าง': formatDateTime(item.created_at),
      'วันที่อัพเดท': formatDateTime(item.updated_at)
    }))

    // Create main data sheet with enhanced formatting
    const ws = XLSX.utils.json_to_sheet(excelData)
    
    // Set column widths for better readability
    ws['!cols'] = [
      { wch: 8 },   // ลำดับที่
      { wch: 15 },  // รหัสลูกค้า
      { wch: 20 },  // ชื่อลูกค้า
      { wch: 15 },  // ห้อง/โซน
      { wch: 12 },  // วันที่เริ่ม
      { wch: 10 },  // เวลาเริ่ม
      { wch: 12 },  // วันที่สิ้นสุด
      { wch: 10 },  // เวลาสิ้นสุด
      { wch: 15 },  // ระยะเวลา (นาที)
      { wch: 20 },  // ระยะเวลา (ชม.และนาที)
      { wch: 12 },  // อัตราต่อชั่วโมง
      { wch: 12 },  // ค่าใช้จ่าย
      { wch: 15 },  // สถานะการจ่าย
      { wch: 12 },  // วิธีการจ่าย
      { wch: 10 },  // กะทำงาน
      { wch: 12 },  // พนักงาน
      { wch: 15 },  // สถานะการใช้งาน
      { wch: 25 },  // หมายเหตุ
      { wch: 18 },  // วันที่สร้าง
      { wch: 18 }   // วันที่อัพเดท
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'รายงานฉบับละเอียด')

    // Enhanced summary sheet
    const totalRevenue = data.reduce((sum, item) => sum + parseFloat(item.final_cost || 0), 0)
    const paidCount = data.filter(item => item.is_paid).length
    const unpaidCount = data.length - paidCount
    const totalHours = data.reduce((sum, item) => sum + parseFloat(item.duration_minutes || 0), 0) / 60
    const avgRevenuePerCustomer = data.length > 0 ? totalRevenue / data.length : 0
    const avgTimePerCustomer = data.length > 0 ? totalHours / data.length : 0
    
    const summaryData = [
      ['📊 สรุปรายงาน JUTHAZONE'],
      [''],
      ['📅 ข้อมูลรายงาน'],
      ['วันที่สร้างรายงาน', formatDate(now)],
      ['เวลาสร้างรายงาน', formatTime(now)],
      ['โซนที่ส่งออก', zone === 'blue' ? '🔵 BLUE ZONE' : '🔴 RED ZONE'],
      ['จำนวนรายการทั้งหมด', data.length],
      [''],
      ['💰 สรุปรายได้'],
      ['รายได้รวมทั้งหมด', formatCurrency(totalRevenue)],
      ['รายได้เฉลี่ยต่อลูกค้า', formatCurrency(avgRevenuePerCustomer)],
      ['จำนวนที่จ่ายแล้ว', `${paidCount} รายการ (${((paidCount/data.length)*100).toFixed(1)}%)`],
      ['จำนวนที่ยังไม่จ่าย', `${unpaidCount} รายการ (${((unpaidCount/data.length)*100).toFixed(1)}%)`],
      [''],
      ['⏱️ สรุปเวลาใช้งาน'],
      ['เวลารวมทั้งหมด', `${totalHours.toFixed(1)} ชั่วโมง`],
      ['เวลาเฉลี่ยต่อลูกค้า', `${avgTimePerCustomer.toFixed(1)} ชั่วโมง`],
      [''],
      ['📊 สถิติตามห้อง/โซน']
    ]

    // Enhanced room statistics
    const roomStats = getRoomStats(data)
    const sortedRoomStats = Object.entries(roomStats)
      .sort(([,a], [,b]) => b.revenue - a.revenue) // Sort by revenue descending
    
    sortedRoomStats.forEach(([room, stats]) => {
      summaryData.push([
        room,
        `${stats.count} รายการ`,
        formatCurrency(stats.revenue),
        `${((stats.revenue/totalRevenue)*100).toFixed(1)}%`
      ])
    })

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
    wsSummary['!cols'] = [
      { wch: 25 }, // หมวดหมู่
      { wch: 20 }, // ค่า
      { wch: 15 }, // จำนวน
      { wch: 10 }  // %
    ]
    XLSX.utils.book_append_sheet(wb, wsSummary, 'สรุปรายงาน')

    // Payment method analysis sheet
    const paymentStats = {}
    data.forEach(item => {
      const method = item.payment_method === 'cash' ? 'เงินสด' : 'โอนเงิน'
      if (!paymentStats[method]) {
        paymentStats[method] = { count: 0, revenue: 0 }
      }
      paymentStats[method].count += 1
      paymentStats[method].revenue += parseFloat(item.final_cost || 0)
    })

    const paymentData = [
      ['💳 วิเคราะห์วิธีการจ่าย'],
      [''],
      ['วิธีการจ่าย', 'จำนวนรายการ', 'รายได้', 'เปอร์เซ็นต์']
    ]

    Object.entries(paymentStats).forEach(([method, stats]) => {
      paymentData.push([
        method,
        stats.count,
        formatCurrency(stats.revenue),
        `${((stats.revenue/totalRevenue)*100).toFixed(1)}%`
      ])
    })

    const wsPayment = XLSX.utils.aoa_to_sheet(paymentData)
    wsPayment['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 }]
    XLSX.utils.book_append_sheet(wb, wsPayment, 'วิเคราะห์การจ่าย')

    // Download with enhanced filename
    const zonePrefix = zone === 'blue' ? 'Blue' : 'Red'
    const enhancedFileName = `${zonePrefix}_Report_${timestamp}_${data.length}items.xlsx`
    XLSX.writeFile(wb, enhancedFileName)
    
    alert(`✅ ส่งออก Excel สำเร็จ\n📊 จำนวน ${data.length} รายการ\n💰 รายได้รวม ${formatCurrency(totalRevenue)}`)
  } catch (error) {
    console.error('Excel export error:', error)
    alert('❌ เกิดข้อผิดพลาดในการส่งออก Excel: ' + error.message)
  }
}

/**
 * Export to PDF - Enhanced Professional Version
 */
export const exportToPDF = async (data, userName = 'Admin', options = {}) => {
  // Ensure imports are loaded
  await initializeImports()

  if (!jsPDF) {
    alert('❌ PDF export not available. Please try again later.')
    return
  }

  if (!data || data.length === 0) {
    alert('⚠️ ไม่มีข้อมูลให้ส่งออก')
    return
  }

  try {
    const doc = new jsPDF('p', 'mm', 'a4')
    const now = new Date()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const { zone = 'red', includeCharts = false } = options
    
    // Calculate statistics
    const totalRevenue = data.reduce((sum, item) => sum + parseFloat(item.final_cost || 0), 0)
    const paidCount = data.filter(item => item.is_paid).length
    const unpaidCount = data.length - paidCount
    const totalHours = data.reduce((sum, item) => sum + parseFloat(item.duration_minutes || 0), 0) / 60
    const avgRevenuePerCustomer = data.length > 0 ? totalRevenue / data.length : 0
    
    // Colors based on zone
    const primaryColor = zone === 'blue' ? [37, 99, 235] : [220, 38, 38]  // blue-600 or red-600
    const secondaryColor = zone === 'blue' ? [59, 130, 246] : [239, 68, 68]  // blue-500 or red-500
    
    let yPos = 15

    // Enhanced Header with gradient effect
    doc.setFillColor(...primaryColor)
    doc.rect(0, 0, pageWidth, 45, 'F')
    
    // Add subtle pattern
    doc.setFillColor(255, 255, 255, 0.1)
    for (let i = 0; i < pageWidth; i += 10) {
      doc.rect(i, 0, 5, 45, 'F')
    }
    
    // Logo and title
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(32)
    doc.setTextColor(255, 255, 255)
    doc.text('JUTHAZONE', pageWidth / 2, 25, { align: 'center' })
  
    doc.setFontSize(16)
    doc.text('รายงานการใช้งานประจำวัน', pageWidth / 2, 38, { align: 'center' })

    // Zone indicator
    doc.setFillColor(255, 255, 255)
    doc.setRoundedRect(pageWidth - 35, 5, 30, 12, 3)
    doc.setFontSize(10)
    doc.setTextColor(...primaryColor)
    doc.text(zone === 'blue' ? 'BLUE' : 'RED', pageWidth - 20, 12, { align: 'center' })

    // Reset color
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)

    yPos = 55

    // Report information box
    doc.setFillColor(240, 240, 240)
    doc.setRoundedRect(15, yPos - 5, pageWidth - 30, 25, 3)
    doc.setFont('helvetica', 'bold')
    doc.text(`วันที่รายงาน: ${formatDate(now)}`, 25, yPos + 3)
    doc.text(`ผู้จัดทำ: ${userName}`, 25, yPos + 10)
    doc.text(`เวลา: ${formatTime(now)}`, 25, yPos + 17)
    doc.text(`โซน: ${zone === 'blue' ? '🔵 BLUE ZONE' : '🔴 RED ZONE'}`, pageWidth - 60, yPos + 10)
    
    yPos += 35

    // Enhanced Summary Cards
    const summaryCards = [
      { label: 'รายได้รวม', value: formatCurrency(totalRevenue), icon: '💰', color: [34, 197, 94] },
      { label: 'จำนวนลูกค้า', value: `${data.length} คน`, icon: '👥', color: [59, 130, 246] },
      { label: 'เวลารวม', value: `${totalHours.toFixed(1)} ชม.`, icon: '⏱️', color: [251, 146, 60] },
      { label: 'จ่ายแล้ว', value: `${paidCount}/${data.length} คน`, icon: '✅', color: [34, 197, 94] }
    ]

    const cardWidth = (pageWidth - 40) / 2
    const cardHeight = 25
    
    summaryCards.forEach((card, index) => {
      const x = 20 + (index % 2) * (cardWidth + 10)
      const y = yPos + Math.floor(index / 2) * (cardHeight + 10)
      
      // Card background
      doc.setFillColor(...card.color, 0.1)
      doc.setRoundedRect(x, y, cardWidth, cardHeight, 3)
      
      // Card border
      doc.setDrawColor(...card.color)
      doc.setLineWidth(0.5)
      doc.setRoundedRect(x, y, cardWidth, cardHeight, 3)
      
      // Card content
      doc.setFillColor(...card.color)
      doc.circle(x + 10, y + 12, 4, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(12)
      doc.text(card.icon, x + 10, y + 16, { align: 'center' })
      
      doc.setTextColor(...card.color)
      doc.setFont('helvetica', 'bold')
      doc.text(card.label, x + 20, y + 10)
      doc.setFontSize(14)
      doc.text(card.value, x + 20, y + 18)
    })

    yPos += 65

    // Detailed Table with enhanced styling
    doc.setFillColor(...primaryColor)
    doc.rect(15, yPos - 5, pageWidth - 30, 10, 'F')
    
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('ลำดับ', 20, yPos)
    doc.text('ชื่อลูกค้า', 35, yPos)
    doc.text('ห้อง', 80, yPos)
    doc.text('ระยะเวลา', 110, yPos)
    doc.text('ค่าใช้จ่าย', 140, yPos)
    doc.text('สถานะ', 170, yPos)

    yPos += 10
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)

    // Table data with alternating row colors
    data.forEach((item, index) => {
      if (yPos > pageHeight - 30) {
        doc.addPage()
        yPos = 20
        
        // Repeat header on new page
        doc.setFillColor(...primaryColor)
        doc.rect(15, yPos - 5, pageWidth - 30, 10, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        doc.text('ลำดับ', 20, yPos)
        doc.text('ชื่อลูกค้า', 35, yPos)
        doc.text('ห้อง', 80, yPos)
        doc.text('ระยะเวลา', 110, yPos)
        doc.text('ค่าใช้จ่าย', 140, yPos)
        doc.text('สถานะ', 170, yPos)
        
        yPos += 10
        doc.setTextColor(0, 0, 0)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
      }
      
      // Alternating row background
      if (index % 2 === 0) {
        doc.setFillColor(245, 245, 245)
        doc.rect(15, yPos - 3, pageWidth - 30, 8, 'F')
      }
      
      // Status color coding
      const statusColor = item.is_paid ? [34, 197, 94] : [239, 68, 68]
      
      doc.text((index + 1).toString(), 20, yPos + 3)
      doc.text((item.name || '-').substring(0, 15), 35, yPos + 3)
      doc.text((item.room || '-').substring(0, 12), 80, yPos + 3)
      doc.text(`${item.duration_minutes || 0} นาที`, 110, yPos + 3)
      doc.text(formatCurrency(item.final_cost || 0), 140, yPos + 3)
      
      // Status with color
      doc.setFillColor(...statusColor, 0.1)
      doc.setRoundedRect(170, yPos - 2, 30, 6, 2)
      doc.setDrawColor(...statusColor)
      doc.setRoundedRect(170, yPos - 2, 30, 6, 2)
      doc.setTextColor(...statusColor)
      doc.text(item.is_paid ? 'จ่ายแล้ว' : 'ยังไม่จ่าย', 185, yPos + 3, { align: 'center' })
      doc.setTextColor(0, 0, 0)
      
      yPos += 8
    })

    // Footer with enhanced design
    yPos = pageHeight - 25
    
    // Footer background
    doc.setFillColor(...primaryColor, 0.05)
    doc.rect(0, yPos, pageWidth, 25, 'F')
    
    // Footer line
    doc.setDrawColor(...primaryColor)
    doc.setLineWidth(0.5)
    doc.line(15, yPos, pageWidth - 15, yPos)
    
    doc.setFontSize(9)
    doc.setTextColor(100, 100, 100)
    doc.text('จัดทำโดยระบบ JUTHAZONE', pageWidth / 2, yPos + 8, { align: 'center' })
    doc.text(`${formatDate(now)} ${formatTime(now)}`, pageWidth / 2, yPos + 15, { align: 'center' })
    doc.text('หน้า ' + doc.internal.getNumberOfPages(), pageWidth / 2, yPos + 22, { align: 'center' })

    // Save with enhanced filename
    const timestamp = now.toISOString().slice(0, 10)
    const zonePrefix = zone === 'blue' ? 'Blue' : 'Red'
    const fileName = `${zonePrefix}_Report_${timestamp}.pdf`
    doc.save(fileName)
    
    alert(`✅ ส่งออก PDF สำเร็จ\n📊 จำนวน ${data.length} รายการ\n💰 รายได้รวม ${formatCurrency(totalRevenue)}`)
  } catch (error) {
    console.error('PDF export error:', error)
    alert('❌ เกิดข้อผิดพลาดในการส่งออก PDF: ' + error.message)
  }
}

/**
 * Print Receipt for POS-58 Thermal Printer
 * Simple window.open approach — no iframe, no @page size
 * Works reliably with thermal printers
 */
export const printReceipt = async (customer, zone = 'red') => {
  if (!customer) {
    alert('⚠️ ไม่มีข้อมูลลูกค้า')
    return
  }

  try {
    const now = new Date()
    const receiptNo = 'RCP-' + now.getTime().toString().slice(-8)

    let startTime, endTime, durationText, costDisplay, rateInfo

    if (zone === 'blue') {
      startTime = customer.start_time ? new Date(customer.start_time) : null
      endTime = customer.end_time ? new Date(customer.end_time) : now
      const durationMs = startTime ? (endTime - startTime) : 0
      const durationMins = customer.duration_minutes || Math.round(durationMs / 60000)
      const hours = Math.floor(durationMins / 60)
      const mins = Math.round(durationMins % 60)
      durationText = hours > 0 ? hours + ' ชม. ' + mins + ' นาที' : mins + ' นาที'
      costDisplay = (customer.final_cost || 0).toFixed(2)
      rateInfo = (customer.hourly_rate || 0) + ' บาท/ชม.'
    } else {
      startTime = customer.startTime ? new Date(customer.startTime) : (customer.start_time ? new Date(customer.start_time) : null)
      endTime = customer.expectedEndTime ? new Date(customer.expectedEndTime) : (customer.end_time ? new Date(customer.end_time) : null)
      const durationMs = startTime && endTime ? (endTime - startTime) : 0
      const durationMins = customer.duration_minutes || Math.round(durationMs / 60000)
      const hours = Math.floor(durationMins / 60)
      const mins = Math.round(durationMins % 60)
      durationText = hours > 0 ? hours + ' ชม. ' + mins + ' นาที' : mins + ' นาที'
      costDisplay = (customer.cost || customer.final_cost || 0).toFixed(2)
      rateInfo = ''
    }

    const fmtTime = (d) => d ? d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-'
    const dateStr = (startTime || now).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const noteTxt = customer.note && customer.note !== '-' ? customer.note : ''
    const zoneName = zone === 'blue' ? 'BLUE ZONE' : 'RED ZONE'
    const zColor = zone === 'blue' ? '#1d4ed8' : '#dc2626'

    // Build plain text-style receipt — all px units, no mm, no @page size
    const lines = []
    lines.push('<div style="text-align:center;font-size:16px;font-weight:bold">JUTHAZONE</div>')
    lines.push('<div style="text-align:center"><span style="background:' + zColor + ';color:#fff;padding:1px 8px;border-radius:3px;font-size:10px;font-weight:bold">' + zoneName + '</span></div>')
    lines.push('<div style="text-align:center;font-size:9px;color:#555">ระบบจัดการเวลาเล่น</div>')
    lines.push('<div style="border-top:2px solid #000;margin:4px 0"></div>')
    lines.push('<div><b>เลขที่:</b> ' + receiptNo + '</div>')
    lines.push('<div><b>วันที่:</b> ' + dateStr + '</div>')
    lines.push('<div><b>พิมพ์:</b> ' + fmtTime(now) + '</div>')
    lines.push('<div style="border-top:1px dashed #000;margin:3px 0"></div>')
    lines.push('<div style="text-align:center;font-weight:bold;font-size:12px">ข้อมูลลูกค้า</div>')
    lines.push('<div><b>ชื่อ:</b> ' + (customer.name || '-') + '</div>')
    lines.push('<div><b>ห้อง:</b> ' + (customer.room || '-') + '</div>')
    if (noteTxt) lines.push('<div><b>Note:</b> ' + noteTxt.substring(0, 16) + '</div>')
    lines.push('<div style="border-top:1px dashed #000;margin:3px 0"></div>')
    lines.push('<div style="text-align:center;font-weight:bold;font-size:12px">รายละเอียดบริการ</div>')
    lines.push('<div><b>เริ่ม:</b> ' + fmtTime(startTime) + '</div>')
    lines.push('<div><b>สิ้นสุด:</b> ' + fmtTime(endTime) + '</div>')
    lines.push('<div><b>เวลา:</b> ' + durationText + '</div>')
    if (rateInfo) lines.push('<div><b>อัตรา:</b> ' + rateInfo + '</div>')
    lines.push('<div style="border-top:2px solid #000;margin:4px 0"></div>')
    lines.push('<div style="border:2px solid #000;border-radius:4px;padding:4px;margin:4px 0;text-align:center"><div style="font-size:9px;color:#333">ยอดรวมทั้งสิ้น</div><div style="font-size:20px;font-weight:bold">฿' + costDisplay + '</div></div>')
    lines.push('<div style="border-top:1px dashed #000;margin:3px 0"></div>')
    lines.push('<div style="text-align:center;font-size:9px;color:#555">ขอบคุณที่ใช้บริการ<br><b>JUTHAZONE</b></div>')

    const bodyContent = lines.join('\n')

    const html = [
      '<!DOCTYPE html>',
      '<html><head><meta charset="UTF-8"><title>Receipt</title>',
      '<style>',
      '@page { margin: 0 }',
      '@media print { html, body { margin: 0; padding: 0; } }',
      'html, body { margin: 0; padding: 0; width: 220px; background: #fff; }',
      'body { font-family: monospace; font-size: 11px; line-height: 1.3; color: #000; width: 220px; padding: 4px 6px; }',
      '</style>',
      '</head><body>',
      bodyContent,
      '</body></html>'
    ].join('\n')

    // Open popup window — unique name each time to avoid stale cache
    const winName = 'RCT_' + Date.now()
    const w = window.open('', winName, 'width=260,height=500,scrollbars=no,menubar=no,toolbar=no,location=no')

    if (!w) {
      alert('❌ ป๊อปอัพถูกบล็อก กรุณาอนุญาต Popup แล้วลองใหม่')
      return
    }

    w.document.open()
    w.document.write(html)
    w.document.close()

    // Wait for content to render then print ONCE and close
    const doPrint = () => {
      try {
        w.focus()
        w.print()
      } catch (e) {
        console.error('Print failed:', e)
      }
      // Close the window after a small delay
      setTimeout(() => {
        try { w.close() } catch (e) { /* ignore */ }
      }, 1500)
    }

    // Use onload if possible, fallback to timeout
    if (w.document.readyState === 'complete') {
      setTimeout(doPrint, 300)
    } else {
      w.onload = () => setTimeout(doPrint, 300)
      // Safety fallback
      setTimeout(doPrint, 1500)
    }

  } catch (error) {
    console.error('Print receipt error:', error)
    alert('❌ เกิดข้อผิดพลาดในการพิมพ์ใบเสร็จ: ' + error.message)
  }
}

/**
 * Export Daily Summary to Excel - Enhanced Version
 */
export const exportDailySummaryToExcel = async (vipData, computerData, selectedDate, selectedShift, options = {}) => {
  await initializeImports()
  
  if (!XLSX) {
    alert('❌ Excel export not available. Please try again later.')
    return
  }

  try {
    const now = new Date()
    const timestamp = now.toISOString().slice(0, 10)
    const { zone = 'red' } = options

    // Enhanced VIP sheet
    const vipSheet = vipData.map((entry, index) => ({
      'ลำดับ': index + 1,
      'รหัส': `VIP-${String(index + 1).padStart(6, '0')}`,
      'ชื่อลูกค้า': entry.name || '-',
      'ห้อง': entry.room || '-',
      'วันที่': formatDate(entry.start_time),
      'เวลาเริ่ม': formatTime(entry.start_time),
      'เวลาสิ้นสุด': formatTime(entry.end_time),
      'ระยะเวลา (นาที)': entry.duration_minutes || 0,
      'ระยะเวลา (ชม.และนาที)': formatDuration(entry.duration_minutes),
      'ค่าใช้จ่าย': parseFloat(entry.final_cost || 0).toFixed(2),
      'วิธีการจ่าย': entry.payment_method === 'cash' ? '💵 เงินสด' : '🏦 โอนเงิน',
      'กะทำงาน': entry.shift ? `กะ ${entry.shift}` : 'ไม่ระบุ',
      'พนักงาน': entry.added_by || '-',
      'หมายเหตุ': entry.note || '-',
      'สถานะ': getEndReasonText(entry.end_reason)
    }))

    // Enhanced Computer sheet
    const computerSheet = computerData.map((entry, index) => ({
      'ลำดับ': index + 1,
      'รหัส': `PC-${String(index + 1).padStart(6, '0')}`,
      'กะ': entry.shift ? `กะ ${entry.shift}` : 'ไม่ระบุ',
      'วันที่': formatDate(entry.created_at || entry.start_time),
      'เวลา': formatTime(entry.created_at || entry.start_time),
      'จำนวนโอน': parseFloat(entry.transfer_amount || 0).toFixed(2),
      'จำนวนสด': parseFloat(entry.cash_amount || 0).toFixed(2),
      'รวม': parseFloat(entry.total_cost || 0).toFixed(2),
      'พนักงาน': entry.added_by || '-',
      'หมายเหตุ': entry.note || '-',
      'วันที่สร้าง': formatDateTime(entry.created_at)
    }))

    // Calculate comprehensive statistics
    const vipStats = {
      total: vipData.reduce((sum, e) => sum + parseFloat(e.final_cost || 0), 0),
      transfer: vipData.filter(e => (e.payment_method || 'transfer') === 'transfer').reduce((sum, e) => sum + parseFloat(e.final_cost || 0), 0),
      cash: vipData.filter(e => (e.payment_method || 'transfer') === 'cash').reduce((sum, e) => sum + parseFloat(e.final_cost || 0), 0),
      count: vipData.length,
      avgPerCustomer: vipData.length > 0 ? vipData.reduce((sum, e) => sum + parseFloat(e.final_cost || 0), 0) / vipData.length : 0
    }

    const computerStats = {
      total: computerData.reduce((sum, e) => sum + parseFloat(e.total_cost || 0), 0),
      transfer: computerData.reduce((sum, e) => sum + parseFloat(e.transfer_amount || 0), 0),
      cash: computerData.reduce((sum, e) => sum + parseFloat(e.cash_amount || 0), 0),
      count: computerData.length,
      avgPerTransaction: computerData.length > 0 ? computerData.reduce((sum, e) => sum + parseFloat(e.total_cost || 0), 0) / computerData.length : 0
    }

    const grandStats = {
      total: vipStats.total + computerStats.total,
      transfer: vipStats.transfer + computerStats.transfer,
      cash: vipStats.cash + computerStats.cash,
      count: vipStats.count + computerStats.count
    }

    // Enhanced summary sheet
    const summaryData = [
      ['📊 รายงานสรุปยอดประจำวัน JUTHAZONE'],
      [''],
      ['📅 ข้อมูลรายงาน'],
      ['วันที่รายงาน', formatDate(selectedDate)],
      ['เวลาสร้างรายงาน', formatTime(now)],
      ['โซน', zone === 'blue' ? '🔵 BLUE ZONE' : '🔴 RED ZONE'],
      ['กะที่เลือก', selectedShift === 'all' ? 'ทุกกะ' : `กะ ${selectedShift}`],
      [''],
      ['💰 สรุปยอดห้อง VIP'],
      ['จำนวนลูกค้า', `${vipStats.count} คน`],
      ['รายได้รวม', formatCurrency(vipStats.total)],
      ['เงินโอน', formatCurrency(vipStats.transfer)],
      ['เงินสด', formatCurrency(vipStats.cash)],
      ['รายได้เฉลี่ยต่อคน', formatCurrency(vipStats.avgPerCustomer)],
      [''],
      ['🏆 สรุปรวมทั้งหมด'],
      ['รายได้รวมทั้งหมด', formatCurrency(grandStats.total)],
      ['เงินโอนรวม', formatCurrency(grandStats.transfer)],
      ['เงินสดรวม', formatCurrency(grandStats.cash)],
      ['จำนวนรายการทั้งหมด', `${grandStats.count} รายการ`],
      ['อัตราส่วนเงินโอน', `${((grandStats.transfer/grandStats.total)*100).toFixed(1)}%`],
      ['อัตราส่วนเงินสด', `${((grandStats.cash/grandStats.total)*100).toFixed(1)}%`]
    ]

    const wb = XLSX.utils.book_new()
    
    // Add sheets with enhanced formatting
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
    wsSummary['!cols'] = [{ wch: 30 }, { wch: 20 }]
    XLSX.utils.book_append_sheet(wb, wsSummary, 'สรุปยอดประจำวัน')
    
    if (vipSheet.length > 0) {
      const wsVip = XLSX.utils.json_to_sheet(vipSheet)
      wsVip['!cols'] = [
        { wch: 8 }, { wch: 12 }, { wch: 20 }, { wch: 15 }, { wch: 12 },
        { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 12 },
        { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 25 }, { wch: 15 }
      ]
      XLSX.utils.book_append_sheet(wb, wsVip, 'รายละเอียดห้อง VIP')
    }
    
    if (computerSheet.length > 0) {
      const wsComputer = XLSX.utils.json_to_sheet(computerSheet)
      wsComputer['!cols'] = [
        { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 10 },
        { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 25 }, { wch: 18 }
      ]
      XLSX.utils.book_append_sheet(wb, wsComputer, 'รายละเอียด Computer Zone')
    }

    // Enhanced filename
    const zonePrefix = zone === 'blue' ? 'Blue' : 'Red'
    const shiftSuffix = selectedShift === 'all' ? 'AllShifts' : `Shift${selectedShift}`
    const fileName = `${zonePrefix}_DailySummary_${selectedDate}_${shiftSuffix}.xlsx`
    
    XLSX.writeFile(wb, fileName)
    alert(`✅ ส่งออก Excel สำเร็จ\n📊 วันที่ ${formatDate(selectedDate)}\n💰 รายได้รวม ${formatCurrency(grandStats.total)}`)
  } catch (error) {
    console.error('Daily summary Excel export error:', error)
    alert('❌ เกิดข้อผิดพลาดในการส่งออก Excel: ' + error.message)
  }
}

/**
 * Export Daily Summary to PDF - Enhanced Version
 */
/**
 * Quick print receipt from history record (convenience wrapper)
 */
export const printHistoryReceipt = (record, zone = 'red') => {
  return printReceipt({
    name: record.name,
    room: record.room,
    note: record.note,
    start_time: record.start_time,
    end_time: record.end_time,
    startTime: record.start_time,
    expectedEndTime: record.end_time,
    duration_minutes: record.duration_minutes,
    hourly_rate: record.hourly_rate,
    cost: record.final_cost,
    final_cost: record.final_cost
  }, zone)
}
