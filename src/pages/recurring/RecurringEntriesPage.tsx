import { useState, useEffect, useCallback } from 'react';
import { tauriInvoke } from '../../lib/tauri';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Plus, Edit, Trash2, RefreshCw, X, AlertTriangle } from 'lucide-react';
import { JalaliDatePicker } from '../../components/ui/JalaliDatePicker';

interface RecurringEntry {
  id: number;
  name: string;
  description?: string;
  accountId: number;
  accountCode: string;
  accountName: string;
  amount: number;
  type: 'debit' | 'credit';
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  dayOfMonth: number | null;
  dayOfWeek: number | null;
  month: number | null;
  startDate: string;
  endDate: string | null;
  nextGenerationDate: string;
  isActive: boolean;
  createdAt?: string;
}

interface Account {
  id: number;
  code: string;
  name: string;
  type: string;
}

const frequencyLabels: Record<string, string> = {
  daily: 'روزانه',
  weekly: 'هفتگی',
  monthly: 'ماهانه',
  quarterly: 'فصلی',
  yearly: 'سالانه',
};

export function RecurringEntriesPage() {
  const [entries, setEntries] = useState<RecurringEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<RecurringEntry | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    accountId: '',
    amount: '',
    type: 'debit' as 'debit' | 'credit',
    frequency: 'monthly' as 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly',
    dayOfMonth: '',
    dayOfWeek: 6 as number | null,
    startDate: '',
    endDate: '',
    isActive: true,
  });
  const [generateLoading, setGenerateLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<RecurringEntry | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [entriesResult, accountsResult] = await Promise.all([
        tauriInvoke<RecurringEntry[]>('get_recurring_entries', { companyId: 1 }),
        tauriInvoke<Account[]>('get_accounts', {}),
      ]);
      setEntries(entriesResult);
      setAccounts(accountsResult);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    try {
      const data = {
        companyId: 1,
        name: formData.name,
        description: formData.description || null,
        accountId: parseInt(formData.accountId),
        amount: parseFloat(formData.amount) || 0,
        type: formData.type,
        frequency: formData.frequency,
        dayOfMonth: formData.dayOfMonth ? parseInt(formData.dayOfMonth) : null,
        dayOfWeek: formData.dayOfWeek,
        month: null,
        startDate: formData.startDate,
        endDate: formData.endDate || null,
      };

      if (editingEntry) {
        await tauriInvoke('update_recurring_entry', { id: editingEntry.id, ...data, isActive: formData.isActive });
      } else {
        await tauriInvoke('create_recurring_entry', data);
      }
      resetForm();
      await loadData();
    } catch (err) {
      console.error('Failed to save:', err);
      alert('خطا در ذخیره: ' + err);
    }
  };

  const handleDelete = (entry: RecurringEntry) => {
    setDeleteConfirm(entry);
    setDeleteError('');
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    try {
      await tauriInvoke('delete_recurring_entry', { id: deleteConfirm.id });
      setDeleteConfirm(null);
      await loadData();
      alert('قالب با موفقیت حذف شد.');
    } catch (err) {
      console.error('Delete recurring error:', err);
      setDeleteError(String(err));
    }
  };

  const handleGenerate = async () => {
    setGenerateLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const result = await tauriInvoke('generate_entries_from_recurring', { companyId: 1, targetDate: today });
      alert(`تعداد ${result} سند تولید شد`);
      await loadData();
    } catch (err) {
      console.error('Failed to generate:', err);
      alert('خطا در تولید اسناد: ' + err);
    } finally {
      setGenerateLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      accountId: '',
      amount: '',
      type: 'debit',
      frequency: 'monthly',
      dayOfMonth: '',
      dayOfWeek: 6,
      startDate: '',
      endDate: '',
      isActive: true,
    });
    setEditingEntry(null);
    setShowForm(false);
  };

  const handleEdit = (entry: RecurringEntry) => {
    setEditingEntry(entry);
    setFormData({
      name: entry.name,
      description: entry.description ?? '',
      accountId: entry.accountId.toString(),
      amount: entry.amount.toString(),
      type: entry.type,
      frequency: entry.frequency,
      dayOfMonth: entry.dayOfMonth?.toString() || '',
      dayOfWeek: entry.dayOfWeek,
      startDate: entry.startDate,
      endDate: entry.endDate || '',
      isActive: entry.isActive,
    });
    setShowForm(true);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center shadow-brand">
            <RefreshCw className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">قالب‌های تکرارشونده</h1>
            <p className="text-[12px] text-slate-400">ثبت اسناد خودکار دوره‌ای</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleGenerate} disabled={generateLoading} variant="secondary" className="flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${generateLoading ? 'animate-spin' : ''}`} />
            تولید اسناد
          </Button>
          <Button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            قالب جدید
          </Button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800">
              {editingEntry ? 'ویرایش قالب' : 'قالب جدید'}
            </h3>
            <button onClick={resetForm} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">نام قالب</label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="نام" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">حساب</label>
              <select value={formData.accountId} onChange={(e) => setFormData({ ...formData, accountId: e.target.value })} className="w-full p-2 border rounded-md">
                <option value="">انتخاب حساب</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">مبلغ (ریال)</label>
              <Input type="text" inputMode="numeric" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} placeholder="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">نوع</label>
              <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as 'debit' | 'credit' })} className="w-full p-2 border rounded-md">
                <option value="debit">بدهکار</option>
                <option value="credit">بستانکار</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">تناوب</label>
              <select value={formData.frequency} onChange={(e) => setFormData({ ...formData, frequency: e.target.value as typeof formData.frequency })} className="w-full p-2 border rounded-md">
                <option value="daily">روزانه</option>
                <option value="weekly">هفتگی</option>
                <option value="monthly">ماهانه</option>
                <option value="quarterly">فصلی</option>
                <option value="yearly">سالانه</option>
              </select>
            </div>
            <div>
              <JalaliDatePicker
                label="تاریخ شروع"
                value={formData.startDate}
                onChange={(val) => setFormData({ ...formData, startDate: val })}
                required
              />
            </div>
            <div>
              <JalaliDatePicker
                label="تاریخ پایان (اختیاری)"
                value={formData.endDate}
                onChange={(val) => setFormData({ ...formData, endDate: val })}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleSave}>{editingEntry ? 'ذخیره' : 'افزودن'}</Button>
            <Button onClick={resetForm} variant="secondary">لغو</Button>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-slate-500">در حال بارگذاری...</div>
        ) : entries.length === 0 ? (
          <div className="p-6 text-center text-slate-500">
            <p>قالبی یافت نشد</p>
            <p className="text-sm mt-2">از دکمه "قالب جدید" استفاده کنید</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-3 text-right">نام</th>
                <th className="p-3 text-right">حساب</th>
                <th className="p-3 text-right">مبلغ</th>
                <th className="p-3 text-right">تناوب</th>
                <th className="p-3 text-right">تاریخ بعدی</th>
                <th className="p-3 text-center">وضعیت</th>
                <th className="p-3 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="p-3 font-medium text-slate-800">{entry.name}</td>
                  <td className="p-3 text-slate-600">{entry.accountCode} - {entry.accountName}</td>
                  <td className="p-3 text-slate-600 ltr-force">{entry.amount.toLocaleString()}</td>
                  <td className="p-3 text-slate-600">{frequencyLabels[entry.frequency]}</td>
                  <td className="p-3 text-slate-600 ltr-force">{entry.nextGenerationDate}</td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs ${entry.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                      {entry.isActive ? 'فعال' : 'غیرفعال'}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => handleEdit(entry)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded" title="ویرایش">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(entry)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="حذف">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
              <h3 className="text-lg font-bold text-slate-900">حذف قالب تکرارشونده</h3>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              آیا از حذف قالب <strong>{deleteConfirm.name}</strong> اطمینان دارید؟
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