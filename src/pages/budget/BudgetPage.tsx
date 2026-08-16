import { useState, useEffect } from 'react';
import type { BudgetPeriod, BudgetEntry, Account } from '../../types/database';
import { tauriInvoke } from '../../lib/tauri';
import { formatNumber } from '../../lib/persian-number';
import { exportToExcel, prepareExportData } from '../../lib/export';
import { Plus, Trash2, RefreshCw, Table2, Save, X, Calendar } from 'lucide-react';
import { JalaliDatePicker } from '../../components/ui/JalaliDatePicker';

export function BudgetPage() {
  const [periods, setPeriods] = useState<BudgetPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);
  const [entries, setEntries] = useState<BudgetEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showNewPeriod, setShowNewPeriod] = useState(false);
  const [periodName, setPeriodName] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [editAmounts, setEditAmounts] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});

  useEffect(() => {
    loadPeriods();
    loadAccounts();
  }, []);

  useEffect(() => {
    if (selectedPeriod) loadEntries(selectedPeriod);
    else setEntries([]);
  }, [selectedPeriod]);

  const loadPeriods = async () => {
    try {
      const data = await tauriInvoke<BudgetPeriod[]>('get_budget_periods', { company_id: 1 });
      setPeriods(data);
    } catch (err) {
      console.error('Failed to load budget periods:', err);
    }
  };

  const loadAccounts = async () => {
    try {
      const data = await tauriInvoke<Account[]>('get_accounts', { company_id: 1 });
      setAccounts(data.filter(a => a.level >= 3));
    } catch (err) {
      console.error('Failed to load accounts:', err);
    }
  };

  const loadEntries = async (periodId: number) => {
    try {
      const data = await tauriInvoke<BudgetEntry[]>('get_budget_entries', { budget_period_id: periodId });
      setEntries(data);
      const amounts: Record<number, string> = {};
      data.forEach(e => { amounts[e.account_id] = String(e.amount); });
      setEditAmounts(amounts);
    } catch (err) {
      console.error('Failed to load budget entries:', err);
    }
  };

  const createPeriod = async () => {
    if (!periodName || !periodStart || !periodEnd) return;
    try {
      await tauriInvoke<BudgetPeriod>('create_budget_period', {
        company_id: 1,
        name: periodName,
        start_date: periodStart,
        end_date: periodEnd,
      });
      setShowNewPeriod(false);
      setPeriodName('');
      setPeriodStart('');
      setPeriodEnd('');
      loadPeriods();
    } catch (err) {
      console.error('Failed to create budget period:', err);
    }
  };

  const deletePeriod = async (id: number) => {
    try {
      await tauriInvoke('delete_budget_period', { id });
      if (selectedPeriod === id) { setSelectedPeriod(null); setEntries([]); }
      loadPeriods();
    } catch (err) {
      console.error('Failed to delete budget period:', err);
    }
  };

  const saveEntry = async (accountId: number) => {
    if (!selectedPeriod) return;
    setSaving(prev => ({ ...prev, [accountId]: true }));
    try {
      const amount = parseFloat(editAmounts[accountId] || '0');
      await tauriInvoke<BudgetEntry>('upsert_budget_entry', {
        budget_period_id: selectedPeriod,
        account_id: accountId,
        amount,
      });
      loadEntries(selectedPeriod);
    } catch (err) {
      console.error('Failed to save budget entry:', err);
    } finally {
      setSaving(prev => ({ ...prev, [accountId]: false }));
    }
  };

  const exportExcel = () => {
    const data = prepareExportData(
      [
        { key: 'account_code', label: 'کد حساب' },
        { key: 'account_name', label: 'نام حساب' },
        { key: 'amount', label: 'مبلغ بودجه' },
      ],
      entries as unknown as Record<string, unknown>[]
    );
    const periodName = periods.find(p => p.id === selectedPeriod)?.name || 'بودجه';
    exportToExcel(data, 'budget', periodName);
  };

  const groupedAccounts = accounts.reduce((acc, a) => {
    const type = a.type || 'other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(a);
    return acc;
  }, {} as Record<string, Account[]>);

  const typeLabels: Record<string, string> = {
    asset: 'دارایی‌ها',
    liability: 'بدهی‌ها',
    equity: 'سرمایه',
    revenue: 'درآمدها',
    expense: 'هزینه‌ها',
  };

  const selectedPeriodObj = periods.find(p => p.id === selectedPeriod);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center shadow-brand">
              <Calendar className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">بودجه</h1>
              <p className="text-[12px] text-slate-400">مدیریت بودجه و پیش‌بینی</p>
            </div>
          </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportExcel}
            disabled={entries.length === 0}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-30"
            title="خروجی Excel"
          >
            <Table2 className="w-3.5 h-3.5" />
            Excel
          </button>
          <button
            onClick={() => setShowNewPeriod(true)}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            دوره جدید
          </button>
        </div>
      </div>

      {/* New Period Modal */}
      {showNewPeriod && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-amber-800">دوره بودجه جدید</h3>
            <button onClick={() => setShowNewPeriod(false)} className="text-amber-400 hover:text-amber-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-amber-700 mb-1">نام دوره</label>
              <input
                type="text"
                value={periodName}
                onChange={(e) => setPeriodName(e.target.value)}
                placeholder="مثال: بودجه سال ۱۴۰۴"
                className="w-full px-3 py-1.5 border border-amber-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-amber-700 mb-1">از تاریخ</label>
              <JalaliDatePicker value={periodStart} onChange={(v) => setPeriodStart(v)} placeholder="۱۴۰۴/۰۱/۰۱" />
            </div>
            <div>
              <label className="block text-xs text-amber-700 mb-1">تا تاریخ</label>
              <JalaliDatePicker value={periodEnd} onChange={(v) => setPeriodEnd(v)} placeholder="۱۴۰۴/۱۲/۲۹" />
            </div>
            <div className="flex items-end">
              <button
                onClick={createPeriod}
                disabled={!periodName || !periodStart || !periodEnd}
                className="bg-amber-600 hover:bg-amber-700 text-white text-sm px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4 inline ml-1" />
                ذخیره
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Period Selector */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <label className="block text-sm font-medium text-slate-700 mb-2">دوره بودجه</label>
        <div className="flex items-center gap-3">
          <select
            value={selectedPeriod ?? ''}
            onChange={(e) => setSelectedPeriod(parseInt(e.target.value) || null)}
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">انتخاب کنید...</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.start_date} تا {p.end_date})
              </option>
            ))}
          </select>
          {selectedPeriod && (
            <button
              onClick={() => deletePeriod(selectedPeriod)}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              حذف دوره
            </button>
          )}
          <button onClick={loadPeriods} className="p-2 text-slate-400 hover:text-slate-600">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        {selectedPeriodObj && (
          <p className="text-xs text-slate-400 mt-2">
            <Calendar className="w-3 h-3 inline ml-1" />
            {selectedPeriodObj.start_date} تا {selectedPeriodObj.end_date}
          </p>
        )}
      </div>

      {/* Budget Entries */}
      {selectedPeriod && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">بودجه حساب‌ها</h2>
            <p className="text-xs text-slate-400">
              جمع: {formatNumber(Object.values(editAmounts).reduce((s, v) => s + (parseFloat(v) || 0), 0))}
            </p>
          </div>
          {accounts.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <p>هیچ حسابی یافت نشد</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {Object.entries(groupedAccounts).map(([type, accs]) => (
                <div key={type}>
                  <div className="px-4 py-2 bg-slate-50">
                    <h3 className="text-xs font-bold text-slate-500">{typeLabels[type] || type}</h3>
                  </div>
                  {accs.map((account) => (
                    <div key={account.id} className="px-4 py-2 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{account.name}</p>
                        <p className="text-xs text-slate-400 font-mono">{account.code}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editAmounts[account.id] ?? ''}
                          onChange={(e) => setEditAmounts(prev => ({ ...prev, [account.id]: e.target.value }))}
                          placeholder="۰"
                          className="w-32 px-2 py-1 border border-slate-200 rounded text-xs text-left ltr-force"
                          dir="ltr"
                        />
                        <button
                          onClick={() => saveEntry(account.id)}
                          disabled={saving[account.id]}
                          className="px-2 py-1 rounded text-xs font-medium text-primary-600 hover:bg-primary-50 transition-colors disabled:opacity-30"
                        >
                          {saving[account.id] ? '...' : 'ذخیره'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
