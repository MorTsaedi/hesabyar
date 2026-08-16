/**
 * Type definitions for the database schema
 * Mirroring backend Rust structs from db/mod.rs
 */

export interface DbCompany {
  id: number;
  company_id: number;
  name: string;
  national_id: string;
  economic_code: string;
  registration_number: string;
  address: string;
  phone: string;
  fiscal_year_start: string;
  created_at: string;
  updated_at: string;
}

export interface DbFiscalYear {
  id: number;
  company_id: number;
  name: string;
  start_date: string;
  end_date: string;
  is_closed: number;
  created_at: string;
}

export interface DbAccount {
  id: number;
  companyId: number;
  code: string;
  name: string;
  parentId: number | null;
  level: number;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | 'contra';
  isActive: boolean;
  currency: string | null;
  description: string | null;
  createdAt: string;
  balance: number;
}

export interface DbJournalEntry {
  id: number;
  companyId: number;
  fiscalYear: string;
  entryNumber: number;
  date: string;
  description: string;
  reference: string | null;
  createdAt: string;
  lines: JournalLine[];
  totalDebit: number;
  totalCredit: number;
}

export interface DbJournalLine {
  id: number;
  entryId: number;
  accountId: number;
  accountCode: string | null;
  accountName: string | null;
  debit: number;
  credit: number;
  description: string | null;
}

export interface DbContact {
  id: number;
  company_id: number;
  type: 'customer' | 'supplier' | 'employee' | 'other';
  code: string;
  name: string;
  national_id: string;
  economic_code: string;
  phone: string;
  address: string;
  account_id: number;
  payment_term_days: number;     // migration 007
  credit_limit: number;          // migration 007
  early_payment_discount_pct: number;  // migration 008
  early_payment_discount_days: number; // migration 008
  late_payment_penalty_pct: number;    // migration 008
  is_active: number;
  created_at: string;
}

export interface DbProduct {
  id: number;
  company_id: number;
  code: string;
  name: string;
  type: 'product' | 'service';
  unit: string;
  category: string;
  sale_price: number;
  purchase_price: number;
  quantity: number;
  account_id: number;
  min_stock: number;     // migration 006
  max_stock: number;     // migration 006
  reorder_point: number; // migration 006
  tax_rate: number;      // migration 010 — VAT/Tax % applied to this product
  is_active: number;
  created_at: string;
}

export interface DbInvoice {
  id: number;
  company_id: number;
  fiscal_year_id: number;
  type: 'sale' | 'purchase' | 'sale_return' | 'purchase_return' | 'proforma';
  number: string;
  date: string;
  contact_id: number;
  due_date: string;           // migration 007
  paid_amount: number;        // migration 007
  discount_date: string;      // migration 008
  early_payment_discount_amount: number; // migration 008
  late_payment_penalty_amount: number;   // migration 008
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  tax_paid: number;                      // migration 010 — amount of VAT settled
  description: string;
  status: 'draft' | 'confirmed' | 'cancelled';
  moadian_status: 'pending' | 'sent' | 'confirmed' | 'failed' | 'not_sent';
  moadian_uid: string;
  created_at: string;
}

export interface DbInvoiceLine {
  id: number;
  invoice_id: number;
  product_id: number;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tax: number;
  total: number;
}

// ===== Tax / VAT (migration 010) =====

export interface TaxSettings {
  id: number;
  vatRate: number;
  vatRegistrationNumber: string | null;
  isRegistered: boolean;
  createdAt: string;
}

export interface VatSummary {
  totalSales: number;
  totalPurchases: number;
  vatOnSales: number;
  vatOnPurchases: number;
  netVatPayable: number;
  taxPeriodStart: string;
  taxPeriodEnd: string;
}

export interface TaxReturn {
  id: number;
  period: string;
  totalSalesVat: number;
  totalPurchaseVat: number;
  netVatPayable: number;
  status: string;
  returnDate: string | null;
  paymentDate: string | null;
  paidAmount: number | null;
  createdAt: string;
}

// ===== Banking (migration 011) =====

export interface BankAccount {
  id: number;
  companyId: number;
  accountId: number;
  accountCode: string;
  accountName: string;
  bankName: string;
  accountNumber: string;
  branch: string;
  iban: string;
  isActive: boolean;
  createdAt: string;
  balance: number;
}

export interface VoucherHeader {
  id: number;
  companyId: number;
  fiscalYearId: number;
  number: string;
  date: string;
  contactId?: number | null;
  contactName?: string | null;
  bankAccountId?: number | null;
  bankAccountLabel?: string | null;
  amount: number;
  paymentMethod: string;
  reference: string;
  description: string;
  journalEntryId?: number | null;
  createdAt: string;
}

export type ReceiptVoucher = VoucherHeader;
export type PaymentVoucher = VoucherHeader;

// ===== Frontend types (camelCase) =====

export interface Company {
  id: number;
  name: string;
  nationalId: string;
  economicCode: string;
  registrationNumber: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  fiscalYearStart: string;
  createdAt: string;
}

export interface DbAppSettings {
  id: number;
  last_company_id: number;
  currency: string;
  date_format: string;
  number_format: string;
  language: string;
  data_directory: string;
}

export interface Account extends Omit<DbAccount, 'companyId' | 'parentId' | 'isActive' | 'createdAt' | 'currency' | 'description' | 'balance'> {
  companyId: number;
  parentId: number | null;
  isActive: boolean;
  createdAt: string;
  currency?: string;
  description?: string;
  balance?: number; // Computed
}

export interface JournalEntry extends Omit<DbJournalEntry, 'companyId' | 'fiscalYear' | 'entryNumber' | 'createdAt'> {
  companyId: number;
  fiscalYear: string;
  entryNumber: number;
  createdAt: string;
  isApproved: boolean;
  lines: JournalLine[];
  totalDebit: number;
  totalCredit: number;
}

export interface JournalLine extends Omit<DbJournalLine, 'entryId' | 'accountId' | 'accountName' | 'accountCode'> {
  entryId: number;
  accountId: number;
  accountName?: string;
  accountCode?: string;
}

export interface Contact {
  id: number;
  companyId: number;
  type: 'customer' | 'supplier' | 'employee' | 'other';
  code?: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  taxId?: string;
  notes?: string;
  paymentTermDays?: number;        // migration 007
  creditLimit?: number;            // migration 007
  earlyPaymentDiscountPct?: number; // migration 008
  earlyPaymentDiscountDays?: number; // migration 008
  latePaymentPenaltyPct?: number;  // migration 008
  isActive: number;
  createdAt: string;
}

export interface Invoice {
  id: number;
  companyId: number;
  fiscalYearId: number;
  type: 'sale' | 'purchase' | 'sale_return' | 'purchase_return' | 'proforma';
  number: string;
  date: string;
  contactId?: number;
  dueDate?: string;                // migration 007
  paidAmount?: number;             // migration 007
  discountDate?: string;           // migration 008
  earlyPaymentDiscountAmount?: number; // migration 008
  latePaymentPenaltyAmount?: number;   // migration 008
  subtotal: number;
  discount: number;
  tax: number;
  taxPaid: number;                       // migration 010
  total: number;
  description: string;
  status: 'draft' | 'confirmed' | 'cancelled';
  moadianStatus: 'pending' | 'sent' | 'confirmed' | 'failed' | 'not_sent';
  moadianUid: string;
  createdAt: string;
}

export interface InvoiceLine {
  id: number;
  invoiceId: number;
  productId?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  total: number;
}

export interface Product {
  id: number;
  companyId: number;
  code?: string;
  name: string;
  type: 'product' | 'service';
  unit?: string;
  purchasePrice?: number;
  salePrice?: number;
  description?: string;
  minStock?: number;         // migration 006
  maxStock?: number;         // migration 006
  reorderPoint?: number;     // migration 006
  currentStock?: number;     // migration 014 — available quantity
  taxRate?: number;          // migration 010 — VAT % applied to this product
  isActive: number;
  createdAt: string;
}

export interface RecurringEntry {
  id: number;
  companyId: number;
  name: string;
  description?: string;
  accountId: number;
  amount: number;
  type: 'debit' | 'credit';
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  dayOfMonth?: number;
  dayOfWeek?: number;
  month?: number;
  startDate: string;
  endDate?: string;
  lastGeneratedDate?: string;
  nextGenerationDate: string;
  isActive: boolean;
  createdAt: string;
}

// ===== Inventory & Currency types =====

export interface InventoryMovement {
  id: number;
  entryId: number;
  productId: number;
  date: string;
  type: 'purchase' | 'sale' | 'sale_return' | 'purchase_return' | 'adjustment' | 'production';
  quantity: number;
  unitCost: number;
  totalCost: number;
  description: string;
}

export interface StockStatusRow {
  productId: number;
  code: string | null;
  name: string;
  unit: string | null;
  currentQty: number;
  minStock: number;
  maxStock: number;
  reorderPoint: number;
  avgCost: number;
  totalValue: number;
  status: 'normal' | 'low_stock' | 'overstock' | 'inactive';
}

export interface ValuationRow {
  productId: number;
  code: string;
  name: string;
  unit: string;
  quantity: number;
  averageCost: number;
  totalValue: number;
  lastPurchaseDate: string | null;
  lastPurchaseCost: number | null;
  method: string;
}

export interface ExchangeRate {
  id: number;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  date: string;
  createdAt: string;
}

export interface RevaluationDetail {
  accountId: number;
  accountCode: string;
  accountName: string;
  currency: string;
  balanceInCurrency: number;
  exchangeRate: number;
  valueInBase: number;
  bookedValue: number;
  unrealizedGainLoss: number;
}

export interface CurrencyRevaluationRow {
  id: number;
  companyId: number;
  fiscalYearId: number;
  date: string;
  entryId: number | null;
  entryNumber: number | null;
  notes: string;
  createdAt: string;
}

export interface MoadianConfig {
  fiscalId: string;
  economicCode: string;
  useSandbox: boolean;
  hasCredentials: boolean;
  lastTestAt: string;
  lastError: string;
}

export interface MoadianDryRun {
  invoiceJson: Record<string, unknown>;
  normalizedString: string;
  dataSignature: string;
  encryptedData: string;
  authTag: string;
  encryptedSymmetricKey: string;
  iv: string;
  uid: string;
  packetEnvelope: Record<string, unknown>;
  envelopeSignature: string;
  wouldSendTo: string;
}

export interface CashFlowLine {
  code: string;
  name: string;
  amount: number;
}

export interface CashFlowSection {
  title: string;
  lines: CashFlowLine[];
  subtotal: number;
}

export interface CashFlowReport {
  fromDate: string;
  toDate: string;
  operating: CashFlowSection;
  investing: CashFlowSection;
  financing: CashFlowSection;
  netChange: number;
  openingCash: number;
  closingCash: number;
  balanced: boolean;
}

// ===== Detailed Report types =====

export interface BalanceSheetItem {
  accountId: number;
  code: string;
  name: string;
  level: number;
  accountType: string;
  balance: number;
  parentCode: string | null;
}

export interface BalanceSheetDetails {
  assets: BalanceSheetItem[];
  liabilities: BalanceSheetItem[];
  equity: BalanceSheetItem[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  balanced: boolean;
}

export interface IncomeStatementItem {
  accountId: number;
  code: string;
  name: string;
  level: number;
  accountType: string;
  balance: number;
}

export interface IncomeStatementDetails {
  revenues: IncomeStatementItem[];
  expenses: IncomeStatementItem[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
}

// ===== Moadian types =====

export interface MoadianSendResult {
  uid: string;
  referenceNumber: string;
  timestampMs: number;
  rawResponse: unknown;
}

export interface MoadianServerInfo {
  serverTime: string;
  publicKeys: MoadianPublicKey[];
}

export interface MoadianPublicKey {
  id: string;
  keyPem: string;
}

export interface BudgetPeriod {
  id: number;
  company_id: number;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
}

export interface BudgetEntry {
  id: number;
  budget_period_id: number;
  account_id: number;
  account_code?: string;
  account_name?: string;
  amount: number;
}

export interface BudgetVsActualRow {
  account_id: number;
  account_code: string;
  account_name: string;
  account_type: string;
  budget_amount: number;
  actual_amount: number;
  variance: number;
  variance_pct: number;
}

// ===== Fixed Assets (migration 016) =====

export interface FixedAsset {
  id: number;
  companyId: number;
  code: string;
  name: string;
  category: string | null;
  purchaseDate: string;
  purchaseCost: number;
  usefulLifeYears: number;
  salvageValue: number;
  depreciationMethod: 'straight_line' | 'declining_balance';
  accumulatedDepreciation: number;
  bookValue: number;
  status: 'active' | 'disposed' | 'sold';
  location: string | null;
  description: string | null;
  createdAt: string;
}

export interface DepreciationRun {
  id: number;
  assetId: number;
  assetCode: string | null;
  assetName: string | null;
  period: string;
  amount: number;
  journalEntryId: number | null;
  createdAt: string;
}

export interface DepreciationSummary {
  assetId: number;
  assetCode: string;
  assetName: string;
  purchaseCost: number;
  accumulatedDepreciation: number;
  bookValue: number;
  monthlyDepreciation: number;
  remainingMonths: number;
}

// ===== Checks (migration 017) =====

export interface Check {
  id: number;
  companyId: number;
  type: 'received' | 'issued';
  checkNumber: string;
  serial: string | null;
  bankName: string | null;
  amount: number;
  issueDate: string;
  dueDate: string;
  status: 'pending' | 'passed' | 'returned' | 'cashed' | 'cancelled';
  contactId: number | null;
  contactName: string | null;
  description: string | null;
  notes: string | null;
  createdAt: string;
}

export interface CheckSummary {
  total: number;
  pending: number;
  passed: number;
  returned: number;
  cashed: number;
  cancelled: number;
  dueSoon: number;
  totalAmount: number;
  pendingAmount: number;
}

// ===== Bank Reconciliation (migration 018) =====

export interface BankStatementEntry {
  id: number;
  bankAccountId: number;
  statementDate: string;
  description: string;
  amount: number;
  reference: string | null;
  linkedVoucherId: number | null;
  voucherType: string | null;
  isReconciled: boolean;
  createdAt: string;
}

export interface ReconciliationSummary {
  bankAccountId: number;
  bankAccountLabel: string;
  statementEntries: number;
  unreconciledEntries: number;
  totalStatementAmount: number;
  unreconciledAmount: number;
  glBalance: number;
  difference: number;
}

// ===== Price Lists (migration 019) =====

export interface PriceList {
  id: number;
  companyId: number;
  name: string;
  type: 'sale' | 'purchase';
  isDefault: boolean;
  createdAt: string;
}

export interface PriceListItem {
  id: number;
  priceListId: number;
  productId: number;
  productCode: string | null;
  productName: string | null;
  price: number;
}

// ===== Audit Trail (migration 020) =====

export interface AuditLogEntry {
  id: number;
  companyId: number;
  action: string;
  entity: string;
  entityId: number | null;
  description: string;
  details: string | null;
  createdAt: string;
}

// ===== Payroll (migration 013) =====

export interface Employee {
  id: number;
  companyId: number;
  code: string;
  firstName: string;
  lastName: string;
  nationalId: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  hireDate: string;
  baseSalary: number;
  dailyWage: number;
  insuranceDays: number;
  status: 'active' | 'inactive' | 'terminated';
  createdAt: string;
}

export interface SalaryTemplate {
  id: number;
  companyId: number;
  name: string;
  description: string | null;
  createdAt: string;
}

export interface SalaryTemplateItem {
  id: number;
  templateId: number;
  type: 'allowance' | 'deduction';
  name: string;
  calculationType: 'fixed' | 'percentage';
  value: number;
  priority: number;
  basedOn: 'base' | 'gross' | 'net';
}

export interface PayrollPeriodSummary {
  id: number;
  companyId: number;
  name: string;
  startDate: string;
  endDate: string;
  status: 'open' | 'closed' | 'paid';
  createdAt: string;
  employeeCount: number;
  grossTotal: number;
  netTotal: number;
}

export interface PayrollEntryView {
  id: number;
  periodId: number;
  periodName: string | null;
  employeeId: number;
  employeeCode: string | null;
  employeeName: string;
  templateId: number | null;
  baseSalary: number;
  dailyWage: number;
  workingDays: number;
  totalAllowances: number;
  totalDeductions: number;
  grossSalary: number;
  netSalary: number;
  employerInsurance: number;
  employeeInsurance: number;
  status: 'pending' | 'approved' | 'paid';
  notes: string | null;
  createdAt: string;
}

export interface SalaryPayment {
  id: number;
  payrollEntryId: number;
  paidDate: string;
  amount: number;
  journalEntryId: number | null;
  method: 'cash' | 'bank' | 'check';
  reference: string | null;
  createdAt: string;
}
