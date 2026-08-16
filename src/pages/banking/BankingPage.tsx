import { useState, useEffect, useMemo } from 'react';
import type { BankAccount, ReceiptVoucher, PaymentVoucher, Contact, Account } from '../../types/database';
import { tauriInvoke } from '../../lib/tauri';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { JalaliDatePicker } from '../../components/ui/JalaliDatePicker';
import { todayJalali } from '../../lib/jalali';
import {
  Building2,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Trash2,
  RefreshCw,
  X,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Wallet,
  Edit,
  Save,
  Search,
} from 'lucide-react';

type Tab = 'receipts' | 'payments' | 'banks';

interface VoucherFormData {
  show: boolean;
  number: string;
  date: string;
  contactId: string;
  bankAccountId: string;
  amount: string;
  paymentMethod: string;
  reference: string;
  description: string;
  error: string;
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'نقد' },
  { value: 'cheque', label: 'چک' },
  { value: 'card', label: 'کارت‌خوان' },
  { value: 'transfer', label: 'حواله' },
];

const emptyForm = (nextNumber: string): VoucherFormData => ({
  show: false,
  number: nextNumber,
  date: todayJalali(),
  contactId: '',
  bankAccountId: '',
  amount: '',
  paymentMethod: 'cash',
  reference: '',
  description: '',
  error: '',
});

export function BankingPage() {
  const [activeTab, setActiveTab] = useState<Tab>('receipts');
  const companyId = 1;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center shadow-brand">
            <Building2 className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">بانکداری</h1>
            <p className="text-[12px] text-slate-400">رسیدهای دریافت و پرداخت و حساب‌های بانکی</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-1 flex gap-1 mb-6">
        <TabBtn active={activeTab === 'receipts'} onClick={() => setActiveTab('receipts')} icon={ArrowDownLeft}>
          رسیدهای دریافت
        </TabBtn>
        <TabBtn active={activeTab === 'payments'} onClick={() => setActiveTab('payments')} icon={ArrowUpRight}>
          رسیدهای پرداخت
        </TabBtn>
        <TabBtn active={activeTab === 'banks'} onClick={() => setActiveTab('banks')} icon={Wallet}>
          حساب‌های بانکی
        </TabBtn>
      </div>

      {activeTab === 'receipts' && (
        <VouchersList
          kind="receipt"
          companyId={companyId}
          title="رسیدهای دریافت"
          subtitle="دریافت وجه از مشتریان یا سایر منابع — ثبت در حساب‌های بانکی/صندوق"
          accent="emerald"
        />
      )}
      {activeTab === 'payments' && (
        <VouchersList
          kind="payment"
          companyId={companyId}
          title="رسیدهای پرداخت"
          subtitle="پرداخت به تأمین‌کنندگان و سایر هزینه‌ها — برداشت از حساب‌های بانکی/صندوق"
          accent="rose"
        />
      )}
      {activeTab === 'banks' && <BankAccountsTab companyId={companyId} />}
    </div>
  );
}

// ---------------------------------------------------------------

function TabBtn({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
        active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
      }`}
    >
      <Icon className="w-4 h-4" />
      {children}
    </button>
  );
}

// ---------------------------------------------------------------

function VouchersList({
  kind,
  companyId,
  title,
  subtitle,
  accent,
}: {
  kind: 'receipt' | 'payment';
  companyId: number;
  title: string;
  subtitle: string;
  accent: 'emerald' | 'rose';
}) {
  const [items, setItems] = useState<(ReceiptVoucher | PaymentVoucher)[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<VoucherFormData>(emptyForm('REC-1001'));
  const [search, setSearch] = useState('');
  const [pageError, setPageError] = useState<string>('');

  const listCmd = kind === 'receipt' ? 'get_receipt_vouchers' : 'get_payment_vouchers';
  const createCmd = kind === 'receipt' ? 'create_receipt_voucher' : 'create_payment_voucher';
  const deleteCmd = kind === 'receipt' ? 'delete_receipt_voucher' : 'delete_payment_voucher';

  const fiscalYearId = 1; // For demo; ideally pulled from store

  const load = async () => {
    try {
      setLoading(true);
      setPageError('');
      const [list, cs, bs, accs] = await Promise.all([
        tauriInvoke<(ReceiptVoucher | PaymentVoucher)[]>(listCmd, { company_id: companyId }),
        tauriInvoke<Contact[]>('get_contacts', {}),
        tauriInvoke<BankAccount[]>('get_bank_accounts', { company_id: companyId }),
        tauriInvoke<Account[]>('get_accounts', {}),
      ]);
      setItems(list);
      setContacts(cs);
      setBankAccounts(bs);
      setAccounts(accs);
    } catch (e) {
      setPageError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const openCreate = () => {
    // Pick a fresh number: R/P + last id + 1
    const nextNum = items.length > 0 ? `${kind === 'receipt' ? 'REC' : 'PAY'}-${(items[0]?.id ?? 0) + 1001}` : '';
    setForm(emptyForm(nextNum || (kind === 'receipt' ? 'REC-1001' : 'PAY-1001')));
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (v) =>
        v.number.toLowerCase().includes(q) ||
        (v.contactName ?? '').toLowerCase().includes(q) ||
        (v.bankAccountLabel ?? '').toLowerCase().includes(q),
    );
  }, [items, search]);

  const handleSave = async () => {
    try {
      setForm((f) => ({ ...f, error: '' }));
      const amount = parseFloat(form.amount) || 0;
      if (amount <= 0) {
        setForm((f) => ({ ...f, error: 'مبلغ باید بزرگتر از صفر باشد' }));
        return;
      }
      const bankId = parseInt(form.bankAccountId);
      if (!bankId) {
        setForm((f) => ({ ...f, error: 'انتخاب حساب بانکی/صندوق الزامی است' }));
        return;
      }

      // For the contact_account side we use a heuristic: any liability account
      // on payment side, any asset account on receipt side.
      // (Contacts table has `account_id` in DB but the frontend Contact type
      //  doesn't expose it yet — we just use the type-based fallback.)
      const targetType = kind === 'receipt' ? 'asset' : 'liability';
      const fallbackAcc = accounts.find((a) => a.type === targetType);
      const contactAccountId = fallbackAcc?.id ?? null;
      if (!contactAccountId) {
        setForm((f) => ({ ...f, error: 'حساب طرف حساب یافت نشد' }));
        return;
      }

      const opts = {
        company_id: companyId,
        fiscal_year_id: fiscalYearId,
        number: form.number,
        date: form.date,
        contact_id: form.contactId ? parseInt(form.contactId) : null,
        contact_account_id: contactAccountId,
        bank_account_id: bankId,
        amount,
        payment_method: form.paymentMethod,
        reference: form.reference,
        description: form.description,
      };

      await tauriInvoke<number>(createCmd, opts);
      setForm((f) => ({ ...f, show: false }));
      await load();
    } catch (e) {
      setForm((f) => ({ ...f, error: String(e) }));
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('آیا از حذف این رسید اطمینان دارید؟ سند حسابداری آن نیز حذف می‌شود.')) {
      return;
    }
    try {
      setPageError('');
      await tauriInvoke(deleteCmd, { id });
      await load();
    } catch (e) {
      setPageError(String(e));
    }
  };

  const totals = useMemo(() => {
    const total = filtered.reduce((s, v) => s + v.amount, 0);
    return { total };
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              {kind === 'receipt' ? (
                <ArrowDownLeft className="w-5 h-5 text-emerald-600" />
              ) : (
                <ArrowUpRight className="w-5 h-5 text-rose-600" />
              )}
              {title}
            </h2>
            <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={load} size="sm">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              onClick={() => {
                openCreate();
                setForm((f) => ({ ...f, show: true }));
              }}
            >
              <Plus className="w-4 h-4 ml-1" />
              {kind === 'receipt' ? 'رسید جدید' : 'پرداخت جدید'}
            </Button>
          </div>
        </div>

        <div className="relative mb-4">
          <Input
            type="text"
            placeholder="جستجو در شماره، طرف حساب، حساب بانکی..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
        </div>

        {pageError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg mb-4">
            {pageError}
          </div>
        )}

        {form.show && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-800">
                {kind === 'receipt' ? 'ایجاد رسید دریافت' : 'ایجاد رسید پرداخت'}
              </h3>
              <button onClick={() => setForm((f) => ({ ...f, show: false }))}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {form.error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-2 rounded mb-3">
                {form.error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">شماره رسید</label>
                <Input
                  value={form.number}
                  onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">تاریخ</label>
                <JalaliDatePicker value={form.date} onChange={(v) => setForm((f) => ({ ...f, date: v }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">مبلغ</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  persianNumbers
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  حساب بانکی/صندوق
                </label>
                <select
                  value={form.bankAccountId}
                  onChange={(e) => setForm((f) => ({ ...f, bankAccountId: e.target.value }))}
                  className="w-full p-2 border border-slate-200 rounded-md bg-white text-sm"
                >
                  <option value="">— انتخاب کنید —</option>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.accountId}>
                      {b.accountCode} — {b.accountName}
                      {b.bankName ? ` (${b.bankName})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">طرف حساب</label>
                <select
                  value={form.contactId}
                  onChange={(e) => setForm((f) => ({ ...f, contactId: e.target.value }))}
                  className="w-full p-2 border border-slate-200 rounded-md bg-white text-sm"
                >
                  <option value="">— انتخاب کنید (اختیاری) —</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">روش پرداخت</label>
                <select
                  value={form.paymentMethod}
                  onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}
                  className="w-full p-2 border border-slate-200 rounded-md bg-white text-sm"
                >
                  {PAYMENT_METHODS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <label className="block text-xs font-medium text-slate-600 mb-1">شرح</label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="مثلاً دریافت بابت فاکتور INV-1001"
                />
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <label className="block text-xs font-medium text-slate-600 mb-1">مرجع</label>
                <Input
                  value={form.reference}
                  onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
                  placeholder="مثلاً شماره چک / شماره پیگیری"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleSave}>
                <Save className="w-4 h-4 ml-1" />
                ثبت رسید
              </Button>
              <Button variant="secondary" onClick={() => setForm((f) => ({ ...f, show: false }))}>
                انصراف
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="p-6 text-center text-slate-500">در حال بارگذاری...</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-slate-500">
            {search.trim() ? 'موردی یافت نشد' : 'هنوز رسیدی ثبت نشده است.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="p-3 text-right font-semibold">شماره</th>
                  <th className="p-3 text-right font-semibold">تاریخ</th>
                  <th className="p-3 text-right font-semibold">طرف حساب</th>
                  <th className="p-3 text-right font-semibold">حساب</th>
                  <th className="p-3 text-right font-semibold">روش</th>
                  <th className="p-3 text-right font-semibold">مبلغ</th>
                  <th className="p-3 text-right font-semibold">شرح</th>
                  <th className="p-3 text-center font-semibold">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => (
                  <tr key={v.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-3 font-medium">{v.number}</td>
                    <td className="p-3 ltr-force">{v.date}</td>
                    <td className="p-3 text-slate-700">{v.contactName ?? '—'}</td>
                    <td className="p-3 text-slate-600 text-xs ltr-force">
                      {v.bankAccountLabel ?? '—'}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-block text-xs px-2 py-1 rounded-full ${
                          accent === 'emerald' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {PAYMENT_METHODS.find((p) => p.value === v.paymentMethod)?.label ??
                          v.paymentMethod}
                      </span>
                    </td>
                    <td className="p-3 ltr-force font-bold">
                      {Math.round(v.amount).toLocaleString('fa-IR')}
                    </td>
                    <td className="p-3 text-xs text-slate-500 max-w-xs truncate" title={v.description}>
                      {v.description || v.reference || '—'}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleDelete(v.id)}
                        className="text-rose-500 hover:text-rose-700 p-1"
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold">
                  <td colSpan={5} className="p-3 text-right">
                    جمع ({filtered.length.toLocaleString('fa-IR')} رسید)
                  </td>
                  <td className="p-3 ltr-force">
                    {Math.round(totals.total).toLocaleString('fa-IR')}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------

function BankAccountsTab({ companyId }: { companyId: number }) {
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState({
    accountId: '',
    bankName: '',
    accountNumber: '',
    branch: '',
    iban: '',
  });

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const [b, a] = await Promise.all([
        tauriInvoke<BankAccount[]>('get_bank_accounts', { company_id: companyId }),
        tauriInvoke<Account[]>('get_accounts', {}),
      ]);
      setBanks(b);
      setAccounts(a);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    try {
      setError('');
      if (!draft.accountId) {
        setError('انتخاب حساب دفتر کل الزامی است');
        return;
      }
      await tauriInvoke('upsert_bank_account', {
        company_id: companyId,
        account_id: parseInt(draft.accountId),
        bank_name: draft.bankName,
        account_number: draft.accountNumber,
        branch: draft.branch,
        iban: draft.iban,
      });
      setEditing(null);
      setDraft({ accountId: '', bankName: '', accountNumber: '', branch: '', iban: '' });
      await load();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('حذف اطلاعات بانکی این حساب؟ (اگر رسید داشته باشد، حذف ممکن نیست)')) {
      return;
    }
    try {
      setError('');
      await tauriInvoke('delete_bank_account', { id });
      await load();
    } catch (e) {
      setError(String(e));
    }
  };

  const startEdit = (b: BankAccount) => {
    setEditing(b.id);
    setDraft({
      accountId: String(b.accountId),
      bankName: b.bankName,
      accountNumber: b.accountNumber,
      branch: b.branch,
      iban: b.iban,
    });
  };

  const candidateAccounts = accounts.filter(
    (a) => a.isActive && (a.type === 'asset') && !banks.some((b) => b.accountId === a.id),
  );

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            حساب‌های بانکی
          </h2>
          <Button variant="secondary" onClick={load}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg mb-4 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5" />
            {error}
          </div>
        )}

        {editing === null && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
            <h3 className="font-semibold mb-3">افزودن / ویرایش اطلاعات حساب بانکی</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  حساب دفتر کل (دارایی)
                </label>
                <select
                  value={draft.accountId}
                  onChange={(e) => setDraft({ ...draft, accountId: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-md bg-white text-sm"
                >
                  <option value="">— انتخاب کنید —</option>
                  {candidateAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">نام بانک</label>
                <Input value={draft.bankName} onChange={(e) => setDraft({ ...draft, bankName: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">شماره حساب</label>
                <Input
                  value={draft.accountNumber}
                  onChange={(e) => setDraft({ ...draft, accountNumber: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">شعبه</label>
                <Input value={draft.branch} onChange={(e) => setDraft({ ...draft, branch: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">شماره شبا (IBAN)</label>
                <Input value={draft.iban} onChange={(e) => setDraft({ ...draft, iban: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Button onClick={handleSave}>
                <Save className="w-4 h-4 ml-1" />
                ذخیره
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setEditing(null);
                  setDraft({ accountId: '', bankName: '', accountNumber: '', branch: '', iban: '' });
                }}
              >
                انصراف
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="p-6 text-center text-slate-500">در حال بارگذاری...</div>
        ) : banks.length === 0 ? (
          <div className="p-6 text-center text-slate-500">
            هنوز حساب بانکی ثبت نشده است. ابتدا یک حساب دارایی در دفتر کل ایجاد کنید (مثلاً ۱۱۰۲ بانک)، سپس از فرم بالا به آن اطلاعات بانکی متصل کنید.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-3 text-right font-semibold">کد</th>
                <th className="p-3 text-right font-semibold">نام حساب</th>
                <th className="p-3 text-right font-semibold">بانک</th>
                <th className="p-3 text-right font-semibold">شماره حساب</th>
                <th className="p-3 text-right font-semibold">شعبه</th>
                <th className="p-3 text-right font-semibold">موجودی</th>
                <th className="p-3 text-center font-semibold">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {banks.map((b) => (
                <tr key={b.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-3 font-mono text-xs">{b.accountCode}</td>
                  <td className="p-3">{b.accountName}</td>
                  <td className="p-3">{b.bankName || '—'}</td>
                  <td className="p-3 ltr-force">{b.accountNumber || '—'}</td>
                  <td className="p-3">{b.branch || '—'}</td>
                  <td className="p-3 ltr-force font-medium">
                    {Math.round(b.balance).toLocaleString('fa-IR')}
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => startEdit(b)}
                        className="text-blue-600 hover:text-blue-800 p-1"
                        title="ویرایش"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(b.id)}
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
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------

// Tiny stat card helper kept here so the page stays self-contained.
export function VoucherStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: 'emerald' | 'rose';
}) {
  const cls =
    accent === 'emerald' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700';
  return (
    <div className={`p-3 border border-current/10 rounded-lg ${cls}`}>
      <div className="text-xs opacity-80">{label}</div>
      <div className="text-xl font-bold ltr-force mt-1">{Math.round(value).toLocaleString('fa-IR')}</div>
    </div>
  );
}

export { ChevronDown, ChevronUp };
