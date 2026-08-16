import React, { useState, useEffect, useMemo } from 'react';
import type { Account } from '../../types/database';
import { JalaliDatePicker } from '../ui/JalaliDatePicker';
import { tauriInvoke } from '../../lib/tauri';
import { formatNumber, parsePersianNumber } from '../../lib/persian-number';
import { Trash2, Plus } from 'lucide-react';

interface JournalLine {
  id: number;
  account_id: number;
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  description: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editEntryId?: number | null;
}

let lineIdCounter = 1;

export function JournalEntryForm({ isOpen, onClose, onSuccess, editEntryId }: Props) {
  const [date, setDate] = useState('1404/01/01');
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [lines, setLines] = useState<JournalLine[]>([
    { id: lineIdCounter++, account_id: 0, account_code: '', account_name: '', debit: 0, credit: 0, description: '' },
    { id: lineIdCounter++, account_id: 0, account_code: '', account_name: '', debit: 0, credit: 0, description: '' },
  ]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isEdit, setIsEdit] = useState(false);

  // Load accounts
  useEffect(() => {
    if (!isOpen) return;
    tauriInvoke<Record<string, unknown>[]>('get_accounts').then((data) => {
      const mapped: Account[] = data.map((a) => ({
        id: a.id as number,
        companyId: a.companyId as number,
        code: a.code as string,
        name: a.name as string,
        parentId: (a.parentId as number | null) ?? null,
        level: a.level as number,
        type: a.type as Account['type'],
        isActive: a.isActive as boolean,
        description: (a.description as string) ?? '',
        createdAt: a.createdAt as string,
        balance: 0,
      }));
      setAccounts(mapped);
    }).catch(console.error);
  }, [isOpen]);

  // Load edit data
  useEffect(() => {
    if (!isOpen || !editEntryId) {
      setIsEdit(false);
      setDate('1404/01/01');
      setDescription('');
      setReference('');
      setLines([
        { id: lineIdCounter++, account_id: 0, account_code: '', account_name: '', debit: 0, credit: 0, description: '' },
        { id: lineIdCounter++, account_id: 0, account_code: '', account_name: '', debit: 0, credit: 0, description: '' },
      ]);
      return;
    }

    setIsEdit(true);
    setLoading(true);
    tauriInvoke<Record<string, unknown>>('get_journal_entry', { id: editEntryId })
      .then((entry) => {
        setDate(entry.date as string);
        setDescription(entry.description as string);
        setReference((entry.reference as string) ?? '');
        const entryLines = (entry.lines as Record<string, unknown>[]) || [];
        setLines(entryLines.map((l) => ({
          id: lineIdCounter++,
          account_id: l.accountId as number,
          account_code: (l.accountCode as string) ?? '',
          account_name: (l.accountName as string) ?? '',
          debit: l.debit as number,
          credit: l.credit as number,
          description: (l.description as string) ?? '',
        })));
      })
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [isOpen, editEntryId]);

  const totals = useMemo(() => {
    const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
    return { totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 };
  }, [lines]);

  const handleAddLine = () => {
    setLines([...lines, { id: lineIdCounter++, account_id: 0, account_code: '', account_name: '', debit: 0, credit: 0, description: '' }]);
  };

  const handleRemoveLine = (id: number) => {
    if (lines.length <= 2) {
      setError('حداقل ۲ سطر الزامی است');
      return;
    }
    setLines(lines.filter((l) => l.id !== id));
    setError('');
  };

  const handleAccountChange = (lineId: number, accountId: number) => {
    const account = accounts.find((a) => a.id === accountId);
    setLines(lines.map((l) =>
      l.id === lineId
        ? { ...l, account_id: accountId, account_code: account?.code ?? '', account_name: account?.name ?? '' }
        : l
    ));
  };

  const handleAmountChange = (lineId: number, field: 'debit' | 'credit', value: string) => {
    const num = parsePersianNumber(value) || 0;
    setLines(lines.map((l) => {
      if (l.id !== lineId) return l;
      if (field === 'debit') {
        return { ...l, debit: num, credit: num > 0 ? 0 : l.credit };
      } else {
        return { ...l, credit: num, debit: num > 0 ? 0 : l.debit };
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!description.trim()) {
      setError('شرح سند الزامی است');
      return;
    }

    const validLines = lines.filter((l) => l.account_id > 0 && (l.debit > 0 || l.credit > 0));
    if (validLines.length < 2) {
      setError('حداقل ۲ سطر با مقدار بدهکار/بستانکار الزامی است');
      return;
    }

    if (!totals.balanced) {
      setError(`عدم تراز: بدهکار ${formatNumber(totals.totalDebit)} ≠ بستانکار ${formatNumber(totals.totalCredit)}`);
      return;
    }

    setLoading(true);
    try {
      const payloadLines = validLines.map((l) => ({
        account_id: l.account_id,
        debit: l.debit,
        credit: l.credit,
        description: l.description,
      }));

      if (isEdit && editEntryId) {
        await tauriInvoke('update_journal_entry', {
          id: editEntryId,
          date,
          description,
          reference,
          lines: payloadLines,
        });
      } else {
        await tauriInvoke('create_journal_entry', {
          date,
          description,
          reference,
          lines: payloadLines,
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">
            {isEdit ? 'ویرایش سند حسابداری' : 'سند حسابداری جدید'}
          </h2>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Header fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <JalaliDatePicker
                label="تاریخ"
                value={date}
                onChange={setDate}
                required
              />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">شماره مرجع</label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="مثلاً فاکتور ۱۲۳"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">شرح سند</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="شرح کلی سند"
                  required
                />
              </div>
            </div>

            {/* Lines table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">حساب</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 w-28">بدهکار (ریال)</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 w-28">بستانکار (ریال)</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">شرح سطر</th>
                    <th className="px-2 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        <select
                          value={line.account_id || ''}
                          onChange={(e) => handleAccountChange(line.id, parseInt(e.target.value) || 0)}
                          className="w-full border border-slate-300 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary-500"
                        >
                          <option value="">انتخاب حساب...</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code} - {a.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={line.debit > 0 ? formatNumber(line.debit) : ''}
                          onChange={(e) => handleAmountChange(line.id, 'debit', e.target.value)}
                          className="w-full border border-slate-300 rounded px-2 py-1 text-xs ltr-force text-left outline-none focus:ring-1 focus:ring-primary-500"
                          placeholder="۰"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={line.credit > 0 ? formatNumber(line.credit) : ''}
                          onChange={(e) => handleAmountChange(line.id, 'credit', e.target.value)}
                          className="w-full border border-slate-300 rounded px-2 py-1 text-xs ltr-force text-left outline-none focus:ring-1 focus:ring-primary-500"
                          placeholder="۰"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={line.description}
                          onChange={(e) => setLines(lines.map((l) => l.id === line.id ? { ...l, description: e.target.value } : l))}
                          className="w-full border border-slate-300 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary-500"
                          placeholder="شرح"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(line.id)}
                          className="text-slate-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50">
                  <tr>
                    <td className="px-3 py-2 text-xs font-medium text-slate-700">جمع</td>
                    <td className={`px-3 py-2 text-xs font-bold ltr-force text-left ${totals.balanced ? 'text-slate-700' : 'text-red-600'}`}>
                      {formatNumber(totals.totalDebit)}
                    </td>
                    <td className={`px-3 py-2 text-xs font-bold ltr-force text-left ${totals.balanced ? 'text-slate-700' : 'text-red-600'}`}>
                      {formatNumber(totals.totalCredit)}
                    </td>
                    <td colSpan={2} className="px-3 py-2">
                      {!totals.balanced && (
                        <span className="text-xs text-red-600">
                          عدم تراز: {formatNumber(Math.abs(totals.totalDebit - totals.totalCredit))}
                        </span>
                      )}
                      {totals.balanced && totals.totalDebit > 0 && (
                        <span className="text-xs text-green-600">✓ تراز است</span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <button
              type="button"
              onClick={handleAddLine}
              className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-800 font-medium"
            >
              <Plus className="w-4 h-4" />
              افزودن سطر
            </button>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-primary-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'در حال ذخیره...' : isEdit ? 'بروزرسانی سند' : 'ثبت سند'}
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
