// ==================== CORE STRUCTS ====================

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub id: i64,
    pub company_id: i64,
    pub code: String,
    pub name: String,
    pub level: i32,
    pub parent_id: Option<i64>,
    pub r#type: Option<String>,
    pub is_active: bool,
    pub currency: Option<String>,
    pub description: Option<String>,
    pub created_at: String,
    pub balance: f64,
}

impl std::fmt::Display for Account {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Account({} - {})", self.code, self.name)
    }
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct JournalEntry {
    pub id: i64,
    pub company_id: i64,
    pub fiscal_year: String,
    pub entry_number: i64,
    pub date: String,
    pub description: String,
    pub reference: Option<String>,
    pub created_at: String,
    pub lines: Vec<JournalLine>,
    pub total_debit: f64,
    pub total_credit: f64,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct JournalLine {
    pub id: i64,
    pub entry_id: i64,
    pub account_id: i64,
    pub account_code: Option<String>,
    pub account_name: Option<String>,
    pub description: Option<String>,
    pub debit: f64,
    pub credit: f64,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct TrialBalanceRow {
    pub id: i64,
    pub code: String,
    pub name: String,
    pub r#type: Option<String>,
    pub total_debit: f64,
    pub total_credit: f64,
    pub balance: f64,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct LedgerRow {
    pub id: i64,
    pub entry_number: i64,
    pub date: String,
    pub entry_description: String,
    pub line_description: Option<String>,
    pub debit: f64,
    pub credit: f64,
    pub balance: f64,
    pub running_balance: f64,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct FinancialReport {
    pub total_revenue: f64,
    pub total_cogs: f64,
    pub gross_profit: f64,
    pub total_expenses: f64,
    pub net_income: f64,

    pub revenue_accounts: Vec<ReportAccount>,
    pub expense_accounts: Vec<ReportAccount>,

    pub total_current_assets: f64,
    pub total_non_current_assets: f64,
    pub total_assets: f64,
    pub total_current_liabilities: f64,
    pub total_non_current_liabilities: f64,
    pub total_liabilities: f64,
    pub total_equity: f64,
    pub total_liabilities_equity: f64,

    pub asset_accounts: Vec<ReportAccount>,
    pub liability_accounts: Vec<ReportAccount>,
    pub equity_accounts: Vec<ReportAccount>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct ReportAccount {
    pub account_id: i64,
    pub code: String,
    pub name: String,
    pub balance: f64,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct BalanceSheetDetails {
    pub assets: Vec<BalanceSheetAccount>,
    pub liabilities: Vec<BalanceSheetAccount>,
    pub equity: Vec<BalanceSheetAccount>,
    pub total_assets: f64,
    pub total_liabilities: f64,
    pub total_equity: f64,
    pub total_liabilities_equity: f64,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct BalanceSheetAccount {
    pub account_id: i64,
    pub code: String,
    pub name: String,
    pub level: i32,
    pub balance: f64,
    pub parent_id: Option<i64>,
    pub children: Vec<BalanceSheetAccount>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct IncomeStatementDetails {
    pub revenues: Vec<IncomeAccount>,
    pub expenses: Vec<IncomeAccount>,
    pub total_revenue: f64,
    pub total_expenses: f64,
    pub net_income: f64,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct IncomeAccount {
    pub account_id: i64,
    pub code: String,
    pub name: String,
    pub level: i32,
    pub balance: f64,
    pub parent_id: Option<i64>,
    pub children: Vec<IncomeAccount>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct CashFlowReport {
    pub operating: CashFlowSection,
    pub investing: CashFlowSection,
    pub financing: CashFlowSection,
    pub opening_cash: f64,
    pub closing_cash: f64,
    pub net_change: f64,
    pub balanced: bool,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct CashFlowSection {
    pub title: String,
    pub items: Vec<CashFlowItem>,
    pub subtotal: f64,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct CashFlowItem {
    pub label: String,
    pub amount: f64,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct Contact {
    pub id: i64,
    pub r#type: String,
    pub name: String,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub national_id: Option<String>,
    pub economic_code: Option<String>,
    pub tax_id: Option<String>,
    pub notes: Option<String>,
    pub payment_term_days: Option<i32>,
    pub credit_limit: Option<f64>,
    pub early_payment_discount_pct: Option<f64>,
    pub early_payment_discount_days: Option<i32>,
    pub late_payment_penalty_pct: Option<f64>,
    pub created_at: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct Invoice {
    pub id: i64,
    pub number: Option<String>,
    pub r#type: String,
    pub invoice_type: String,
    pub contact_id: i64,
    pub contact_name: Option<String>,
    pub date: String,
    pub due_date: Option<String>,
    pub total: f64,
    pub status: String,
    pub notes: Option<String>,
    pub lines: Vec<InvoiceLine>,
    pub created_at: String,
    pub moadian_uid: Option<String>,
    pub moadian_status: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct InvoiceLine {
    pub id: i64,
    pub invoice_id: i64,
    pub product_id: Option<i64>,
    pub description: Option<String>,
    pub quantity: f64,
    pub unit_price: f64,
    pub discount: f64,
    pub discount_pct: f64,
    pub tax: f64,
    pub tax_rate: f64,
    pub total: f64,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Product {
    pub id: i64,
    pub company_id: i64,
    pub code: String,
    pub name: String,
    pub r#type: String,
    pub unit: String,
    pub sale_price: f64,
    pub purchase_price: f64,
    pub min_stock: Option<f64>,
    pub max_stock: Option<f64>,
    pub reorder_point: Option<f64>,
    pub current_stock: f64,
    pub tax_rate: Option<f64>,
    pub status: String,
    pub created_at: String,
}

impl std::fmt::Display for Product {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Product({} - {})", self.code, self.name)
    }
}



#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct Company {
    pub id: i64,
    pub name: String,
    pub legal_name: Option<String>,
    pub national_id: Option<String>,
    pub economic_code: Option<String>,
    pub registration_number: Option<String>,
    pub address: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub website: Option<String>,
    pub fiscal_year: Option<String>,
    pub currency: Option<String>,
    pub created_at: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct RecurringEntry {
    pub id: i64,
    pub company_id: i64,
    pub name: String,
    pub description: Option<String>,
    pub frequency: String,
    pub day_of_month: Option<i32>,
    pub day_of_week: Option<i32>,
    pub month: Option<i32>,
    pub start_date: String,
    pub end_date: Option<String>,
    pub next_date: Option<String>,
    pub is_active: bool,
    pub created_at: String,
    pub lines: Vec<RecurringLine>,
    pub total_debit: f64,
    pub total_credit: f64,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct RecurringLine {
    pub id: i64,
    pub recurring_id: i64,
    pub account_id: i64,
    pub account_code: Option<String>,
    pub account_name: Option<String>,
    pub description: Option<String>,
    pub debit: f64,
    pub credit: f64,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct FiscalYear {
    pub id: i64,
    pub company_id: i64,
    pub year: String,
    pub is_active: bool,
    pub start_date: String,
    pub end_date: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct InventoryMovement {
    pub id: i64,
    pub product_id: i64,
    pub r#type: String,
    pub quantity: f64,
    pub unit_cost: f64,
    pub total_cost: f64,
    pub date: String,
    pub reference: Option<String>,
    pub description: Option<String>,
    pub created_at: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct KardexRow {
    pub date: String,
    pub r#type: String,
    pub reference: Option<String>,
    pub description: Option<String>,
    pub qty_in: f64,
    pub qty_out: f64,
    pub unit_cost: f64,
    pub total_cost: f64,
    pub qty_balance: f64,
    pub cost_balance: f64,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TaxSetting {
    pub id: i64,
    pub vat_rate: f64,
    pub vat_registration_number: Option<String>,
    pub is_registered: bool,
    pub created_at: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TaxReturn {
    pub id: i64,
    pub period: String,
    pub total_sales_vat: f64,
    pub total_purchase_vat: f64,
    pub net_vat_payable: f64,
    pub status: String,
    pub return_date: Option<String>,
    pub payment_date: Option<String>,
    pub paid_amount: Option<f64>,
    pub created_at: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct ExchangeRate {
    pub id: i64,
    pub from_currency: String,
    pub to_currency: String,
    pub rate: f64,
    pub date: String,
    pub created_at: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct RevaluationResult {
    pub account_id: i64,
    pub account_code: String,
    pub account_name: String,
    pub currency: String,
    pub balance_before: f64,
    pub exchange_rate: f64,
    pub balance_after: f64,
    pub revaluation_gain: f64,
    pub revaluation_loss: f64,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct BankAccount {
    pub id: i64,
    pub company_id: i64,
    pub gl_account_id: i64,
    pub bank_name: String,
    pub branch: Option<String>,
    pub account_number: Option<String>,
    pub iban: Option<String>,
    pub card_number: Option<String>,
    pub currency: Option<String>,
    pub is_active: bool,
    pub created_at: String,
    pub gl_code: Option<String>,
    pub gl_name: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct ReceiptVoucher {
    pub id: i64,
    pub company_id: i64,
    pub bank_account_id: i64,
    pub amount: f64,
    pub payer: Option<String>,
    pub description: Option<String>,
    pub receipt_date: String,
    pub reference_number: Option<String>,
    pub journal_entry_id: Option<i64>,
    pub created_at: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct PaymentVoucher {
    pub id: i64,
    pub company_id: i64,
    pub bank_account_id: i64,
    pub amount: f64,
    pub payee: Option<String>,
    pub description: Option<String>,
    pub payment_date: String,
    pub reference_number: Option<String>,
    pub journal_entry_id: Option<i64>,
    pub created_at: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct BudgetPeriod {
    pub id: i64,
    pub company_id: i64,
    pub name: String,
    pub start_date: String,
    pub end_date: String,
    pub is_active: bool,
    pub created_at: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct BudgetEntry {
    pub id: i64,
    pub period_id: i64,
    pub budget_period_id: i64,
    pub account_id: i64,
    pub account_code: Option<String>,
    pub account_name: Option<String>,
    pub account_type: Option<String>,
    pub amount: f64,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct BudgetVsActualRow {
    pub account_id: i64,
    pub account_code: String,
    pub account_name: String,
    pub account_type: String,
    pub budget_amount: f64,
    pub actual_amount: f64,
    pub variance: f64,
    pub variance_pct: f64,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct Employee {
    pub id: i64,
    pub company_id: i64,
    pub code: String,
    pub first_name: String,
    pub last_name: String,
    pub national_id: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub hire_date: String,
    pub base_salary: f64,
    pub daily_wage: f64,
    pub insurance_days: i32,
    pub status: String,
    pub created_at: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct SalaryTemplate {
    pub id: i64,
    pub company_id: i64,
    pub name: String,
    pub description: Option<String>,
    pub created_at: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct SalaryTemplateItem {
    pub id: i64,
    pub template_id: i64,
    pub r#type: String,
    pub name: String,
    pub calculation_type: String,
    pub value: f64,
    pub priority: i32,
    pub based_on: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct PayrollPeriod {
    pub id: i64,
    pub company_id: i64,
    pub name: String,
    pub start_date: String,
    pub end_date: String,
    pub status: String,
    pub created_at: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct PayrollEntry {
    pub id: i64,
    pub period_id: i64,
    pub employee_id: i64,
    pub template_id: Option<i64>,
    pub base_salary: f64,
    pub daily_wage: f64,
    pub working_days: i32,
    pub total_allowances: f64,
    pub total_deductions: f64,
    pub gross_salary: f64,
    pub net_salary: f64,
    pub employer_insurance: f64,
    pub employee_insurance: f64,
    pub status: String,
    pub notes: Option<String>,
    pub created_at: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct SalaryPayment {
    pub id: i64,
    pub payroll_entry_id: i64,
    pub paid_date: String,
    pub amount: f64,
    pub journal_entry_id: Option<i64>,
    pub method: String,
    pub reference: Option<String>,
    pub created_at: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct MoadianConfig {
    pub id: i64,
    pub username: Option<String>,
    pub base_url: String,
    pub is_test_mode: bool,
    pub created_at: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct MoadianCredentials {
    pub id: i64,
    pub private_key: String,
    pub certificate: String,
    pub public_key: Option<String>,
    pub created_at: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct TrialBalanceComparisonRow {
    pub account_id: i64,
    pub account_code: String,
    pub account_name: String,
    pub current_balance: f64,
    pub previous_balance: f64,
    pub variance: f64,
    pub variance_pct: f64,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct FinancialReportComparison {
    pub current_revenue: f64,
    pub current_expenses: f64,
    pub current_net_income: f64,
    pub current_total_assets: f64,
    pub current_total_liabilities: f64,
    pub current_total_equity: f64,
    pub previous_revenue: f64,
    pub previous_expenses: f64,
    pub previous_net_income: f64,
    pub previous_total_assets: f64,
    pub previous_total_liabilities: f64,
    pub previous_total_equity: f64,
    pub variance_revenue: f64,
    pub variance_expenses: f64,
    pub variance_net_income: f64,
    pub variance_total_assets: f64,
    pub variance_total_liabilities: f64,
    pub variance_total_equity: f64,
    pub variance_pct_revenue: f64,
    pub variance_pct_expenses: f64,
    pub variance_pct_net_income: f64,
    pub variance_pct_total_assets: f64,
    pub variance_pct_total_liabilities: f64,
    pub variance_pct_total_equity: f64,
}

// ==================== BACKUP STRUCTS ====================

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct BackupInfo {
    pub name: String,
    pub size: u64,
    pub created_at: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct DatabaseInfo {
    pub path: String,
    pub size: u64,
    pub table_count: usize,
}

// ==================== TYPE ALIASES (command expectations) ====================
/// Commands expect `AccountRow` — same as `Account`.
pub type AccountRow = Account;
/// Commands expect `JournalEntryRow` — same as `JournalEntry`.
pub type JournalEntryRow = JournalEntry;
/// Commands expect `JournalLineRow` — same as `JournalLine`.
pub type JournalLineRow = JournalLine;
/// Commands expect `BackupEntry` — same as `BackupInfo`.
pub type BackupEntry = BackupInfo;
/// Commands expect `TaxSettings` — re-export of TaxSetting.
pub type TaxSettings = TaxSetting;

// ==================== ADDITIONAL STRUCTS ====================

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct AgingRow {
    pub contact_id: i64,
    pub contact_name: String,
    pub invoice_id: i64,
    pub invoice_number: String,
    pub invoice_date: String,
    pub due_date: String,
    pub balance: f64,
    pub aging_bucket: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct RestoreResult {
    pub path: String,
    pub size: u64,
    pub restored_from: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct CurrencyRevaluationRow {
    pub id: i64,
    pub company_id: i64,
    pub fiscal_year_id: i64,
    pub revaluation_date: String,
    pub created_at: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct RevaluationDetail {
    pub account_id: i64,
    pub account_code: String,
    pub account_name: String,
    pub currency: String,
    pub balance_before: f64,
    pub exchange_rate: f64,
    pub balance_after: f64,
    pub revaluation_gain: f64,
    pub revaluation_loss: f64,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct InventoryValuation {
    pub product_id: i64,
    #[serde(rename = "code")]
    pub product_code: String,
    #[serde(rename = "name")]
    pub product_name: String,
    pub unit: String,
    pub quantity: f64,
    #[serde(rename = "averageCost")]
    pub unit_cost: f64,
    pub total_value: f64,
    #[serde(rename = "method")]
    pub valuation_method: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct StockAlertItem {
    pub product_id: i64,
    pub product_code: String,
    pub product_name: String,
    pub current_quantity: f64,
    pub min_stock: Option<f64>,
    pub max_stock: Option<f64>,
    pub reorder_point: Option<f64>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct StockStatusRow {
    pub product_id: i64,
    #[serde(rename = "code")]
    pub product_code: String,
    #[serde(rename = "name")]
    pub product_name: String,
    pub unit: String,
    #[serde(rename = "currentQty")]
    pub current_quantity: f64,
    #[serde(rename = "avgCost")]
    pub unit_cost: f64,
    pub total_value: f64,
    pub min_stock: Option<f64>,
    pub max_stock: Option<f64>,
    pub reorder_point: Option<f64>,
    pub status: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct VatSummary {
    pub total_sales: f64,
    pub total_purchases: f64,
    pub vat_on_sales: f64,
    pub vat_on_purchases: f64,
    pub net_vat_payable: f64,
    pub tax_period_start: String,
    pub tax_period_end: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct CompanyRow {
    pub id: i64,
    pub name: String,
    pub legal_name: Option<String>,
    pub national_id: Option<String>,
    pub economic_code: Option<String>,
    pub registration_number: Option<String>,
    pub address: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub website: Option<String>,
    pub fiscal_year: Option<String>,
    pub fiscal_year_start: String,
    pub currency: Option<String>,
    pub is_active: i32,
    pub created_at: Option<String>,
}

// ==================== FIXED ASSETS ====================

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FixedAsset {
    pub id: i64,
    pub company_id: i64,
    pub code: String,
    pub name: String,
    pub category: Option<String>,
    pub purchase_date: String,
    pub purchase_cost: f64,
    pub useful_life_years: i32,
    pub salvage_value: f64,
    pub depreciation_method: String,
    pub accumulated_depreciation: f64,
    pub book_value: f64,
    pub status: String,
    pub location: Option<String>,
    pub description: Option<String>,
    pub created_at: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DepreciationRun {
    pub id: i64,
    pub asset_id: i64,
    pub asset_code: Option<String>,
    pub asset_name: Option<String>,
    pub period: String,
    pub amount: f64,
    pub journal_entry_id: Option<i64>,
    pub created_at: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DepreciationSummary {
    pub asset_id: i64,
    pub asset_code: String,
    pub asset_name: String,
    pub purchase_cost: f64,
    pub accumulated_depreciation: f64,
    pub book_value: f64,
    pub monthly_depreciation: f64,
    pub remaining_months: i64,
}

// ==================== CHECKS ====================

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Check {
    pub id: i64,
    pub company_id: i64,
    pub r#type: String, // received | issued
    pub check_number: String,
    pub serial: Option<String>,
    pub bank_name: Option<String>,
    pub amount: f64,
    pub issue_date: String,
    pub due_date: String,
    pub status: String, // pending | passed | returned | cashed | cancelled
    pub contact_id: Option<i64>,
    pub contact_name: Option<String>,
    pub description: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CheckSummary {
    pub total: i64,
    pub pending: i64,
    pub passed: i64,
    pub returned: i64,
    pub cashed: i64,
    pub cancelled: i64,
    pub due_soon: i64,
    pub total_amount: f64,
    pub pending_amount: f64,
}

// ==================== BANK RECONCILIATION ====================

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BankStatementEntry {
    pub id: i64,
    pub bank_account_id: i64,
    pub statement_date: String,
    pub description: String,
    pub amount: f64,
    pub reference: Option<String>,
    pub linked_voucher_id: Option<i64>,
    pub voucher_type: Option<String>,
    pub is_reconciled: bool,
    pub created_at: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ReconciliationSummary {
    pub bank_account_id: i64,
    pub bank_account_label: String,
    pub statement_entries: i64,
    pub unreconciled_entries: i64,
    pub total_statement_amount: f64,
    pub unreconciled_amount: f64,
    pub gl_balance: f64,
    pub difference: f64,
}

// ==================== PRICE LISTS ====================

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PriceList {
    pub id: i64,
    pub company_id: i64,
    pub name: String,
    pub r#type: String, // sale | purchase
    pub is_default: bool,
    pub created_at: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PriceListItem {
    pub id: i64,
    pub price_list_id: i64,
    pub product_id: i64,
    pub product_code: Option<String>,
    pub product_name: Option<String>,
    pub price: f64,
}

// ==================== AUDIT TRAIL ====================

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AuditLogEntry {
    pub id: i64,
    pub company_id: i64,
    pub action: String,
    pub entity: String,
    pub entity_id: Option<i64>,
    pub description: String,
    pub details: Option<String>,
    pub created_at: String,
}

// ==================== PAYROLL VIEWS ====================

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PayrollEntryView {
    pub id: i64,
    pub period_id: i64,
    pub period_name: Option<String>,
    pub employee_id: i64,
    pub employee_code: Option<String>,
    pub employee_name: String,
    pub template_id: Option<i64>,
    pub base_salary: f64,
    pub daily_wage: f64,
    pub working_days: i32,
    pub total_allowances: f64,
    pub total_deductions: f64,
    pub gross_salary: f64,
    pub net_salary: f64,
    pub employer_insurance: f64,
    pub employee_insurance: f64,
    pub status: String,
    pub notes: Option<String>,
    pub created_at: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PayrollPeriodSummary {
    pub id: i64,
    pub company_id: i64,
    pub name: String,
    pub start_date: String,
    pub end_date: String,
    pub status: String,
    pub created_at: String,
    pub employee_count: i64,
    pub gross_total: f64,
    pub net_total: f64,
}
