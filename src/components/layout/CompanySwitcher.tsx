import { useState, useEffect, useRef } from 'react';
import { useCompanyStore } from '../../stores/useCompanyStore';
import { tauriInvoke } from '../../lib/tauri';
import { Building2, ChevronDown, Plus, Check } from 'lucide-react';

interface CompanyData {
  id: number;
  name: string;
  nationalId: string;
}

export function CompanySwitcher() {
  const { currentCompany, setCurrentCompany, setCompanies } = useCompanyStore();
  const [companies, setLocalCompanies] = useState<CompanyData[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newFiscalYear, setNewFiscalYear] = useState('1404');
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadCompanies();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const loadCompanies = async () => {
    try {
      const result = await tauriInvoke<CompanyData[]>('get_companies');
      setLocalCompanies(result);
      setCompanies(result as any);

      if (!currentCompany && result.length > 0) {
        const active = await tauriInvoke<CompanyData>('get_current_company').catch(() => result[0]);
        setCurrentCompany(active as any);
      }
    } catch (err) {
      console.error('Failed to load companies:', err);
    }
  };

  const switchCompany = async (id: number) => {
    try {
      await tauriInvoke('switch_company', { id });
      const company = await tauriInvoke<CompanyData>('get_company', { id });
      setCurrentCompany(company as any);
      setIsOpen(false);
      window.location.reload();
    } catch (err) {
      console.error('Failed to switch company:', err);
    }
  };

  const createCompany = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      await tauriInvoke('create_company', {
        name: newName,
        nationalId: null,
        economicCode: null,
        fiscalYear: newFiscalYear,
      });
      setNewName('');
      setShowCreate(false);
      await loadCompanies();
    } catch (err) {
      alert('خطا در ایجاد شرکت: ' + err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg text-sm transition-colors border border-slate-200"
      >
        <Building2 className="w-4 h-4 text-slate-500" />
        <span className="text-slate-800 font-medium max-w-[120px] truncate">
          {currentCompany?.name || 'انتخاب شرکت'}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1">
          <div className="px-3 py-2 text-xs font-medium text-slate-500 border-b border-slate-100">
            شرکت‌ها
          </div>
          {companies.map((c) => (
            <button
              key={c.id}
              onClick={() => switchCompany(c.id)}
              className={`w-full text-right px-3 py-2.5 text-sm flex items-center gap-2 hover:bg-slate-50 transition-colors ${
                currentCompany?.id === c.id ? 'bg-primary-50 text-primary-700' : 'text-slate-700'
              }`}
            >
              <Building2 className="w-4 h-4 shrink-0" />
              <span className="flex-1 truncate">{c.name}</span>
              {currentCompany?.id === c.id && <Check className="w-4 h-4 text-primary-600" />}
            </button>
          ))}
          <div className="border-t border-slate-100 mt-1 pt-1">
            {showCreate ? (
              <div className="px-3 py-2 space-y-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="نام شرکت"
                  className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary-500"
                  autoFocus
                />
                <input
                  value={newFiscalYear}
                  onChange={(e) => setNewFiscalYear(e.target.value)}
                  placeholder="سال مالی (مثلاً 1404)"
                  className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={createCompany}
                    disabled={loading}
                    className="flex-1 bg-primary-600 text-white text-sm py-1.5 rounded-md hover:bg-primary-700 disabled:opacity-50"
                  >
                    {loading ? '...' : 'ایجاد'}
                  </button>
                  <button
                    onClick={() => setShowCreate(false)}
                    className="px-3 text-sm text-slate-600 hover:text-slate-800"
                  >
                    انصراف
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowCreate(true)}
                className="w-full text-right px-3 py-2.5 text-sm text-primary-600 flex items-center gap-2 hover:bg-primary-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                شرکت جدید
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
