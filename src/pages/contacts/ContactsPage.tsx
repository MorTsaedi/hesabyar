import { useState, useEffect } from 'react';
import type { Contact } from '../../types/database';
import { tauriInvoke } from '../../lib/tauri';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { exportToExcel, prepareExportData } from '../../lib/export';
import { Search, Edit, Trash2, UserPlus, X, Settings2, DollarSign, AlertTriangle, Table2, Users } from 'lucide-react';

export function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [showFinancialSettings, setShowFinancialSettings] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Contact | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [formData, setFormData] = useState({
    type: 'customer' as 'customer' | 'supplier' | 'employee' | 'other',
    name: '',
    phone: '',
    email: '',
    address: '',
    taxId: '',
    notes: '',
    paymentTermDays: '30',
    creditLimit: '',
    earlyPaymentDiscountPct: '',
    earlyPaymentDiscountDays: '',
    latePaymentPenaltyPct: '',
  });

  const fetchContacts = async () => {
    try {
      setLoading(true);
      if (searchQuery.trim()) {
        const result: Contact[] = await tauriInvoke('search_contacts', { query: searchQuery });
        setContacts(result);
      } else {
        const result: Contact[] = await tauriInvoke('get_contacts');
        setContacts(result);
      }
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [searchQuery]);

  const handleCreateOrUpdate = async () => {
    try {
      const payload: Record<string, unknown> = {
        contact_type: formData.type,
        name: formData.name,
        phone: formData.phone || null,
        email: formData.email || null,
        address: formData.address || null,
        tax_id: formData.taxId || null,
        notes: formData.notes || null,
        payment_term_days: parseInt(formData.paymentTermDays) || 30,
        credit_limit: parseFloat(formData.creditLimit) || 0,
        early_payment_discount_pct: parseFloat(formData.earlyPaymentDiscountPct) || 0,
        early_payment_discount_days: parseInt(formData.earlyPaymentDiscountDays) || 0,
        late_payment_penalty_pct: parseFloat(formData.latePaymentPenaltyPct) || 0,
      };

      if (editingContact) {
        await tauriInvoke('update_contact', { id: editingContact.id, ...payload });
      } else {
        await tauriInvoke('create_contact', payload);
      }

      resetForm();
      await fetchContacts();
    } catch (error) {
      console.error('Failed to save contact:', error);
      alert('خطا در ذخیره مخاطب: ' + error);
    }
  };

  const handleDelete = (contact: Contact) => {
    setDeleteConfirm(contact);
    setDeleteError('');
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    try {
      await tauriInvoke('delete_contact', { id: deleteConfirm.id });
      setDeleteConfirm(null);
      await fetchContacts();
      alert('مخاطب با موفقیت حذف شد.');
    } catch (error) {
      console.error('Delete contact error:', error);
      setDeleteError(String(error));
    }
  };

  const resetForm = () => {
    setFormData({
      type: 'customer',
      name: '',
      phone: '',
      email: '',
      address: '',
      taxId: '',
      notes: '',
      paymentTermDays: '30',
      creditLimit: '',
      earlyPaymentDiscountPct: '',
      earlyPaymentDiscountDays: '',
      latePaymentPenaltyPct: '',
    });
    setEditingContact(null);
    setShowForm(false);
    setShowFinancialSettings(false);
  };

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setFormData({
      type: (contact.type as 'customer' | 'supplier' | 'employee' | 'other') || 'customer',
      name: contact.name,
      phone: contact.phone || '',
      email: contact.email || '',
      address: contact.address || '',
      taxId: contact.taxId || '',
      notes: contact.notes || '',
      paymentTermDays: contact.paymentTermDays?.toString() || '30',
      creditLimit: contact.creditLimit?.toString() || '',
      earlyPaymentDiscountPct: contact.earlyPaymentDiscountPct?.toString() || '',
      earlyPaymentDiscountDays: contact.earlyPaymentDiscountDays?.toString() || '',
      latePaymentPenaltyPct: contact.latePaymentPenaltyPct?.toString() || '',
    });
    setShowForm(true);
    setShowFinancialSettings(!!(contact.paymentTermDays || contact.creditLimit || contact.earlyPaymentDiscountPct));
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center shadow-brand">
            <Users className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">مدیریت مخاطبین</h1>
            <p className="text-[12px] text-slate-400">مشتریان، تأمین‌کنندگان و اشخاص</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const data = prepareExportData(
                [
                  { key: 'name', label: 'نام' },
                  { key: 'type', label: 'نوع' },
                  { key: 'phone', label: 'تلفن' },
                  { key: 'email', label: 'ایمیل' },
                  { key: 'tax_id', label: 'شماره اقتصادی' },
                  { key: 'credit_limit', label: 'سقف اعتباری' },
                  { key: 'payment_term_days', label: 'مدت پرداخت' },
                ],
                contacts as unknown as Record<string, unknown>[]
              );
              exportToExcel(data, 'contacts', 'لیست مخاطبین');
            }}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
            title="خروجی Excel"
          >
            <Table2 className="w-3.5 h-3.5" />
            Excel
          </button>
        </div>
        <Button onClick={() => {
          setEditingContact(null);
          setFormData({
            type: 'customer',
            name: '',
            phone: '',
            email: '',
            address: '',
            taxId: '',
            notes: '',
            paymentTermDays: '30',
            creditLimit: '',
            earlyPaymentDiscountPct: '',
            earlyPaymentDiscountDays: '',
            latePaymentPenaltyPct: '',
          });
          setShowForm(true);
        }} className="flex items-center gap-2">
          <UserPlus className="w-4 h-4" />
          مخاطب جدید
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Input
            type="text"
            placeholder="جستجو در مخاطبین..."
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
              {editingContact ? 'ویرایش مخاطب' : 'مخاطب جدید'}
            </h3>
            <button onClick={resetForm} className="text-slate-400 hover:text-slate-600 p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">نوع مخاطب</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as 'customer' | 'supplier' | 'employee' | 'other' })}
                className="w-full p-2 border border-slate-200 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
              >
                <option value="customer">مشتری</option>
                <option value="supplier">تأمین‌کننده</option>
                <option value="employee">کارمند</option>
                <option value="other">سایر</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">نام کامل</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="نام و نام خانوادگی یا نام شرکت"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">تلفن</label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="۰۹۱۲۳۴۵۶۷۸۹"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">ایمیل</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="example@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">شناسه مالیاتی</label>
              <Input
                value={formData.taxId}
                onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                placeholder="۱۲۳۴۵۶۷۸۹۰"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-600 mb-1">آدرس</label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="آدرس کامل"
              className="w-full p-2 border border-slate-200 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows={3}
            />
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

          {/* Financial Settings Toggle */}
          <button
            onClick={() => setShowFinancialSettings(!showFinancialSettings)}
            className="flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 mb-4"
          >
            <Settings2 className="w-4 h-4" />
            {showFinancialSettings ? 'پنهان کردن تنظیمات مالی' : 'تنظیمات مالی (شرایط پرداخت، تخفیف، جریمه)'}
          </button>

          {showFinancialSettings && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
              <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                شرایط پرداخت و تخفیفات
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">مدت پرداخت (روز)</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={formData.paymentTermDays}
                    onChange={(e) => setFormData({ ...formData, paymentTermDays: e.target.value })}
                    persianNumbers
                  />
                  <p className="text-xs text-slate-400 mt-1">پیش‌فرض: ۳۰ روز</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">سقف اعتبار</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={formData.creditLimit}
                    onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                    persianNumbers
                  />
                  <p className="text-xs text-slate-400 mt-1">۰ = بدون محدودیت</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">درصد تخفیف زودهنگام</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={formData.earlyPaymentDiscountPct}
                    onChange={(e) => setFormData({ ...formData, earlyPaymentDiscountPct: e.target.value })}
                    persianNumbers
                  />
                  <p className="text-xs text-slate-400 mt-1">مثلاً ۲ برای ۲٪</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">مهلت تخفیف (روز)</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={formData.earlyPaymentDiscountDays}
                    onChange={(e) => setFormData({ ...formData, earlyPaymentDiscountDays: e.target.value })}
                    persianNumbers
                  />
                  <p className="text-xs text-slate-400 mt-1">تعداد روز تا پایان تخفیف</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">درصد جریمه دیرکرد</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={formData.latePaymentPenaltyPct}
                    onChange={(e) => setFormData({ ...formData, latePaymentPenaltyPct: e.target.value })}
                    persianNumbers
                  />
                  <p className="text-xs text-slate-400 mt-1">مثلاً ۰.۵ برای ۰.۵٪ ماهانه</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button onClick={handleCreateOrUpdate} className="flex items-center gap-2">
              {editingContact ? 'ذخیره تغییرات' : 'افزودن مخاطب'}
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
        ) : contacts.length === 0 ? (
          <div className="p-6 text-center text-slate-500">
            <p>مخاطبی یافت نشد</p>
            <p className="text-sm mt-2">از دکمه "مخاطب جدید" برای افزودن اولین مخاطب استفاده کنید</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="p-3 text-right font-semibold text-slate-700">نام</th>
                  <th className="p-3 text-right font-semibold text-slate-700">تلفن</th>
                  <th className="p-3 text-right font-semibold text-slate-700">مدت پرداخت</th>
                  <th className="p-3 text-right font-semibold text-slate-700">سقف اعتبار</th>
                  <th className="p-3 text-right font-semibold text-slate-700">تخفیف</th>
                  <th className="p-3 text-right font-semibold text-slate-700">جریمه</th>
                  <th className="p-3 text-center font-semibold text-slate-700">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr key={contact.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-3 font-medium text-slate-800">
                      <div>{contact.name}</div>
                      <div className="text-xs text-slate-400">{contact.taxId || ''}</div>
                    </td>
                    <td className="p-3 text-slate-600">{contact.phone || '-'}</td>
                    <td className="p-3 text-slate-600">
                      {contact.paymentTermDays ? `${contact.paymentTermDays} روز` : '-'}
                    </td>
                    <td className="p-3 text-slate-600 ltr-force">
                      {contact.creditLimit ? contact.creditLimit.toLocaleString('fa-IR') : '-'}
                    </td>
                    <td className="p-3 text-slate-600">
                      {contact.earlyPaymentDiscountPct ? (
                        <span className="text-emerald-600">{contact.earlyPaymentDiscountPct}% / {contact.earlyPaymentDiscountDays}روز</span>
                      ) : '-'}
                    </td>
                    <td className="p-3 text-slate-600">
                      {contact.latePaymentPenaltyPct ? `${contact.latePaymentPenaltyPct}% ماهانه` : '-'}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(contact)}
                          className="text-primary-600 hover:text-primary-800 p-1"
                          title="ویرایش"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(contact)}
                          className="text-rose-500 hover:text-rose-700 p-1"
                          title="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 p-2 rounded-full">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">حذف مخاطب</h3>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              آیا از حذف مخاطب <strong>{deleteConfirm.name}</strong> اطمینان دارید؟
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
