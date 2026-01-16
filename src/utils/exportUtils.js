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
 * Print Receipt (58 x 210 mm) - Compact Thai Design
 */
export const printReceipt = async (customer) => {
  await initializeImports()

  if (!customer) {
    alert('⚠️ ไม่มีข้อมูลลูกค้า')
    return
  }

  try {
    const now = new Date()
    const receiptNo = `RCP-${now.getTime().toString().slice(-6)}`
    const startTime = new Date(customer.startTime)
    const endTime = new Date(customer.expectedEndTime)
    const duration = (endTime - startTime) / (1000 * 60)

    // Fallback to HTML print if html2canvas missing
    if (!html2canvas) {
      alert('⚠️ ระบบพิมพ์รูปภาพไม่พร้อม ใช้โหมดพิมพ์ปกติแทน')
      const receiptHTML = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>@page{size:58mm auto;margin:0}html,body{margin:0;padding:0}img{width:100%}</style></head><body>
        <div style="width:384px;padding:12px;font-family:Arial;color:#000">
          <div style="text-align:center;border-bottom:1px solid #000;padding-bottom:6px;margin-bottom:8px">
            <div style="font-size:18px;font-weight:bold">JUTHAZONE</div>
            <div style="font-size:12px">ใบเสร็จ</div>
          </div>
          <div style="display:flex;justify-content:space-between;margin:4px 0"><b>เลขที่:</b><span>${receiptNo}</span></div>
          <div style="display:flex;justify-content:space-between;margin:4px 0"><b>วันที่:</b><span>${now.toLocaleDateString('th-TH')}</span></div>
          <div style="display:flex;justify-content:space-between;margin:4px 0"><b>เวลา:</b><span>${now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span></div>
          <div style="border-bottom:1px solid #000;margin:8px 0"></div>
          <div style="background:#f9f9f9;padding:6px;border-radius:4px">
            <div style="font-weight:bold;margin-bottom:4px">ข้อมูลลูกค้า</div>
            <div style="display:flex;justify-content:space-between;margin:4px 0"><b>ชื่อ:</b><span>${customer.name}</span></div>
            <div style="display:flex;justify-content:space-between;margin:4px 0"><b>ห้อง:</b><span style="background:#0066cc;color:#fff;padding:2px 6px;border-radius:3px">${customer.room}</span></div>
            ${customer.note && customer.note !== '-' ? `<div style="display:flex;justify-content:space-between;margin:4px 0"><b>หมายเหตุ:</b><span>${customer.note.substring(0,25)}</span></div>` : ''}
          </div>
          <div style="border-bottom:1px solid #000;margin:8px 0"></div>
          <div style="font-weight:bold;margin-bottom:4px">รายละเอียด</div>
          <div style="display:flex;justify-content:space-between;margin:4px 0"><b>เวลา:</b><span>${startTime.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})} - ${endTime.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})}</span></div>
          <div style="display:flex;justify-content:space-between;margin:4px 0"><b>ระยะเวลา:</b><span>${Math.round(duration)} นาที</span></div>
          <div style="text-align:center;color:#444;margin-top:8px">ขอบคุณที่ใช้บริการ JUTHAZONE</div>
        </div>
      </body></html>`
      const w = window.open('', 'PRINT', 'width=400,height=800')
      w.document.write(receiptHTML)
      w.document.close()
      w.focus()
      w.onload = () => { w.print(); w.close() }
      return
    }

    // Create offscreen container for html2canvas rendering
    const container = document.createElement('div')
    container.style.position = 'fixed'
    container.style.left = '-10000px'
    container.style.top = '0'
    container.style.width = '384px' // Typical width for 58mm printers (384 dots)
    container.style.background = '#fff'
    container.style.color = '#000'
    container.style.padding = '0'
    container.style.margin = '0'
    container.style.zIndex = '-1'

    // Build receipt DOM (pixel-based for printer compatibility)
    container.innerHTML = `
      <div style="width:384px;padding:12px;font-family:Arial,sans-serif">
        <div style="text-align:center;border-bottom:1px solid #000;padding-bottom:6px;margin-bottom:8px">
          <div style="font-size:18px;font-weight:bold">JUTHAZONE</div>
          <div style="font-size:12px">ใบเสร็จ</div>
        </div>
        <div style="display:flex;justify-content:space-between;margin:4px 0"><b>เลขที่:</b><span>${receiptNo}</span></div>
        <div style="display:flex;justify-content:space-between;margin:4px 0"><b>วันที่:</b><span>${now.toLocaleDateString('th-TH')}</span></div>
        <div style="display:flex;justify-content:space-between;margin:4px 0"><b>เวลา:</b><span>${now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span></div>
        <div style="border-bottom:1px solid #000;margin:8px 0"></div>
        <div style="background:#f9f9f9;padding:6px;border-radius:4px">
          <div style="font-weight:bold;margin-bottom:4px">ข้อมูลลูกค้า</div>
          <div style="display:flex;justify-content:space-between;margin:4px 0"><b>ชื่อ:</b><span>${customer.name}</span></div>
          <div style="display:flex;justify-content:space-between;margin:4px 0"><b>ห้อง:</b><span style="background:#0066cc;color:#fff;padding:2px 6px;border-radius:3px">${customer.room}</span></div>
          ${customer.note && customer.note !== '-' ? `<div style="display:flex;justify-content:space-between;margin:4px 0"><b>หมายเหตุ:</b><span>${customer.note.substring(0,25)}</span></div>` : ''}
        </div>
        <div style="border-bottom:1px solid #000;margin:8px 0"></div>
        <div style="font-weight:bold;margin-bottom:4px">รายละเอียด</div>
        <div style="display:flex;justify-content:space-between;margin:4px 0"><b>เวลา:</b><span>${startTime.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})} - ${endTime.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})}</span></div>
        <div style="display:flex;justify-content:space-between;margin:4px 0"><b>ระยะเวลา:</b><span>${Math.round(duration)} นาที</span></div>
        <div style="text-align:center;color:#444;margin-top:8px">ขอบคุณที่ใช้บริการ JUTHAZONE</div>
      </div>
    `

    document.body.appendChild(container)

    // Render to canvas with higher scale for print clarity
    const canvas = await html2canvas(container, { backgroundColor: '#ffffff', scale: 2, useCORS: true })
    const imgData = canvas.toDataURL('image/png')

    // Cleanup offscreen container
    document.body.removeChild(container)

    // Open a lightweight print window with only the image
    const printWindow = window.open('', 'PRINT', 'width=400,height=800')
    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Print</title>
      <style>@page{size:auto;margin:0}html,body{margin:0;padding:0;background:#fff}img{width:100%;display:block}</style>
    </head><body>
      <img id="receiptImage" src="${imgData}" alt="receipt" />
      <script>const img=document.getElementById('receiptImage');img.onload=function(){window.print();window.close();};</script>
    </body></html>`)
    printWindow.document.close()
    printWindow.focus()

  } catch (error) {
    console.error('Print error:', error)
    alert('❌ เกิดข้อผิดพลาดในการพิมพ์: ' + error.message)
  }
}
