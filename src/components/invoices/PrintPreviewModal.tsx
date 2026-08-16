/**
 * PrintPreviewModal
 *
 * Modal that previews an invoice in the chosen print layout (A4 / Thermal)
 * and triggers the browser's native print dialog. Renders BOTH layouts so
 * the user can switch between them; the @media print CSS in print.css hides
 * the inactive one when printing.
 *
 * Fetches the full invoice (with lines) via the `get_invoice` Tauri command,
 * plus the contact (for billing party) and the current company (for seller
 * party + header).
 */

import { useEffect, useState } from 'react';
import { X, Printer, FileText, Receipt } from 'lucide-react';
import { tauriInvoke } from '../../lib/tauri';
import type {
  Invoice,
  InvoiceLine,
  Contact,
  Company,
} from '../../types/database';
import {
  InvoicePrintView,
  type PrintLayout,
} from './InvoicePrintView';
import './print.css';

interface Props {
  invoiceId: number;
  /** Optional override; if omitted we fetch the invoice from DB. */
  initialInvoice?: Invoice | null;
  /** Optional override for the line items, fetched from DB by default. */
  initialLines?: InvoiceLine[];
  /** Optional override for the contact. */
  contact?: Contact | null;
  onClose: () => void;
}

export function PrintPreviewModal({
  invoiceId,
  initialInvoice,
  initialLines,
  contact: initialContact,
  onClose,
}: Props) {
  const [invoice, setInvoice] = useState<Invoice | null>(initialInvoice ?? null);
  const [lines, setLines] = useState<InvoiceLine[]>(initialLines ?? []);
  const [contact, setContact] = useState<Contact | null>(initialContact ?? null);
  const [company, setCompany] = useState<Company | null>(null);
  const [layout, setLayout] = useState<PrintLayout>('a4');
  const [loading, setLoading] = useState(!initialInvoice || !initialLines);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (!initialInvoice || !initialLines) {
          const [inv, fetchedLines] = await tauriInvoke<[Invoice, InvoiceLine[]]>(
            'get_invoice',
            { id: invoiceId },
          );
          if (cancelled) return;
          setInvoice(inv);
          setLines(fetchedLines);
          if (!initialContact && inv.contactId) {
            try {
              const c = await tauriInvoke<Contact>('get_contact', {
                id: inv.contactId,
              });
              if (!cancelled) setContact(c);
            } catch {
              /* contact fetch failure is non-fatal */
            }
          }
        } else if (!initialContact && initialInvoice.contactId) {
          try {
            const c = await tauriInvoke<Contact>('get_contact', {
              id: initialInvoice.contactId,
            });
            if (!cancelled) setContact(c);
          } catch {
            /* ignore */
          }
        }

        // Always (re)load the current company so the header info is fresh
        try {
          const co = await tauriInvoke<Company>('get_current_company');
          if (!cancelled) setCompany(co);
        } catch {
          /* non-fatal */
        }
      } catch (err) {
        if (!cancelled) {
          setError(String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [invoiceId, initialInvoice, initialLines, initialContact]);

  const handlePrint = () => {
    // The CSS in print.css hides everything except the active layout
    document.body.dataset.activeLayout = layout;
    window.print();
    // Clean up after print dialog closes
    setTimeout(() => {
      delete document.body.dataset.activeLayout;
    }, 500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[95vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 print:hidden">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-800">
              پیش‌نمایش چاپ فاکتور
            </h2>
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setLayout('a4')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                  layout === 'a4'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <FileText className="w-4 h-4" />
                A4
              </button>
              <button
                onClick={() => setLayout('thermal')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                  layout === 'thermal'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <Receipt className="w-4 h-4" />
                فیش ۸۰mm
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={loading || !!error || !invoice}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 text-white rounded-lg text-sm transition-colors"
            >
              <Printer className="w-4 h-4" />
              چاپ
            </button>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-700 p-2 rounded-lg hover:bg-slate-100"
              title="بستن"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body / preview area */}
        <div className="flex-1 overflow-auto bg-slate-100">
          {loading && (
            <div className="p-10 text-center text-slate-500">
              در حال بارگذاری فاکتور...
            </div>
          )}
          {error && !loading && (
            <div className="p-10 text-center text-rose-600">
              خطا در بارگذاری فاکتور: {error}
            </div>
          )}
          {!loading && !error && invoice && (
            <>
              {/* Always render BOTH layouts, but the print CSS hides the inactive one */}
              <div data-print-active={layout === 'a4' ? 'true' : 'false'}>
                <div className="invoice-print-preview py-6">
                  <InvoicePrintView
                    invoice={invoice}
                    lines={lines}
                    contact={contact}
                    company={company}
                    layout="a4"
                  />
                </div>
              </div>
              <div data-print-active={layout === 'thermal' ? 'true' : 'false'}>
                <div className="invoice-print-preview invoice-print-preview--thermal py-6">
                  <InvoicePrintView
                    invoice={invoice}
                    lines={lines}
                    contact={contact}
                    company={company}
                    layout="thermal"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-5 py-2 border-t border-slate-200 text-xs text-slate-500 text-center print:hidden">
          در چاپگر A4 گزینه «اندازه واقعی» و در فیش‌پرینتر گزینه «۸۰mm» را انتخاب کنید.
        </div>
      </div>
    </div>
  );
}