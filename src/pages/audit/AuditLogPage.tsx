import { useState, useEffect, useCallback } from 'react';
import type { AuditLogEntry } from '../../types/database';
import { tauriInvoke } from '../../lib/tauri';
import { formatNumber } from '../../lib/persian-number';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Badge, type BadgeTone } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { SearchInput } from '../../components/ui/SearchInput';
import {
  ShieldCheck, RefreshCw, History, PlusCircle, Pencil, Trash2, Database,
} from 'lucide-react';

const actionTone: Record<string, BadgeTone> = {
  create: 'green',
  update: 'blue',
  delete: 'red',
  approve: 'brand',
  pay: 'purple',
  send: 'purple',
  status: 'amber',
  calculate: 'slate',
  default: 'slate',
};

const actionLabel: Record<string, string> = {
  create: 'ایجاد',
  update: 'ویرایش',
  delete: 'حذف',
  approve: 'تأیید',
  pay: 'پرداخت',
  send: 'ارسال',
  status: 'تغییر وضعیت',
  calculate: 'محاسبه',
  default: 'عملیات',
};

const entityLabel: Record<string, string> = {
  account: 'حساب', journal: 'سند روزنامه', contact: 'شخص', invoice: 'فاکتور',
  product: 'کالا', company: 'شرکت', bank: 'بانک', check: 'چک', asset: 'دارایی ثابت',
  employee: 'کارمند', payroll: 'حقوق', budget: 'بودجه', price_list: 'لیست قیمت',
  tax: 'مالیات', voucher: 'رسید', statement: 'صورتحساب بانک', default: 'موجودیت',
};

export function AuditLogPage() {
  const [log, setLog] = useState<AuditLogEntry[]>([]);
  const [entities, setEntities] = useState<string[]>([]);
  const [entityFilter, setEntityFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [data, ents] = await Promise.all([
        tauriInvoke<AuditLogEntry[]>('get_audit_log', { companyId: 1, limit: 500 }),
        tauriInvoke<string[]>('get_audit_entities', { companyId: 1 }),
      ]);
      setLog(data);
      setEntities(ents);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const filtered = log.filter((e) => {
    if (entityFilter !== 'all' && e.entity !== entityFilter) return false;
    if (actionFilter !== 'all' && e.action !== actionFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${e.description} ${e.entity} ${e.action}`.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="بازرسی و رویدادها"
        description="ثبت خودکار تمام عملیات انجام‌شده در نرم‌افزار (ردیابی تغییرات)"
        icon={<ShieldCheck className="w-5 h-5" />}
        breadcrumb="سیستم / بازرسی و رویدادها"
        actions={
          <Button variant="outline" onClick={loadAll}>
            <RefreshCw className="w-4 h-4" /> بروزرسانی
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        >
          <option value="all">همه موجودیت‌ها</option>
          {entities.map((en) => (
            <option key={en} value={en}>{entityLabel[en] || en}</option>
          ))}
        </select>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        >
          <option value="all">همه عملیات‌ها</option>
          {Object.entries(actionLabel).filter(([k]) => k !== 'default').map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <SearchInput value={search} onChange={setSearch} placeholder="جستجوی رویداد..." className="w-64" />
        <span className="text-[13px] text-slate-400 mr-auto">{formatNumber(filtered.length)} رویداد</span>
      </div>

      <Card padding={false}>
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">در حال بارگذاری...</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<History className="w-7 h-7" />}
            title="رویدادی ثبت نشده"
            description="عملیات ایجاد، ویرایش و حذف در بخش‌های مختلف نرم‌افزار به‌صورت خودکار در اینجا ثبت می‌شود."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-card w-full">
              <thead>
                <tr>
                  <th>زمان</th><th>عملیات</th><th>موجودیت</th><th>شرح</th><th>جزئیات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id}>
                    <td className="text-slate-400 font-mono text-xs whitespace-nowrap ltr-force">{e.createdAt}</td>
                    <td>
                      <Badge tone={actionTone[e.action] || 'slate'}>
                        {actionLabel[e.action] || e.action}
                      </Badge>
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1.5 text-slate-600">
                        {e.action === 'create' ? <PlusCircle className="w-3.5 h-3.5 text-emerald-500" />
                          : e.action === 'delete' ? <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                          : e.action === 'update' ? <Pencil className="w-3.5 h-3.5 text-blue-500" />
                          : <Database className="w-3.5 h-3.5 text-slate-400" />}
                        {entityLabel[e.entity] || e.entity}
                        {e.entityId ? ` #${e.entityId}` : ''}
                      </span>
                    </td>
                    <td className="text-slate-700 max-w-md truncate">{e.description}</td>
                    <td className="text-slate-400 text-xs max-w-xs truncate" title={e.details || ''}>
                      {e.details || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
