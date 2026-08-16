import { useState, useEffect } from 'react';
import type { ExchangeRate, CurrencyRevaluationRow, RevaluationDetail, Account } from '../../types/database';
import { tauriInvoke } from '../../lib/tauri';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

import { JalaliDatePicker } from '../../components/ui/JalaliDatePicker';
import { RefreshCw, TrendingUp, TrendingDown, History, DollarSign, Plus, X } from 'lucide-react';

type Tab = 'rates' | 'revaluation';

export function CurrencyPage() {
  const [activeTab, setActiveTab] = useState<Tab>('rates');

  // Exchange rates
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [showRateForm, setShowRateForm] = useState(false);
  const [rateForm, setRateForm] = useState({
    fromCurrency: 'USD',
    toCurrency: 'IRR',
    rate: '',
    date: '',
  });
  const [rateFilterFrom, setRateFilterFrom] = useState('USD');
  const [rateFilterTo, setRateFilterTo] = useState('IRR');

  // Revaluation
  const [revaluationHistory, setRevaluationHistory] = useState<CurrencyRevaluationRow[]>([]);
  const [foreignAccounts, setForeignAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [accountBalance, setAccountBalance] = useState<number | null>(null);
  const [revaluationDate, setRevaluationDate] = useState('');
  const [gainAccountId, setGainAccountId] = useState<number | null>(null);
  const [lossAccountId, setLossAccountId] = useState<number | null>(null);
  const [revaluationResult, setRevaluationResult] = useState<RevaluationDetail[] | null>(null);
  const [loading, setLoading] = useState(false);

  const currencies = ['IRR', 'USD', 'EUR', 'GBP', 'TRY', 'AED', 'CNY', 'JPY'];

  const fetchExchangeRates = async () => {
    try {
      setLoading(true);
      const result = await tauriInvoke<ExchangeRate[]>('get_exchange_rates', {
        fromCurrency: rateFilterFrom,
        toCurrency: rateFilterTo,
        limit: 20,
      });
      setExchangeRates(result || []);
    } catch (error) {
      console.error('Failed to fetch exchange rates:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRevaluationHistory = async () => {
    try {
      const result = await tauriInvoke<CurrencyRevaluationRow[]>('get_revaluation_history');
      setRevaluationHistory(result || []);
    } catch (error) {
      console.error('Failed to fetch revaluation history:', error);
    }
  };

  const fetchForeignAccounts = async () => {
    try {
      const result = await tauriInvoke<Account[]>('get_foreign_currency_accounts');
      setForeignAccounts(result || []);
    } catch (error) {
      console.error('Failed to fetch foreign currency accounts:', error);
    }
  };

  useEffect(() => {
    if (activeTab === 'rates') {
      fetchExchangeRates();
    } else if (activeTab === 'revaluation') {
      fetchRevaluationHistory();
      fetchForeignAccounts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, rateFilterFrom, rateFilterTo]);

  const handleSetRate = async () => {
    try {
      await tauriInvoke('set_exchange_rate', {
        fromCurrency: rateForm.fromCurrency,
        toCurrency: rateForm.toCurrency,
        rate: parseFloat(rateForm.rate) || 0,
        date: rateForm.date,
      });
      setShowRateForm(false);
      setRateForm({ fromCurrency: 'USD', toCurrency: 'IRR', rate: '', date: '' });
      await fetchExchangeRates();
    } catch (error) {
      alert('خطا در ثبت نرخ ارز: ' + error);
    }
  };

  const handleCheckBalance = async (accountId: number) => {
    setSelectedAccountId(accountId);
    try {
      const balance = await tauriInvoke<number>('get_account_balance_as_of', {
        accountId,
        asOfDate: revaluationDate || new Date().toISOString().split('T')[0],
      });
      setAccountBalance(balance);
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    }
  };

  const handlePerformRevaluation = async () => {
    if (!gainAccountId || !lossAccountId) {
      alert('لطفاً حساب‌های سود و زیان تسعیر ارز را انتخاب کنید');
      return;
    }
    if (!revaluationDate) {
      alert('لطفاً تاریخ را وارد کنید');
      return;
    }
    try {
      setLoading(true);
      const result = await tauriInvoke<RevaluationDetail[]>('perform_currency_revaluation', {
        fiscalYearId: 1,
        asOfDate: revaluationDate,
        revaluationGainAccountId: gainAccountId,
        revaluationLossAccountId: lossAccountId,
      });
      setRevaluationResult(result);
      await fetchRevaluationHistory();
      await fetchForeignAccounts();
    } catch (error) {
      alert('خطا در اجرای تجدید ارزیابی: ' + error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center shadow-brand">
            <DollarSign className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">مدیریت ارز خارجی</h1>
            <p className="text-[12px] text-slate-400">نرخ ارز و تسعیر حساب‌های ارزی</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border border-slate-200 rounded-lg p-1 flex gap-1 mb-6">
        <button
          onClick={() => setActiveTab('rates')}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors flex-1 ${
            activeTab === 'rates' ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          نرخ ارزها
        </button>
        <button
          onClick={() => setActiveTab('revaluation')}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors flex-1 ${
            activeTab === 'revaluation' ? 'bg-amber-50 text-amber-700' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <RefreshCw className="w-4 h-4" />
          تجدید ارزیابی
        </button>
      </div>

      {/* ===== EXCHANGE RATES TAB ===== */}
      {activeTab === 'rates' && (
        <div className="space-y-6">
          {/* Filter & Add */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-end gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">از ارز</label>
              <select
                value={rateFilterFrom}
                onChange={(e) => setRateFilterFrom(e.target.value)}
                className="border border-slate-200 rounded px-3 py-2 text-sm"
              >
                {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">به ارز</label>
              <select
                value={rateFilterTo}
                onChange={(e) => setRateFilterTo(e.target.value)}
                className="border border-slate-200 rounded px-3 py-2 text-sm"
              >
                {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <Button onClick={() => setShowRateForm(true)} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              ثبت نرخ جدید
            </Button>
          </div>

          {/* New Rate Form */}
          {showRateForm && (
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700">ثبت نرخ ارز جدید</h3>
                <button onClick={() => setShowRateForm(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">از ارز</label>
                  <select
                    value={rateForm.fromCurrency}
                    onChange={(e) => setRateForm({ ...rateForm, fromCurrency: e.target.value })}
                    className="w-full border border-slate-200 rounded px-3 py-2 text-sm"
                  >
                    {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">به ارز</label>
                  <select
                    value={rateForm.toCurrency}
                    onChange={(e) => setRateForm({ ...rateForm, toCurrency: e.target.value })}
                    className="w-full border border-slate-200 rounded px-3 py-2 text-sm"
                  >
                    {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">نرخ</label>
                  <Input
                    type="text"
                    value={rateForm.rate}
                    onChange={(e) => setRateForm({ ...rateForm, rate: e.target.value })}
                    placeholder="مثلاً ۵۹۰,۰۰۰"
                  />
                </div>
                <JalaliDatePicker
                  label="تاریخ"
                  value={rateForm.date}
                  onChange={(val) => setRateForm({ ...rateForm, date: val })}
                />
              </div>
              <div className="flex gap-2 mt-4">
                <Button onClick={handleSetRate} size="sm">ذخیره</Button>
                <Button onClick={() => setShowRateForm(false)} variant="secondary" size="sm">لغو</Button>
              </div>
            </div>
          )}

          {/* Rates Table */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            {loading ? (
              <div className="p-6 text-center text-slate-500">در حال بارگذاری...</div>
            ) : exchangeRates.length === 0 ? (
              <div className="p-6 text-center text-slate-500">
                <p>نرخ ارزی یافت نشد</p>
                <p className="text-xs mt-2">از دکمه "ثبت نرخ جدید" برای افزودن استفاده کنید</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">از</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">به</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">نرخ</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">تاریخ</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">ثبت شده در</th>
                  </tr>
                </thead>
                <tbody>
                  {exchangeRates.map((rate) => (
                    <tr key={rate.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-medium">{rate.fromCurrency}</td>
                      <td className="px-4 py-2.5 font-medium">{rate.toCurrency}</td>
                      <td className="px-4 py-2.5 font-mono ltr-force font-bold">
                        {rate.rate.toLocaleString('fa-IR')}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{rate.date}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-400">{rate.createdAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ===== REVALUATION TAB ===== */}
      {activeTab === 'revaluation' && (
        <div className="space-y-6">
          {/* Revaluation Form */}
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-primary-600" />
              اجرای تجدید ارزیابی
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <JalaliDatePicker
                label="تاریخ تجدید ارزیابی"
                value={revaluationDate}
                onChange={(val) => setRevaluationDate(val)}
              />
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">حساب سود تسعیر</label>
                <select
                  value={gainAccountId ?? ''}
                  onChange={(e) => setGainAccountId(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full p-2 border border-slate-200 rounded-md text-sm"
                >
                  <option value="">انتخاب کنید</option>
                  {foreignAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">حساب زیان تسعیر</label>
                <select
                  value={lossAccountId ?? ''}
                  onChange={(e) => setLossAccountId(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full p-2 border border-slate-200 rounded-md text-sm"
                >
                  <option value="">انتخاب کنید</option>
                  {foreignAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {foreignAccounts.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  حساب‌های ارزی برای تجدید ارزیابی
                </label>
                <div className="flex flex-wrap gap-2">
                  {foreignAccounts.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => handleCheckBalance(a.id)}
                      className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                        selectedAccountId === a.id
                          ? 'bg-primary-50 border-primary-300 text-primary-700'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {a.code} - {a.name} ({a.currency || 'IRR'})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {accountBalance !== null && selectedAccountId && (
              <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4 text-sm">
                <span className="font-medium">مانده حساب: </span>
                <span className="ltr-force font-bold">{accountBalance.toLocaleString('fa-IR')}</span>
              </div>
            )}

            <Button
              onClick={handlePerformRevaluation}
              disabled={loading || !revaluationDate || !gainAccountId || !lossAccountId}
              className="flex items-center gap-2"
            >
              {loading ? 'در حال اجرا...' : 'اجرای تجدید ارزیابی'}
            </Button>
          </div>

          {/* Revaluation Result */}
          {revaluationResult && revaluationResult.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                <h3 className="font-semibold text-slate-700">نتیجه تجدید ارزیابی</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">حساب</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">ارز</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">مانده ارزی</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">نرخ</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">ارزش پایه</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">ارزش دفتری</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">سود/زیان</th>
                  </tr>
                </thead>
                <tbody>
                  {revaluationResult.map((detail) => (
                    <tr key={detail.accountId} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-slate-800">{detail.accountName}</div>
                        <div className="text-xs text-slate-400">{detail.accountCode}</div>
                      </td>
                      <td className="px-4 py-2.5 font-medium">{detail.currency}</td>
                      <td className="px-4 py-2.5 ltr-force">{detail.balanceInCurrency.toLocaleString('fa-IR')}</td>
                      <td className="px-4 py-2.5 ltr-force">{detail.exchangeRate.toLocaleString('fa-IR')}</td>
                      <td className="px-4 py-2.5 ltr-force">{detail.valueInBase.toLocaleString('fa-IR')}</td>
                      <td className="px-4 py-2.5 ltr-force">{detail.bookedValue.toLocaleString('fa-IR')}</td>
                      <td className="px-4 py-2.5 ltr-force">
                        <span className={`inline-flex items-center gap-1 font-bold ${
                          detail.unrealizedGainLoss >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          {detail.unrealizedGainLoss >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {Math.abs(detail.unrealizedGainLoss).toLocaleString('fa-IR')}
                        </span>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold">
                    <td colSpan={3} className="px-4 py-3 text-sm text-slate-700">جمع</td>
                    <td></td>
                    <td className="px-4 py-3 ltr-force">
                      {revaluationResult.reduce((s, r) => s + r.valueInBase, 0).toLocaleString('fa-IR')}
                    </td>
                    <td className="px-4 py-3 ltr-force">
                      {revaluationResult.reduce((s, r) => s + r.bookedValue, 0).toLocaleString('fa-IR')}
                    </td>
                    <td className="px-4 py-3 ltr-force">
                      {revaluationResult.reduce((s, r) => s + r.unrealizedGainLoss, 0).toLocaleString('fa-IR')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Revaluation History */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                <History className="w-4 h-4" />
                تاریخچه تجدید ارزیابی‌ها
              </h3>
              <Button size="sm" variant="ghost" onClick={fetchRevaluationHistory}>بروزرسانی</Button>
            </div>
            {revaluationHistory.length === 0 ? (
              <div className="p-6 text-center text-slate-500">
                <p>تاریخچه‌ای یافت نشد</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">شناسه</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">تاریخ</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">شماره سند</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">توضیحات</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">تاریخ ثبت</th>
                  </tr>
                </thead>
                <tbody>
                  {revaluationHistory.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{row.id}</td>
                      <td className="px-4 py-2.5">{row.date}</td>
                      <td className="px-4 py-2.5">
                        {row.entryNumber ? (
                          <span className="font-mono text-primary-600">{row.entryNumber}</span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{row.notes || '-'}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-400">{row.createdAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
