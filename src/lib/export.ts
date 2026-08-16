import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

/**
 * Export an HTML element as PDF.
 * @param element - The DOM element to capture
 * @param filename - Output filename (without extension)
 * @param title - Optional title to print at top of PDF
 */
export async function exportToPdf(
  element: HTMLElement,
  filename: string,
  title?: string
): Promise<void> {
  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/png');
    const imgWidth = 190; // mm (A4 width minus margins)
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const pdf = new jsPDF('p', 'mm', 'a4');
    let yOffset = 10;

    // Add title if provided
    if (title) {
      pdf.setFontSize(16);
      // jsPDF doesn't have great RTL support, but we'll set the text
      // For Persian, we set the font (default works for basic chars)
      pdf.text(title, 105, yOffset, { align: 'center' });
      yOffset += 10;
    }

    // Calculate how many pages we need
    let heightLeft = imgHeight;
    let position = yOffset;

    // First page
    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= pageHeight - yOffset;

    // Additional pages if content overflows
    while (heightLeft > 0) {
      position = heightLeft - imgHeight + yOffset - 10; // overlap a bit
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`${filename}.pdf`);
  } catch (error) {
    console.error('PDF export failed:', error);
    throw error;
  }
}

/**
 * Export data as Excel (XLSX) file.
 * @param rows - Array of row objects
 * @param filename - Output filename (without extension)
 * @param sheetName - Name of the sheet
 */
export function exportToExcel<T extends Record<string, unknown>>(
  rows: T[],
  filename: string,
  sheetName: string = 'Report'
): void {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  // Auto-fit column widths
  const colWidths = Object.keys(rows[0] || {}).map((key) => ({
    wch: Math.max(
      key.length * 2, // Persian chars are wider
      ...rows.map((row) => String(row[key] ?? '').length * 2)
    ),
  }));
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Format data for export as a flat array of plain objects,
 * with Persian-friendly column names.
 */
export function prepareExportData(
  columns: { key: string; label: string }[],
  rows: Record<string, unknown>[]
): Record<string, unknown>[] {
  return rows.map((row) => {
    const exportRow: Record<string, unknown> = {};
    columns.forEach((col) => {
      exportRow[col.label] = row[col.key];
    });
    return exportRow;
  });
}
