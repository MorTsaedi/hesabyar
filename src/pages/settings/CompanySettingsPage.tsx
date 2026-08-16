import { useState, useEffect } from 'react';
import type { Company } from '../../types/database';
import { tauriInvoke } from '../../lib/tauri';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useUIStore } from '../../stores/useUIStore';
import { Building2, Save, X, Sparkles } from 'lucide-react';

export function CompanySettingsPage() {
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    nationalId: '',
    economicCode: '',
    registrationNumber: '',
    address: '',
    phone: '',
    email: '',
    website: '',
  });

  const fetchCompany = async () => {
    try {
      setLoading(true);
      const result: Company = await tauriInvoke('get_current_company');
      setCompany(result);
      setFormData({
        name: result.name,
        nationalId: result.nationalId || '',
        economicCode: result.economicCode || '',
        registrationNumber: result.registrationNumber || '',
        address: result.address || '',
        phone: result.phone || '',
        email: result.email || '',
        website: result.website || '',
      });
    } catch (error) {
      console.error('Failed to fetch company:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompany();
  }, []);

  const handleSave = async () => {
    try {
      if (!company) return;

      await tauriInvoke('update_company', {
        id: company.id,
        name: formData.name,
        nationalId: formData.nationalId || null,
        economicCode: formData.economicCode || null,
        registrationNumber: formData.registrationNumber || null,
        address: formData.address || null,
        phone: formData.phone || null,
        email: formData.email || null,
        website: formData.website || null,
      });

      alert('اطلاعات شرکت با موفقیت ذخیره شد');
      await fetchCompany();
    } catch (error) {
      console.error('Failed to save company:', error);
      alert('خطا در ذخیره اطلاعات شرکت');
    }
  };

  const handleReset = () => {
    if (company) {
      setFormData({
        name: company.name,
        nationalId: company.nationalId || '',
        economicCode: company.economicCode || '',
        registrationNumber: company.registrationNumber || '',
        address: company.address || '',
        phone: company.phone || '',
        email: company.email || '',
        website: company.website || '',
      });
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-slate-500">
        <p>در حال بارگذاری...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center shadow-brand">
            <Building2 className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">تنظیمات شرکت</h1>
            <p className="text-[12px] text-slate-400">مشخصات شرکت و سال مالی</p>
          </div>
        </div>
        <button
          onClick={() => useUIStore.getState().openWizard()}
          className="text-[12px] font-medium text-slate-500 hover:text-brand-600 transition-colors flex items-center gap-1.5"
          title="راهنمای راه‌اندازی"
        >
          <Sparkles className="w-4 h-4" />
          راهنمای شروع
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">نام شرکت</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="نام شرکت"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">شناسه ملی</label>
            <Input
              value={formData.nationalId}
              onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
              placeholder="۱۲۳۴۵۶۷۸۹۰"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">کد اقتصادی</label>
            <Input
              value={formData.economicCode}
              onChange={(e) => setFormData({ ...formData, economicCode: e.target.value })}
              placeholder="۱۲۳۴۵۶۷۸۹۰۱۲"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">شماره ثبت</label>
            <Input
              value={formData.registrationNumber}
              onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
              placeholder="۱۲۳۴۵"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">تلفن</label>
            <Input
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="۰۲۱۱۲۳۴۵۶۷۸"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">ایمیل</label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="info@company.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">وبسایت</label>
            <Input
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              placeholder="https://company.com"
            />
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-600 mb-1">آدرس</label>
          <textarea
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="آدرس کامل شرکت"
            className="w-full p-2 border border-slate-200 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            rows={4}
          />
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} className="flex items-center gap-2">
            <Save className="w-4 h-4" />
            ذخیره تغییرات
          </Button>
          <Button onClick={handleReset} variant="secondary" className="flex items-center gap-2">
            <X className="w-4 h-4" />
            بازنشانی
          </Button>
        </div>
      </div>

      <div className="mt-8 bg-slate-50 border border-slate-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-slate-800 mb-3">اطلاعات مالیاتی</h3>
        <p className="text-slate-600 text-sm">
          این اطلاعات برای ارتباط با سامانه مودیان استفاده میشود.
        </p>
      </div>
    </div>
  );
}
