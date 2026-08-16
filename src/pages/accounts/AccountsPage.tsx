import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Account } from '../../types/database';
import { AccountTreeView } from '../../components/accounts/AccountTreeView';
import { AccountFormModal } from '../../components/accounts/AccountFormModal';
import { formatNumber } from '../../lib/persian-number';
import { tauriInvoke } from '../../lib/tauri';
import { Search, Plus, Pencil, Trash2, AlertTriangle, BookOpen } from 'lucide-react';

const ACCOUNT_TYPES: Record<string, { label: string; color: string }> = {
  asset: { label: 'دارایی', color: 'text-blue-700 bg-blue-50' },
  liability: { label: 'بدهی', color: 'text-amber-700 bg-amber-50' },
  equity: { label: 'سرمایه', color: 'text-green-700 bg-green-50' },
  revenue: { label: 'درآمد', color: 'text-emerald-700 bg-emerald-50' },
  expense: { label: 'هزینه', color: 'text-red-700 bg-red-50' },
  contra: { label: 'تعدیلی', color: 'text-purple-700 bg-purple-50' },
};

export function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Account | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await tauriInvoke<Record<string, unknown>[]>('get_accounts'));
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
        currency: (a.currency as string) ?? 'IRR',
        createdAt: a.createdAt as string,
        balance: 0,
      }));
      setAccounts(mapped);
    } catch (err) {
      console.error('Failed to load accounts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Filter accounts by search
  const filteredAccounts = useMemo(() => {
    if (!searchQuery.trim()) return accounts;
    const q = searchQuery.trim().toLowerCase();
    return accounts.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.code.includes(q)
    );
  }, [accounts, searchQuery]);

  const accountMap = useMemo(() => {
    const map = new Map<number, Account>();
    accounts.forEach((a) => map.set(a.id, a));
    return map;
  }, [accounts]);

  const selectedWithChildren = useMemo(() => {
    if (!selectedAccount) return null;
    const children = accounts.filter((a) => a.parentId === selectedAccount.id);
    const parent = selectedAccount.parentId ? accountMap.get(selectedAccount.parentId) : null;
    return { account: selectedAccount, children, parent };
  }, [selectedAccount, accounts, accountMap]);

  const handleAdd = () => {
    setEditingAccount(null);
    setIsModalOpen(true);
  };

  const handleEdit = () => {
    if (selectedAccount) {
      setEditingAccount(selectedAccount);
      setIsModalOpen(true);
    }
  };

  const handleDeleteClick = () => {
    if (selectedAccount) {
      setDeleteConfirm(selectedAccount);
      setDeleteError('');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    try {
      await tauriInvoke('delete_account', { id: deleteConfirm.id });
      setDeleteConfirm(null);
      setSelectedAccount(null);
      loadAccounts();
    } catch (err) {
      setDeleteError(String(err));
    }
  };

  // Parent accounts for dropdown (only level 1 and 2)
  const parentAccounts = useMemo(() => {
    return accounts.filter((a) => a.level <= 2).sort((a, b) => a.code.localeCompare(b.code));
  }, [accounts]);

  const typeLabel = selectedAccount ? ACCOUNT_TYPES[selectedAccount.type]?.label : '';
  const typeColor = selectedAccount ? ACCOUNT_TYPES[selectedAccount.type]?.color : '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center shadow-brand">
            <BookOpen className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">حساب‌ها</h1>
            <p className="text-[12px] text-slate-400">مدیریت کدینگ حسابداری</p>
          </div>
        </div>
        <button
          onClick={handleAdd}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          حساب جدید
        </button>
      </div>

      {/* Search */}
      <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="جستجوی حساب (کد یا نام)..."
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

      {/* Results count */}
      {searchQuery && (
        <p className="text-xs text-slate-500">
          {filteredAccounts.length} حساب یافت شد
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tree View */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 min-h-[400px] max-h-[600px] overflow-y-auto">
          <h2 className="text-sm font-semibold text-slate-500 mb-3">ساختار حساب‌ها</h2>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <svg className="animate-spin h-5 w-5 ml-2" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              در حال بارگذاری...
            </div>
          ) : (
            <AccountTreeView
              items={filteredAccounts}
              selectedId={selectedAccount?.id ?? null}
              onSelect={setSelectedAccount}
            />
          )}
        </div>

        {/* Detail Panel */}
        {selectedWithChildren ? (
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-slate-500 ltr-force">{selectedWithChildren.account.code}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColor}`}>{typeLabel}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleEdit}
                  className="text-sm text-primary-600 hover:text-primary-800 px-2 py-1 rounded hover:bg-primary-50 flex items-center gap-1 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  ویرایش
                </button>
                <button
                  onClick={handleDeleteClick}
                  className="text-sm text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  حذف
                </button>
              </div>
            </div>

            <h2 className="text-xl font-bold text-slate-900 mb-1">{selectedWithChildren.account.name}</h2>

            {selectedWithChildren.parent && (
              <p className="text-sm text-slate-500 mb-4">
                والد: {selectedWithChildren.parent.code} - {selectedWithChildren.parent.name}
              </p>
            )}

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-slate-50 rounded p-3">
                <p className="text-xs text-slate-500">سطح</p>
                <p className="text-sm font-medium">{selectedWithChildren.account.level}</p>
              </div>
              <div className="bg-slate-50 rounded p-3">
                <p className="text-xs text-slate-500">ارز</p>
                <p className="text-sm font-medium">{selectedWithChildren.account.currency || 'IRR'}</p>
              </div>
              <div className="bg-slate-50 rounded p-3">
                <p className="text-xs text-slate-500">مانده</p>
                <p className="text-sm font-medium">{formatNumber(0)} ریال</p>
              </div>
            </div>

            {selectedWithChildren.account.description && (
              <div className="bg-slate-50 rounded p-3 mb-4">
                <p className="text-xs text-slate-500 mb-1">توضیحات</p>
                <p className="text-sm text-slate-700">{selectedWithChildren.account.description}</p>
              </div>
            )}

            {/* Children list */}
            {selectedWithChildren.children.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-500 mb-2">زیرمجموعه‌ها</h3>
                <div className="space-y-1">
                  {selectedWithChildren.children.map((child) => (
                    <button
                      key={child.id}
                      onClick={() => setSelectedAccount(child)}
                      className="w-full text-right px-3 py-2 rounded-md text-sm hover:bg-slate-50 flex items-center gap-2 transition-colors"
                    >
                      <span className="font-mono text-xs text-slate-400 ltr-force">{child.code}</span>
                      <span className="text-slate-700">{child.name}</span>
                      <span className={`px-1.5 py-0.5 rounded text-xs ${ACCOUNT_TYPES[child.type]?.color ?? ''}`}>
                        {ACCOUNT_TYPES[child.type]?.label ?? child.type}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col items-center justify-center text-slate-400 min-h-[400px]">
            <p>یک حساب را از درخت انتخاب کنید</p>
            <p className="text-xs mt-2">برای مشاهده جزئیات، روی حساب کلیک کنید</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <AccountFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadAccounts}
        editAccount={editingAccount}
        parentAccounts={parentAccounts}
      />

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 p-2 rounded-full">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">حذف حساب</h3>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              آیا از حذف حساب <strong>{deleteConfirm.name}</strong> ({deleteConfirm.code}) اطمینان دارید؟
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
