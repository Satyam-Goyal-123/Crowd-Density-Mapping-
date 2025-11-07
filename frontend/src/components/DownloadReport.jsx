import React from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

export default function DownloadReport({ targetId = 'report-root', filename = 'Crowd_Trends_Report.pdf' }) {
  async function handleDownload() {
    const node = document.getElementById(targetId)
    if (!node) return alert('Report node not found!')

    // Take screenshot of the report area
    const canvas = await html2canvas(node, { scale: 2, useCORS: true })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pageWidth = pdf.internal.pageSize.getWidth()

    // --- Title page ---
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(22)
    pdf.text('Crowd Trends Analysis Report', pageWidth / 2, 30, { align: 'center' })

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(14)
    pdf.text('IoT Smart Campus Monitoring System', pageWidth / 2, 45, { align: 'center' })

    const date = new Date().toLocaleString()
    pdf.setFontSize(10)
    pdf.text(`Generated on: ${date}`, pageWidth / 2, 55, { align: 'center' })

    // --- Visual Data Page ---
    pdf.addPage()
    pdf.setFontSize(16)
    pdf.setFont('helvetica', 'bold')
    pdf.text('Visual Data Summary', 15, 20)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(12)
    pdf.text('Below are visualizations showing trends, predictions, and insights.', 15, 30)

    const imgProps = pdf.getImageProperties(imgData)
    const pdfWidth = pageWidth - 30
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width
    pdf.addImage(imgData, 'PNG', 15, 40, pdfWidth, pdfHeight)

    // Save the PDF
    pdf.save(filename)
  }

  return (
    <button
      onClick={handleDownload}
      className="w-full py-3 rounded-xl bg-gradient-to-r from-slate-900 to-indigo-800 text-white font-semibold shadow-md hover:opacity-90 transition"
    >
      📄 Download Full PDF Report
    </button>
  )
}
