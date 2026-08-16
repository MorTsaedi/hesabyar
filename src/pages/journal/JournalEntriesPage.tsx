import { useState, useEffect, useCallback, useMemo } from 'react';
import type { JournalEntry, JournalLine } from '../../types/database';
import { JournalEntryForm } from '../../components/journal/JournalEntryForm';
import { tauriInvoke } from '../../lib/tauri';
import { formatNumber } from '../../lib/persian-number';
import { Search, Plus, FileText, Trash2, Pencil, Eye, AlertTriangle } from 'lucide-react';

interface EntryWithLines extends JournalEntry {
  lines: JournalLine[];
}

type SortField = 'date' | 'number' | 'debit' | 'credit';
type SortDirection = 'asc' | 'desc';
type GroupBy = 'none' | 'date' | 'month';

export function JournalEntriesPage() {
  const [entries, setEntries] = useState<EntryWithLines[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
  const [viewingEntry, setViewingEntry] = useState<EntryWithLines | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<EntryWithLines | null>(null);
  const [deleteError, setDeleteError] = useState('');
  // Sort & Group state
  const [sortField] = useState<SortField>('date');
  const [sortDirection] = useState<SortDirection>('desc');
  const [groupBy] = useState<GroupBy>('none');

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const entriesData = await tauriInvoke<JournalEntry[]>('get_journal_entries');
      const entriesWithLines: EntryWithLines[] = entriesData.map((entry) => ({
        ...entry,
        isApproved: false, // frontend-only field
      }));
      setEntries(entriesWithLines);
    } catch (err) {
      console.error('Failed to load entries:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.trim().toLowerCase();
    return entries.filter(
      (e) =>
        e.description.toLowerCase().includes(q) ||
        (e.reference ?? '').toLowerCase().includes(q) ||
        e.entryNumber.toString().includes(q)
    );
  }, [entries, searchQuery]);

  const handleAdd = () => {
    setEditingEntryId(null);
    setIsFormOpen(true);
  };

  const handleEdit = (entry: EntryWithLines) => {
    setEditingEntryId(entry.id);
    setIsFormOpen(true);
  };

  const handleView = async (entry: EntryWithLines) => {
    setViewingEntry(entry);
  };

  const handleDeleteClick = (entry: EntryWithLines) => {
    setDeleteConfirm(entry);
    setDeleteError('');
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    try {
      await tauriInvoke('delete_journal_entry', { id: deleteConfirm.id });
      setDeleteConfirm(null);
      loadEntries();
    } catch (err) {
      setDeleteError(String(err));
    }
  };

  // Get sorted entries
  const sortedEntries = useMemo(() => {
    const filtered = searchQuery.trim()
      ? entries.filter((e) =>
          e.description.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
          (e.reference ?? '').toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
          e.entryNumber.toString().includes(searchQuery)
        )
      : entries;

    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'date':
          comparison = a.date.localeCompare(b.date);
          break;
        case 'number':
          comparison = a.entryNumber - b.entryNumber;
          break;
        case 'debit':
          comparison = a.totalDebit - b.totalDebit;
          break;
        case 'credit':
          comparison = a.totalCredit - b.totalCredit;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    if (groupBy === 'none') return sorted;

    // Group entries
    const groups: Record<string, EntryWithLines[]> = {};
    sorted.forEach((entry) => {
      let key: string;
      if (groupBy === 'date') {
        key = entry.date;
      } else {
        // month: 1404/01 → فروردین 1404
        const parts = entry.date.split('/');
        const months = ['', 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
        key = `${months[parseInt(parts[1])] || parts[1]} ${parts[0]}`;
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(entry);
    });

    return sortedEntriesByGroup(sorted, groups);
  }, [entries, searchQuery, sortField, sortDirection, groupBy]);

  // Helper to interleave grouped entries with headers
  const sortedEntriesByGroup = (all: EntryWithLines[], groups: Record<string, EntryWithLines[]>): (EntryWithLines | { type: 'header'; label: string; count: number })[] => {
    if (groupBy === 'none') return all;
    const result: (EntryWithLines | { type: 'header'; label: string; count: number })[] = [];
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      // Sort by first entry in each group
      const aFirst = groups[a][0];
      const bFirst = groups[b][0];
      if (sortField === 'date') {
        return sortDirection === 'asc' ? aFirst.date.localeCompare(bFirst.date) : bFirst.date.localeCompare(aFirst.date);
      }
      return sortDirection === 'asc' ? aFirst.entryNumber - bFirst.entryNumber : bFirst.entryNumber - aFirst.entryNumber;
    });
    sortedKeys.forEach((key) => {
      result.push({ type: 'header' as const, label: key, count: groups[key].length });
      result.push(...groups[key]);
    });
    return result;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center shadow-brand">
            <FileText className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">اسناد حسابداری</h1>
            <p className="text-[12px] text-slate-400">ثبت و مدیریت اسناد روزنامه</p>
          </div>
        </div>
        <button
          onClick={handleAdd}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          سند جدید
        </button>
      </div>

      {/* Search */}
      <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="جستجو (شماره سند، شرح، مرجع)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-transparent outline-none text-sm text-slate-700 placeholder:text-slate-400"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600 text-xs">
            پاک کردن
          </button>
        )}
      </div>

      {/* Entries Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <svg className="animate-spin h-5 w-5 ml-2" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            در حال بارگذاری...
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <FileText className="w-12 h-12 mb-3 opacity-30" />
            <p>هیچ سندی یافت نشد</p>
            <button onClick={handleAdd} className="mt-3 text-primary-600 text-sm hover:underline">
              + ثبت اولین سند
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">شماره</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">تاریخ</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">شرح</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">بدهکار</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">بستانکار</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 w-24">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {sortedEntries.map((item) => {
                // Handle group header
                if ('type' in item && item.type === 'header') {
                  return (
                    <tr key={`header-${item.label}`} className="bg-primary-50 border-t-2 border-primary-200">
                      <td colSpan={6} className="px-4 py-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-primary-800 text-sm">{item.label}</span>
                          <span className="text-xs text-primary-600 bg-primary-100 px-2 py-0.5 rounded-full">
                            {item.count} سند
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                }
                // Handle entry row
                const entry = item as EntryWithLines;
                return (
                  <tr key={entry.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500 ltr-force">{entry.entryNumber}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 ltr-force">{entry.date}</td>
                    <td className="px-4 py-3">
                      <p className="text-slate-700 font-medium">{entry.description}</p>
                      {entry.reference && (
                        <p className="text-xs text-slate-400 mt-0.5">مرجع: {entry.reference}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-700 ltr-force">{formatNumber(entry.totalDebit)}</td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-700 ltr-force">{formatNumber(entry.totalCredit)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleView(entry)}
                          className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                          title="مشاهده"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {!entry.isApproved && (
                          <button
                            onClick={() => handleEdit(entry)}
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                            title="ویرایش"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteClick(entry)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Form */}
      <JournalEntryForm
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditingEntryId(null); }}
        onSuccess={loadEntries}
        editEntryId={editingEntryId}
      />

      {/* View Modal */}
      {viewingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setViewingEntry(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900">
                  سند شماره {viewingEntry.entryNumber}
                </h2>
                <button onClick={() => setViewingEntry(null)} className="text-slate-400 hover:text-slate-600">
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                <div className="bg-slate-50 rounded p-3">
                  <p className="text-xs text-slate-500">تاریخ</p>
                  <p className="font-medium ltr-force">{viewingEntry.date}</p>
                </div>
                <div className="bg-slate-50 rounded p-3">
                  <p className="text-xs text-slate-500">مرجع</p>
                  <p className="font-medium">{viewingEntry.reference || '-'}</p>
                </div>
                <div className="bg-slate-50 rounded p-3">
                  <p className="text-xs text-slate-500">وضعیت</p>
                  <p className="font-medium">{viewingEntry.isApproved ? 'تأیید شده' : 'پیش‌نویس'}</p>
                </div>
              </div>

              <p className="text-sm text-slate-700 mb-4 font-medium">{viewingEntry.description}</p>

              <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">کد</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">حساب</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">شرح</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 w-28">بدهکار</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 w-28">بستانکار</th>
                  </tr>
                </thead>
                <tbody>
                  {viewingEntry.lines.map((line) => (
                    <tr key={line.id} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-mono text-xs text-slate-500 ltr-force">{line.accountCode}</td>
                      <td className="px-3 py-2 text-slate-700">{line.accountName}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">{line.description || '-'}</td>
                      <td className="px-3 py-2 text-xs font-medium ltr-force text-left">{line.debit > 0 ? formatNumber(line.debit) : ''}</td>
                      <td className="px-3 py-2 text-xs font-medium ltr-force text-left">{line.credit > 0 ? formatNumber(line.credit) : ''}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-medium">
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-xs">جمع</td>
                    <td className="px-3 py-2 text-xs ltr-force text-left">{formatNumber(viewingEntry.totalDebit)}</td>
                    <td className="px-3 py-2 text-xs ltr-force text-left">{formatNumber(viewingEntry.totalCredit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 p-2 rounded-full">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">حذف سند</h3>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              آیا از حذف سند شماره <strong>{deleteConfirm.entryNumber}</strong> اطمینان دارید؟
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
