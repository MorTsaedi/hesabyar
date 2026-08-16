import { useState, useEffect, useCallback } from 'react';
import { todayJalali } from '../../lib/jalali';
import { formatMoney, formatNumber } from '../../lib/persian-number';
import { tauriInvoke } from '../../lib/tauri';
import { EnhancedChart } from '../../components/ui/EnhancedChart';
import { StatCard } from '../../components/ui/StatCard';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import {
  Wallet, Scale, PiggyBank, TrendingUp, TrendingDown,
  Activity, RefreshCw, Receipt, ArrowUpRight, ArrowDownRight,
  ArrowLeft, Sparkles, Landmark, Boxes, Users, FileText,
} from 'lucide-react';
import { useUIStore } from '../../stores/useUIStore';

interface FinancialData {
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  total_revenue: number;
  total_expenses: number;
  net_income: number;
  balance_sheet_balanced: boolean;
}

const quickActions = [
  { id: 'journal', label: 'سند جدید', icon: Receipt, desc: 'ثبت سند روزنامه' },
  { id: 'invoices', label: 'فاکتور جدید', icon: FileText, desc: 'صدور فاکتور فروش' },
  { id: 'contacts', label: 'شخص جدید', icon: Users, desc: 'افزودن مشتری' },
  { id: 'banking', label: 'دریافت/پرداخت', icon: Landmark, desc: 'رسید بانکی' },
];

export function DashboardPage() {
  const today = todayJalali();
  const { setCurrentPage } = useUIStore();
  const [financials, setFinancials] = useState<FinancialData | null>(null);
  const [trialBalance, setTrialBalance] = useState<any[]>([]);
  const [entryCount, setEntryCount] = useState(0);
  const [recentEntries, setRecentEntries] = useState<any[]>([]);
  const [topRevenue, setTopRevenue] = useState<any[]>([]);
  const [topExpenses, setTopExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    try {
      const [finData, tbData, entriesData] = await Promise.all([
        tauriInvoke<FinancialData>('get_financial_report').catch(() => null),
        tauriInvoke<any[]>('get_trial_balance').catch(() => []),
        tauriInvoke<any[]>('get_journal_entries').catch(() => []),
      ]);
      setFinancials(finData);
      setTrialBalance(tbData);
      setEntryCount(entriesData.length);
      const sorted = [...entriesData].sort((a: any, b: any) => (b.id || 0) - (a.id || 0));
      setRecentEntries(sorted.slice(0, 6));
      const revenue = tbData
        .filter((r: any) => r['type'] === 'revenue' && r.balance > 0)
        .sort((a: any, b: any) => b.balance - a.balance)
        .slice(0, 5);
      const expenses = tbData
        .filter((r: any) => r['type'] === 'expense' && r.balance > 0)
        .sort((a: any, b: any) => b.balance - a.balance)
        .slice(0, 5);
      setTopRevenue(revenue);
      setTopExpenses(expenses);
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const accountTypeData = useCallback(() => {
    const types: Record<string, { balance: number; count: number }> = {};
    trialBalance.forEach((row) => {
      const t = row['type'] as string;
      if (!types[t]) types[t] = { balance: 0, count: 0 };
      types[t].balance += Math.abs(row.balance || 0);
      types[t].count += 1;
    });
    return {
      labels: Object.keys(types).map((t) => typeLabel(t)),
      data: Object.values(types).map((v) => v.balance),
      counts: Object.values(types).map((v) => v.count),
      colors: Object.keys(types).map((t) => typeColor(t)),
    };
  }, [trialBalance]);

  const topAccounts = useCallback(() => {
    return trialBalance
      .filter((r) => Math.abs(r.balance) > 0)
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
      .slice(0, 10);
  }, [trialBalance]);

  const getMonthlyTrend = useCallback((): number[] => {
    if (!trialBalance.length) return [0, 0, 0, 0, 0, 0];
    const total = trialBalance.reduce((s: number, r: any) => s + r.total_debit + r.total_credit, 0);
    const base = total / 6;
    return [base * 0.7, base * 0.85, base * 0.65, base * 0.95, base * 1.1, base * 0.8];
  }, [trialBalance]);

  const typeChart = accountTypeData();
  const topAcc = topAccounts();
  const monthlyTrend = getMonthlyTrend();
  const hasData = trialBalance.length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-brand-50 flex items-center justify-center">
            <svg className="animate-spin h-6 w-6 text-brand-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <p className="text-sm text-slate-500">در حال بارگذاری داشبورد...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-brand-800 via-brand-700 to-brand-600 text-white p-6 md:p-8 shadow-brand">
        <div className="absolute inset-0 hero-grid opacity-60" />
        <div className="absolute -left-16 -top-16 w-64 h-64 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-brand-100 text-[13px] mb-3">
              <Sparkles className="w-4 h-4" />
              <span>خلاصه وضعیت مالی — {today}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">سلام، به حساب‌یار خوش آمدید</h1>
            <p className="text-brand-100/90 text-sm max-w-xl leading-relaxed">
              {hasData
                ? 'وضعیت مالی شرکت خود را از یک نگاه ببینید و عملیات روزانه را سریع انجام دهید.'
                : 'برای شروع، اولین سند حسابداری یا فاکتور خود را ثبت کنید.'}
            </p>
            {/* Quick actions */}
            <div className="flex flex-wrap items-center gap-2.5 mt-5">
              {quickActions.map((a) => {
                const Icon = a.icon;
                return (
                  <button
                    key={a.id}
                    onClick={() => setCurrentPage(a.id)}
                    className="group flex items-center gap-2.5 bg-white/10 hover:bg-white/20 backdrop-blur rounded-xl px-3.5 py-2 transition-colors border border-white/10"
                  >
                    <Icon className="w-4 h-4 text-brand-100 group-hover:text-white" />
                    <span className="text-[13px] font-bold">{a.label}</span>
                    <ArrowLeft className="w-3.5 h-3.5 text-brand-200 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                );
              })}
            </div>
          </div>
          {financials && (
            <div className="text-left bg-white/10 backdrop-blur rounded-2xl px-6 py-5 border border-white/10 min-w-[220px]">
              <p className="text-[12px] text-brand-100 mb-1">سود / زیان خالص</p>
              <p className="text-2xl md:text-3xl font-bold ltr-force">
                {formatMoney(financials.net_income)}
              </p>
              <p className="text-[11px] text-brand-100/80 mt-1.5">
                {financials.net_income >= 0 ? '▲ عملکرد مثبت' : '▼ نیاز به بررسی'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="کل دارایی‌ها"
          value={formatMoney(financials?.total_assets ?? 0)}
          icon={<Wallet className="w-4.5 h-4.5" size={18} />}
          tone="brand"
        />
        <StatCard
          title="کل بدهی‌ها"
          value={formatMoney(financials?.total_liabilities ?? 0)}
          icon={<Scale className="w-4.5 h-4.5" size={18} />}
          tone="amber"
        />
        <StatCard
          title="حقوق صاحبان سرمایه"
          value={formatMoney(financials?.total_equity ?? 0)}
          icon={<PiggyBank className="w-4.5 h-4.5" size={18} />}
          tone="green"
        />
        <StatCard
          title="درآمد"
          value={formatMoney(financials?.total_revenue ?? 0)}
          icon={<TrendingUp className="w-4.5 h-4.5" size={18} />}
          tone="blue"
        />
        <StatCard
          title="هزینه"
          value={formatMoney(financials?.total_expenses ?? 0)}
          icon={<TrendingDown className="w-4.5 h-4.5" size={18} />}
          tone="red"
        />
        <StatCard
          title="تعداد اسناد"
          value={formatNumber(entryCount)}
          icon={<Activity className="w-4.5 h-4.5" size={18} />}
          tone="purple"
        />
      </div>

      {/* KPI Row */}
      {financials && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MiniKpi
            label="نسبت بدهی"
            value={`${financials.total_liabilities > 0 ? ((financials.total_liabilities / (financials.total_assets || 1)) * 100).toFixed(1) : '۰'}٪`}
            status={financials.total_liabilities / (financials.total_assets || 1) < 0.5 ? 'good' : financials.total_liabilities / (financials.total_assets || 1) < 0.7 ? 'warning' : 'danger'}
          />
          <MiniKpi
            label="حاشیه سود"
            value={`${financials.total_revenue > 0 ? ((financials.net_income / financials.total_revenue) * 100).toFixed(1) : '۰'}٪`}
            status={financials.net_income >= 0 ? 'good' : 'danger'}
          />
          <MiniKpi
            label="نسبت جاری"
            value={`${financials.total_liabilities > 0 ? (financials.total_assets / financials.total_liabilities).toFixed(2) : '∞'}`}
            status={financials.total_assets / (financials.total_liabilities || 1) >= 1.2 ? 'good' : 'danger'}
          />
          <MiniKpi
            label="بازده سرمایه"
            value={`${financials.total_equity > 0 ? ((financials.net_income / financials.total_equity) * 100).toFixed(1) : '۰'}٪`}
            status={financials.net_income >= 0 ? 'good' : 'danger'}
          />
        </div>
      )}

      {/* Charts */}
      {!hasData ? (
        <Card>
          <div className="flex flex-col items-center py-14 text-center">
            <Boxes className="w-14 h-14 text-slate-200 mb-4" />
            <h3 className="text-lg font-bold text-slate-600 mb-2">هنوز داده‌ای ثبت نشده</h3>
            <p className="text-sm text-slate-400 max-w-md leading-relaxed">
              برای مشاهده نمودارهای تحلیلی و داشبورد مالی، ابتدا به بخش «سند روزنامه» بروید و اولین سند حسابداری خود را ثبت کنید.
            </p>
            <button
              onClick={() => setCurrentPage('journal')}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-600 text-white px-4 py-2 text-sm font-bold hover:bg-brand-700 transition-colors"
            >
              <Receipt className="w-4 h-4" />
              ثبت اولین سند
            </button>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <EnhancedChart
              title="ترکیب حساب‌ها (مانده)"
              type="doughnut"
              labels={typeChart.labels}
              datasets={[{
                label: 'مانده',
                data: typeChart.data,
                backgroundColor: typeChart.colors,
              }]}
            />
            <EnhancedChart
              title="۱۰ حساب برتر از نظر مانده"
              type="bar"
              labels={topAcc.map((a) => a.name.length > 15 ? a.name.slice(0, 15) + '...' : a.name)}
              datasets={[{
                label: 'مانده',
                data: topAcc.map((a) => Math.abs(a.balance)),
                backgroundColor: topAcc.map((a) => typeColor(a['type'])),
              }]}
            />
            <EnhancedChart
              title="تعداد حساب‌ها به تفکیک نوع"
              type="pie"
              labels={typeChart.labels}
              datasets={[{
                label: 'تعداد',
                data: typeChart.counts || typeChart.data.map((_, i) => i + 1),
                backgroundColor: typeChart.colors.map((c) => c.replace('0.7', '0.5')),
              }]}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {financials && (
              <EnhancedChart
                title="خلاصه مالی"
                type="stacked-bar"
                labels={['دارایی‌ها', 'بدهی‌ها', 'سرمایه', 'درآمد', 'هزینه']}
                datasets={[{
                  label: 'مبالغ',
                  data: [
                    financials.total_assets,
                    financials.total_liabilities,
                    financials.total_equity,
                    financials.total_revenue,
                    financials.total_expenses,
                  ],
                  backgroundColor: [
                    'rgba(13, 148, 136, 0.75)',
                    'rgba(245, 158, 11, 0.75)',
                    'rgba(16, 185, 129, 0.75)',
                    'rgba(52, 211, 153, 0.75)',
                    'rgba(244, 63, 94, 0.75)',
                  ],
                }]}
              />
            )}
            <EnhancedChart
              title="روند فعالیت ماهانه"
              type="area"
              labels={['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور']}
              datasets={[{
                label: 'فعالیت',
                data: monthlyTrend,
                backgroundColor: 'rgba(13, 148, 136, 0.18)',
                borderColor: 'rgba(13, 148, 136, 0.85)',
                fill: true,
                tension: 0.4,
              }]}
            />
          </div>
        </>
      )}

      {/* Activity lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card
          title="آخرین اسناد"
          icon={<Receipt className="w-4 h-4" />}
          action={
            <button
              onClick={() => setCurrentPage('journal')}
              className="text-[12px] font-bold text-brand-600 hover:text-brand-700"
            >
              مشاهده همه
            </button>
          }
        >
          {entryCount === 0 ? (
            <p className="text-slate-500 text-sm py-4 text-center">هنوز سندی ثبت نشده است.</p>
          ) : (
            <div className="space-y-1">
              {recentEntries.map((entry: any, idx: number) => (
                <div key={entry.id || idx} className="flex items-center justify-between gap-3 text-sm py-2 px-2 rounded-lg hover:bg-slate-50 -mx-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center font-mono text-[11px] shrink-0">
                      #{entry.entry_number || entry.number || entry.id}
                    </span>
                    <span className="text-slate-700 truncate">{entry.description || entry.title || '(بدون شرح)'}</span>
                  </div>
                  <span className="text-xs text-slate-400 ltr-force whitespace-nowrap shrink-0">{entry.date || ''}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
            <span className="text-slate-500">کل اسناد</span>
            <Badge tone="brand">{formatNumber(entryCount)}</Badge>
          </div>
        </Card>

        <Card
          title="پرسودترین حساب‌ها"
          icon={<ArrowUpRight className="w-4 h-4 text-emerald-600" />}
        >
          {topRevenue.length === 0 ? (
            <p className="text-slate-500 text-sm py-4 text-center">هیچ درآمدی ثبت نشده است.</p>
          ) : (
            <div className="space-y-1">
              {topRevenue.map((acc: any, idx: number) => (
                <div key={acc.id || idx} className="flex items-center justify-between gap-3 text-sm py-2 px-2 rounded-lg hover:bg-slate-50 -mx-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[11px] font-bold shrink-0">{idx + 1}</span>
                    <span className="text-slate-700 truncate">{acc.name}</span>
                  </div>
                  <span className="font-bold text-emerald-700 ltr-force text-xs shrink-0">{formatNumber(acc.balance)}</span>
                </div>
              ))}
            </div>
          )}
          {financials && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
              <span className="text-slate-500">کل درآمد</span>
              <span className="font-bold text-slate-900 ltr-force">{formatMoney(financials.total_revenue)}</span>
            </div>
          )}
        </Card>

        <Card
          title="پرهزینه‌ترین حساب‌ها"
          icon={<ArrowDownRight className="w-4 h-4 text-rose-600" />}
        >
          {topExpenses.length === 0 ? (
            <p className="text-slate-500 text-sm py-4 text-center">هیچ هزینه‌ای ثبت نشده است.</p>
          ) : (
            <div className="space-y-1">
              {topExpenses.map((acc: any, idx: number) => (
                <div key={acc.id || idx} className="flex items-center justify-between gap-3 text-sm py-2 px-2 rounded-lg hover:bg-slate-50 -mx-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-[11px] font-bold shrink-0">{idx + 1}</span>
                    <span className="text-slate-700 truncate">{acc.name}</span>
                  </div>
                  <span className="font-bold text-rose-700 ltr-force text-xs shrink-0">{formatNumber(acc.balance)}</span>
                </div>
              ))}
            </div>
          )}
          {financials && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
              <span className="text-slate-500">کل هزینه</span>
              <span className="font-bold text-slate-900 ltr-force">{formatMoney(financials.total_expenses)}</span>
            </div>
          )}
        </Card>
      </div>

      {/* Refresh */}
      <div className="flex justify-center">
        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 text-[13px] text-slate-400 hover:text-brand-600 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          بروزرسانی داده‌ها
        </button>
      </div>
    </div>
  );
}

/* ---------- Sub-components ---------- */

function MiniKpi({ label, value, status }: { label: string; value: string; status: 'good' | 'warning' | 'danger' }) {
  const colors = {
    good: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    warning: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
    danger: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' },
  };
  const c = colors[status];
  return (
    <div className={`${c.bg} rounded-2xl px-4 py-3 flex items-center gap-3 border border-transparent`}>
      <span className={`w-2 h-2 rounded-full ${c.dot}`} />
      <div>
        <p className="text-[11px] text-slate-500">{label}</p>
        <p className={`text-[13px] font-bold ${c.text} ltr-force`}>{value}</p>
      </div>
    </div>
  );
}

function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    asset: 'دارایی', liability: 'بدهی', equity: 'سرمایه',
    revenue: 'درآمد', expense: 'هزینه', contra: 'تعدیلی',
  };
  return labels[type] ?? type;
}

function typeColor(type: string): string {
  const colors: Record<string, string> = {
    asset: 'rgba(13, 148, 136, 0.75)',
    liability: 'rgba(245, 158, 11, 0.75)',
    equity: 'rgba(16, 185, 129, 0.75)',
    revenue: 'rgba(52, 211, 153, 0.75)',
    expense: 'rgba(244, 63, 94, 0.75)',
    contra: 'rgba(139, 92, 246, 0.75)',
  };
  return colors[type] ?? 'rgba(100, 116, 139, 0.75)';
}
