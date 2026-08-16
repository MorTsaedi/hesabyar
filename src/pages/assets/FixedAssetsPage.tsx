import { useState, useEffect, useCallback, type ReactNode } from 'react';
import type { FixedAsset, DepreciationSummary, DepreciationRun } from '../../types/database';
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
import { SearchInput } from '../../components/ui/SearchInput';
import {
  Boxes, Plus, Pencil, Trash2, Calculator, RefreshCw, History,
  PackageX, TrendingDown, Coins,
} from 'lucide-react';

interface AssetForm {
  code: string; name: string; category: string; purchaseDate: string; purchaseCost: number;
  usefulLifeYears: number; salvageValue: number;
  depreciationMethod: 'straight_line' | 'declining_balance';
  location: string; description: string;
}

const emptyAsset: AssetForm = {
  code: '', name: '', category: '', purchaseDate: todayJalali(), purchaseCost: 0,
  usefulLifeYears: 5, salvageValue: 0, depreciationMethod: 'straight_line',
  location: '', description: '',
};

export function FixedAssetsPage() {
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [summaries, setSummaries] = useState<DepreciationSummary[]>([]);
  const [history, setHistory] = useState<Record<number, DepreciationRun[]>>({});
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [assetModal, setAssetModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<FixedAsset | null>(null);
  const [assetForm, setAssetForm] = useState<AssetForm>({ ...emptyAsset });
  const [historyAsset, setHistoryAsset] = useState<FixedAsset | null>(null);
  const [depPeriod, setDepPeriod] = useState(todayJalali().slice(0, 7));

  const loadAll = useCallback(async () => {
    try {
      const [a, s] = await Promise.all([
        tauriInvoke<FixedAsset[]>('get_fixed_assets', { companyId: 1 }),
        tauriInvoke<DepreciationSummary[]>('get_depreciation_summaries', { companyId: 1 }),
      ]);
      setAssets(a);
      setSummaries(s);
    } catch (e) { setError(String(e)); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const saveAsset = async () => {
    try {
      if (editingAsset) {
        await tauriInvoke('update_fixed_asset', {
          id: editingAsset.id, ...assetForm, status: editingAsset.status,
        });
      } else {
        await tauriInvoke('create_fixed_asset', { companyId: 1, ...assetForm });
      }
      setAssetModal(false);
      loadAll();
    } catch (e) { setError(String(e)); }
  };

  const deleteAsset = async (a: FixedAsset) => {
    if (!window.confirm(`دارایی «${a.name}» و سوابق استهلاک آن حذف شود؟`)) return;
    try {
      await tauriInvoke('delete_fixed_asset', { id: a.id });
      loadAll();
    } catch (e) { setError(String(e)); }
  };

  const runDepreciation = async (assetId: number) => {
    try {
      await tauriInvoke('record_depreciation', { assetId, period: depPeriod });
      setError('');
      loadAll();
      openHistory(assetId);
    } catch (e) { setError(String(e)); }
  };

  const runAllDepreciation = async () => {
    if (!window.confirm(`استهلاک دوره ${depPeriod} برای همه دارایی‌های فعال محاسبه و ثبت شود؟`)) return;
    let done = 0;
    try {
      for (const a of assets) {
        if (a.status !== 'active') continue;
        try {
          await tauriInvoke('record_depreciation', { assetId: a.id, period: depPeriod });
          done++;
        } catch { /* already fully depreciated */ }
      }
      setError(done > 0 ? `${formatNumber(done)} دارایی مستهلک شد` : '');
      loadAll();
    } catch (e) { setError(String(e)); }
  };

  const dispose = async (a: FixedAsset, status: 'disposed' | 'sold') => {
    if (!window.confirm(`دارایی «${a.name}» به وضعیت «${status === 'disposed' ? 'اسقاط' : 'فروخته شده'}» منتقل شود؟`)) return;
    try {
      await tauriInvoke('dispose_asset', { id: a.id, status });
      loadAll();
    } catch (e) { setError(String(e)); }
  };

  const openHistory = async (assetId: number) => {
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;
    setHistoryAsset(asset);
    try {
      const h = await tauriInvoke<DepreciationRun[]>('get_depreciation_history', { assetId });
      setHistory((prev) => ({ ...prev, [assetId]: h }));
    } catch (e) { console.error(e); }
  };

  const filtered = assets.filter((a) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${a.name} ${a.code} ${a.category || ''}`.toLowerCase().includes(q);
  });

  const activeAssets = assets.filter((a) => a.status === 'active');
  const totalCost = activeAssets.reduce((s, a) => s + a.purchaseCost, 0);
  const totalAccum = activeAssets.reduce((s, a) => s + a.accumulatedDepreciation, 0);
  const totalBook = activeAssets.reduce((s, a) => s + a.bookValue, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="دارایی ثابت"
        description="ثبت اموال، محاسبه استهلاک (خط مستقیم / نزولی) و پیگیری وضعیت دارایی‌ها"
        icon={<Boxes className="w-5 h-5" />}
        breadcrumb="حقوق و دارایی / دارایی ثابت"
        actions={
          <>
            <Button variant="outline" onClick={loadAll}>
              <RefreshCw className="w-4 h-4" /> بروزرسانی
            </Button>
            <Button onClick={() => {
              setEditingAsset(null);
              setAssetForm({ ...emptyAsset });
              setAssetModal(true);
            }}>
              <Plus className="w-4 h-4" /> دارایی جدید
            </Button>
          </>
        }
      />

      {error && (
        <div className={`text-sm rounded-xl px-4 py-3 border ${error.startsWith('✓') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
          {error}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="تعداد دارایی‌های فعال" value={formatNumber(activeAssets.length)} icon={<Boxes className="w-4 h-4" />} tone="brand" />
        <StatCard title="بهای تمام‌شده" value={formatMoney(totalCost)} icon={<Coins className="w-4 h-4" />} tone="blue" />
        <StatCard title="استهلاک انباشته" value={formatMoney(totalAccum)} icon={<TrendingDown className="w-4 h-4" />} tone="amber" />
        <StatCard title="ارزش دفتری" value={formatMoney(totalBook)} icon={<Calculator className="w-4 h-4" />} tone="green" />
      </div>

      {/* Depreciation period bar */}
      <Card
        title="محاسبه استهلاک دوره"
        description="استهلاک ماهانه بر اساس روش انتخابی و عمر مفید هر دارایی محاسبه می‌شود"
        icon={<Calculator className="w-4 h-4" />}
        action={
          <div className="flex items-center gap-2">
            <input
              value={depPeriod}
              onChange={(e) => setDepPeriod(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm w-32 ltr-force"
              placeholder="۱۴۰۴/۰۴"
            />
            <Button variant="secondary" size="sm" onClick={runAllDepreciation} disabled={activeAssets.length === 0}>
              <Calculator className="w-4 h-4" /> استهلاک همه
            </Button>
          </div>
        }
      >
        {summaries.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-3">دارایی فعالی برای محاسبه استهلاک وجود ندارد.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-card w-full">
              <thead>
                <tr>
                  <th>کد</th><th>نام دارایی</th><th>بهای تمام‌شده</th><th>استهلاک انباشته</th>
                  <th>ارزش دفتری</th><th>استهلاک ماهانه</th><th>ماه باقی‌مانده</th><th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((s) => (
                  <tr key={s.assetId}>
                    <td className="font-mono text-xs text-slate-400">{s.assetCode}</td>
                    <td className="font-bold">{s.assetName}</td>
                    <td className="ltr-force">{formatMoney(s.purchaseCost)}</td>
                    <td className="ltr-force text-amber-700">{formatMoney(s.accumulatedDepreciation)}</td>
                    <td className="ltr-force font-bold">{formatMoney(s.bookValue)}</td>
                    <td className="ltr-force text-emerald-700">{formatMoney(s.monthlyDepreciation)}</td>
                    <td>{formatNumber(s.remainingMonths)}</td>
                    <td>
                      <Button variant="outline" size="sm" onClick={() => runDepreciation(s.assetId)}>
                        ثبت استهلاک
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Assets table */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="جستجوی دارایی..." className="w-64" />
        <span className="text-[13px] text-slate-400">{formatNumber(filtered.length)} دارایی</span>
      </div>

      <Card padding={false}>
        {filtered.length === 0 ? (
          <EmptyState
            icon={<PackageX className="w-7 h-7" />}
            title="دارایی‌ای ثبت نشده"
            description="دارایی‌های ثابت خود (ساختمان، ماشین‌آلات، خودرو، تجهیزات و...) را ثبت کنید تا استهلاک آن‌ها خودکار محاسبه شود."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-card w-full">
              <thead>
                <tr>
                  <th>کد</th><th>نام</th><th>دسته</th><th>تاریخ خرید</th><th>بهای تمام‌شده</th>
                  <th>روش استهلاک</th><th>ارزش دفتری</th><th>وضعیت</th><th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id}>
                    <td className="font-mono text-xs text-slate-400">{a.code}</td>
                    <td className="font-bold">{a.name}</td>
                    <td className="text-slate-500">{a.category || '—'}</td>
                    <td className="text-slate-500">{a.purchaseDate}</td>
                    <td className="ltr-force">{formatMoney(a.purchaseCost)}</td>
                    <td>
                      <Badge tone="blue">
                        {a.depreciationMethod === 'straight_line' ? 'خط مستقیم' : 'نزولی'}
                      </Badge>
                    </td>
                    <td className="ltr-force font-bold">{formatMoney(a.bookValue)}</td>
                    <td>
                      <Badge tone={a.status === 'active' ? 'green' : a.status === 'sold' ? 'blue' : 'slate'} dot>
                        {a.status === 'active' ? 'فعال' : a.status === 'sold' ? 'فروخته شده' : 'اسقاط'}
                      </Badge>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openHistory(a.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-brand-50 hover:text-brand-700"
                          title="سوابق استهلاک"
                        >
                          <History className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingAsset(a);
                            setAssetForm({
                              code: a.code, name: a.name, category: a.category || '',
                              purchaseDate: a.purchaseDate, purchaseCost: a.purchaseCost,
                              usefulLifeYears: a.usefulLifeYears, salvageValue: a.salvageValue,
                              depreciationMethod: a.depreciationMethod, location: a.location || '',
                              description: a.description || '',
                            });
                            setAssetModal(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-brand-50 hover:text-brand-700"
                          title="ویرایش"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {a.status === 'active' && (
                          <button
                            onClick={() => dispose(a, 'disposed')}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600"
                            title="اسقاط"
                          >
                            <PackageX className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteAsset(a)}
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

      {/* Asset modal */}
      <Modal
        open={assetModal}
        onClose={() => setAssetModal(false)}
        title={editingAsset ? `ویرایش دارایی «${editingAsset.name}»` : 'دارایی جدید'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setAssetModal(false)}>انصراف</Button>
            <Button onClick={saveAsset}>ذخیره دارایی</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="کد دارایی">
            <Input value={assetForm.code} onChange={(e) => setAssetForm({ ...assetForm, code: e.target.value })} placeholder="مثلاً FA-001" />
          </Field>
          <Field label="نام دارایی">
            <Input value={assetForm.name} onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })} placeholder="مثلاً خودرو پژو ۲۰۶" />
          </Field>
          <Field label="دسته‌بندی">
            <Input value={assetForm.category} onChange={(e) => setAssetForm({ ...assetForm, category: e.target.value })} placeholder="مثلاً وسایل نقلیه" />
          </Field>
          <Field label="تاریخ خرید">
            <JalaliDatePicker value={assetForm.purchaseDate} onChange={(v) => setAssetForm({ ...assetForm, purchaseDate: v })} />
          </Field>
          <Field label="بهای تمام‌شده (ریال)">
            <Input type="text" inputMode="decimal" persianNumbers value={assetForm.purchaseCost} onChange={(e) => setAssetForm({ ...assetForm, purchaseCost: parsePersianNumber(e.target.value) })} />
          </Field>
          <Field label="ارزش اسقاط (ریال)">
            <Input type="text" inputMode="decimal" persianNumbers value={assetForm.salvageValue} onChange={(e) => setAssetForm({ ...assetForm, salvageValue: parsePersianNumber(e.target.value) })} />
          </Field>
          <Field label="عمر مفید (سال)">
            <Input type="text" inputMode="numeric" persianNumbers value={assetForm.usefulLifeYears} onChange={(e) => setAssetForm({ ...assetForm, usefulLifeYears: parsePersianNumber(e.target.value) })} />
          </Field>
          <Field label="روش استهلاک">
            <select
              value={assetForm.depreciationMethod}
              onChange={(e) => setAssetForm({ ...assetForm, depreciationMethod: e.target.value as 'straight_line' | 'declining_balance' })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            >
              <option value="straight_line">خط مستقیم</option>
              <option value="declining_balance">نزولی (۱۵۰٪)</option>
            </select>
          </Field>
          <Field label="مکان">
            <Input value={assetForm.location} onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })} />
          </Field>
          <Field label="توضیحات">
            <Input value={assetForm.description} onChange={(e) => setAssetForm({ ...assetForm, description: e.target.value })} />
          </Field>
        </div>
      </Modal>

      {/* History modal */}
      <Modal
        open={!!historyAsset}
        onClose={() => setHistoryAsset(null)}
        title={`سوابق استهلاک — ${historyAsset?.name ?? ''}`}
        size="lg"
        footer={<Button variant="outline" onClick={() => setHistoryAsset(null)}>بستن</Button>}
      >
        {historyAsset && (
          <div>
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[11px] text-slate-500 mb-1">بهای تمام‌شده</p>
                <p className="text-sm font-bold ltr-force">{formatMoney(historyAsset.purchaseCost)}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[11px] text-slate-500 mb-1">استهلاک انباشته</p>
                <p className="text-sm font-bold text-amber-700 ltr-force">{formatMoney(historyAsset.accumulatedDepreciation)}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[11px] text-slate-500 mb-1">ارزش دفتری</p>
                <p className="text-sm font-bold text-emerald-700 ltr-force">{formatMoney(historyAsset.bookValue)}</p>
              </div>
            </div>
            {(history[historyAsset.id] || []).length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">هنوز استهلاکی ثبت نشده است.</p>
            ) : (
              <table className="table-card w-full">
                <thead>
                  <tr><th>دوره</th><th>مبلغ استهلاک</th><th>تاریخ ثبت</th></tr>
                </thead>
                <tbody>
                  {(history[historyAsset.id] || []).map((h) => (
                    <tr key={h.id}>
                      <td className="font-bold">{h.period}</td>
                      <td className="ltr-force text-amber-700">{formatMoney(h.amount)}</td>
                      <td className="text-slate-500">{h.createdAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
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
