/**
 * InvoicePrintView
 *
 * Pure presentational component that renders a single invoice + its lines
 * for printing. Supports two layout modes:
 *   - "a4"      → A4 portrait (default)
 *   - "thermal" → 80 mm thermal receipt printer
 *
 * The component itself does NOT trigger window.print(); the parent
 * (PrintPreviewModal) decides when to print.
 *
 * All numbers / dates are Persian-friendly. The actual print styling is
 * in `print.css`.
 */

import type { Invoice, InvoiceLine, Contact, Company } from '../../types/database';
import { toPersianNumber, formatNumber } from '../../lib/persian-number';

export type PrintLayout = 'a4' | 'thermal';

export interface InvoicePrintViewProps {
  invoice: Invoice;
  lines: InvoiceLine[];
  contact?: Contact | null;
  company?: Company | null;
  layout?: PrintLayout;
}

const TYPE_LABELS: Record<string, string> = {
  sale: 'فاکتور فروش',
  purchase: 'فاکتور خرید',
  sale_return: 'برگشت از فروش',
  purchase_return: 'برگشت از خرید',
  proforma: 'پیش‌فاکتور',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'پیش‌نویس',
  confirmed: 'تایید شده',
  cancelled: 'لغو شده',
};

function formatPersianDate(jalaliDate: string): string {
  // Display YYYY/MM/DD in Persian digits (no conversion needed if already Jalali)
  return toPersianNumber(jalaliDate);
}

export function InvoicePrintView({
  invoice,
  lines,
  contact,
  company,
  layout = 'a4',
}: InvoicePrintViewProps) {
  const isThermal = layout === 'thermal';
  const typeLabel = TYPE_LABELS[invoice.type] ?? invoice.type;
  const statusLabel = STATUS_LABELS[invoice.status] ?? invoice.status;

  // Wrap layout class so the parent modal can render *either* view
  const wrapperClass = [
    'invoice-print',
    isThermal ? 'invoice-print--thermal' : 'invoice-print--a4',
  ].join(' ');

  return (
    <div className={wrapperClass} data-layout={layout}>
      {/* Header */}
      <header className="invoice-print__header">
        <div className="invoice-print__company">
          <h1 className="invoice-print__company-name">
            {company?.name ?? '—'}
          </h1>
          {company && (
            <div className="invoice-print__company-meta">
              {company.nationalId && (
                <div>شناسه ملی: {toPersianNumber(company.nationalId)}</div>
              )}
              {company.economicCode && (
                <div>کد اقتصادی: {toPersianNumber(company.economicCode)}</div>
              )}
              {company.registrationNumber && (
                <div>شماره ثبت: {toPersianNumber(company.registrationNumber)}</div>
              )}
              {company.address && <div>{company.address}</div>}
              {company.phone && (
                <div>تلفن: {toPersianNumber(company.phone)}</div>
              )}
              {company.email && (
                <div>ایمیل: {company.email}</div>
              )}
              {company.website && (
                <div>وبسایت: {company.website}</div>
              )}
            </div>
          )}
        </div>
        <div className="invoice-print__title-block">
          <h2 className="invoice-print__title">{typeLabel}</h2>
          <table className="invoice-print__meta-table">
            <tbody>
              <tr>
                <th>شماره:</th>
                <td>{toPersianNumber(invoice.number)}</td>
              </tr>
              <tr>
                <th>تاریخ:</th>
                <td>{formatPersianDate(invoice.date)}</td>
              </tr>
              <tr>
                <th>وضعیت:</th>
                <td>{statusLabel}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </header>

      {/* Parties */}
      <section className="invoice-print__parties">
        <div className="invoice-print__party">
          <h3 className="invoice-print__party-title">فروشنده</h3>
          <div className="invoice-print__party-body">
            <div className="invoice-print__party-name">
              {company?.name ?? '—'}
            </div>
            {company?.nationalId && (
              <div>شناسه ملی: {toPersianNumber(company.nationalId)}</div>
            )}
            {company?.economicCode && (
              <div>کد اقتصادی: {toPersianNumber(company.economicCode)}</div>
            )}
            {company?.address && <div>{company.address}</div>}
          </div>
        </div>
        <div className="invoice-print__party">
          <h3 className="invoice-print__party-title">خریدار</h3>
          <div className="invoice-print__party-body">
            <div className="invoice-print__party-name">
              {contact?.name ?? '—'}
            </div>
            {contact?.phone && (
              <div>تلفن: {toPersianNumber(contact.phone)}</div>
            )}
            {contact?.email && <div>ایمیل: {contact.email}</div>}
            {contact?.address && <div>{contact.address}</div>}
            {contact?.taxId && (
              <div>شناسه مالیاتی: {toPersianNumber(contact.taxId)}</div>
            )}
          </div>
        </div>
      </section>

      {/* Lines */}
      <section className="invoice-print__lines">
        <table className="invoice-print__table">
          <thead>
            <tr>
              <th style={{ width: '4%' }}>ردیف</th>
              <th>شرح</th>
              {!isThermal && <th style={{ width: '8%' }}>تعداد</th>}
              {!isThermal && <th style={{ width: '14%' }}>قیمت واحد</th>}
              {isThermal && <th style={{ width: '12%' }}>تعداد × قیمت</th>}
              {!isThermal && <th style={{ width: '12%' }}>مالیات</th>}
              <th style={{ width: isThermal ? '20%' : '16%' }}>مبلغ</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => {
              const qty = Number(line.quantity) || 0;
              const unit = Number(line.unitPrice) || 0;
              const tax = Number(line.tax) || 0;
              const total = Number(line.total) || 0;
              return (
                <tr key={line.id ?? idx}>
                  <td>{toPersianNumber(idx + 1)}</td>
                  <td className="invoice-print__cell-text">
                    {line.description || '—'}
                  </td>
                  {!isThermal && (
                    <td>{toPersianNumber(formatNumber(qty, 2))}</td>
                  )}
                  {!isThermal && (
                    <td>{toPersianNumber(formatNumber(unit))}</td>
                  )}
                  {isThermal && (
                    <td>
                      {toPersianNumber(formatNumber(qty, 2))} ×{' '}
                      {toPersianNumber(formatNumber(unit))}
                    </td>
                  )}
                  {!isThermal && (
                    <td>{toPersianNumber(formatNumber(tax))}</td>
                  )}
                  <td>{toPersianNumber(formatNumber(total))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* Totals */}
      <section className="invoice-print__totals">
        <table>
          <tbody>
            <tr>
              <th>جمع جزء</th>
              <td>{toPersianNumber(formatNumber(invoice.subtotal))} ریال</td>
            </tr>
            {invoice.discount > 0 && (
              <tr>
                <th>تخفیف</th>
                <td>
                  − {toPersianNumber(formatNumber(invoice.discount))} ریال
                </td>
              </tr>
            )}
            <tr>
              <th>مالیات بر ارزش افزوده</th>
              <td>{toPersianNumber(formatNumber(invoice.tax))} ریال</td>
            </tr>
            <tr className="invoice-print__grand-total">
              <th>مبلغ قابل پرداخت</th>
              <td>
                {toPersianNumber(formatNumber(invoice.total))} ریال
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Notes / Description */}
      {invoice.description && (
        <section className="invoice-print__notes">
          <h3 className="invoice-print__notes-title">توضیحات</h3>
          <p>{invoice.description}</p>
        </section>
      )}

      {/* Signatures */}
      <footer className="invoice-print__signatures">
        <div className="invoice-print__signature">
          <div className="invoice-print__signature-line" />
          <div className="invoice-print__signature-label">مهر و امضای فروشنده</div>
        </div>
        <div className="invoice-print__signature">
          <div className="invoice-print__signature-line" />
          <div className="invoice-print__signature-label">مهر و امضای خریدار</div>
        </div>
      </footer>

      <div className="invoice-print__footer-note">
        این فاکتور توسط نرم‌افزار حساب‌یار صادر شده است.
      </div>
    </div>
  );
}