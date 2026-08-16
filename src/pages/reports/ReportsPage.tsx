import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Account, CashFlowReport, BalanceSheetDetails, IncomeStatementDetails, BudgetVsActualRow, BudgetPeriod } from '../../types/database';
import { tauriInvoke } from '../../lib/tauri';
import { formatNumber } from '../../lib/persian-number';
import { EnhancedChart } from '../../components/ui/EnhancedChart';
import { JalaliDatePicker } from '../../components/ui/JalaliDatePicker';
import { exportToPdf, exportToExcel, prepareExportData } from '../../lib/export';
import { FileText, BookOpen, Scale, TrendingUp, TrendingDown, AlertTriangle, Download, Columns, Check, ChevronDown, Wallet, FileDown, Table2, RefreshCw } from 'lucide-react';

type ReportTab = 'trial' | 'ledger' | 'balance' | 'income' | 'cashflow' | 'budget';

interface TrialBalanceRow {
  id: number;
  code: string;
  name: string;
  level: number;
  account_type: string;
  total_debit: number;
  total_credit: number;
  balance: number;
}

interface TrialBalanceComparisonRow {
  id: number;
  code: string;
  name: string;
  level: number;
  account_type: string;
  current_debit: number;
  current_credit: number;
  current_balance: number;
  previous_debit: number;
  previous_credit: number;
  previous_balance: number;
  variance: number;
  variance_pct: number;
}

interface LedgerRow {
  entry_id: number;
  entry_number: number;
  date: string;
  entry_description: string;
  line_description: string;
  debit: number;
  credit: number;
  balance: number;
}

interface FinancialReportComparison {
  current_assets: number;
  current_liabilities: number;
  current_equity: number;
  current_revenue: number;
  current_expenses: number;
  current_net_income: number;
  previous_assets: number;
  previous_liabilities: number;
  previous_equity: number;
  previous_revenue: number;
  previous_expenses: number;
  previous_net_income: number;
  variance_assets: number;
  variance_liabilities: number;
  variance_equity: number;
  variance_revenue: number;
  variance_expenses: number;
  variance_net_income: number;
  variance_pct_assets: number;
  variance_pct_liabilities: number;
  variance_pct_equity: number;
  variance_pct_revenue: number;
  variance_pct_expenses: number;
  variance_pct_net_income: number;
}

interface FinancialReport {
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  total_revenue: number;
  total_expenses: number;
  net_income: number;
  balance_sheet_balanced: boolean;
}

// Column chooser types
type TrialColumn = 'code' | 'name' | 'type' | 'debit' | 'credit' | 'balance';
type LedgerColumn = 'entryNumber' | 'date' | 'description' | 'debit' | 'credit' | 'balance';

const TRIAL_COLUMNS: { key: TrialColumn; label: string; default: boolean }[] = [
  { key: 'code', label: 'کد حساب', default: true },
  { key: 'name', label: 'نام حساب', default: true },
  { key: 'type', label: 'نوع', default: true },
  { key: 'debit', label: 'بدهکار', default: true },
  { key: 'credit', label: 'بستانکار', default: true },
  { key: 'balance', label: 'مانده', default: true },
];

const LEDGER_COLUMNS: { key: LedgerColumn; label: string; default: boolean }[] = [
  { key: 'entryNumber', label: 'شماره سند', default: true },
  { key: 'date', label: 'تاریخ', default: true },
  { key: 'description', label: 'شرح', default: true },
  { key: 'debit', label: 'بدهکار', default: true },
  { key: 'credit', label: 'بستانکار', default: true },
  { key: 'balance', label: 'مانده', default: true },
];

function ColumnChooser<T extends string>({
  columns,
  visibleColumns,
  onToggle,
}: {
  columns: { key: T; label: string; default: boolean }[];
  visibleColumns: Set<T>;
  onToggle: (key: T) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    if (isOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const visibleCount = visibleColumns.size;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
          visibleCount !== columns.length
            ? 'bg-primary-100 text-primary-700 border border-primary-300'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        }`}
      >
        <Columns className="w-4 h-4" />
        <span>ستونها</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-10 p-2">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
            <button
              onClick={() => columns.forEach((c) => visibleColumns.has(c.key) || onToggle(c.key))}
              className="text-xs text-primary-600 hover:text-primary-800"
            >
              انتخاب همه
            </button>
            <button
              onClick={() => columns.forEach((c) => visibleColumns.has(c.key) && onToggle(c.key))}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              حذف همه
            </button>
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {columns.map((col) => {
              const isVisible = visibleColumns.has(col.key);
              return (
                <button
                  key={col.key}
                  onClick={() => onToggle(col.key)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors hover:bg-slate-50"
                >
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center ${
                      isVisible
                        ? 'bg-primary-600 border-primary-600'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {isVisible && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className={isVisible ? 'text-slate-800' : 'text-slate-400'}>
                    {col.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('trial');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [trialBalance, setTrialBalance] = useState<TrialBalanceRow[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [financialReport, setFinancialReport] = useState<FinancialReport | null>(null);
  const [cashFlow, setCashFlow] = useState<CashFlowReport | null>(null);
  const [cashFlowFrom, setCashFlowFrom] = useState('1404/01/01');
  const [cashFlowTo, setCashFlowTo] = useState('1404/12/29');
  const [reportCompare, setReportCompare] = useState(false);
  const [reportComparison, setReportComparison] = useState<FinancialReportComparison | null>(null);
  const [reportPrevFrom, setReportPrevFrom] = useState('');
  const [reportPrevTo, setReportPrevTo] = useState('');
  const [budgetPeriods, setBudgetPeriods] = useState<BudgetPeriod[]>([]);
  const [selectedBudgetPeriod, setSelectedBudgetPeriod] = useState<number | null>(null);
  const [budgetData, setBudgetData] = useState<BudgetVsActualRow[]>([]);
  const [trialFromDate, setTrialFromDate] = useState('');
  const [trialToDate, setTrialToDate] = useState('');
  const [trialCompare, setTrialCompare] = useState(false);
  const [trialComparison, setTrialComparison] = useState<TrialBalanceComparisonRow[]>([]);
  const [trialPrevFrom, setTrialPrevFrom] = useState('');
  const [trialPrevTo, setTrialPrevTo] = useState('');
  const [ledgerFromDate, setLedgerFromDate] = useState('');
  const [ledgerToDate, setLedgerToDate] = useState('');
  const [reportFromDate, setReportFromDate] = useState('');
  const [reportToDate, setReportToDate] = useState('');


  const [balanceSheetDetail, setBalanceSheetDetail] = useState<BalanceSheetDetails | null>(null);
  const [incomeStatementDetail, setIncomeStatementDetail] = useState<IncomeStatementDetails | null>(null);
  const [showBalanceDetail, setShowBalanceDetail] = useState(false);
  const [showIncomeDetail, setShowIncomeDetail] = useState(false);

  const loadBudgetPeriods = useCallback(async () => {
    try {
      const data = await tauriInvoke<BudgetPeriod[]>('get_budget_periods', { company_id: 1 });
      setBudgetPeriods(data);
    } catch (err) {
      console.error('Failed to load budget periods:', err);
    }
  }, []);

  const loadBudgetData = useCallback(async () => {
    if (!selectedBudgetPeriod) { setBudgetData([]); return; }
    try {
      const data = await tauriInvoke<BudgetVsActualRow[]>('get_budget_vs_actual', {
        budget_period_id: selectedBudgetPeriod,
        from_date: null,
        to_date: null,
      });
      setBudgetData(data);
    } catch (err) {
      console.error('Failed to load budget vs actual:', err);
    }
  }, [selectedBudgetPeriod]);

  useEffect(() => {
    if (activeTab === 'budget' && selectedBudgetPeriod) loadBudgetData();
  }, [activeTab, selectedBudgetPeriod, loadBudgetData]);

  const exportBudget = () => {
    const data = prepareExportData(
      [
        { key: 'account_code', label: 'کد حساب' },
        { key: 'account_name', label: 'نام حساب' },
        { key: 'account_type', label: 'نوع' },
        { key: 'budget_amount', label: 'بودجه' },
        { key: 'actual_amount', label: 'واقعی' },
        { key: 'variance', label: 'تغییرات' },
        { key: 'variance_pct', label: 'درصد تغییر' },
      ],
      budgetData as unknown as Record<string, unknown>[]
    );
    exportToExcel(data, 'budget_vs_actual', 'بودجه و عملکرد');
  };
  const [loading, setLoading] = useState(false);

  // Column visibility state
  const [trialColumns, setTrialColumns] = useState<Set<TrialColumn>>(
    new Set(TRIAL_COLUMNS.filter((c) => c.default).map((c) => c.key))
  );
  const [ledgerColumns, setLedgerColumns] = useState<Set<LedgerColumn>>(
    new Set(LEDGER_COLUMNS.filter((c) => c.default).map((c) => c.key))
  );

  const loadAccounts = useCallback(async () => {
    const data = await tauriInvoke<Record<string, unknown>[]>('get_accounts');
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
    setAccounts(mapped.filter((a) => a.level >= 3));
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const loadTrialBalance = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {};
      if (trialFromDate) params.from_date = trialFromDate;
      if (trialToDate) params.to_date = trialToDate;
      const data = await tauriInvoke<TrialBalanceRow[]>('get_trial_balance', params);
      setTrialBalance(data);
    } catch (err) {
      console.error('Failed to load trial balance:', err);
    } finally {
      setLoading(false);
    }
  }, [trialFromDate, trialToDate]);

  const loadTrialComparison = useCallback(async () => {
    if (!trialCompare) { setTrialComparison([]); return; }
    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        current_from: trialFromDate || undefined,
        current_to: trialToDate || undefined,
        previous_from: trialPrevFrom || undefined,
        previous_to: trialPrevTo || undefined,
      };
      const data = await tauriInvoke<TrialBalanceComparisonRow[]>('get_trial_balance_comparison', params);
      setTrialComparison(data);
    } catch (err) {
      console.error('Failed to load trial comparison:', err);
    } finally {
      setLoading(false);
    }
  }, [trialCompare, trialFromDate, trialToDate, trialPrevFrom, trialPrevTo]);

  const loadReportComparison = useCallback(async () => {
    if (!reportCompare) { setReportComparison(null); return; }
    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        current_from: reportFromDate || undefined,
        current_to: reportToDate || undefined,
        previous_from: reportPrevFrom || undefined,
        previous_to: reportPrevTo || undefined,
      };
      const data = await tauriInvoke<FinancialReportComparison>('get_financial_report_comparison', params);
      setReportComparison(data);
    } catch (err) {
      console.error('Failed to load report comparison:', err);
    } finally {
      setLoading(false);
    }
  }, [reportCompare, reportFromDate, reportToDate, reportPrevFrom, reportPrevTo]);

  const loadLedger = useCallback(async (accountId: number) => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { account_id: accountId };
      if (ledgerFromDate) params.from_date = ledgerFromDate;
      if (ledgerToDate) params.to_date = ledgerToDate;
      const data = await tauriInvoke<LedgerRow[]>('get_general_ledger', params);
      setLedger(data);
    } catch (err) {
      console.error('Failed to load ledger:', err);
    } finally {
      setLoading(false);
    }
  }, [ledgerFromDate, ledgerToDate]);

  const loadFinancialReport = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {};
      if (reportFromDate) params.from_date = reportFromDate;
      if (reportToDate) params.to_date = reportToDate;
      const data = await tauriInvoke<FinancialReport>('get_financial_report', params);
      setFinancialReport(data);
    } catch (err) {
      console.error('Failed to load financial report:', err);
    } finally {
      setLoading(false);
    }
  }, [reportFromDate, reportToDate]);

  const loadCashFlow = useCallback(async () => {
    setLoading(true);
    try {
      const data = await tauriInvoke<CashFlowReport>(
        'get_cash_flow_statement',
        { fromDate: cashFlowFrom, toDate: cashFlowTo },
      );
      setCashFlow(data);
    } catch (err) {
      console.error('Failed to load cash flow:', err);
    } finally {
      setLoading(false);
    }
  }, [cashFlowFrom, cashFlowTo]);

  const loadBalanceSheetDetail = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {};
      if (reportFromDate) params.from_date = reportFromDate;
      if (reportToDate) params.to_date = reportToDate;
      const data = await tauriInvoke<BalanceSheetDetails>('get_balance_sheet_details', params);
      setBalanceSheetDetail(data);
    } catch (err) {
      console.error('Failed to load balance sheet details:', err);
    } finally {
      setLoading(false);
    }
  }, [reportFromDate, reportToDate]);

  const loadIncomeStatementDetail = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {};
      if (reportFromDate) params.from_date = reportFromDate;
      if (reportToDate) params.to_date = reportToDate;
      const data = await tauriInvoke<IncomeStatementDetails>('get_income_statement_details', params);
      setIncomeStatementDetail(data);
    } catch (err) {
      console.error('Failed to load income statement details:', err);
    } finally {
      setLoading(false);
    }
  }, [reportFromDate, reportToDate]);

  // Load data when tab changes
  useEffect(() => {
    if (activeTab === 'trial') {
      loadTrialBalance();
      if (trialCompare) loadTrialComparison();
    }
    else if (activeTab === 'ledger' && selectedAccountId) loadLedger(selectedAccountId);
    else if (activeTab === 'balance') {
      if (showBalanceDetail) {
        loadBalanceSheetDetail();
      } else {
        loadFinancialReport();
      }
      if (reportCompare) loadReportComparison();
    } else if (activeTab === 'income') {
      if (showIncomeDetail) {
        loadIncomeStatementDetail();
      } else {
        loadFinancialReport();
      }
      if (reportCompare) loadReportComparison();
    } else if (activeTab === 'cashflow') loadCashFlow();
    else if (activeTab === 'budget') loadBudgetPeriods();
  }, [activeTab, selectedAccountId, showBalanceDetail, showIncomeDetail, loadTrialBalance, loadTrialComparison, loadLedger, loadFinancialReport, loadCashFlow, loadBalanceSheetDetail, loadIncomeStatementDetail, trialFromDate, trialToDate, trialCompare, trialPrevFrom, trialPrevTo, ledgerFromDate, ledgerToDate, reportFromDate, reportToDate, reportCompare, reportPrevFrom, reportPrevTo, loadReportComparison]);

  const tabs: { id: ReportTab; label: string; icon: React.ReactNode }[] = [
    { id: 'trial', label: 'تراز آزمایشی', icon: <Scale className="w-4 h-4" /> },
    { id: 'ledger', label: 'دفتر کل', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'balance', label: 'ترازنامه', icon: <FileText className="w-4 h-4" /> },
    { id: 'income', label: 'صورت سود و زیان', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'cashflow', label: 'جریان وجوه نقد', icon: <Wallet className="w-4 h-4" /> },
    { id: 'budget', label: 'بودجه و عملکرد', icon: <TrendingDown className="w-4 h-4" /> },
  ];

  const totalDebits = trialBalance.reduce((s, r) => s + r.total_debit, 0);
  const totalCredits = trialBalance.reduce((s, r) => s + r.total_credit, 0);
  const totalBalance = trialBalance.reduce((s, r) => s + r.balance, 0);
  const compTotalCurrent = trialComparison.reduce((s, r) => s + r.current_balance, 0);
  const compTotalPrev = trialComparison.reduce((s, r) => s + r.previous_balance, 0);
  const compTotalVar = trialComparison.reduce((s, r) => s + r.variance, 0);
  const compTotalPct = compTotalPrev !== 0 ? (compTotalVar / compTotalPrev) * 100 : 0;

  const exportToCSV = (filename: string, rows: string[][]) => {
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  // Refs for PDF export of each section
  const trialRef = useRef<HTMLDivElement>(null);
  const ledgerRef = useRef<HTMLDivElement>(null);
  const balanceRef = useRef<HTMLDivElement>(null);
  const incomeRef = useRef<HTMLDivElement>(null);
  const cashFlowRef = useRef<HTMLDivElement>(null);

  const exportTrialBalance = () => {
    const rows = [
      ['کد', 'نام حساب', 'نوع', 'بدهکار', 'بستانکار', 'مانده'],
      ...trialBalance.map((r) => [
        r.code, r.name, r.account_type,
        String(r.total_debit), String(r.total_credit), String(r.balance),
      ]),
      ['', 'جمع', '', String(totalDebits), String(totalCredits), String(totalBalance)],
    ];
    exportToCSV('trial_balance.csv', rows);
  };

  const exportTrialPdf = () => {
    if (trialRef.current) exportToPdf(trialRef.current, 'trial_balance', 'تراز آزمایشی');
  };

  const exportTrialExcel = () => {
    const data = prepareExportData(
      [
        { key: 'code', label: 'کد حساب' },
        { key: 'name', label: 'نام حساب' },
        { key: 'account_type', label: 'نوع' },
        { key: 'total_debit', label: 'بدهکار' },
        { key: 'total_credit', label: 'بستانکار' },
        { key: 'balance', label: 'مانده' },
      ],
      trialBalance as unknown as Record<string, unknown>[]
    );
    exportToExcel(data, 'trial_balance', 'تراز آزمایشی');
  };

  const exportLedgerPdf = () => {
    if (ledgerRef.current) exportToPdf(ledgerRef.current, 'general_ledger', 'دفتر کل');
  };

  const exportLedgerExcel = () => {
    const currentAccount = accounts.find(a => a.id === selectedAccountId);
    const accountName = currentAccount ? `${currentAccount.code} - ${currentAccount.name}` : 'دفتر کل';
    const data = prepareExportData(
      [
        { key: 'entry_number', label: 'شماره سند' },
        { key: 'date', label: 'تاریخ' },
        { key: 'entry_description', label: 'شرح' },
        { key: 'debit', label: 'بدهکار' },
        { key: 'credit', label: 'بستانکار' },
        { key: 'balance', label: 'مانده' },
      ],
      ledger as unknown as Record<string, unknown>[]
    );
    exportToExcel(data, 'general_ledger', accountName);
  };

  const exportBalancePdf = () => {
    if (balanceRef.current) exportToPdf(balanceRef.current, 'balance_sheet', 'ترازنامه');
  };

  const exportBalanceExcel = () => {
    const items: Record<string, unknown>[] = [];
    if (balanceSheetDetail) {
      balanceSheetDetail.assets.forEach(a => items.push({ 'نوع': 'دارایی', 'کد حساب': a.code, 'نام حساب': a.name, 'مانده': a.balance }));
      balanceSheetDetail.liabilities.forEach(l => items.push({ 'نوع': 'بدهی', 'کد حساب': l.code, 'نام حساب': l.name, 'مانده': l.balance }));
      balanceSheetDetail.equity.forEach(e => items.push({ 'نوع': 'سرمایه', 'کد حساب': e.code, 'نام حساب': e.name, 'مانده': e.balance }));
    }
    exportToExcel(items, 'balance_sheet', 'ترازنامه');
  };

  const exportIncomePdf = () => {
    if (incomeRef.current) exportToPdf(incomeRef.current, 'income_statement', 'صورت سود و زیان');
  };

  const exportIncomeExcel = () => {
    const items: Record<string, unknown>[] = [];
    if (incomeStatementDetail) {
      incomeStatementDetail.revenues.forEach(r => items.push({ 'نوع': 'درآمد', 'کد حساب': r.code, 'نام حساب': r.name, 'مانده': r.balance }));
      incomeStatementDetail.expenses.forEach(e => items.push({ 'نوع': 'هزینه', 'کد حساب': e.code, 'نام حساب': e.name, 'مانده': e.balance }));
    }
    exportToExcel(items, 'income_statement', 'صورت سود و زیان');
  };

  const exportCashFlowPdf = () => {
    if (cashFlowRef.current) exportToPdf(cashFlowRef.current, 'cash_flow', 'صورت جریان وجوه نقد');
  };

  const exportCashFlowExcel = () => {
    const items: Record<string, unknown>[] = [];
    if (cashFlow) {
      cashFlow.operating.lines.forEach(l => items.push({ 'بخش': 'عملیاتی', 'کد': l.code, 'نام': l.name, 'مبلغ': l.amount }));
      cashFlow.investing.lines.forEach(l => items.push({ 'بخش': 'سرمایه‌گذاری', 'کد': l.code, 'نام': l.name, 'مبلغ': l.amount }));
      cashFlow.financing.lines.forEach(l => items.push({ 'بخش': 'تأمین مالی', 'کد': l.code, 'نام': l.name, 'مبلغ': l.amount }));
    }
    exportToExcel(items, 'cash_flow', 'جریان وجوه نقد');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center shadow-brand">
          <FileText className="w-5 h-5" />
        </span>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">گزارش‌ها</h1>
          <p className="text-[12px] text-slate-400">گزارش‌های مالی و حسابداری</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border border-slate-200 rounded-lg p-1 flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors
              ${activeTab === tab.id ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <svg className="animate-spin h-5 w-5 ml-2" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            در حال بارگذاری...
          </div>
        ) : (
          <>
            {/* Trial Balance */}
            {activeTab === 'trial' && (
              <div ref={trialRef}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm font-bold text-slate-900">تراز آزمایشی</h2>
                    <div className="h-4 w-px bg-slate-200 mx-1"></div>
                    <QuickDateButtons
                      fromDate={trialFromDate}
                      toDate={trialToDate}
                      setFromDate={setTrialFromDate}
                      setToDate={setTrialToDate}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Comparison Toggle */}
                    <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={trialCompare}
                        onChange={(e) => setTrialCompare(e.target.checked)}
                        className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                      />
                      مقایسه
                    </label>
                    {trialCompare && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400">قبلی:</span>
                        <JalaliDatePicker className="w-28" value={trialPrevFrom} onChange={setTrialPrevFrom} placeholder="از تاریخ" />
                        <span className="text-[10px] text-slate-400">تا</span>
                        <JalaliDatePicker className="w-28" value={trialPrevTo} onChange={setTrialPrevTo} placeholder="تا تاریخ" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <ColumnChooser
                      columns={TRIAL_COLUMNS}
                      visibleColumns={trialColumns}
                      onToggle={(col) => setTrialColumns((prev) => {
                        const next = new Set(prev);
                        if (next.has(col)) next.delete(col);
                        else next.add(col);
                        return next;
                      })}
                    />
                    <button
                      onClick={exportTrialPdf}
                      className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-slate-600 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                      title="خروجی PDF"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      PDF
                    </button>
                    <button
                      onClick={exportTrialExcel}
                      className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                      title="خروجی Excel"
                    >
                      <Table2 className="w-3.5 h-3.5" />
                      Excel
                    </button>
                    <button
                      onClick={exportTrialBalance}
                      className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-800 font-medium px-2"
                    >
                      <Download className="w-4 h-4" />
                      خروجی CSV
                    </button>
                  </div>
                </div>
                {trialCompare && trialComparison.length > 0 ? (
                  <>
                  <div className="px-4 py-4 border-b border-slate-100">
                    <EnhancedChart
                      title="مقایسه ۱۰ حساب برتر (دوره جاری vs دوره قبل)"
                      type="bar"
                      labels={trialComparison.slice(0, 10).map(r => r.name)}
                      datasets={[
                        {
                          label: 'دوره جاری',
                          data: trialComparison.slice(0, 10).map(r => r.current_balance),
                          backgroundColor: 'rgba(59, 130, 246, 0.7)',
                        },
                        {
                          label: 'دوره قبل',
                          data: trialComparison.slice(0, 10).map(r => r.previous_balance),
                          backgroundColor: 'rgba(156, 163, 175, 0.7)',
                        },
                      ]}
                    />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-3 text-right text-xs font-medium text-slate-500">کد</th>
                          <th className="px-3 py-3 text-right text-xs font-medium text-slate-500">نام حساب</th>
                          <th className="px-3 py-3 text-right text-xs font-medium text-slate-500">نوع</th>
                          <th className="px-3 py-3 text-right text-xs font-medium text-slate-500 w-28">دوره جاری</th>
                          <th className="px-3 py-3 text-right text-xs font-medium text-slate-500 w-28">دوره قبل</th>
                          <th className="px-3 py-3 text-right text-xs font-medium text-slate-500 w-28">تغییرات</th>
                          <th className="px-3 py-3 text-right text-xs font-medium text-slate-500 w-24">% تغییر</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trialComparison.map((row) => (
                          <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                            <td className="px-3 py-2 font-mono text-xs text-slate-500 ltr-force">{row.code}</td>
                            <td className="px-3 py-2 text-slate-700 font-medium">{row.name}</td>
                            <td className="px-3 py-2"><TypeBadge type={row.account_type} /></td>
                            <td className="px-3 py-2 text-xs ltr-force text-left font-medium">{formatNumber(row.current_balance)}</td>
                            <td className="px-3 py-2 text-xs ltr-force text-left">{formatNumber(row.previous_balance)}</td>
                            <td className={`px-3 py-2 text-xs ltr-force text-left font-bold ${row.variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {formatNumber(row.variance)}
                            </td>
                            <td className={`px-3 py-2 text-xs ltr-force text-left font-bold ${row.variance_pct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {row.variance_pct >= 0 ? '+' : ''}{row.variance_pct.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-100 font-bold">
                        <tr>
                          <td colSpan={3} className="px-3 py-3 text-xs text-slate-700">جمع کل</td>
                          <td className="px-3 py-3 text-xs ltr-force text-left text-slate-900">{formatNumber(compTotalCurrent)}</td>
                          <td className="px-3 py-3 text-xs ltr-force text-left text-slate-600">{formatNumber(compTotalPrev)}</td>
                          <td className={`px-3 py-3 text-xs ltr-force text-left font-bold ${compTotalVar >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatNumber(compTotalVar)}
                          </td>
                          <td className={`px-3 py-3 text-xs ltr-force text-left font-bold ${compTotalPct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {compTotalPct >= 0 ? '+' : ''}{compTotalPct.toFixed(1)}%
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  </>
                ) : trialBalance.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <Scale className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>هیچ سندی ثبت نشده است</p>
                    <p className="text-xs mt-1">ابتدا در بخش «سند روزنامه» اسناد را ثبت کنید</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        {trialColumns.has('code') && (
                          <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">کد</th>
                        )}
                        {trialColumns.has('name') && (
                          <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">نام حساب</th>
                        )}
                        {trialColumns.has('type') && (
                          <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">نوع</th>
                        )}
                        {trialColumns.has('debit') && (
                          <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 w-32">بدهکار</th>
                        )}
                        {trialColumns.has('credit') && (
                          <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 w-32">بستانکار</th>
                        )}
                        {trialColumns.has('balance') && (
                          <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 w-32">مانده</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {trialBalance.map((row) => (
                        <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                          {trialColumns.has('code') && (
                            <td className="px-4 py-2.5 font-mono text-xs text-slate-500 ltr-force">{row.code}</td>
                          )}
                          {trialColumns.has('name') && (
                            <td className="px-4 py-2.5 text-slate-700 font-medium">{row.name}</td>
                          )}
                          {trialColumns.has('type') && (
                            <td className="px-4 py-2.5"><TypeBadge type={row.account_type} /></td>
                          )}
                          {trialColumns.has('debit') && (
                            <td className="px-4 py-2.5 text-xs ltr-force text-left">{formatNumber(row.total_debit)}</td>
                          )}
                          {trialColumns.has('credit') && (
                            <td className="px-4 py-2.5 text-xs ltr-force text-left">{formatNumber(row.total_credit)}</td>
                          )}
                          {trialColumns.has('balance') && (
                            <td className={`px-4 py-2.5 text-xs font-bold ltr-force text-left ${row.balance >= 0 ? 'text-slate-700' : 'text-red-600'}`}>
                              {formatNumber(row.balance)}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold">
                      <tr>
                        <td colSpan={trialColumns.size} className="px-4 py-3 text-xs text-slate-700">جمع</td>
                        {trialColumns.has('debit') && (
                          <td className={`px-4 py-3 text-xs ltr-force text-left ${trialColumns.size < 5 ? '' : 'border-r border-slate-200'}`}>
                            {formatNumber(totalDebits)}
                          </td>
                        )}
                        {trialColumns.has('credit') && (
                          <td className="px-4 py-3 text-xs ltr-force text-left">{formatNumber(totalCredits)}</td>
                        )}
                        {trialColumns.has('balance') && (
                          <td className="px-4 py-3 text-xs ltr-force text-left">{formatNumber(totalBalance)}</td>
                        )}
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            )}

            {/* General Ledger */}
            {activeTab === 'ledger' && (
              <div ref={ledgerRef}>
                <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">انتخاب حساب</label>
                      <select
                        value={selectedAccountId ?? ''}
                        onChange={(e) => setSelectedAccountId(parseInt(e.target.value) || null)}
                        className="w-full max-w-md border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">انتخاب کنید...</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} - {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-500">از</span>
                      <JalaliDatePicker className="w-32" value={ledgerFromDate} onChange={setLedgerFromDate} placeholder="از تاریخ" />
                      <span className="text-xs text-slate-500">تا</span>
                      <JalaliDatePicker className="w-32" value={ledgerToDate} onChange={setLedgerToDate} placeholder="تا تاریخ" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedAccountId && ledger.length > 0 && (
                      <>
                        <button
                          onClick={exportLedgerPdf}
                          className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-slate-600 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                          title="خروجی PDF"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          PDF
                        </button>
                        <button
                          onClick={exportLedgerExcel}
                          className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                          title="خروجی Excel"
                        >
                          <Table2 className="w-3.5 h-3.5" />
                          Excel
                        </button>
                        <ColumnChooser
                          columns={LEDGER_COLUMNS}
                          visibleColumns={ledgerColumns}
                          onToggle={(col) => setLedgerColumns((prev) => {
                            const next = new Set(prev);
                            if (next.has(col)) next.delete(col);
                            else next.add(col);
                            return next;
                          })}
                        />
                      </>
                    )}
                  </div>
                </div>
                {!selectedAccountId ? (
                  <div className="p-8 text-center text-slate-400">
                    <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>یک حساب را انتخاب کنید</p>
                  </div>
                ) : ledger.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <p>هیچ سندی برای این حساب ثبت نشده</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        {ledgerColumns.has('entryNumber') && (
                          <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">شماره سند</th>
                        )}
                        {ledgerColumns.has('date') && (
                          <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">تاریخ</th>
                        )}
                        {ledgerColumns.has('description') && (
                          <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">شرح</th>
                        )}
                        {ledgerColumns.has('debit') && (
                          <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 w-28">بدهکار</th>
                        )}
                        {ledgerColumns.has('credit') && (
                          <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 w-28">بستانکار</th>
                        )}
                        {ledgerColumns.has('balance') && (
                          <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 w-28">مانده</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.map((row) => (
                        <tr key={`${row.entry_id}-${row.entry_number}`} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                          {ledgerColumns.has('entryNumber') && (
                            <td className="px-4 py-2.5 font-mono text-xs text-slate-500 ltr-force">{row.entry_number}</td>
                          )}
                          {ledgerColumns.has('date') && (
                            <td className="px-4 py-2.5 text-xs text-slate-600 ltr-force">{row.date}</td>
                          )}
                          {ledgerColumns.has('description') && (
                            <td className="px-4 py-2.5">
                              <p className="text-slate-700">{row.entry_description}</p>
                              {row.line_description && (
                                <p className="text-xs text-slate-400">{row.line_description}</p>
                              )}
                            </td>
                          )}
                          {ledgerColumns.has('debit') && (
                            <td className="px-4 py-2.5 text-xs ltr-force text-left">{row.debit > 0 ? formatNumber(row.debit) : ''}</td>
                          )}
                          {ledgerColumns.has('credit') && (
                            <td className="px-4 py-2.5 text-xs ltr-force text-left">{row.credit > 0 ? formatNumber(row.credit) : ''}</td>
                          )}
                          {ledgerColumns.has('balance') && (
                            <td className="px-4 py-2.5 text-xs font-bold ltr-force text-left">{formatNumber(row.balance)}</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Balance Sheet */}
            {activeTab === 'balance' && (financialReport || balanceSheetDetail) && (
              <div ref={balanceRef} className="p-6">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900">ترازنامه</h2>
                    <div className="h-4 w-px bg-slate-200 mx-1"></div>
                    <QuickDateButtons
                      fromDate={reportFromDate}
                      toDate={reportToDate}
                      setFromDate={setReportFromDate}
                      setToDate={setReportToDate}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={reportCompare}
                        onChange={(e) => setReportCompare(e.target.checked)}
                        className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                      />
                      مقایسه
                    </label>
                    {reportCompare && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400">قبلی:</span>
                        <JalaliDatePicker className="w-28" value={reportPrevFrom} onChange={setReportPrevFrom} placeholder="از تاریخ" />
                        <span className="text-[10px] text-slate-400">تا</span>
                        <JalaliDatePicker className="w-28" value={reportPrevTo} onChange={setReportPrevTo} placeholder="تا تاریخ" />
                      </div>
                    )}
                    <button
                      onClick={exportBalancePdf}
                      className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-slate-600 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                      title="خروجی PDF"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      PDF
                    </button>
                    <button
                      onClick={exportBalanceExcel}
                      className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                      title="خروجی Excel"
                    >
                      <Table2 className="w-3.5 h-3.5" />
                      Excel
                    </button>
                    <button
                      onClick={() => setShowBalanceDetail(!showBalanceDetail)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        showBalanceDetail
                          ? 'bg-primary-50 text-primary-700'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                      {showBalanceDetail ? 'نمایش خلاصه' : 'نمایش تفصیلی'}
                    </button>
                  </div>
                </div>

                {showBalanceDetail && balanceSheetDetail ? (
                  /* Detail table view */
                  <div className="space-y-6">
                    {/* Assets detail */}
                    <div>
                      <h3 className="text-sm font-bold text-blue-800 mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        دارایی‌ها
                        <span className="text-xs text-slate-400 font-normal">({formatNumber(balanceSheetDetail.totalAssets)})</span>
                      </h3>
                      <table className="w-full text-sm">
                        <thead className="bg-blue-50">
                          <tr>
                            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">کد</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">نام حساب</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 w-32">مانده (بدهکار)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {balanceSheetDetail.assets.map((item) => (
                            <tr key={item.accountId} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                              <td className="px-3 py-2 font-mono text-xs text-slate-500 ltr-force">{item.code}</td>
                              <td className="px-3 py-2 text-slate-700">{item.name}</td>
                              <td className="px-3 py-2 text-xs ltr-force text-left font-bold text-slate-900">{formatNumber(item.balance)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-blue-50 font-bold">
                          <tr>
                            <td colSpan={2} className="px-3 py-2 text-xs text-slate-700">جمع دارایی‌ها</td>
                            <td className="px-3 py-2 text-xs ltr-force text-left text-blue-800">{formatNumber(balanceSheetDetail.totalAssets)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Liabilities detail */}
                    <div>
                      <h3 className="text-sm font-bold text-amber-800 mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        بدهی‌ها
                        <span className="text-xs text-slate-400 font-normal">({formatNumber(balanceSheetDetail.totalLiabilities)})</span>
                      </h3>
                      <table className="w-full text-sm">
                        <thead className="bg-amber-50">
                          <tr>
                            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">کد</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">نام حساب</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 w-32">مانده (بستانکار)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {balanceSheetDetail.liabilities.map((item) => (
                            <tr key={item.accountId} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                              <td className="px-3 py-2 font-mono text-xs text-slate-500 ltr-force">{item.code}</td>
                              <td className="px-3 py-2 text-slate-700">{item.name}</td>
                              <td className="px-3 py-2 text-xs ltr-force text-left font-bold text-slate-900">{formatNumber(item.balance)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-amber-50 font-bold">
                          <tr>
                            <td colSpan={2} className="px-3 py-2 text-xs text-slate-700">جمع بدهی‌ها</td>
                            <td className="px-3 py-2 text-xs ltr-force text-left text-amber-800">{formatNumber(balanceSheetDetail.totalLiabilities)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Equity detail */}
                    <div>
                      <h3 className="text-sm font-bold text-green-800 mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        حقوق صاحبان سرمایه
                        <span className="text-xs text-slate-400 font-normal">({formatNumber(balanceSheetDetail.totalEquity)})</span>
                      </h3>
                      <table className="w-full text-sm">
                        <thead className="bg-green-50">
                          <tr>
                            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">کد</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">نام حساب</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 w-32">مانده (بستانکار)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {balanceSheetDetail.equity.map((item) => (
                            <tr key={item.accountId} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                              <td className="px-3 py-2 font-mono text-xs text-slate-500 ltr-force">{item.code}</td>
                              <td className="px-3 py-2 text-slate-700">{item.name}</td>
                              <td className="px-3 py-2 text-xs ltr-force text-left font-bold text-slate-900">{formatNumber(item.balance)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-green-50 font-bold">
                          <tr>
                            <td colSpan={2} className="px-3 py-2 text-xs text-slate-700">جمع حقوق صاحبان سرمایه</td>
                            <td className="px-3 py-2 text-xs ltr-force text-left text-green-800">{formatNumber(balanceSheetDetail.totalEquity)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Balance check */}
                    <div className={`rounded-xl p-4 ${balanceSheetDetail.balanced ? 'bg-green-50' : 'bg-red-50'}`}>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-slate-700">بررسی ترازنامه</span>
                        <span className={`text-sm font-bold ${balanceSheetDetail.balanced ? 'text-green-600' : 'text-red-600'}`}>
                          {balanceSheetDetail.balanced ? '✓ تراز است' : '✗ تراز نیست'}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        دارایی‌ها: {formatNumber(balanceSheetDetail.totalAssets)} = بدهی‌ها: {formatNumber(balanceSheetDetail.totalLiabilities)} + حقوق صاحبان سرمایه: {formatNumber(balanceSheetDetail.totalEquity)}
                      </div>
                    </div>
                  </div>
                ) : financialReport ? (
                  /* Summary view (existing) */
                  <>
                    {!financialReport.balance_sheet_balanced && (
                      <div className="bg-amber-50 text-amber-700 text-sm p-3 rounded-lg mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        ترازنامه تراز نیست! لطفاً اسناد را بررسی کنید.
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <div className="bg-blue-50 rounded-xl p-5">
                        <h3 className="text-sm font-bold text-blue-800 mb-2">دارایی‌ها</h3>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-500">جمع</span>
                          <span className="font-bold text-slate-900 ltr-force">{formatNumber(financialReport.total_assets)}</span>
                        </div>
                      </div>
                      <div className="bg-amber-50 rounded-xl p-5">
                        <h3 className="text-sm font-bold text-amber-800 mb-2">بدهی‌ها</h3>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-500">جمع</span>
                          <span className="font-bold text-slate-900 ltr-force">{formatNumber(financialReport.total_liabilities)}</span>
                        </div>
                      </div>
                      <div className="bg-green-50 rounded-xl p-5">
                        <h3 className="text-sm font-bold text-green-800 mb-2">حقوق صاحبان سرمایه</h3>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-500">جمع</span>
                          <span className="font-bold text-slate-900 ltr-force">{formatNumber(financialReport.total_equity)}</span>
                        </div>
                      </div>
                    </div>
                    {/* Comparison Table */}
                    {reportCompare && reportComparison && (
                      <div className="mb-6 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">قلم</th>
                              <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500 w-28">دوره جاری</th>
                              <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500 w-28">دوره قبل</th>
                              <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500 w-28">تغییرات</th>
                              <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500 w-24">% تغییر</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[
                              { label: 'دارایی‌ها', current: reportComparison.current_assets, previous: reportComparison.previous_assets, variance: reportComparison.variance_assets, pct: reportComparison.variance_pct_assets },
                              { label: 'بدهی‌ها', current: reportComparison.current_liabilities, previous: reportComparison.previous_liabilities, variance: reportComparison.variance_liabilities, pct: reportComparison.variance_pct_liabilities },
                              { label: 'سرمایه', current: reportComparison.current_equity, previous: reportComparison.previous_equity, variance: reportComparison.variance_equity, pct: reportComparison.variance_pct_equity },
                            ].map((row) => (
                              <tr key={row.label} className="border-t border-slate-100">
                                <td className="px-4 py-2.5 text-slate-700 font-medium">{row.label}</td>
                                <td className="px-4 py-2.5 text-xs ltr-force text-left">{formatNumber(row.current)}</td>
                                <td className="px-4 py-2.5 text-xs ltr-force text-left">{formatNumber(row.previous)}</td>
                                <td className={`px-4 py-2.5 text-xs ltr-force text-left font-bold ${row.variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatNumber(row.variance)}</td>
                                <td className={`px-4 py-2.5 text-xs ltr-force text-left font-bold ${row.pct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{row.pct >= 0 ? '+' : ''}{row.pct.toFixed(1)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {/* Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <EnhancedChart
                        title="ساختار ترازنامه (حلقوی)"
                        type="doughnut"
                        labels={['دارایی‌ها', 'بدهی‌ها', 'سرمایه']}
                        datasets={[{
                          label: 'مانده',
                          data: [
                            financialReport.total_assets,
                            financialReport.total_liabilities,
                            financialReport.total_equity,
                          ],
                          backgroundColor: [
                            'rgba(59, 130, 246, 0.7)',
                            'rgba(245, 158, 11, 0.7)',
                            'rgba(16, 185, 129, 0.7)',
                          ],
                        }]}
                      />
                      <EnhancedChart
                        title="مقایسه دارایی در برابر بدهی + سرمایه"
                        type="bar"
                        labels={['ترازنامه']}
                        datasets={[
                          {
                            label: 'دارایی‌ها',
                            data: [financialReport.total_assets],
                            backgroundColor: 'rgba(59, 130, 246, 0.7)',
                          },
                          {
                            label: 'بدهی + سرمایه',
                            data: [financialReport.total_liabilities + financialReport.total_equity],
                            backgroundColor: 'rgba(245, 158, 11, 0.7)',
                          },
                        ]}
                      />
                      <EnhancedChart
                        title="توزیع بدهی و سرمایه (دایره‌ای)"
                        type="pie"
                        labels={['بدهی‌ها', 'سرمایه']}
                        datasets={[{
                          label: 'مانده',
                          data: [
                            financialReport.total_liabilities,
                            financialReport.total_equity,
                          ],
                          backgroundColor: [
                            'rgba(245, 158, 11, 0.7)',
                            'rgba(16, 185, 129, 0.7)',
                          ],
                        }]}
                      />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                      <EnhancedChart
                        title="روند ترازنامه (محاسبه شده)"
                        type="area"
                        labels={['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور']}
                        datasets={[
                          {
                            label: 'دارایی‌ها',
                            data: [1, 2, 3, 4, 5, 6].map((m) => financialReport.total_assets * (m / 6)),
                            backgroundColor: 'rgba(59, 130, 246, 0.2)',
                            borderColor: 'rgba(59, 130, 246, 0.8)',
                            fill: true,
                            tension: 0.4,
                          },
                          {
                            label: 'بدهی‌ها',
                            data: [1, 2, 3, 4, 5, 6].map((m) => financialReport.total_liabilities * (m / 6)),
                            backgroundColor: 'rgba(245, 158, 11, 0.2)',
                            borderColor: 'rgba(245, 158, 11, 0.8)',
                            fill: true,
                            tension: 0.4,
                          },
                        ]}
                      />
                      <EnhancedChart
                        title="نسبت‌های مالی"
                        type="bar"
                        labels={['نسبت بدهی', 'نسبت جاری', 'بازده سرمایه', 'حاشیه سود']}
                        datasets={[{
                          label: 'درصد',
                          data: [
                            financialReport.total_liabilities > 0
                              ? (financialReport.total_liabilities / (financialReport.total_assets || 1)) * 100
                              : 0,
                            financialReport.total_liabilities > 0
                              ? (financialReport.total_assets / financialReport.total_liabilities) * 20
                              : 200,
                            financialReport.total_equity > 0
                              ? (financialReport.net_income / financialReport.total_equity) * 100
                              : 0,
                            financialReport.total_revenue > 0
                              ? (financialReport.net_income / financialReport.total_revenue) * 100
                              : 0,
                          ],
                          backgroundColor: [
                            'rgba(245, 158, 11, 0.7)',
                            'rgba(59, 130, 246, 0.7)',
                            'rgba(16, 185, 129, 0.7)',
                            'rgba(52, 211, 153, 0.7)',
                          ],
                        }]}
                      />
                    </div>
                    <div className="mt-6 bg-slate-50 rounded-xl p-5">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-slate-700">بررسی ترازنامه</span>
                        <span className={`text-sm font-bold ${financialReport.balance_sheet_balanced ? 'text-green-600' : 'text-red-600'}`}>
                          {financialReport.balance_sheet_balanced ? '✓ تراز است' : '✗ تراز نیست'}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        دارایی‌ها: {formatNumber(financialReport.total_assets)} = بدهی‌ها: {formatNumber(financialReport.total_liabilities)} + حقوق صاحبان سرمایه: {formatNumber(financialReport.total_equity)}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-8 text-center text-slate-400">
                    <Scale className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>در حال بارگذاری...</p>
                  </div>
                )}
              </div>
            )}

            {/* Income Statement */}
            {activeTab === 'income' && (financialReport || incomeStatementDetail) && (
              <div ref={incomeRef} className="p-6">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900">صورت سود و زیان</h2>
                    <div className="h-4 w-px bg-slate-200 mx-1"></div>
                    <QuickDateButtons
                      fromDate={reportFromDate}
                      toDate={reportToDate}
                      setFromDate={setReportFromDate}
                      setToDate={setReportToDate}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={reportCompare}
                        onChange={(e) => setReportCompare(e.target.checked)}
                        className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                      />
                      مقایسه
                    </label>
                    {reportCompare && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400">قبلی:</span>
                        <JalaliDatePicker className="w-28" value={reportPrevFrom} onChange={setReportPrevFrom} placeholder="از تاریخ" />
                        <span className="text-[10px] text-slate-400">تا</span>
                        <JalaliDatePicker className="w-28" value={reportPrevTo} onChange={setReportPrevTo} placeholder="تا تاریخ" />
                      </div>
                    )}
                    <button
                      onClick={exportIncomePdf}
                      className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-slate-600 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                      title="خروجی PDF"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      PDF
                    </button>
                    <button
                      onClick={exportIncomeExcel}
                      className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                      title="خروجی Excel"
                    >
                      <Table2 className="w-3.5 h-3.5" />
                      Excel
                    </button>
                    <button
                      onClick={() => setShowIncomeDetail(!showIncomeDetail)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        showIncomeDetail
                          ? 'bg-primary-50 text-primary-700'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <TrendingUp className="w-4 h-4" />
                      {showIncomeDetail ? 'نمایش خلاصه' : 'نمایش تفصیلی'}
                    </button>
                  </div>
                </div>

                {showIncomeDetail && incomeStatementDetail ? (
                  /* Detail table view */
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-bold text-emerald-800 mb-3 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        درآمدها
                        <span className="text-xs text-slate-400 font-normal">({formatNumber(incomeStatementDetail.totalRevenue)})</span>
                      </h3>
                      <table className="w-full text-sm">
                        <thead className="bg-emerald-50">
                          <tr>
                            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">کد</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">نام حساب</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 w-32">مانده</th>
                          </tr>
                        </thead>
                        <tbody>
                          {incomeStatementDetail.revenues.map((item) => (
                            <tr key={item.accountId} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                              <td className="px-3 py-2 font-mono text-xs text-slate-500 ltr-force">{item.code}</td>
                              <td className="px-3 py-2 text-slate-700">{item.name}</td>
                              <td className="px-3 py-2 text-xs ltr-force text-left font-bold text-emerald-700">{formatNumber(item.balance)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-emerald-50 font-bold">
                          <tr>
                            <td colSpan={2} className="px-3 py-2 text-xs text-slate-700">جمع درآمدها</td>
                            <td className="px-3 py-2 text-xs ltr-force text-left text-emerald-800">{formatNumber(incomeStatementDetail.totalRevenue)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-red-800 mb-3 flex items-center gap-2">
                        <TrendingDown className="w-4 h-4" />
                        هزینه‌ها
                        <span className="text-xs text-slate-400 font-normal">({formatNumber(incomeStatementDetail.totalExpenses)})</span>
                      </h3>
                      <table className="w-full text-sm">
                        <thead className="bg-red-50">
                          <tr>
                            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">کد</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">نام حساب</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 w-32">مانده</th>
                          </tr>
                        </thead>
                        <tbody>
                          {incomeStatementDetail.expenses.map((item) => (
                            <tr key={item.accountId} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                              <td className="px-3 py-2 font-mono text-xs text-slate-500 ltr-force">{item.code}</td>
                              <td className="px-3 py-2 text-slate-700">{item.name}</td>
                              <td className="px-3 py-2 text-xs ltr-force text-left font-bold text-red-700">{formatNumber(item.balance)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-red-50 font-bold">
                          <tr>
                            <td colSpan={2} className="px-3 py-2 text-xs text-slate-700">جمع هزینه‌ها</td>
                            <td className="px-3 py-2 text-xs ltr-force text-left text-red-800">{formatNumber(incomeStatementDetail.totalExpenses)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <div className={`rounded-xl p-4 ${incomeStatementDetail.netIncome >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        {incomeStatementDetail.netIncome >= 0 ? (
                          <TrendingUp className="w-5 h-5 text-green-600" />
                        ) : (
                          <TrendingDown className="w-5 h-5 text-red-600" />
                        )}
                        <span className={`text-lg font-bold ${incomeStatementDetail.netIncome >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {incomeStatementDetail.netIncome >= 0 ? 'سود خالص' : 'زیان خالص'}: {formatNumber(Math.abs(incomeStatementDetail.netIncome))}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        درآمدها: {formatNumber(incomeStatementDetail.totalRevenue)} - هزینه‌ها: {formatNumber(incomeStatementDetail.totalExpenses)}
                      </div>
                    </div>
                  </div>
                ) : financialReport ? (
                  /* Summary view */
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <div className="bg-emerald-50 rounded-xl p-5">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="w-4 h-4 text-emerald-600" />
                          <h3 className="text-sm font-bold text-emerald-800">درآمدها</h3>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-500">جمع</span>
                          <span className="font-bold text-slate-900 ltr-force">{formatNumber(financialReport.total_revenue)}</span>
                        </div>
                      </div>
                      <div className="bg-red-50 rounded-xl p-5">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingDown className="w-4 h-4 text-red-600" />
                          <h3 className="text-sm font-bold text-red-800">هزینه‌ها</h3>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-500">جمع</span>
                          <span className="font-bold text-slate-900 ltr-force">{formatNumber(financialReport.total_expenses)}</span>
                    </div>
                  </div>
                  <div className={`rounded-xl p-5 ${financialReport.net_income >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {financialReport.net_income >= 0
                        ? <TrendingUp className="w-4 h-4 text-green-600" />
                        : <TrendingDown className="w-4 h-4 text-red-600" />
                      }
                      <h3 className={`text-sm font-bold ${financialReport.net_income >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                        {financialReport.net_income >= 0 ? 'سود خالص' : 'زیان خالص'}
                      </h3>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500">مبلغ</span>
                      <span className={`text-lg font-bold ltr-force ${financialReport.net_income >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {formatNumber(Math.abs(financialReport.net_income))}
                      </span>
                    </div>
                  </div>
                </div>
                  {/* Comparison Table */}
                  {reportCompare && reportComparison && (
                    <div className="mt-6 mb-4 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">قلم</th>
                            <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500 w-28">دوره جاری</th>
                            <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500 w-28">دوره قبل</th>
                            <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500 w-28">تغییرات</th>
                            <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500 w-24">% تغییر</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { label: 'درآمدها', current: reportComparison.current_revenue, previous: reportComparison.previous_revenue, variance: reportComparison.variance_revenue, pct: reportComparison.variance_pct_revenue },
                            { label: 'هزینه‌ها', current: reportComparison.current_expenses, previous: reportComparison.previous_expenses, variance: reportComparison.variance_expenses, pct: reportComparison.variance_pct_expenses },
                            { label: 'سود/زیان خالص', current: reportComparison.current_net_income, previous: reportComparison.previous_net_income, variance: reportComparison.variance_net_income, pct: reportComparison.variance_pct_net_income },
                          ].map((row) => (
                            <tr key={row.label} className="border-t border-slate-100">
                              <td className="px-4 py-2.5 text-slate-700 font-medium">{row.label}</td>
                              <td className="px-4 py-2.5 text-xs ltr-force text-left">{formatNumber(row.current)}</td>
                              <td className="px-4 py-2.5 text-xs ltr-force text-left">{formatNumber(row.previous)}</td>
                              <td className={`px-4 py-2.5 text-xs ltr-force text-left font-bold ${row.variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatNumber(row.variance)}</td>
                              <td className={`px-4 py-2.5 text-xs ltr-force text-left font-bold ${row.pct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{row.pct >= 0 ? '+' : ''}{row.pct.toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  </>
                ) : (
                  <div className="p-8 text-center text-slate-400">
                    <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>در حال بارگذاری...</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'cashflow' && (
              <div ref={cashFlowRef} className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-slate-900">
                    صورت جریان وجوه نقد (روش غیرمستقیم)
                  </h2>
                  <div className="flex items-center gap-2">
                    <JalaliDatePicker className="w-36" value={cashFlowFrom} onChange={setCashFlowFrom} placeholder="از تاریخ ۱۴۰۴/۰۱/۰۱" />
                    <span className="text-slate-400 text-sm">تا</span>
                    <JalaliDatePicker className="w-36" value={cashFlowTo} onChange={setCashFlowTo} placeholder="تا تاریخ ۱۴۰۴/۱۲/۲۹" />
                    <button
                      onClick={loadCashFlow}
                      className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm"
                    >
                      به‌روزرسانی
                    </button>
                    <div className="h-5 w-px bg-slate-200"></div>
                    <button
                      onClick={exportCashFlowPdf}
                      className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-slate-600 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                      title="خروجی PDF"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      PDF
                    </button>
                    <button
                      onClick={exportCashFlowExcel}
                      className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                      title="خروجی Excel"
                    >
                      <Table2 className="w-3.5 h-3.5" />
                      Excel
                    </button>
                  </div>
                </div>

                {cashFlow && (
                  <>
                    {/* Summary cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <div className={`rounded-xl p-5 ${cashFlow.operating.subtotal >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className={`w-4 h-4 ${cashFlow.operating.subtotal >= 0 ? 'text-emerald-600' : 'text-red-600'}`} />
                          <h3 className={`text-sm font-bold ${cashFlow.operating.subtotal >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                            جریان عملیاتی
                          </h3>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-500">مبلغ</span>
                          <span className={`text-lg font-bold ltr-force ${cashFlow.operating.subtotal >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                            {formatNumber(Math.abs(cashFlow.operating.subtotal))}
                          </span>
                        </div>
                      </div>
                      <div className={`rounded-xl p-5 ${cashFlow.investing.subtotal >= 0 ? 'bg-blue-50' : 'bg-amber-50'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <Wallet className={`w-4 h-4 ${cashFlow.investing.subtotal >= 0 ? 'text-blue-600' : 'text-amber-600'}`} />
                          <h3 className={`text-sm font-bold ${cashFlow.investing.subtotal >= 0 ? 'text-blue-800' : 'text-amber-800'}`}>
                            جریان سرمایه‌گذاری
                          </h3>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-500">مبلغ</span>
                          <span className={`text-lg font-bold ltr-force ${cashFlow.investing.subtotal >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>
                            {formatNumber(Math.abs(cashFlow.investing.subtotal))}
                          </span>
                        </div>
                      </div>
                      <div className={`rounded-xl p-5 ${cashFlow.financing.subtotal >= 0 ? 'bg-indigo-50' : 'bg-rose-50'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingDown className={`w-4 h-4 ${cashFlow.financing.subtotal >= 0 ? 'text-indigo-600' : 'text-rose-600'}`} />
                          <h3 className={`text-sm font-bold ${cashFlow.financing.subtotal >= 0 ? 'text-indigo-800' : 'text-rose-800'}`}>
                            جریان تأمین مالی
                          </h3>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-500">مبلغ</span>
                          <span className={`text-lg font-bold ltr-force ${cashFlow.financing.subtotal >= 0 ? 'text-indigo-700' : 'text-rose-700'}`}>
                            {formatNumber(Math.abs(cashFlow.financing.subtotal))}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Section tables */}
                    {([
                      { section: cashFlow.operating, color: 'emerald' },
                      { section: cashFlow.investing, color: 'blue' },
                      { section: cashFlow.financing, color: 'indigo' },
                    ] as const).map(({ section, color }) => (
                      <div key={section.title} className="bg-white border border-slate-200 rounded-lg mb-4">
                        <div className={`px-5 py-3 border-b border-slate-200 bg-${color}-50 flex items-center justify-between`}>
                          <h3 className={`font-bold text-${color}-900`}>{section.title}</h3>
                          <span className={`text-sm font-bold ltr-force text-${color}-700`}>
                            {section.subtotal >= 0 ? '+' : ''}{formatNumber(section.subtotal)}
                          </span>
                        </div>
                        {section.lines.length === 0 ? (
                          <div className="p-4 text-center text-slate-400 text-sm">
                            هیچ موردی در این بخش وجود ندارد
                          </div>
                        ) : (
                          <table className="w-full text-sm">
                            <tbody>
                              {section.lines.map((line, idx) => (
                                <tr key={idx} className="border-b border-slate-100 last:border-0">
                                  <td className="px-4 py-2 font-mono text-xs text-slate-500 w-20">{line.code}</td>
                                  <td className="px-4 py-2 text-slate-700">{line.name}</td>
                                  <td className={`px-4 py-2 text-left font-medium ltr-force ${line.amount >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    {line.amount >= 0 ? '+' : ''}{formatNumber(line.amount)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    ))}

                    {/* Reconciliation */}
                    <div className={`rounded-xl p-5 border-2 ${cashFlow.balanced ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                      <h3 className="font-bold text-slate-900 mb-3">صورت تطبیق موجودی نقد</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="text-xs text-slate-500 mb-1">موجودی نقد در ابتدای دوره</div>
                          <div className="font-bold text-slate-900 ltr-force">{formatNumber(cashFlow.openingCash)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-1">تغییر خالص در دوره</div>
                          <div className={`font-bold ltr-force ${cashFlow.netChange >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {cashFlow.netChange >= 0 ? '+' : ''}{formatNumber(cashFlow.netChange)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-1">موجودی نقد در پایان دوره</div>
                          <div className="font-bold text-slate-900 ltr-force">{formatNumber(cashFlow.closingCash)}</div>
                        </div>
                      </div>
                      {!cashFlow.balanced && (
                        <p className="text-xs text-amber-700 mt-3 flex items-center gap-1">
                          <AlertTriangle className="w-4 h-4" />
                          اختلاف: جمع موجودی نقد ابتدا + خالص تغییرات با موجودی پایانی یکسان نیست.
                        </p>
                      )}
                    </div>

                    {/* Chart visualization */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                      <EnhancedChart
                        title="جریان خالص هر بخش"
                        type="bar"
                        labels={[cashFlow.operating.title, cashFlow.investing.title, cashFlow.financing.title]}
                        datasets={[{
                          label: 'مبلغ',
                          data: [cashFlow.operating.subtotal, cashFlow.investing.subtotal, cashFlow.financing.subtotal],
                          backgroundColor: [
                            cashFlow.operating.subtotal >= 0 ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)',
                            cashFlow.investing.subtotal >= 0 ? 'rgba(59, 130, 246, 0.7)' : 'rgba(245, 158, 11, 0.7)',
                            cashFlow.financing.subtotal >= 0 ? 'rgba(99, 102, 241, 0.7)' : 'rgba(244, 63, 94, 0.7)',
                          ],
                        }]}
                      />
                      <EnhancedChart
                        title="موجودی نقد"
                        type="bar"
                        labels={['ابتدای دوره', 'پایان دوره']}
                        datasets={[{
                          label: 'موجودی نقد',
                          data: [cashFlow.openingCash, cashFlow.closingCash],
                          backgroundColor: ['rgba(148, 163, 184, 0.7)', 'rgba(16, 185, 129, 0.7)'],
                        }]}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
            {activeTab === 'budget' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-slate-900">
                    بودجه و عملکرد
                  </h2>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedBudgetPeriod ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedBudgetPeriod(val ? parseInt(val) : null);
                      }}
                      className="border border-slate-300 rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">انتخاب دوره...</option>
                      {budgetPeriods.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => loadBudgetPeriods()}
                      className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-slate-600 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" />
                      بارگذاری
                    </button>
                    <button
                      onClick={() => exportBudget()}
                      disabled={budgetData.length === 0}
                      className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-30"
                    >
                      <Table2 className="w-3.5 h-3.5" />
                      Excel
                    </button>
                  </div>
                </div>
                {budgetData.length > 0 ? (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">کد</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">نام حساب</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 w-24">نوع</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 w-28">بودجه</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 w-28">واقعی</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 w-28">تغییرات</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 w-24">%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {budgetData.map(row => (
                            <tr key={row.account_id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                              <td className="px-3 py-2 text-xs font-mono text-slate-500 ltr-force">{row.account_code}</td>
                              <td className="px-3 py-2 text-sm text-slate-700">{row.account_name}</td>
                              <td className="px-3 py-2"><TypeBadge type={row.account_type} /></td>
                              <td className="px-3 py-2 text-xs ltr-force text-left text-slate-600">{formatNumber(row.budget_amount)}</td>
                              <td className="px-3 py-2 text-xs ltr-force text-left text-slate-600">{formatNumber(row.actual_amount)}</td>
                              <td className={`px-3 py-2 text-xs ltr-force text-left font-bold ${row.variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatNumber(row.variance)}</td>
                              <td className={`px-3 py-2 text-xs ltr-force text-left font-bold ${row.variance_pct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{row.variance_pct >= 0 ? '+' : ''}{row.variance_pct.toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* Summary */}
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="bg-slate-50 rounded-lg p-3">
                        <div className="text-xs text-slate-500 mb-1">جمع بودجه</div>
                        <div className="text-sm font-bold text-slate-700 ltr-force">{formatNumber(budgetData.reduce((s, r) => s + r.budget_amount, 0))}</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3">
                        <div className="text-xs text-slate-500 mb-1">جمع واقعی</div>
                        <div className="text-sm font-bold text-slate-700 ltr-force">{formatNumber(budgetData.reduce((s, r) => s + r.actual_amount, 0))}</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3">
                        <div className="text-xs text-slate-500 mb-1">کل تغییرات</div>
                        <div className={`text-sm font-bold ltr-force ${budgetData.reduce((s, r) => s + r.variance, 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatNumber(budgetData.reduce((s, r) => s + r.variance, 0))}</div>
                      </div>
                      <div className={`bg-slate-50 rounded-lg p-3 ${budgetData.filter(r => r.variance < 0).length > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
                        <div className="text-xs text-slate-500 mb-1">حساب‌های با انحراف</div>
                        <div className="text-sm font-bold text-red-600">{budgetData.filter(r => r.variance < 0).length}</div>
                      </div>
                    </div>
                    {/* Chart */}
                    {budgetData.length > 0 && (
                      <div className="mt-6">
                        <EnhancedChart
                          title="بودجه vs واقعی (۱۰ حساب برتر)"
                          type="bar"
                          labels={budgetData.slice(0, 10).map(r => r.account_name.substring(0, 12))}
                          datasets={[
                            {
                              label: 'بودجه',
                              data: budgetData.slice(0, 10).map(r => r.budget_amount),
                              backgroundColor: 'rgba(99, 102, 241, 0.7)',
                            },
                            {
                              label: 'واقعی',
                              data: budgetData.slice(0, 10).map(r => r.actual_amount),
                              backgroundColor: 'rgba(16, 185, 129, 0.7)',
                            },
                          ]}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-8 text-center text-slate-400">
                    <TrendingDown className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>یک دوره بودجه انتخاب کنید</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Quick Date Range Preset Buttons ---------- */
function QuickDateButtons({ fromDate, toDate, setFromDate, setToDate }: {
  fromDate: string;
  toDate: string;
  setFromDate: (v: string) => void;
  setToDate: (v: string) => void;
}) {
  const presets: { label: string; from: string; to: string }[] = [
    { label: 'ماه', from: '1404/01/01', to: '1404/01/31' },
    { label: 'سه ماهه', from: '1404/01/01', to: '1404/03/31' },
    { label: 'سال', from: '1404/01/01', to: '1404/12/29' },
    { label: 'همه', from: '', to: '' },
  ];
  return (
    <div className="flex items-center gap-1">
      {presets.map((p) => (
        <button
          key={p.label}
          onClick={() => { setFromDate(p.from); setToDate(p.to); }}
          className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
            fromDate === p.from && toDate === p.to
              ? 'bg-primary-100 text-primary-700'
              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    asset: 'bg-blue-100 text-blue-700',
    liability: 'bg-amber-100 text-amber-700',
    equity: 'bg-green-100 text-green-700',
    revenue: 'bg-emerald-100 text-emerald-700',
    expense: 'bg-red-100 text-red-700',
    contra: 'bg-purple-100 text-purple-700',
  };
  const labels: Record<string, string> = {
    asset: 'دارایی',
    liability: 'بدهی',
    equity: 'سرمایه',
    revenue: 'درآمد',
    expense: 'هزینه',
    contra: 'تعدیلی',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[type] ?? 'bg-slate-100 text-slate-700'}`}>
      {labels[type] ?? type}
    </span>
  );
}
