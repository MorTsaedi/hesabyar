import React, { useState, useEffect } from 'react';
import type { Account } from '../../types/database';
import { tauriInvoke } from '../../lib/tauri';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editAccount?: Account | null;
  parentAccounts: Account[];
}

const ACCOUNT_TYPES = [
  { value: 'asset', label: 'دارایی' },
  { value: 'liability', label: 'بدهی' },
  { value: 'equity', label: 'سرمایه' },
  { value: 'revenue', label: 'درآمد' },
  { value: 'expense', label: 'هزینه' },
  { value: 'contra', label: 'تعدیلی' },
];

const CURRENCIES = [
  { value: 'IRR', label: 'ریال ایران' },
  { value: 'USD', label: 'دلار آمریکا' },
  { value: 'EUR', label: 'یورو' },
  { value: 'GBP', label: 'پوند انگلیس' },
  { value: 'TRY', label: 'لیر ترکیه' },
  { value: 'AED', label: 'درهم امارات' },
  { value: 'CNY', label: 'یوان چین' },
  { value: 'JPY', label: 'ین ژاپن' },
];

export function AccountFormModal({ isOpen, onClose, onSuccess, editAccount, parentAccounts }: Props) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('asset');
  const [parentId, setParentId] = useState<string>('');
  const [level, setLevel] = useState(1);
  const [isActive, setIsActive] = useState(true);
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('IRR');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isEdit = !!editAccount;

  useEffect(() => {
    if (isOpen && editAccount) {
      setCode(editAccount.code);
      setName(editAccount.name);
      setType(editAccount.type);
      setParentId(editAccount.parentId?.toString() ?? '');
      setLevel(editAccount.level);
      setIsActive(editAccount.isActive);
      setDescription(editAccount.description ?? '');
      setCurrency(editAccount.currency || 'IRR');
      setError('');
    } else if (isOpen) {
      setCode('');
      setName('');
      setType('asset');
      setParentId('');
      setLevel(1);
      setIsActive(true);
      setDescription('');
      setCurrency('IRR');
      setError('');
    }
  }, [isOpen, editAccount]);

  // Auto-calculate level when parent changes
  useEffect(() => {
    if (parentId) {
      const parent = parentAccounts.find((a) => a.id.toString() === parentId);
      if (parent) {
        setLevel(parent.level + 1);
      }
    } else {
      setLevel(1);
    }
  }, [parentId, parentAccounts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!code.trim() || !name.trim()) {
        setError('کد و نام حساب الزامی است');
        setLoading(false);
        return;
      }

      if (isEdit && editAccount) {
        await tauriInvoke('update_account', {
          id: editAccount.id,
          code,
          name,
          isActive,
          description,
          currency,
        });
      } else {
        await tauriInvoke('create_account', {
          company_id: 1,
          code,
          name,
          parent_id: parentId ? parseInt(parentId) : null,
          level,
          account_type: type,
          currency: currency !== 'IRR' ? currency : null,
        });
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">
            {isEdit ? 'ویرایش حساب' : 'حساب جدید'}
          </h2>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isEdit && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">والد حساب</label>
                  <select
                    value={parentId}
                    onChange={(e) => setParentId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  >
                    <option value="">بدون والد (سطح ۱)</option>
                    {parentAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">نوع حساب</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  >
                    {ACCOUNT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">کد حساب</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none ltr-force"
                placeholder="مثلاً ۱۱۰۱"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">نام حساب</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                placeholder="مثلاً موجودی نقد"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ارز</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">پیش‌فرض: ریال ایران. برای حساب‌های ارزی ارز مورد نظر را انتخاب کنید.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">توضیحات</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="isActive" className="text-sm text-slate-700">فعال</label>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-primary-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'در حال ذخیره...' : isEdit ? 'بروزرسانی' : 'ایجاد'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 border border-slate-300 text-slate-700 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                انصراف
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
