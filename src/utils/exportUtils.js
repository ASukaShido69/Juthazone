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
