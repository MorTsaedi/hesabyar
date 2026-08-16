import { useState, useEffect, useCallback, type ReactNode } from 'react';
import type {
  Employee, SalaryTemplate, SalaryTemplateItem, PayrollPeriodSummary, PayrollEntryView,
} from '../../types/database';
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
import { Tabs } from '../../components/ui/Tabs';
import { EmptyState } from '../../components/ui/EmptyState';
import { SearchInput } from '../../components/ui/SearchInput';
import {
  BadgeDollarSign, Users, Plus, Pencil, Trash2, FileText, Calculator,
  RefreshCw, CheckCircle2, Layers, CalendarClock, Printer,
} from 'lucide-react';

type Tab = 'employees' | 'templates' | 'periods';

const emptyEmployee = {
  code: '', firstName: '', lastName: '', nationalId: '', phone: '', email: '',
  address: '', hireDate: todayJalali(), baseSalary: 0, dailyWage: 0, insuranceDays: 30,
};

export function PayrollPage() {
  const [activeTab, setActiveTab] = useState<Tab>('employees');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [templates, setTemplates] = useState<SalaryTemplate[]>([]);
  const [templateItems, setTemplateItems] = useState<Record<number, SalaryTemplateItem[]>>({});
  const [periods, setPeriods] = useState<PayrollPeriodSummary[]>([]);
  const [entries, setEntries] = useState<PayrollEntryView[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  // Employee modal
  const [employeeModal, setEmployeeModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeForm, setEmployeeForm] = useState({ ...emptyEmployee });

  // Template modal
  const [templateModal, setTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SalaryTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({ name: '', description: '' });
  const [templateItemForms, setTemplateItemForms] = useState<SalaryTemplateItem[]>([]);

  // Period modal
  const [periodModal, setPeriodModal] = useState(false);
  const [periodForm, setPeriodForm] = useState({ name: '', startDate: todayJalali(), endDate: todayJalali() });

  // Calc modal
  const [calcModal, setCalcModal] = useState(false);
  const [calcForm, setCalcForm] = useState({ employeeId: 0, templateId: '', workingDays: 30, notes: '' });

  const loadEmployees = useCallback(async () => {
    try {
      const data = await tauriInvoke<Employee[]>('get_employees', { companyId: 1 });
      setEmployees(data);
    } catch (e) { console.error(e); }
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      const data = await tauriInvoke<SalaryTemplate[]>('get_salary_templates', { companyId: 1 });
      setTemplates(data);
      const itemsMap: Record<number, SalaryTemplateItem[]> = {};
      for (const t of data) {
        try {
          itemsMap[t.id] = await tauriInvoke<SalaryTemplateItem[]>('get_salary_template_items', { templateId: t.id });
        } catch { itemsMap[t.id] = []; }
      }
      setTemplateItems(itemsMap);
    } catch (e) { console.error(e); }
  }, []);

  const loadPeriods = useCallback(async () => {
    try {
      const data = await tauriInvoke<PayrollPeriodSummary[]>('get_payroll_periods', { companyId: 1 });
      setPeriods(data);
      if (data.length > 0 && selectedPeriod === null) {
        setSelectedPeriod(data[0].id);
        const entriesData = await tauriInvoke<PayrollEntryView[]>('get_payroll_entries', { periodId: data[0].id });
        setEntries(entriesData);
      }
    } catch (e) { console.error(e); }
  }, [selectedPeriod]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadEmployees(), loadTemplates(), loadPeriods()]);
    setLoading(false);
  }, [loadEmployees, loadTemplates, loadPeriods]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const selectPeriod = async (periodId: number) => {
    setSelectedPeriod(periodId);
    try {
      const data = await tauriInvoke<PayrollEntryView[]>('get_payroll_entries', { periodId });
      setEntries(data);
    } catch (e) { console.error(e); }
  };

  // ===== Employees =====
  const saveEmployee = async () => {
    try {
      if (editingEmployee) {
        await tauriInvoke('update_employee', {
          id: editingEmployee.id, ...employeeForm, status: editingEmployee.status,
        });
      } else {
        await tauriInvoke('create_employee', { companyId: 1, ...employeeForm });
      }
      setEmployeeModal(false);
      loadEmployees();
    } catch (e) { setError(String(e)); }
  };

  const deleteEmployee = async (emp: Employee) => {
    if (!window.confirm(`کارمند «${emp.firstName} ${emp.lastName}» حذف شود؟`)) return;
    try {
      await tauriInvoke('delete_employee', { id: emp.id });
      loadEmployees();
    } catch (e) { setError(String(e)); }
  };

  // ===== Templates =====
  const saveTemplate = async () => {
    try {
      let templateId: number;
      if (editingTemplate) {
        // No update command for templates; recreate items only
        templateId = editingTemplate.id;
      } else {
        const created = await tauriInvoke<SalaryTemplate>('create_salary_template', {
          companyId: 1, name: templateForm.name, description: templateForm.description || null,
        });
        templateId = created.id;
      }
      // Upsert items
      for (const item of templateItemForms) {
        await tauriInvoke('upsert_salary_template_item', {
          templateId, type: item.type, name: item.name,
          calculationType: item.calculationType, value: item.value,
          priority: item.priority, basedOn: item.basedOn,
        });
      }
      setTemplateModal(false);
      loadTemplates();
    } catch (e) { setError(String(e)); }
  };

  const deleteTemplate = async (t: SalaryTemplate) => {
    if (!window.confirm(`قالب «${t.name}» حذف شود؟`)) return;
    try {
      await tauriInvoke('delete_salary_template', { id: t.id });
      loadTemplates();
    } catch (e) { setError(String(e)); }
  };

  // ===== Periods =====
  const createPeriod = async () => {
    try {
      await tauriInvoke('create_payroll_period', { companyId: 1, ...periodForm });
      setPeriodModal(false);
      setPeriodForm({ name: '', startDate: todayJalali(), endDate: todayJalali() });
      setSelectedPeriod(null);
      loadPeriods();
    } catch (e) { setError(String(e)); }
  };

  const calculateEntry = async () => {
    if (!calcForm.employeeId || !selectedPeriod) return;
    try {
      await tauriInvoke('calculate_payroll_entry', {
        periodId: selectedPeriod,
        employeeId: calcForm.employeeId,
        templateId: calcForm.templateId ? Number(calcForm.templateId) : null,
        workingDays: Number(calcForm.workingDays),
        notes: calcForm.notes || null,
      });
      setCalcModal(false);
      setCalcForm({ employeeId: 0, templateId: '', workingDays: 30, notes: '' });
      selectPeriod(selectedPeriod);
    } catch (e) { setError(String(e)); }
  };

  const approveEntry = async (id: number) => {
    try {
      await tauriInvoke('approve_payroll_entry', { id });
      if (selectedPeriod) selectPeriod(selectedPeriod);
    } catch (e) { setError(String(e)); }
  };

  const calculateAll = async () => {
    if (!selectedPeriod) return;
    try {
      for (const emp of employees) {
        if (emp.status !== 'active') continue;
        await tauriInvoke('calculate_payroll_entry', {
          periodId: selectedPeriod, employeeId: emp.id, templateId: null,
          workingDays: 30, notes: null,
        });
      }
      selectPeriod(selectedPeriod);
    } catch (e) { setError(String(e)); }
  };

  const filteredEmployees = employees.filter((e) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${e.firstName} ${e.lastName} ${e.code}`.toLowerCase().includes(q);
  });

  const activeTemplates = templates;

  return (
    <div className="space-y-6">
      <PageHeader
        title="حقوق و دستمزد"
        description="مدیریت کارکنان، قالب‌های محاسبه حقوق و صدور فیش حقوقی"
        icon={<BadgeDollarSign className="w-5 h-5" />}
        breadcrumb="حسابداری / حقوق و دستمزد"
        actions={
          <Button variant="outline" onClick={() => { loadAll(); }}>
            <RefreshCw className="w-4 h-4" /> بروزرسانی
          </Button>
        }
      />

      <Tabs
        tabs={[
          { id: 'employees', label: 'کارکنان', icon: <Users className="w-4 h-4" />, count: employees.length },
          { id: 'templates', label: 'قالب‌های حقوق', icon: <Layers className="w-4 h-4" />, count: templates.length },
          { id: 'periods', label: 'دوره‌ها و فیش حقوق', icon: <CalendarClock className="w-4 h-4" />, count: periods.length },
        ]}
        active={activeTab}
        onChange={(v) => setActiveTab(v as Tab)}
      />

      {error && (
        <div className="bg-rose-50 text-rose-700 text-sm rounded-xl px-4 py-3 border border-rose-200">
          {error}
        </div>
      )}

      {loading ? (
        <Card><div className="py-16 text-center text-slate-400 text-sm">در حال بارگذاری...</div></Card>
      ) : (
        <>
          {/* ================= EMPLOYEES ================= */}
          {activeTab === 'employees' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SearchInput value={search} onChange={setSearch} placeholder="جستجوی کارمند..." className="w-64" />
                <Button
                  onClick={() => {
                    setEditingEmployee(null);
                    setEmployeeForm({ ...emptyEmployee });
                    setEmployeeModal(true);
                  }}
                >
                  <Plus className="w-4 h-4" /> کارمند جدید
                </Button>
              </div>

              <Card padding={false}>
                {filteredEmployees.length === 0 ? (
                  <EmptyState
                    icon={<Users className="w-7 h-7" />}
                    title="کارمندی ثبت نشده است"
                    description="کارکنان خود را اضافه کنید تا بتوانید برای آن‌ها فیش حقوقی صادر کنید."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="table-card w-full">
                      <thead>
                        <tr>
                          <th>کد</th><th>نام و نام خانوادگی</th><th>کد ملی</th>
                          <th>تاریخ استخدام</th><th>حقوق پایه</th><th>دستمزد روزانه</th>
                          <th>وضعیت</th><th>عملیات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredEmployees.map((emp) => (
                          <tr key={emp.id}>
                            <td className="font-mono text-xs text-slate-400">{emp.code}</td>
                            <td className="font-bold">{emp.firstName} {emp.lastName}</td>
                            <td className="text-slate-500">{emp.nationalId || '—'}</td>
                            <td className="text-slate-500">{emp.hireDate}</td>
                            <td className="ltr-force">{formatMoney(emp.baseSalary)}</td>
                            <td className="ltr-force">{formatMoney(emp.dailyWage)}</td>
                            <td>
                              <Badge tone={emp.status === 'active' ? 'green' : emp.status === 'inactive' ? 'amber' : 'red'}>
                                {emp.status === 'active' ? 'فعال' : emp.status === 'inactive' ? 'غیرفعال' : 'ترک کار'}
                              </Badge>
                            </td>
                            <td>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    setEditingEmployee(emp);
                                    setEmployeeForm({
                                      code: emp.code, firstName: emp.firstName, lastName: emp.lastName,
                                      nationalId: emp.nationalId || '', phone: emp.phone || '',
                                      email: emp.email || '', address: emp.address || '',
                                      hireDate: emp.hireDate, baseSalary: emp.baseSalary,
                                      dailyWage: emp.dailyWage, insuranceDays: emp.insuranceDays,
                                    });
                                    setEmployeeModal(true);
                                  }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:bg-brand-50 hover:text-brand-700"
                                  title="ویرایش"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => deleteEmployee(emp)}
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
            </div>
          )}

          {/* ================= TEMPLATES ================= */}
          {activeTab === 'templates' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    setEditingTemplate(null);
                    setTemplateForm({ name: '', description: '' });
                    setTemplateItemForms([
                      { id: 0, templateId: 0, type: 'allowance', name: 'بن و مسکن', calculationType: 'fixed', value: 0, priority: 1, basedOn: 'base' },
                    ]);
                    setTemplateModal(true);
                  }}
                >
                  <Plus className="w-4 h-4" /> قالب جدید
                </Button>
              </div>

              {templates.length === 0 ? (
                <Card>
                  <EmptyState
                    icon={<Layers className="w-7 h-7" />}
                    title="قالب حقوقی تعریف نشده"
                    description="قالب‌ها ترکیبی از مزایا (حق مسکن، بن، حق اولاد و...) و کسورات (مالیات، جریمه و...) را برای محاسبه خودکار فیش مشخص می‌کنند."
                  />
                </Card>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {templates.map((t) => {
                    const items = templateItems[t.id] || [];
                    return (
                      <Card
                        key={t.id}
                        title={t.name}
                        description={t.description || undefined}
                        icon={<Layers className="w-4 h-4" />}
                        action={
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setEditingTemplate(t);
                                setTemplateForm({ name: t.name, description: t.description || '' });
                                setTemplateItemForms(items.map((i) => ({ ...i })));
                                setTemplateModal(true);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:bg-brand-50 hover:text-brand-700"
                              title="ویرایش"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteTemplate(t)}
                              className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                              title="حذف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        }
                      >
                        {items.length === 0 ? (
                          <p className="text-sm text-slate-400 text-center py-4">بدون آیتم</p>
                        ) : (
                          <div className="space-y-2">
                            {items.map((item) => (
                              <div key={item.id || item.name} className="flex items-center justify-between text-sm py-1.5 px-3 rounded-lg bg-slate-50">
                                <div className="flex items-center gap-2">
                                  <Badge tone={item.type === 'allowance' ? 'green' : 'red'}>
                                    {item.type === 'allowance' ? 'مزایا' : 'کسور'}
                                  </Badge>
                                  <span className="font-medium text-slate-700">{item.name}</span>
                                </div>
                                <span className="text-slate-500 text-[13px] ltr-force">
                                  {item.calculationType === 'percentage'
                                    ? `${formatNumber(item.value)}٪ از ${item.basedOn === 'gross' ? 'ناخالص' : 'پایه'}`
                                    : formatMoney(item.value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ================= PERIODS ================= */}
          {activeTab === 'periods' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-bold text-slate-600">دوره:</span>
                  <select
                    value={selectedPeriod ?? ''}
                    onChange={(e) => selectPeriod(Number(e.target.value))}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                  >
                    {periods.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.startDate} تا {p.endDate})
                      </option>
                    ))}
                  </select>
                  {selectedPeriod && (
                    <>
                      <Button variant="secondary" size="sm" onClick={calculateAll}>
                        <Calculator className="w-4 h-4" /> محاسبه همه
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setCalcModal(true)}>
                        <FileText className="w-4 h-4" /> محاسبه فیش تکی
                      </Button>
                    </>
                  )}
                </div>
                <Button
                  onClick={() => {
                    setPeriodModal(true);
                  }}
                >
                  <Plus className="w-4 h-4" /> دوره جدید
                </Button>
              </div>

              {/* Period stats */}
              {selectedPeriod && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {(() => {
                    const p = periods.find((x) => x.id === selectedPeriod);
                    if (!p) return null;
                    return (
                      <>
                        <PeriodStat label="کارکنان دوره" value={formatNumber(p.employeeCount)} icon={<Users className="w-4 h-4" />} />
                        <PeriodStat label="جمع ناخالص" value={formatMoney(p.grossTotal)} icon={<Calculator className="w-4 h-4" />} tone="blue" />
                        <PeriodStat label="جمع خالص" value={formatMoney(p.netTotal)} icon={<FileText className="w-4 h-4" />} tone="green" />
                        <PeriodStat
                          label="وضعیت"
                          value={p.status === 'open' ? 'باز' : p.status === 'closed' ? 'بسته' : 'پرداخت شده'}
                          icon={<CheckCircle2 className="w-4 h-4" />}
                          tone={p.status === 'open' ? 'amber' : 'brand'}
                        />
                      </>
                    );
                  })()}
                </div>
              )}

              <Card padding={false}>
                {entries.length === 0 ? (
                  <EmptyState
                    icon={<FileText className="w-7 h-7" />}
                    title="فیش حقوقی برای این دوره محاسبه نشده"
                    description="با دکمه «محاسبه همه» برای همه کارکنان فعال فیش صادر کنید یا برای هر کارمند جداگانه."
                    action={
                      selectedPeriod ? (
                        <Button onClick={calculateAll}>
                          <Calculator className="w-4 h-4" /> محاسبه همه
                        </Button>
                      ) : undefined
                    }
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="table-card w-full">
                      <thead>
                        <tr>
                          <th>کد</th><th>کارمند</th><th>روز کارکرد</th><th>مزایا</th>
                          <th>کسورات</th><th>ناخالص</th><th>بیمه سهم کارمند</th>
                          <th>خالص پرداختی</th><th>وضعیت</th><th>عملیات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((e) => (
                          <tr key={e.id}>
                            <td className="font-mono text-xs text-slate-400">{e.employeeCode}</td>
                            <td className="font-bold">{e.employeeName}</td>
                            <td>{formatNumber(e.workingDays)}</td>
                            <td className="ltr-force text-emerald-700">{formatMoney(e.totalAllowances)}</td>
                            <td className="ltr-force text-rose-700">{formatMoney(e.totalDeductions + e.employeeInsurance)}</td>
                            <td className="ltr-force font-bold">{formatMoney(e.grossSalary)}</td>
                            <td className="ltr-force text-slate-500">{formatMoney(e.employeeInsurance)}</td>
                            <td className="ltr-force font-bold text-brand-700">{formatMoney(e.netSalary)}</td>
                            <td>
                              <Badge tone={e.status === 'paid' ? 'green' : e.status === 'approved' ? 'blue' : 'amber'} dot>
                                {e.status === 'paid' ? 'پرداخت شده' : e.status === 'approved' ? 'تأیید شده' : 'در انتظار'}
                              </Badge>
                            </td>
                            <td>
                              <div className="flex items-center gap-1">
                                {e.status === 'pending' && (
                                  <button
                                    onClick={() => approveEntry(e.id)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                                    title="تأیید فیش"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => window.print()}
                                  className="p-1.5 rounded-lg text-slate-400 hover:bg-brand-50 hover:text-brand-700"
                                  title="چاپ فیش"
                                >
                                  <Printer className="w-4 h-4" />
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
            </div>
          )}
        </>
      )}

      {/* ===== Employee Modal ===== */}
      <Modal
        open={employeeModal}
        onClose={() => setEmployeeModal(false)}
        title={editingEmployee ? 'ویرایش کارمند' : 'کارمند جدید'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setEmployeeModal(false)}>انصراف</Button>
            <Button onClick={saveEmployee}>
              <CheckCircle2 className="w-4 h-4" /> ذخیره
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="کد پرسنلی">
            <Input value={employeeForm.code} onChange={(e) => setEmployeeForm({ ...employeeForm, code: e.target.value })} placeholder="مثلاً ۱۰۰۱" />
          </Field>
          <Field label="تاریخ استخدام">
            <JalaliDatePicker value={employeeForm.hireDate} onChange={(v) => setEmployeeForm({ ...employeeForm, hireDate: v })} />
          </Field>
          <Field label="نام">
            <Input value={employeeForm.firstName} onChange={(e) => setEmployeeForm({ ...employeeForm, firstName: e.target.value })} />
          </Field>
          <Field label="نام خانوادگی">
            <Input value={employeeForm.lastName} onChange={(e) => setEmployeeForm({ ...employeeForm, lastName: e.target.value })} />
          </Field>
          <Field label="کد ملی">
            <Input value={employeeForm.nationalId} onChange={(e) => setEmployeeForm({ ...employeeForm, nationalId: e.target.value })} />
          </Field>
          <Field label="تلفن">
            <Input value={employeeForm.phone} onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })} />
          </Field>
          <Field label="ایمیل">
            <Input value={employeeForm.email} onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })} />
          </Field>
          <Field label="آدرس">
            <Input value={employeeForm.address} onChange={(e) => setEmployeeForm({ ...employeeForm, address: e.target.value })} />
          </Field>
          <Field label="حقوق پایه ماهانه (ریال)">
            <Input type="text" inputMode="decimal" persianNumbers value={employeeForm.baseSalary} onChange={(e) => setEmployeeForm({ ...employeeForm, baseSalary: parsePersianNumber(e.target.value) })} />
          </Field>
          <Field label="دستمزد روزانه (ریال)">
            <Input type="text" inputMode="decimal" persianNumbers value={employeeForm.dailyWage} onChange={(e) => setEmployeeForm({ ...employeeForm, dailyWage: parsePersianNumber(e.target.value) })} />
          </Field>
          <Field label="روزهای بیمه">
            <Input type="text" inputMode="numeric" persianNumbers value={employeeForm.insuranceDays} onChange={(e) => setEmployeeForm({ ...employeeForm, insuranceDays: parsePersianNumber(e.target.value) })} />
          </Field>
        </div>
      </Modal>

      {/* ===== Template Modal ===== */}
      <Modal
        open={templateModal}
        onClose={() => setTemplateModal(false)}
        title={editingTemplate ? `ویرایش قالب «${editingTemplate.name}»` : 'قالب حقوق جدید'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setTemplateModal(false)}>انصراف</Button>
            <Button onClick={saveTemplate}>
              <CheckCircle2 className="w-4 h-4" /> ذخیره قالب
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <Field label="نام قالب">
            <Input value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} placeholder="مثلاً قالب ماهانه کارمندی" />
          </Field>
          <Field label="توضیحات">
            <Input value={templateForm.description} onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })} />
          </Field>
        </div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[13px] font-bold text-slate-700">آیتم‌های محاسبه (مزایا و کسورات)</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              setTemplateItemForms([
                ...templateItemForms,
                { id: 0, templateId: 0, type: 'allowance', name: '', calculationType: 'fixed', value: 0, priority: templateItemForms.length + 1, basedOn: 'base' },
              ])
            }
          >
            <Plus className="w-3.5 h-3.5" /> افزودن آیتم
          </Button>
        </div>
        <div className="space-y-2.5">
          {templateItemForms.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 rounded-xl p-2.5">
              <select
                value={item.type}
                onChange={(e) => setTemplateItemForms(templateItemForms.map((it, i) => i === idx ? { ...it, type: e.target.value as 'allowance' | 'deduction' } : it))}
                className="col-span-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
              >
                <option value="allowance">مزایا</option>
                <option value="deduction">کسور</option>
              </select>
              <input
                value={item.name}
                onChange={(e) => setTemplateItemForms(templateItemForms.map((it, i) => i === idx ? { ...it, name: e.target.value } : it))}
                placeholder="نام آیتم"
                className="col-span-4 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
              />
              <select
                value={item.calculationType}
                onChange={(e) => setTemplateItemForms(templateItemForms.map((it, i) => i === idx ? { ...it, calculationType: e.target.value as 'fixed' | 'percentage' } : it))}
                className="col-span-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
              >
                <option value="fixed">مبلغ ثابت</option>
                <option value="percentage">درصد</option>
              </select>
              <input
                type="text"
                inputMode="decimal"
                value={item.value}
                onChange={(e) => setTemplateItemForms(templateItemForms.map((it, i) => i === idx ? { ...it, value: parsePersianNumber(e.target.value) } : it))}
                className="col-span-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
              />
              <button
                onClick={() => setTemplateItemForms(templateItemForms.filter((_, i) => i !== idx))}
                className="col-span-1 p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                title="حذف"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
          بیمه سهم کارمند ۷٪ و سهم کارفرما ۲۳٪ به‌صورت خودکار در فیش محاسبه می‌شود.
        </p>
      </Modal>

      {/* ===== Period Modal ===== */}
      <Modal
        open={periodModal}
        onClose={() => setPeriodModal(false)}
        title="دوره حقوقی جدید"
        footer={
          <>
            <Button variant="outline" onClick={() => setPeriodModal(false)}>انصراف</Button>
            <Button onClick={createPeriod}>
              <CheckCircle2 className="w-4 h-4" /> ایجاد دوره
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="نام دوره">
            <Input value={periodForm.name} onChange={(e) => setPeriodForm({ ...periodForm, name: e.target.value })} placeholder="مثلاً حقوق فروردین ۱۴۰۴" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="تاریخ شروع">
              <JalaliDatePicker value={periodForm.startDate} onChange={(v) => setPeriodForm({ ...periodForm, startDate: v })} />
            </Field>
            <Field label="تاریخ پایان">
              <JalaliDatePicker value={periodForm.endDate} onChange={(v) => setPeriodForm({ ...periodForm, endDate: v })} />
            </Field>
          </div>
        </div>
      </Modal>

      {/* ===== Calculate Modal ===== */}
      <Modal
        open={calcModal}
        onClose={() => setCalcModal(false)}
        title="محاسبه فیش حقوق"
        footer={
          <>
            <Button variant="outline" onClick={() => setCalcModal(false)}>انصراف</Button>
            <Button onClick={calculateEntry}>
              <Calculator className="w-4 h-4" /> محاسبه
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="کارمند">
            <select
              value={calcForm.employeeId}
              onChange={(e) => setCalcForm({ ...calcForm, employeeId: Number(e.target.value) })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            >
              <option value={0}>انتخاب کنید...</option>
              {employees.filter((e) => e.status === 'active').map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName} ({emp.code})</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="قالب محاسبه">
              <select
                value={calcForm.templateId}
                onChange={(e) => setCalcForm({ ...calcForm, templateId: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              >
                <option value="">بدون قالب</option>
                {activeTemplates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </Field>
            <Field label="روزهای کارکرد">
              <Input type="text" inputMode="numeric" persianNumbers value={calcForm.workingDays} onChange={(e) => setCalcForm({ ...calcForm, workingDays: parsePersianNumber(e.target.value) })} />
            </Field>
          </div>
          <Field label="توضیحات">
            <Input value={calcForm.notes} onChange={(e) => setCalcForm({ ...calcForm, notes: e.target.value })} />
          </Field>
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

function PeriodStat({ label, value, icon, tone = 'brand' }: {
  label: string; value: string; icon: ReactNode; tone?: 'brand' | 'blue' | 'green' | 'amber';
}) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700',
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
  };
  return (
    <div className="card p-4 flex items-center gap-3">
      <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${tones[tone]}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] text-slate-500">{label}</p>
        <p className="text-sm font-bold text-slate-900 ltr-force truncate">{value}</p>
      </div>
    </div>
  );
}
