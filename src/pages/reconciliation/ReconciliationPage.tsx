import { useState, useEffect, useCallback, type ReactNode } from 'react';
import type { BankAccount, BankStatementEntry, ReconciliationSummary } from '../../types/database';
import { tauriInvoke } from '../../lib/tauri';
import { formatMoney, formatNumber, parsePersianNumber } from '../../lib/persian-number';
import { todayJalali } from '../../lib/jalali';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { JalaliDatePicker } from '../../components/ui/JalaliDatePicker';
import { Modal } from '../../components/ui/Modal';
import { StatCard } from '../../components/ui/StatCard';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  Scale, Plus, Trash2, RefreshCw, Link2, Unlink, Landmark, FileText, ArrowDownUp,
} from 'lucide-react';

const emptyEntry = {
  statementDate: todayJalali(), description: '', amount: 0, reference: '',
};

export function ReconciliationPage() {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBank, setSelectedBank] = useState<number | null>(null);
  const [entries, setEntries] = useState<BankStatementEntry[]>([]);
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);
  const [vouchers, setVouchers] = useState<[number, string, string, number, string][]>([]);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ ...emptyEntry });

  const loadBanks = useCallback(async () => {
    try {
      const data = await tauriInvoke<BankAccount[]>('get_bank_accounts', { company_id: 1 });
      setBankAccounts(data);
      if (data.length > 0) {
        setSelectedBank((prev) => prev ?? data[0].id);
      }
    } catch (e) { setError(String(e)); }
  }, []);

  const loadData = useCallback(async (bankId: number | null) => {
    if (!bankId) return;
    try {
      const [e, s, v] = await Promise.all([
        tauriInvoke<BankStatementEntry[]>('get_bank_statement_entries', { bankAccountId: bankId }),
        tauriInvoke<ReconciliationSummary>('get_reconciliation_summary', { bankAccountId: bankId }),
        tauriInvoke<[number, string, string, number, string][]>('get_unmatched_vouchers', { bankAccountId: bankId }),
      ]);
      setEntries(e);
      setSummary(s);
      setVouchers(v);
    } catch (err) { setError(String(err)); }
  }, []);

  useEffect(() => {
    loadBanks();
  }, [loadBanks]);

  useEffect(() => {
    loadData(selectedBank);
  }, [selectedBank, loadData]);

  const addEntry = async () => {
    if (!selectedBank) return;
    try {
      await tauriInvoke('add_bank_statement_entry', {
        bankAccountId: selectedBank, statementDate: form.statementDate,
        description: form.description, amount: form.amount, reference: form.reference || null,
      });
      setModal(false);
      setForm({ ...emptyEntry });
      loadData(selectedBank);
    } catch (e) { setError(String(e)); }
  };

  const deleteEntry = async (id: number) => {
    if (!window.confirm('این قلم صورت‌حساب حذف شود؟')) return;
    try {
      await tauriInvoke('delete_bank_statement_entry', { id });
      loadData(selectedBank);
    } catch (e) { setError(String(e)); }
  };

  const reconcile = async (entryId: number, voucherId: number, voucherType: string) => {
    try {
      await tauriInvoke('reconcile_statement_entry', { id: entryId, voucherId, voucherType });
      loadData(selectedBank);
    } catch (e) { setError(String(e)); }
  };

  const unreconcile = async (entryId: number) => {
    try {
      await tauriInvoke('unreconcile_statement_entry', { id: entryId });
      loadData(selectedBank);
    } catch (e) { setError(String(e)); }
  };

  const bank = bankAccounts.find((b) => b.id === selectedBank);
  const difference = summary ? summary.totalStatementAmount - summary.glBalance : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="مغایرت بانکی"
        description="مطابقت صورتحساب بانک با اسناد دریافت و پرداخت سیستم"
        icon={<Scale className="w-5 h-5" />}
        breadcrumb="عملیات / مغایرت بانکی"
        actions={
          <>
            <Button variant="outline" onClick={() => loadData(selectedBank)}>
              <RefreshCw className="w-4 h-4" /> بروزرسانی
            </Button>
            <Button onClick={() => setModal(true)} disabled={!selectedBank}>
              <Plus className="w-4 h-4" /> قلم جدید
            </Button>
          </>
        }
      />

      {error && (
        <div className="bg-rose-50 text-rose-700 text-sm rounded-xl px-4 py-3 border border-rose-200">{error}</div>
      )}

      {/* Bank selector */}
      <Card title="انتخاب حساب بانکی" icon={<Landmark className="w-4 h-4" />}>
        {bankAccounts.length === 0 ? (
          <p className="text-sm text-slate-400">
            ابتدا در بخش «بانکداری» یک حساب بانکی تعریف کنید.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {bankAccounts.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelectedBank(b.id)}
                className={`rounded-xl px-4 py-2.5 text-[13px] font-bold transition-all border ${
                  selectedBank === b.id
                    ? 'bg-brand-50 text-brand-800 border-brand-300 ring-2 ring-brand-500/20'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                {b.bankName} — {b.accountNumber} ({b.accountName})
              </button>
            ))}
          </div>
        )}
      </Card>

      {bank && summary && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="مانده سیستم (دفتر کل)" value={formatMoney(summary.glBalance)} icon={<FileText className="w-4 h-4" />} tone="blue" />
            <StatCard title="مانده صورتحساب بانک" value={formatMoney(summary.totalStatementAmount)} icon={<Landmark className="w-4 h-4" />} tone="brand" />
            <StatCard
              title="اختلاف"
              value={formatMoney(difference)}
              icon={<ArrowDownUp className="w-4 h-4" />}
              tone={Math.abs(difference) < 0.01 ? 'green' : 'red'}
            />
            <StatCard
              title="اقلام مغایرت‌گیری نشده"
              value={`${formatNumber(summary.unreconciledEntries)} قلم`}
              hint={formatMoney(summary.unreconciledAmount)}
              icon={<Scale className="w-4 h-4" />}
              tone={summary.unreconciledEntries === 0 ? 'green' : 'amber'}
            />
          </div>

          {/* Statement entries */}
          <Card
            title={`اقلام صورت‌حساب ${bank.bankName}`}
            description="هر قلم را به سند دریافت/پرداخت متناظر متصل کنید"
            icon={<FileText className="w-4 h-4" />}
          >
            {entries.length === 0 ? (
              <EmptyState
                icon={<FileText className="w-7 h-7" />}
                title="قلمی ثبت نشده"
                description="اقلام صورت‌حساب بانک را اضافه کنید (مبلغ مثبت = واریز، منفی = برداشت)."
                action={<Button onClick={() => setModal(true)}><Plus className="w-4 h-4" /> افزودن قلم</Button>}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="table-card w-full">
                  <thead>
                    <tr>
                      <th>تاریخ</th><th>شرح</th><th>مبلغ</th><th>مرجع</th>
                      <th>سند متصل</th><th>وضعیت</th><th>عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={e.id} className={e.isReconciled ? '' : 'bg-amber-50/40'}>
                        <td className="text-slate-500">{e.statementDate}</td>
                        <td className="font-medium">{e.description}</td>
                        <td className={`ltr-force font-bold ${e.amount >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {formatMoney(e.amount)}
                        </td>
                        <td className="font-mono text-xs text-slate-400">{e.reference || '—'}</td>
                        <td className="text-slate-500">
                          {e.isReconciled
                            ? `${e.voucherType === 'receipt' ? 'رسید دریافت' : 'رسید پرداخت'} #${e.linkedVoucherId}`
                            : '—'}
                        </td>
                        <td>
                          {e.isReconciled ? (
                            <Badge tone="green" dot>تطبیق شده</Badge>
                          ) : (
                            <Badge tone="amber" dot>مغایرت‌گیری نشده</Badge>
                          )}
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            {!e.isReconciled && vouchers.length > 0 && (
                              <select
                                value=""
                                onChange={(ev) => {
                                  const v = vouchers[Number(ev.target.value)];
                                  if (v) reconcile(e.id, v[0], v[4]);
                                }}
                                className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-[11px] max-w-[130px]"
                              >
                                <option value="">اتصال به سند...</option>
                                {vouchers.map((v, idx) => (
                                  <option key={v[0]} value={idx}>
                                    {v[1]} — {formatNumber(v[3])}
                                  </option>
                                ))}
                              </select>
                            )}
                            {e.isReconciled && (
                              <button
                                onClick={() => unreconcile(e.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600"
                                title="قطع اتصال"
                              >
                                <Unlink className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => deleteEntry(e.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
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
          </Card>

          {/* Unmatched vouchers */}
          {vouchers.length > 0 && (
            <Card
              title="رسیدهای بدون تطبیق"
              description="دریافت/پرداخت‌هایی که هنوز به قلمی از صورت‌حساب متصل نشده‌اند"
              icon={<Link2 className="w-4 h-4" />}
            >
              <div className="flex flex-wrap gap-2">
                {vouchers.map((v) => (
                  <span key={v[0]} className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-[13px] text-slate-600">
                    <Link2 className="w-3.5 h-3.5 text-slate-400" />
                    {v[1]} — {v[2]} — <span className="font-bold ltr-force">{formatMoney(v[3])}</span>
                  </span>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {/* Add entry modal */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="قلم جدید صورت‌حساب"
        footer={
          <>
            <Button variant="outline" onClick={() => setModal(false)}>انصراف</Button>
            <Button onClick={addEntry}>افزودن قلم</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="تاریخ">
            <JalaliDatePicker value={form.statementDate} onChange={(v) => setForm({ ...form, statementDate: v })} />
          </Field>
          <Field label="شرح">
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="مثلاً واریز از مشتری" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="مبلغ (واریز مثبت / برداشت منفی)">
              <Input type="text" inputMode="decimal" persianNumbers value={form.amount} onChange={(e) => setForm({ ...form, amount: parsePersianNumber(e.target.value) })} />
            </Field>
            <Field label="مرجع / شماره پیگیری">
              <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
            </Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="form-label">{label}</label>
      {children}
    </div>
  );
}
