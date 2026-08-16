import { useState, useEffect, useCallback } from 'react';
import type { Account, JournalEntry, JournalLine } from '../../types/database';
import { tauriInvoke } from '../../lib/tauri';
import { formatMoney, formatNumber } from '../../lib/persian-number';
import { todayJalali } from '../../lib/jalali';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { JalaliDatePicker } from '../../components/ui/JalaliDatePicker';
import { Badge } from '../../components/ui/Badge';
import {
  FileSpreadsheet, Play, RefreshCw, Filter, Printer, FileText,
} from 'lucide-react';

type GroupBy = 'none' | 'date' | 'month' | 'account';

interface ReportRow {
  key: string;
  label: string;
  date?: string;
  debit: number;
  credit: number;
  lines: { accountName: string; accountCode: string; debit: number; credit: number }[];
}

export function CustomReportsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<number[]>([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('date');
  const [showZeroBalances, setShowZeroBalances] = useState(true);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [ran, setRan] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchAccounts, setSearchAccounts] = useState('');

  useEffect(() => {
    tauriInvoke<Account[]>('get_accounts', { companyId: 1 }).then(setAccounts).catch(() => {});
  }, []);

  const filteredAccounts = accounts.filter((a) => {
    const q = searchAccounts.trim().toLowerCase();
    if (!q) return true;
    return `${a.code} ${a.name}`.toLowerCase().includes(q);
  });

  const toggleAccount = (id: number) => {
    setSelectedAccounts((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const runReport = useCallback(async () => {
    setLoading(true);
    try {
      const data = await tauriInvoke<JournalEntry[]>('get_journal_entries');
      const entriesWithLines = data.map((e) => ({ ...e, lines: e.lines || [] }));

      let filtered = entriesWithLines;
      if (fromDate) filtered = filtered.filter((e) => e.date >= fromDate);
      if (toDate) filtered = filtered.filter((e) => e.date <= toDate);

      const selectedSet = new Set(selectedAccounts);
      const lines: { entry: JournalEntry; line: JournalLine }[] = [];
      filtered.forEach((entry) => {
        (entry.lines || []).forEach((line) => {
          if (selectedAccounts.length === 0 || selectedSet.has(line.accountId)) {
            lines.push({ entry, line });
          }
        });
      });

      const grouped = new Map<string, ReportRow>();
      lines.forEach(({ entry, line }) => {
        let key: string;
        let label: string;
        if (groupBy === 'date') {
          key = entry.date;
          label = entry.date;
        } else if (groupBy === 'month') {
          key = entry.date.slice(0, 7);
          label = entry.date.slice(0, 7);
        } else if (groupBy === 'account') {
          key = `acc-${line.accountId}`;
          label = `${line.accountName || ''} (${line.accountCode || ''})`;
        } else {
          key = 'all';
          label = 'کل گزارش';
        }
        const existing = grouped.get(key) || { key, label, debit: 0, credit: 0, lines: [] };
        existing.debit += line.debit;
        existing.credit += line.credit;
        existing.lines.push({
          accountName: line.accountName || '', accountCode: line.accountCode || '',
          debit: line.debit, credit: line.credit,
        });
        grouped.set(key, existing);
      });

      let result = Array.from(grouped.values());
      result.sort((a, b) => a.key.localeCompare(b.key));
      if (!showZeroBalances) {
        result = result.filter((r) => Math.abs(r.debit - r.credit) > 0.001);
      }
      setRows(result);
      setRan(true);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [fromDate, toDate, groupBy, selectedAccounts, showZeroBalances]);

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="گزارش‌ساز"
        description="ساخت گزارش دلخواه از اسناد روزنامه بر اساس حساب، بازه زمانی و گروه‌بندی"
        icon={<FileSpreadsheet className="w-5 h-5" />}
        breadcrumb="گزارش‌ها / گزارش‌ساز"
        actions={
          <Button onClick={runReport} disabled={loading}>
            <Play className="w-4 h-4" /> {loading ? 'در حال اجرا...' : 'اجرای گزارش'}
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Filters */}
        <Card title="پارامترهای گزارش" icon={<Filter className="w-4 h-4" />} className="lg:col-span-1 self-start">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">از تاریخ</label>
                <JalaliDatePicker value={fromDate} onChange={(v) => setFromDate(v)} placeholder="۱۴۰۴/۰۱/۰۱" />
              </div>
              <div>
                <label className="form-label">تا تاریخ</label>
                <JalaliDatePicker value={toDate} onChange={(v) => setToDate(v)} placeholder={todayJalali()} />
              </div>
            </div>
            <div>
              <label className="form-label">گروه‌بندی</label>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              >
                <option value="date">بر اساس تاریخ</option>
                <option value="month">بر اساس ماه</option>
                <option value="account">بر اساس حساب</option>
                <option value="none">بدون گروه‌بندی</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showZeroBalances}
                onChange={(e) => setShowZeroBalances(e.target.checked)}
                className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              نمایش ردیف‌های صفر
            </label>
            <div>
              <label className="form-label">انتخاب حساب‌ها ({formatNumber(selectedAccounts.length)})</label>
              <Input value={searchAccounts} onChange={(e) => setSearchAccounts(e.target.value)} placeholder="جستجوی حساب..." />
              <div className="mt-2 max-h-64 overflow-y-auto space-y-0.5 rounded-xl border border-slate-100 p-1.5">
                {filteredAccounts.map((a) => (
                  <label key={a.id} className={`flex items-center gap-2 text-[13px] rounded-lg px-2 py-1.5 cursor-pointer transition-colors ${selectedAccounts.includes(a.id) ? 'bg-brand-50 text-brand-800' : 'hover:bg-slate-50 text-slate-600'}`}>
                    <input
                      type="checkbox"
                      checked={selectedAccounts.includes(a.id)}
                      onChange={() => toggleAccount(a.id)}
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="font-mono text-[11px] text-slate-400">{a.code}</span>
                    <span className="truncate">{a.name}</span>
                  </label>
                ))}
                {filteredAccounts.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-3">حسابی یافت نشد</p>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">در صورت عدم انتخاب، همه حساب‌ها گزارش می‌شوند.</p>
            </div>
          </div>
        </Card>

        {/* Report output */}
        <div className="lg:col-span-3 space-y-4">
          {!ran ? (
            <Card>
              <EmptyState
                icon={<FileSpreadsheet className="w-7 h-7" />}
                title="گزارشی اجرا نشده"
                description="پارامترها را تنظیم کنید و «اجرای گزارش» را بزنید."
              />
            </Card>
          ) : rows.length === 0 ? (
            <Card>
              <EmptyState
                icon={<FileText className="w-7 h-7" />}
                title="نتیجه‌ای یافت نشد"
                description="برای بازه یا حساب‌های انتخابی سندی ثبت نشده است."
              />
            </Card>
          ) : (
            <Card
              title="نتیجه گزارش"
              description={`${formatNumber(rows.length)} ردیف`}
              icon={<FileText className="w-4 h-4" />}
              action={
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => window.print()}>
                    <Printer className="w-3.5 h-3.5" /> چاپ
                  </Button>
                  <Button variant="outline" size="sm" onClick={runReport}>
                    <RefreshCw className="w-3.5 h-3.5" /> اجرای مجدد
                  </Button>
                </div>
              }
            >
              <div className="overflow-x-auto">
                <table className="table-card w-full">
                  <thead>
                    <tr>
                      <th>ردیف</th><th>گروه</th><th>بدهکار</th><th>بستانکار</th><th>مانده</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={row.key}>
                        <td className="text-slate-400 font-mono text-xs">{formatNumber(idx + 1)}</td>
                        <td>
                          <div className="font-bold text-slate-800">{row.label}</div>
                          {groupBy !== 'account' && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {row.lines.slice(0, 3).map((l, i) => (
                                <Badge key={i} tone="slate" className="text-[10px]">
                                  {l.accountName} {formatNumber(l.debit - l.credit)}
                                </Badge>
                              ))}
                              {row.lines.length > 3 && (
                                <Badge tone="brand" className="text-[10px]">+{formatNumber(row.lines.length - 3)}</Badge>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="ltr-force text-emerald-700">{formatMoney(row.debit)}</td>
                        <td className="ltr-force text-rose-700">{formatMoney(row.credit)}</td>
                        <td className={`ltr-force font-bold ${row.debit - row.credit >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>
                          {formatMoney(row.debit - row.credit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50">
                      <td className="font-bold" colSpan={2}>جمع کل</td>
                      <td className="ltr-force font-bold text-emerald-700">{formatMoney(totalDebit)}</td>
                      <td className="ltr-force font-bold text-rose-700">{formatMoney(totalCredit)}</td>
                      <td className="ltr-force font-bold">{formatMoney(totalDebit - totalCredit)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
