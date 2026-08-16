import { useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Check, CheckSummary } from '../../types/database';
import { tauriInvoke } from '../../lib/tauri';
import { formatMoney, formatNumber, parsePersianNumber } from '../../lib/persian-number';
import { todayJalali } from '../../lib/jalali';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Badge, type BadgeTone } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { JalaliDatePicker } from '../../components/ui/JalaliDatePicker';
import { Modal } from '../../components/ui/Modal';
import { StatCard } from '../../components/ui/StatCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { SearchInput } from '../../components/ui/SearchInput';
import { Tabs } from '../../components/ui/Tabs';
import {
  Banknote, Plus, Pencil, Trash2, RefreshCw, AlertCircle, CheckCircle2,
  XCircle, CalendarClock, Landmark,
} from 'lucide-react';

interface CheckForm {
  type: 'received' | 'issued';
  checkNumber: string; serial: string; bankName: string; amount: number;
  issueDate: string; dueDate: string;
  contactId: number | null; description: string; notes: string;
}

const emptyCheck: CheckForm = {
  type: 'received',
  checkNumber: '', serial: '', bankName: '', amount: 0,
  issueDate: todayJalali(), dueDate: todayJalali(),
  contactId: null, description: '', notes: '',
};

const statusTone: Record<string, BadgeTone> = {
  pending: 'amber', passed: 'blue', returned: 'red', cashed: 'green', cancelled: 'slate',
};

const statusLabel: Record<string, string> = {
  pending: 'در جریان', passed: 'وصول شده', returned: 'برگشتی', cashed: 'نقد شده', cancelled: 'باطل',
};

const nextStatusOptions: Record<string, string[]> = {
  pending: ['passed', 'returned', 'cancelled'],
  passed: ['cashed', 'returned', 'cancelled'],
  returned: ['pending', 'cancelled'],
  cashed: [],
  cancelled: [],
};

export function ChecksPage() {
  const [checks, setChecks] = useState<Check[]>([]);
  const [summary, setSummary] = useState<CheckSummary | null>(null);
  const [filter, setFilter] = useState<'all' | 'received' | 'issued'>('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Check | null>(null);
  const [form, setForm] = useState<CheckForm>({ ...emptyCheck });
  const [contacts, setContacts] = useState<{ id: number; name: string }[]>([]);

  const loadAll = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([
        tauriInvoke<Check[]>('get_checks', { companyId: 1 }),
        tauriInvoke<CheckSummary>('get_check_summary', { companyId: 1, today: todayJalali() }),
      ]);
      setChecks(c);
      setSummary(s);
    } catch (e) { setError(String(e)); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    tauriInvoke<{ id: number; name: string }[]>('get_contacts', { companyId: 1 })
      .then((data) => setContacts(data.map((c: any) => ({ id: c.id, name: c.name }))))
      .catch(() => {});
  }, []);

  const saveCheck = async () => {
    try {
      if (editing) {
        await tauriInvoke('update_check', {
          id: editing.id, checkNumber: form.checkNumber, serial: form.serial || null,
          bankName: form.bankName || null, amount: form.amount, issueDate: form.issueDate,
          dueDate: form.dueDate, contactId: form.contactId, description: form.description || null,
          notes: form.notes || null,
        });
      } else {
        await tauriInvoke('create_check', {
          companyId: 1, type: form.type, checkNumber: form.checkNumber,
          serial: form.serial || null, bankName: form.bankName || null, amount: form.amount,
          issueDate: form.issueDate, dueDate: form.dueDate, contactId: form.contactId,
          description: form.description || null, notes: form.notes || null,
        });
      }
      setModal(false);
      loadAll();
    } catch (e) { setError(String(e)); }
  };

  const changeStatus = async (check: Check, status: string) => {
    try {
      await tauriInvoke('update_check_status', { id: check.id, status });
      loadAll();
    } catch (e) { setError(String(e)); }
  };

  const deleteCheck = async (c: Check) => {
    if (!window.confirm(`چک شماره ${c.checkNumber} حذف شود؟`)) return;
    try {
      await tauriInvoke('delete_check', { id: c.id });
      loadAll();
    } catch (e) { setError(String(e)); }
  };

  const filtered = checks.filter((c) => {
    if (filter !== 'all' && c.type !== filter) return false;
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${c.checkNumber} ${c.serial || ''} ${c.bankName || ''} ${c.contactName || ''}`.toLowerCase().includes(q);
  });

  const dueSoon = checks.filter((c) => c.status === 'pending' || c.status === 'passed');
  const receivedChecks = checks.filter((c) => c.type === 'received');
  const issuedChecks = checks.filter((c) => c.type === 'issued');

  return (
    <div className="space-y-6">
      <PageHeader
        title="مدیریت چک"
        description="ثبت چک‌های دریافتی و پرداختی، پیگیری وضعیت و یادآوری سررسید"
        icon={<Banknote className="w-5 h-5" />}
        breadcrumb="عملیات / مدیریت چک"
        actions={
          <>
            <Button variant="outline" onClick={loadAll}>
              <RefreshCw className="w-4 h-4" /> بروزرسانی
            </Button>
            <Button onClick={() => {
              setEditing(null);
              setForm({ ...emptyCheck });
              setModal(true);
            }}>
              <Plus className="w-4 h-4" /> چک جدید
            </Button>
          </>
        }
      />

      {error && (
        <div className="bg-rose-50 text-rose-700 text-sm rounded-xl px-4 py-3 border border-rose-200">{error}</div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
        <StatCard title="کل چک‌ها" value={formatNumber(summary?.total ?? 0)} icon={<Banknote className="w-4 h-4" />} tone="brand" />
        <StatCard title="در جریان" value={formatNumber(summary?.pending ?? 0)} icon={<CalendarClock className="w-4 h-4" />} tone="amber" />
        <StatCard title="وصول شده" value={formatNumber(summary?.passed ?? 0)} icon={<CheckCircle2 className="w-4 h-4" />} tone="blue" />
        <StatCard title="برگشتی" value={formatNumber(summary?.returned ?? 0)} icon={<XCircle className="w-4 h-4" />} tone="red" />
        <StatCard title="سررسید ۱۴ روز آینده" value={formatNumber(summary?.dueSoon ?? 0)} icon={<AlertCircle className="w-4 h-4" />} tone="purple" />
        <StatCard title="مبلغ در جریان" value={formatMoney(summary?.pendingAmount ?? 0)} icon={<Landmark className="w-4 h-4" />} tone="green" />
      </div>

      {/* Due soon reminders */}
      {dueSoon.length > 0 && (
        <Card
          title="یادآوری سررسید"
          description="چک‌هایی که در ۱۴ روز آینده سررسید می‌شوند"
          icon={<AlertCircle className="w-4 h-4 text-amber-600" />}
        >
          <div className="flex flex-wrap gap-2">
            {dueSoon.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-3 py-1.5 text-[13px]">
                <Banknote className="w-3.5 h-3.5" />
                چک {c.checkNumber} — {c.contactName || 'بدون شخص'} — سررسید {c.dueDate}
                <span className="font-bold ltr-force">{formatMoney(c.amount)}</span>
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Filter toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Tabs
            tabs={[
              { id: 'all', label: 'همه' },
              { id: 'received', label: 'دریافتی', count: receivedChecks.length },
              { id: 'issued', label: 'پرداختی', count: issuedChecks.length },
            ]}
            active={filter}
            onChange={(v) => setFilter(v as 'all' | 'received' | 'issued')}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          >
            <option value="all">همه وضعیت‌ها</option>
            <option value="pending">در جریان</option>
            <option value="passed">وصول شده</option>
            <option value="returned">برگشتی</option>
            <option value="cashed">نقد شده</option>
            <option value="cancelled">باطل</option>
          </select>
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="جستجوی چک..." className="w-64" />
      </div>

      <Card padding={false}>
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Banknote className="w-7 h-7" />}
            title="چکی ثبت نشده"
            description="چک‌های دریافتی از مشتریان یا پرداختی به تأمین‌کنندگان را ثبت کنید و وضعیت آن‌ها را پیگیری نمایید."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-card w-full">
              <thead>
                <tr>
                  <th>نوع</th><th>شماره چک</th><th>سریال</th><th>بانک</th><th>مبلغ</th>
                  <th>تاریخ صدور</th><th>سررسید</th><th>شخص</th><th>وضعیت</th><th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Badge tone={c.type === 'received' ? 'green' : 'blue'}>
                        {c.type === 'received' ? 'دریافتی' : 'پرداختی'}
                      </Badge>
                    </td>
                    <td className="font-mono font-bold">{c.checkNumber}</td>
                    <td className="text-slate-500 font-mono text-xs">{c.serial || '—'}</td>
                    <td className="text-slate-500">{c.bankName || '—'}</td>
                    <td className="ltr-force font-bold">{formatMoney(c.amount)}</td>
                    <td className="text-slate-500">{c.issueDate}</td>
                    <td className={`font-bold ${c.status === 'pending' ? 'text-amber-700' : 'text-slate-500'}`}>{c.dueDate}</td>
                    <td className="text-slate-600">{c.contactName || '—'}</td>
                    <td><Badge tone={statusTone[c.status]} dot>{statusLabel[c.status]}</Badge></td>
                    <td>
                      <div className="flex items-center gap-1">
                        {(nextStatusOptions[c.status] || []).length > 0 && (
                          <select
                            value=""
                            onChange={(e) => e.target.value && changeStatus(c, e.target.value)}
                            className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-[11px]"
                          >
                            <option value="">تغییر وضعیت...</option>
                            {nextStatusOptions[c.status].map((s) => (
                              <option key={s} value={s}>{statusLabel[s]}</option>
                            ))}
                          </select>
                        )}
                        <button
                          onClick={() => {
                            setEditing(c);
                            setForm({
                              type: c.type, checkNumber: c.checkNumber, serial: c.serial || '',
                              bankName: c.bankName || '', amount: c.amount, issueDate: c.issueDate,
                              dueDate: c.dueDate, contactId: c.contactId, description: c.description || '',
                              notes: c.notes || '',
                            });
                            setModal(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-brand-50 hover:text-brand-700"
                          title="ویرایش"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteCheck(c)}
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

      {/* Check modal */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? `ویرایش چک ${editing.checkNumber}` : 'ثبت چک جدید'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setModal(false)}>انصراف</Button>
            <Button onClick={saveCheck}>ذخیره چک</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="نوع چک">
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as 'received' | 'issued' })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            >
              <option value="received">دریافتی</option>
              <option value="issued">پرداختی</option>
            </select>
          </Field>
          <Field label="شماره چک">
            <Input value={form.checkNumber} onChange={(e) => setForm({ ...form, checkNumber: e.target.value })} placeholder="مثلاً ۳۴۵۶۷۸" />
          </Field>
          <Field label="سریال">
            <Input value={form.serial} onChange={(e) => setForm({ ...form, serial: e.target.value })} />
          </Field>
          <Field label="بانک">
            <Input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} placeholder="مثلاً ملت" />
          </Field>
          <Field label="مبلغ (ریال)">
            <Input type="text" inputMode="decimal" persianNumbers value={form.amount} onChange={(e) => setForm({ ...form, amount: parsePersianNumber(e.target.value) })} />
          </Field>
          <Field label="شخص مرتبط">
            <select
              value={form.contactId ?? ''}
              onChange={(e) => setForm({ ...form, contactId: e.target.value ? Number(e.target.value) : null })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            >
              <option value="">بدون شخص</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="تاریخ صدور">
            <JalaliDatePicker value={form.issueDate} onChange={(v) => setForm({ ...form, issueDate: v })} />
          </Field>
          <Field label="سررسید">
            <JalaliDatePicker value={form.dueDate} onChange={(v) => setForm({ ...form, dueDate: v })} />
          </Field>
          <div className="md:col-span-2">
            <Field label="شرح">
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
