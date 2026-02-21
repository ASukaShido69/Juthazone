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
    minute: '2-digit'
  })
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
 * Export History to Excel
 */
export const exportToExcel = async (data, fileName = 'juthazone-report') => {
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
    // Prepare data for Excel
    const excelData = data.map(item => ({
      'ลำดับที่': item.id,
      'ชื่อลูกค้า': item.name,
      'ห้อง': item.room,
      'เริ่ม': formatDateTime(item.start_time),
      'จบ': formatDateTime(item.end_time),
      'ระยะเวลา (นาที)': item.duration_minutes,
      'ค่าใช้จ่าย': item.final_cost,
      'สถานะจ่าย': item.is_paid ? 'จ่ายแล้ว' : 'ยังไม่จ่าย',
      'สถานะ': getEndReasonText(item.end_reason),
      'Note': item.note || '-'
    }))

    // Create workbook
    const ws = XLSX.utils.json_to_sheet(excelData)
    
    // Set column widths
    ws['!cols'] = [
      { wch: 8 },  // ID
      { wch: 15 }, // ชื่อ
      { wch: 12 }, // ห้อง
      { wch: 18 }, // เริ่ม
      { wch: 18 }, // จบ
      { wch: 15 }, // ระยะเวลา
      { wch: 12 }, // ค่า
      { wch: 12 }, // สถานะจ่าย
      { wch: 12 }, // สถานะ
      { wch: 20 }  // Note
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'รายงาน')

    // Add summary sheet
    const now = new Date()
    const totalRevenue = data.reduce((sum, item) => sum + parseFloat(item.final_cost), 0)
    const paidCount = data.filter(item => item.is_paid).length
    
    const summaryData = [
      ['สรุปรายงาน Juthazone'],
      ['วันที่รายงาน', now.toLocaleDateString('th-TH')],
      [''],
      ['สรุปทั่วไป'],
      ['จำนวนทั้งหมด', data.length],
      ['รายได้รวม', totalRevenue.toFixed(2)],
      ['จ่ายแล้ว', paidCount],
      ['ยังไม่จ่าย', data.length - paidCount],
      [''],
      ['สถิติตามห้อง']
    ]

    const roomStats = getRoomStats(data)
    Object.entries(roomStats).forEach(([room, stats]) => {
      summaryData.push([room, stats.count, stats.revenue.toFixed(2)])
    })

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
    wsSummary['!cols'] = [{ wch: 25 }, { wch: 15 }]
    XLSX.utils.book_append_sheet(wb, wsSummary, 'สรุป')

    // Download
    const timestamp = now.toISOString().slice(0, 10)
    XLSX.writeFile(wb, `${fileName}-${timestamp}.xlsx`)
    
    alert('✅ ส่งออก Excel สำเร็จ')
  } catch (error) {
    console.error('Excel export error:', error)
    alert('❌ เกิดข้อผิดพลาดในการส่งออก Excel')
  }
}

/**
 * Export to PDF (Report)
 */
export const exportToPDF = async (data, userName = 'Admin') => {
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
    let yPos = 20

    // Header
    doc.setFillColor(147, 51, 234) // Purple
    doc.rect(0, 0, pageWidth, 40, 'F')
    
    doc.setFont('Mali', 'bold')
    doc.setFontSize(28)
    doc.setTextColor(255, 255, 255)
    doc.text('JUTHAZONE', pageWidth / 2, 20, { align: 'center' })
  
    doc.setFontSize(14)
    doc.text('รายงานสรุปยอดประจำเดือน', pageWidth / 2, 32, { align: 'center' })

    // Reset color
    doc.setTextColor(0, 0, 0)
    doc.setFont('Mali', 'normal')
    doc.setFontSize(11)

    yPos = 50

    // Report info
    doc.text(`วันที่รายงาน: ${now.toLocaleDateString('th-TH')}`, 20, yPos)
    yPos += 7
    doc.text(`ผู้จัดทำ: ${userName}`, 20, yPos)
    yPos += 7
    doc.text(`เวลา: ${now.toLocaleTimeString('th-TH')}`, 20, yPos)
    yPos += 12

    // Summary box
    const totalRevenue = data.reduce((sum, item) => sum + parseFloat(item.final_cost), 0)
    const paidCount = data.filter(item => item.is_paid).length
    const totalHours = data.reduce((sum, item) => sum + parseFloat(item.duration_minutes), 0) / 60

    doc.setFillColor(230, 240, 250)
    doc.rect(20, yPos - 5, pageWidth - 40, 30, 'F')
    doc.setFont('Mali', 'bold')
    doc.setFontSize(12)
    doc.text(`รายได้รวม: ฿${totalRevenue.toFixed(2)}`, 30, yPos + 3)
    doc.text(`จำนวนลูกค้า: ${data.length} คน`, 30, yPos + 10)
    doc.text(`เวลารวม: ${totalHours.toFixed(1)} ชม.`, 30, yPos + 17)
    doc.text(`จ่ายแล้ว: ${paidCount}/${data.length} คน`, 110, yPos + 10)

    yPos += 40

    // Table
    const columns = ['ชื่อ', 'ห้อง', 'ระยะเวลา', 'ค่า', 'สถานะ']
    const tableData = data.map(item => [
      item.name,
      item.room,
      `${item.duration_minutes.toFixed(0)} นาที`,
      `฿${item.final_cost}`,
      item.is_paid ? '✓ จ่าย' : '✗ ยังไม่จ่าย'
    ])

    // Simple table
    doc.setFont('Mali', 'bold')
    doc.setFontSize(10)
    const columnWidths = [40, 25, 35, 25, 30]
    let xPos = 20

    // Header
    columns.forEach((col, idx) => {
      doc.setFillColor(147, 51, 234)
      doc.setTextColor(255, 255, 255)
      doc.rect(xPos, yPos, columnWidths[idx], 8, 'F')
      doc.text(col, xPos + 2, yPos + 5)
      xPos += columnWidths[idx]
    })

    yPos += 8
    doc.setTextColor(0, 0, 0)
    doc.setFont('Mali', 'normal')

    // Data rows
    tableData.forEach((row, rowIdx) => {
      if (yPos > pageHeight - 20) {
        doc.addPage()
        yPos = 20
      }
      
      if (rowIdx % 2 === 0) {
        doc.setFillColor(240, 240, 240)
        xPos = 20
        let maxWidth = 0
        columnWidths.forEach(w => maxWidth += w)
        doc.rect(20, yPos, maxWidth, 7, 'F')
      }

      xPos = 20
      row.forEach((cell, idx) => {
        doc.text(cell, xPos + 2, yPos + 5)
        xPos += columnWidths[idx]
      })
      yPos += 7
    })

    // Footer
    yPos = pageHeight - 15
    doc.setFontSize(9)
    doc.setTextColor(100, 100, 100)
    doc.text('จัดทำโดยระบบ JUTHAZONE', pageWidth / 2, yPos, { align: 'center' })
    doc.text(`${now.toLocaleDateString('th-TH')} ${now.toLocaleTimeString('th-TH')}`, pageWidth / 2, yPos + 5, { align: 'center' })

    // Save
    const timestamp = now.toISOString().slice(0, 10)
    doc.save(`juthazone-report-${timestamp}.pdf`)
    alert('✅ ส่งออก PDF สำเร็จ')
  } catch (error) {
    console.error('PDF export error:', error)
    alert('❌ เกิดข้อผิดพลาดในการส่งออก PDF')
  }
}

/**
 * Print Receipt for POS-58 Thermal Printer (58mm width)
 * Supports both Red Zone (fixed time) and Blue Zone (pro-rated)
 * Auto-cut support, no blank white space at bottom
 */
export const printReceipt = async (customer, zone = 'red') => {
  if (!customer) {
    alert('⚠️ ไม่มีข้อมูลลูกค้า')
    return
  }

  try {
    const now = new Date()
    const receiptNo = `RCP-${now.getTime().toString().slice(-8)}`

    // Calculate duration and cost based on zone type
    let startTime, endTime, durationText, costDisplay, rateInfo

    if (zone === 'blue') {
      startTime = customer.start_time ? new Date(customer.start_time) : null
      endTime = customer.end_time ? new Date(customer.end_time) : now
      const durationMs = startTime ? (endTime - startTime) : 0
      const durationMins = customer.duration_minutes || Math.round(durationMs / 60000)
      const hours = Math.floor(durationMins / 60)
      const mins = Math.round(durationMins % 60)
      durationText = hours > 0 ? `${hours} ชม. ${mins} นาที` : `${mins} นาที`
      costDisplay = (customer.final_cost || 0).toFixed(2)
      rateInfo = `${customer.hourly_rate || 0} บาท/ชม.`
    } else {
      startTime = customer.startTime ? new Date(customer.startTime) : (customer.start_time ? new Date(customer.start_time) : null)
      endTime = customer.expectedEndTime ? new Date(customer.expectedEndTime) : (customer.end_time ? new Date(customer.end_time) : null)
      const durationMs = startTime && endTime ? (endTime - startTime) : 0
      const durationMins = customer.duration_minutes || Math.round(durationMs / 60000)
      const hours = Math.floor(durationMins / 60)
      const mins = Math.round(durationMins % 60)
      durationText = hours > 0 ? `${hours} ชม. ${mins} นาที` : `${mins} นาที`
      costDisplay = (customer.cost || customer.final_cost || 0).toFixed(2)
      rateInfo = null
    }

    const startTimeStr = startTime ? startTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-'
    const endTimeStr = endTime ? endTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-'
    const dateStr = (startTime || now).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const noteTxt = customer.note && customer.note !== '-' ? customer.note : ''
    const zoneName = zone === 'blue' ? 'BLUE ZONE' : 'RED ZONE'
    const zoneColor = zone === 'blue' ? '#1d4ed8' : '#dc2626'

    const receiptHTML = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Receipt</title>
<style>
  @page { size: 58mm auto; margin: 0 !important; padding: 0 !important; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 58mm; margin: 0; padding: 0;
    font-family: 'Courier New', 'Lucida Console', monospace;
    font-size: 11px; line-height: 1.4; color: #000; background: #fff;
  }
  .receipt { width: 58mm; padding: 3mm 2mm 1mm 2mm; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .big { font-size: 16px; font-weight: bold; }
  .med { font-size: 13px; font-weight: bold; }
  .small { font-size: 9px; color: #555; }
  .line { border-top: 1px dashed #000; margin: 3px 0; }
  .dbl-line { border-top: 2px solid #000; margin: 4px 0; }
  .row { display: flex; justify-content: space-between; padding: 1px 0; }
  .row-label { font-weight: bold; }
  .zone-badge {
    display: inline-block; background: ${zoneColor}; color: #fff;
    padding: 2px 10px; border-radius: 3px; font-size: 10px; font-weight: bold;
    letter-spacing: 1px; margin: 3px 0;
  }
  .total-box {
    border: 2px solid #000; border-radius: 4px; padding: 4px 6px; margin: 4px 0;
    text-align: center;
  }
  .total-amount { font-size: 20px; font-weight: bold; }
  .cut-line { border-top: 1px dashed #aaa; margin-top: 6px; }
  @media print { html, body { width: 58mm; } }
</style>
</head><body>
<div class="receipt">
  <div class="center">
    <div class="big">JUTHAZONE</div>
    <div class="zone-badge">${zoneName}</div>
    <div class="small">ระบบจัดการเวลาเล่น</div>
  </div>
  <div class="dbl-line"></div>
  <div class="row"><span class="row-label">เลขที่:</span><span>${receiptNo}</span></div>
  <div class="row"><span class="row-label">วันที่:</span><span>${dateStr}</span></div>
  <div class="row"><span class="row-label">เวลาพิมพ์:</span><span>${now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span></div>
  <div class="line"></div>
  <div class="center med" style="margin:3px 0">ข้อมูลลูกค้า</div>
  <div class="row"><span class="row-label">ชื่อ:</span><span>${customer.name || '-'}</span></div>
  <div class="row"><span class="row-label">ห้อง:</span><span>${customer.room || '-'}</span></div>
  ${noteTxt ? `<div class="row"><span class="row-label">Note:</span><span>${noteTxt.substring(0, 20)}</span></div>` : ''}
  <div class="line"></div>
  <div class="center med" style="margin:3px 0">รายละเอียดบริการ</div>
  <div class="row"><span class="row-label">เริ่ม:</span><span>${startTimeStr}</span></div>
  <div class="row"><span class="row-label">สิ้นสุด:</span><span>${endTimeStr}</span></div>
  <div class="row"><span class="row-label">ระยะเวลา:</span><span>${durationText}</span></div>
  ${rateInfo ? `<div class="row"><span class="row-label">อัตรา:</span><span>${rateInfo}</span></div>` : ''}
  <div class="dbl-line"></div>
  <div class="total-box">
    <div class="small">ยอดรวมทั้งสิ้น</div>
    <div class="total-amount">฿${costDisplay}</div>
  </div>
  <div class="line"></div>
  <div class="center small" style="margin-top:4px">
    <div>ขอบคุณที่ใช้บริการ</div>
    <div style="font-weight:bold">JUTHAZONE</div>
    <div style="margin-top:2px">${dateStr}</div>
  </div>
  <div class="cut-line"></div>
</div>
<script>
  window.onload = function() {
    setTimeout(function() { window.print(); }, 200);
    window.onafterprint = function() { window.close(); };
    setTimeout(function() { window.close(); }, 8000);
  };
</script>
</body></html>`

    const printWindow = window.open('', 'RECEIPT', 'width=250,height=600')
    if (!printWindow) {
      alert('❌ ไม่สามารถเปิดหน้าต่างพิมพ์ได้ กรุณาอนุญาต Popup')
      return
    }
    printWindow.document.write(receiptHTML)
    printWindow.document.close()

  } catch (error) {
    console.error('Print receipt error:', error)
    alert('❌ เกิดข้อผิดพลาดในการพิมพ์ใบเสร็จ: ' + error.message)
  }
}

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
