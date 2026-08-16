import { lazy, Suspense } from 'react';
import { Layout } from './components/layout/Layout';
import { StartupWizard } from './components/wizard/StartupWizard';
import { useUIStore } from './stores/useUIStore';

// Code-split every page so the main bundle stays small
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const AccountsPage = lazy(() => import('./pages/accounts/AccountsPage').then((m) => ({ default: m.AccountsPage })));
const JournalEntriesPage = lazy(() => import('./pages/journal/JournalEntriesPage').then((m) => ({ default: m.JournalEntriesPage })));
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const ContactsPage = lazy(() => import('./pages/contacts/ContactsPage').then((m) => ({ default: m.ContactsPage })));
const InvoicesPage = lazy(() => import('./pages/invoices/InvoicesPage').then((m) => ({ default: m.InvoicesPage })));
const ProductsPage = lazy(() => import('./pages/products/ProductsPage').then((m) => ({ default: m.ProductsPage })));
const CurrencyPage = lazy(() => import('./pages/currency/CurrencyPage').then((m) => ({ default: m.CurrencyPage })));
const RecurringEntriesPage = lazy(() => import('./pages/recurring/RecurringEntriesPage').then((m) => ({ default: m.RecurringEntriesPage })));
const CompanySettingsPage = lazy(() => import('./pages/settings/CompanySettingsPage').then((m) => ({ default: m.CompanySettingsPage })));
const PeriodEndPage = lazy(() => import('./pages/period/PeriodEndPage').then((m) => ({ default: m.PeriodEndPage })));
const AgingPage = lazy(() => import('./pages/aging/AgingPage').then((m) => ({ default: m.AgingPage })));
const BackupPage = lazy(() => import('./pages/backup/BackupPage').then((m) => ({ default: m.BackupPage })));
const MoadianSettingsPage = lazy(() => import('./pages/moadian/MoadianSettingsPage').then((m) => ({ default: m.MoadianSettingsPage })));
const TaxPage = lazy(() => import('./pages/tax/TaxPage').then((m) => ({ default: m.TaxPage })));
const BankingPage = lazy(() => import('./pages/banking/BankingPage').then((m) => ({ default: m.BankingPage })));
const BudgetPage = lazy(() => import('./pages/budget/BudgetPage').then((m) => ({ default: m.BudgetPage })));
const PayrollPage = lazy(() => import('./pages/payroll/PayrollPage').then((m) => ({ default: m.PayrollPage })));
const FixedAssetsPage = lazy(() => import('./pages/assets/FixedAssetsPage').then((m) => ({ default: m.FixedAssetsPage })));
const ChecksPage = lazy(() => import('./pages/checks/ChecksPage').then((m) => ({ default: m.ChecksPage })));
const ReconciliationPage = lazy(() => import('./pages/reconciliation/ReconciliationPage').then((m) => ({ default: m.ReconciliationPage })));
const PriceListsPage = lazy(() => import('./pages/price-lists/PriceListsPage').then((m) => ({ default: m.PriceListsPage })));
const AuditLogPage = lazy(() => import('./pages/audit/AuditLogPage').then((m) => ({ default: m.AuditLogPage })));
const CustomReportsPage = lazy(() => import('./pages/custom-reports/CustomReportsPage').then((m) => ({ default: m.CustomReportsPage })));

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="w-10 h-10 rounded-2xl bg-brand-50 flex items-center justify-center">
        <svg className="animate-spin h-5 w-5 text-brand-600" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    </div>
  );
}

function App() {
  const { currentPage, setCurrentPage, wizardDone, showWizard } = useUIStore();

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'accounts':
        return <AccountsPage />;
      case 'journal':
        return <JournalEntriesPage />;
      case 'reports':
        return <ReportsPage />;
      case 'recurring':
        return <RecurringEntriesPage />;
      case 'contacts':
        return <ContactsPage />;
      case 'invoices':
        return <InvoicesPage />;
      case 'products':
        return <ProductsPage />;
      case 'currency':
        return <CurrencyPage />;
      case 'period':
        return <PeriodEndPage />;
      case 'aging':
        return <AgingPage />;
      case 'backup':
        return <BackupPage />;
      case 'moadian':
        return <MoadianSettingsPage />;
      case 'tax':
        return <TaxPage />;
      case 'banking':
        return <BankingPage />;
      case 'budget':
        return <BudgetPage />;
      case 'payroll':
        return <PayrollPage />;
      case 'assets':
        return <FixedAssetsPage />;
      case 'checks':
        return <ChecksPage />;
      case 'reconciliation':
        return <ReconciliationPage />;
      case 'price-lists':
        return <PriceListsPage />;
      case 'audit':
        return <AuditLogPage />;
      case 'custom-reports':
        return <CustomReportsPage />;
      case 'tools':
        return <CompanySettingsPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <>
      <Layout onSettingsClick={() => setCurrentPage('tools')}>
        <Suspense fallback={<PageLoader />}>{renderPage()}</Suspense>
      </Layout>
      {/* Startup wizard: shows on first launch, reopenable via useUIStore.openWizard() */}
      <StartupWizard open={!wizardDone || showWizard} />
    </>
  );
}

export default App;
