/**
 * Company Store
 * Manages current company and company list
 */
import { create } from 'zustand';

export interface Company {
  id: number;
  name: string;
  nationalId: string;
  economicCode: string;
  fiscalYearStart: string; // MM/DD
  createdAt: string;
}

interface CompanyState {
  companies: Company[];
  currentCompany: Company | null;
  isLoading: boolean;
  
  // Actions
  setCompanies: (companies: Company[]) => void;
  setCurrentCompany: (company: Company | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useCompanyStore = create<CompanyState>((set) => ({
  companies: [],
  currentCompany: null,
  isLoading: false,
  
  setCompanies: (companies) => set({ companies }),
  setCurrentCompany: (company) => set({ currentCompany: company }),
  setLoading: (loading) => set({ isLoading: loading }),
}));
