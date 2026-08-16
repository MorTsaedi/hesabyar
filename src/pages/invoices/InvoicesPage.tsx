import { useState, useEffect } from 'react';
import type { Invoice, Contact } from '../../types/database';
import { tauriInvoke } from '../../lib/tauri';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { fromPersianNumber, formatNumber } from '../../lib/persian-number';
import { exportToExcel, prepareExportData } from '../../lib/export';
import { Search, Edit, Trash2, FilePlus, X, Printer, Plus, Send, DollarSign, Clock, AlertTriangle, Table2 } from 'lucide-react';
import { JalaliDatePicker } from '../../components/ui/JalaliDatePicker';
import { PrintPreviewModal } from '../../components/invoices/PrintPreviewModal';
import { SendToMoadianModal } from '../../components/invoices/SendToMoadianModal';

interface InvoiceLineState {
  productId: string | number;
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
}

interface PaymentFormState {
  show: boolean;
  invoiceId: number | null;
  paymentDate: string;
  paymentAmount: string;
}

function parseNum(v: string): number {
  if (!v) return 0;
  const n = parseFloat(fromPersianNumber(v));
  return isNaN(n) ? 0 : n;
}

export function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [printingInvoiceId, setPrintingInvoiceId] = useState<number | null>(null);
  const [moadianInvoiceId, setMoadianInvoiceId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Invoice | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>({
    show: false,
    invoiceId: null,
    paymentDate: '',
    paymentAmount: '',
  });

  const emptyLine = (): InvoiceLineState => ({
    productId: '',
    description: '',
    quantity: '',
    unitPrice: '',
    taxRate: '',
  });

  const [formData, setFormData] = useState({
    contactId: '' as string | number,
    date: '',
    dueDate: '',
    invoiceType: 'sale' as 'sale' | 'purchase' | 'sale_return' | 'purchase_return' | 'proforma',
    status: 'draft' as 'draft' | 'confirmed' | 'cancelled',
    lines: [emptyLine()],
    notes: '',
  });

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch contacts
      const contactsResult: Contact[] = await tauriInvoke('get_contacts');
      setContacts(contactsResult);

      // Fetch invoices
      if (searchQuery.trim()) {
        const invoicesResult: Invoice[] = await tauriInvoke('search_invoices', { query: searchQuery });
        setInvoices(invoicesResult);
      } else {
        const invoicesResult: Invoice[] = await tauriInvoke('get_invoices');
        setInvoices(invoicesResult);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [searchQuery]);

  const handleCreateOrUpdate = async () => {
    try {
      const lines = formData.lines.map(line => ({
        product_id: line.productId ? Number(line.productId) : null,
        description: line.description,
        quantity: parseNum(line.quantity),
        unit_price: parseNum(line.unitPrice),
        tax_rate: parseNum(line.taxRate),
      }));

      if (editingInvoice) {
        await tauriInvoke('update_invoice', {
          id: editingInvoice.id,
          contact_id: formData.contactId === '' ? null : Number(formData.contactId),
          date: formData.date,
          due_date: formData.dueDate || null,
          status: formData.status,
          lines,
          notes: formData.notes || null,
        });
      } else {
        await tauriInvoke('create_invoice', {
          contact_id: formData.contactId === '' ? null : Number(formData.contactId),
          date: formData.date,
          due_date: formData.dueDate || null,
          invoice_type: formData.invoiceType,
          lines,
          notes: formData.notes || null,
        });
      }
      resetForm();
      await fetchData();
    } catch (error) {
      console.error('Failed to save invoice:', error);
      alert('خطا در ذخیره فاکتور: ' + error);
    }
  };

  const handleDelete = (invoice: Invoice) => {
    setDeleteConfirm(invoice);
    setDeleteError('');
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    try {
      await tauriInvoke('delete_invoice', { id: deleteConfirm.id });
      setDeleteConfirm(null);
      await fetchData();
      alert('فاکتور با موفقیت حذف شد.');
    } catch (error) {
      console.error('Delete invoice error:', error);
      setDeleteError(String(error));
    }
  };

  const handleRecordPayment = async () => {
    if (!paymentForm.invoiceId) return;
    try {
      await tauriInvoke('record_invoice_payment', {
        invoiceId: paymentForm.invoiceId,
        paymentDate: paymentForm.paymentDate,
        paymentAmount: parseNum(paymentForm.paymentAmount),
      });
      setPaymentForm({ show: false, invoiceId: null, paymentDate: '', paymentAmount: '' });
      await fetchData();
    } catch (error) {
      alert('خطا در ثبت پرداخت: ' + error);
    }
  };

  const resetForm = () => {
    setFormData({
      contactId: '',
      date: '',
      dueDate: '',
      invoiceType: 'sale',
      status: 'draft',
      lines: [emptyLine()],
      notes: '',
    });
    setEditingInvoice(null);
    setShowForm(false);
  };

  const handleEdit = async (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setFormData({
      contactId: invoice.contactId || '',
      date: invoice.date,
      dueDate: '',
      invoiceType: (invoice.type as 'sale' | 'purchase' | 'sale_return' | 'purchase_return' | 'proforma') || 'sale',
      status: (invoice.status as 'draft' | 'confirmed' | 'cancelled') || 'draft',
      lines: [
        { productId: '', description: 'مورد نمونه', quantity: '', unitPrice: invoice.total.toString(), taxRate: '' }
      ],
      notes: invoice.description || '',
    });
    setShowForm(true);
  };

  const addLine = () => {
    setFormData({
      ...formData,
      lines: [...formData.lines, emptyLine()],
    });
  };

  const removeLine = (index: number) => {
    if (formData.lines.length > 1) {
      const newLines = formData.lines.filter((_, i) => i !== index);
      setFormData({ ...formData, lines: newLines });
    }
  };

  const updateLine = (index: number, field: string, value: string | number) => {
    const newLines = formData.lines.map((line, i) => {
      if (i === index) {
        return { ...line, [field]: value };
      }
      return line;
    });
    setFormData({ ...formData, lines: newLines });
  };

  const getInvoiceTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      sale: 'فروش',
      purchase: 'خرید',
      sale_return: 'برگشت از فروش',
      purchase_return: 'برگشت از خرید',
      proforma: 'پیش‌فاکتور',
    };
    return labels[type] || type;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: 'پیشنویس',
      confirmed: 'تایید شده',
      cancelled: 'لغو شده',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-slate-100 text-slate-600',
      confirmed: 'bg-blue-100 text-blue-700',
      cancelled: 'bg-rose-100 text-rose-700',
    };
    return colors[status] || 'bg-slate-100 text-slate-600';
  };

  const getMoadianStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      not_sent: 'ارسال نشده',
      pending: 'در انتظار',
      sent: 'ارسال شده',
      confirmed: 'تایید شده',
      failed: 'ناموفق',
    };
    return labels[status] || status;
  };

  const getMoadianStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      not_sent: 'bg-slate-100 text-slate-500',
      pending: 'bg-amber-100 text-amber-700',
      sent: 'bg-blue-100 text-blue-700',
      confirmed: 'bg-emerald-100 text-emerald-700',
      failed: 'bg-rose-100 text-rose-700',
    };
    return colors[status] || 'bg-slate-100 text-slate-500';
  };

  const getBalance = (invoice: Invoice): number => {
    return invoice.total - (invoice.paidAmount || 0);
  };

  const isOverdue = (invoice: Invoice): boolean => {
    if (!invoice.dueDate || invoice.status !== 'confirmed') return false;
    return getBalance(invoice) > 0 && invoice.dueDate < new Date().toISOString().split('T')[0];
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center shadow-brand">
            <FilePlus className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">مدیریت فاکتورها</h1>
            <p className="text-[12px] text-slate-400">فاکتورهای فروش، خرید و پیش‌فاکتور</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const data = prepareExportData(
                [
                  { key: 'number', label: 'شماره' },
                  { key: 'type', label: 'نوع' },
                  { key: 'contact_name', label: 'طرف حساب' },
                  { key: 'date', label: 'تاریخ' },
                  { key: 'due_date', label: 'سررسید' },
                  { key: 'total', label: 'مبلغ' },
                  { key: 'status', label: 'وضعیت' },
                ],
                invoices as unknown as Record<string, unknown>[]
              );
              exportToExcel(data, 'invoices', 'لیست فاکتورها');
            }}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
            title="خروجی Excel"
          >
            <Table2 className="w-3.5 h-3.5" />
            Excel
          </button>
          <Button onClick={() => {
          setEditingInvoice(null);
          setFormData({
            contactId: '',
            date: '',
            dueDate: '',
            invoiceType: 'sale',
            status: 'draft',
            lines: [emptyLine()],
            notes: '',
          });
          setShowForm(true);
        }} className="flex items-center gap-2">
          <FilePlus className="w-4 h-4" />
          فاکتور جدید
        </Button>
      </div>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Input
            type="text"
            placeholder="جستجو در فاکتورها..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
        </div>
      </div>

      {showForm && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800">
              {editingInvoice ? 'ویرایش فاکتور' : 'فاکتور جدید'}
            </h3>
            <button onClick={resetForm} className="text-slate-400 hover:text-slate-600 p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">مخاطب</label>
              <select
                value={formData.contactId}
                onChange={(e) => setFormData({ ...formData, contactId: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">بدون مخاطب</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <JalaliDatePicker
                label="تاریخ"
                value={formData.date}
                onChange={(val) => setFormData({ ...formData, date: val })}
                required
              />
            </div>
            <div>
              <JalaliDatePicker
                label="سررسید"
                value={formData.dueDate}
                onChange={(val) => setFormData({ ...formData, dueDate: val })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">نوع فاکتور</label>
              <select
                value={formData.invoiceType}
                onChange={(e) => setFormData({ ...formData, invoiceType: e.target.value as typeof formData.invoiceType })}
                className="w-full p-2 border border-slate-200 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="sale">فروش</option>
                <option value="purchase">خرید</option>
                <option value="sale_return">برگشت از فروش</option>
                <option value="purchase_return">برگشت از خرید</option>
                <option value="proforma">پیش‌فاکتور</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">وضعیت</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as typeof formData.status })}
                className="w-full p-2 border border-slate-200 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="draft">پیشنویس</option>
                <option value="confirmed">تایید شده</option>
                <option value="cancelled">لغو شده</option>
              </select>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-600">اقلام فاکتور</label>
              <Button onClick={addLine} size="sm" variant="secondary" className="flex items-center gap-1">
                <Plus className="w-4 h-4" />
                اضافه کردن قلم
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-slate-200 rounded-md">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-2 text-right font-semibold text-slate-700">توضیحات</th>
                    <th className="p-2 text-right font-semibold text-slate-700">تعداد</th>
                    <th className="p-2 text-right font-semibold text-slate-700">قیمت واحد</th>
                    <th className="p-2 text-right font-semibold text-slate-700">مالیات (%)</th>
                    <th className="p-2 text-right font-semibold text-slate-700">جمع</th>
                    <th className="p-2 text-center font-semibold text-slate-700">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.lines.map((line, index) => {
                    const quantityNum = parseNum(line.quantity);
                    const unitPriceNum = parseNum(line.unitPrice);
                    const taxRateNum = parseNum(line.taxRate);
                    const subtotal = quantityNum * unitPriceNum;
                    const tax = subtotal * (taxRateNum / 100);
                    const total = subtotal + tax;

                    return (
                      <tr key={index} className="border-t border-slate-100">
                        <td className="p-2">
                          <Input
                            value={line.description}
                            onChange={(e) => updateLine(index, 'description', e.target.value)}
                            placeholder="توضیحات قلم"
                            className="text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={line.quantity}
                            onChange={(e) => updateLine(index, 'quantity', e.target.value)}
                            placeholder="تعداد"
                            className="text-xs w-16"
                            persianNumbers={true}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={line.unitPrice}
                            onChange={(e) => updateLine(index, 'unitPrice', e.target.value)}
                            placeholder="قیمت واحد"
                            className="text-xs w-24"
                            persianNumbers={true}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={line.taxRate}
                            onChange={(e) => updateLine(index, 'taxRate', e.target.value)}
                            placeholder="مالیات %"
                            className="text-xs w-16"
                            persianNumbers={true}
                          />
                        </td>
                        <td className="p-2 font-medium">{total.toLocaleString('fa-IR')}</td>
                        <td className="p-2 text-center">
                          <button
                            onClick={() => removeLine(index)}
                            className="text-rose-500 hover:text-rose-700 p-1"
                            title="حذف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-600 mb-1">یادداشتها</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="یادداشتهای اضافی"
              className="w-full p-2 border border-slate-200 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows={3}
            />
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleCreateOrUpdate} className="flex items-center gap-2">
              {editingInvoice ? 'ذخیره تغییرات' : 'افزودن فاکتور'}
            </Button>
            <Button onClick={resetForm} variant="secondary">
              لغو
            </Button>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-slate-500">
            <p>در حال بارگذاری...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-6 text-center text-slate-500">
            <p>فاکتوری یافت نشد</p>
            <p className="text-sm mt-2">از دکمه "فاکتور جدید" برای افزودن اولین فاکتور استفاده کنید</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="p-3 text-right font-semibold text-slate-700">شماره</th>
                  <th className="p-3 text-right font-semibold text-slate-700">مخاطب</th>
                  <th className="p-3 text-right font-semibold text-slate-700">تاریخ</th>
                  <th className="p-3 text-right font-semibold text-slate-700">سررسید</th>
                  <th className="p-3 text-right font-semibold text-slate-700">نوع</th>
                  <th className="p-3 text-right font-semibold text-slate-700">مبلغ</th>
                  <th className="p-3 text-right font-semibold text-slate-700">پرداخت شده</th>
                  <th className="p-3 text-right font-semibold text-slate-700">مانده</th>
                  <th className="p-3 text-right font-semibold text-slate-700">وضعیت</th>
                  <th className="p-3 text-center font-semibold text-slate-700">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => {
                  const contact = contacts.find(c => c.id === invoice.contactId);
                  const balance = getBalance(invoice);
                  const overdue = isOverdue(invoice);
                  return (
                    <tr
                      key={invoice.id}
                      className={`border-b border-slate-100 hover:bg-slate-50 ${overdue ? 'bg-rose-50' : ''}`}
                    >
                      <td className="p-3 font-medium text-slate-800">{invoice.number}</td>
                      <td className="p-3 text-slate-600">{contact ? contact.name : '-'}</td>
                      <td className="p-3 text-slate-600">{invoice.date}</td>
                      <td className="p-3">
                        {invoice.dueDate ? (
                          <span className={`${overdue ? 'text-rose-600 font-bold' : 'text-slate-600'}`}>
                            {invoice.dueDate}
                            {overdue && <Clock className="w-3 h-3 inline-block mr-1" />}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="p-3 text-slate-600">{getInvoiceTypeLabel(invoice.type)}</td>
                      <td className="p-3 font-medium text-slate-800 ltr-force">{formatNumber(invoice.total)}</td>
                      <td className="p-3 text-emerald-600 ltr-force">
                        {(invoice.paidAmount || 0) > 0 ? formatNumber(invoice.paidAmount || 0) : '-'}
                      </td>
                      <td className="p-3 font-bold ltr-force">
                        <span className={balance > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                          {formatNumber(balance)}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                            {getStatusLabel(invoice.status)}
                          </span>
                          {invoice.moadianStatus && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getMoadianStatusColor(invoice.moadianStatus)}`}>
                              {getMoadianStatusLabel(invoice.moadianStatus)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleEdit(invoice)}
                            className="text-primary-600 hover:text-primary-800 p-1"
                            title="ویرایش"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(invoice)}
                            className="text-rose-500 hover:text-rose-700 p-1"
                            title="حذف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setPrintingInvoiceId(invoice.id)}
                            className="text-slate-500 hover:text-slate-700 p-1"
                            title="چاپ"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setPaymentForm({
                                show: true,
                                invoiceId: invoice.id,
                                paymentDate: '',
                                paymentAmount: String(balance),
                              });
                            }}
                            className="text-emerald-600 hover:text-emerald-800 p-1"
                            title="ثبت پرداخت"
                            disabled={balance <= 0}
                          >
                            <DollarSign className="w-4 h-4" />
                          </button>
                          {invoice.type === 'sale' && (
                            <button
                              onClick={() => setMoadianInvoiceId(invoice.id)}
                              className="text-emerald-600 hover:text-emerald-800 p-1"
                              title="ارسال به سامانه مودیان"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Recording Modal */}
      {paymentForm.show && paymentForm.invoiceId && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setPaymentForm({ ...paymentForm, show: false })}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                ثبت پرداخت
              </h3>
              <button onClick={() => setPaymentForm({ ...paymentForm, show: false })} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <JalaliDatePicker
                label="تاریخ پرداخت"
                value={paymentForm.paymentDate}
                onChange={(val) => setPaymentForm({ ...paymentForm, paymentDate: val })}
                required
              />
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">مبلغ پرداخت</label>
                <Input
                  type="text"
                  value={paymentForm.paymentAmount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentAmount: e.target.value })}
                  persianNumbers
                />
              </div>
              <div className="flex gap-3">
                <Button onClick={handleRecordPayment} className="flex-1">
                  ثبت پرداخت
                </Button>
                <Button onClick={() => setPaymentForm({ ...paymentForm, show: false })} variant="secondary" className="flex-1">
                  انصراف
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {printingInvoiceId !== null && (
        <PrintPreviewModal
          invoiceId={printingInvoiceId}
          initialInvoice={
            invoices.find((i) => i.id === printingInvoiceId) ?? null
          }
          contact={
            (() => {
              const inv = invoices.find(
                (i) => i.id === printingInvoiceId,
              );
              return inv?.contactId
                ? contacts.find((c) => c.id === inv.contactId) ?? null
                : null;
            })()
          }
          onClose={() => setPrintingInvoiceId(null)}
        />
      )}

      {moadianInvoiceId !== null && (
        <SendToMoadianModal
          invoiceId={moadianInvoiceId}
          invoiceNumber={
            invoices.find((i) => i.id === moadianInvoiceId)?.number ?? ''
          }
          onClose={() => setMoadianInvoiceId(null)}
          onSuccess={() => fetchData()}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 p-2 rounded-full">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">حذف فاکتور</h3>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              آیا از حذف فاکتور شماره <strong>{deleteConfirm.number}</strong> اطمینان دارید؟
            </p>
            {deleteError && (
              <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4">
                {deleteError}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
              >
                بله، حذف شود
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 border border-slate-300 text-slate-700 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
