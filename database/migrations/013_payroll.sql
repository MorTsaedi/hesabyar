-- Migration 013: Payroll System

CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    code TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    national_id TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    hire_date TEXT NOT NULL,
    base_salary REAL NOT NULL DEFAULT 0,
    daily_wage REAL NOT NULL DEFAULT 0,
    insurance_days INTEGER NOT NULL DEFAULT 30,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive','terminated')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS salary_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS salary_template_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL REFERENCES salary_templates(id),
    type TEXT NOT NULL CHECK(type IN ('allowance','deduction')),
    name TEXT NOT NULL,
    calculation_type TEXT NOT NULL CHECK(calculation_type IN ('fixed','percentage')),
    value REAL NOT NULL DEFAULT 0,
    priority INTEGER NOT NULL DEFAULT 0,
    based_on TEXT DEFAULT 'base' CHECK(based_on IN ('base','gross','net'))
);

CREATE TABLE IF NOT EXISTS payroll_periods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed','paid')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payroll_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    period_id INTEGER NOT NULL REFERENCES payroll_periods(id),
    employee_id INTEGER NOT NULL REFERENCES employees(id),
    template_id INTEGER REFERENCES salary_templates(id),
    base_salary REAL NOT NULL DEFAULT 0,
    daily_wage REAL NOT NULL DEFAULT 0,
    working_days INTEGER NOT NULL DEFAULT 30,
    total_allowances REAL NOT NULL DEFAULT 0,
    total_deductions REAL NOT NULL DEFAULT 0,
    gross_salary REAL NOT NULL DEFAULT 0,
    net_salary REAL NOT NULL DEFAULT 0,
    employer_insurance REAL NOT NULL DEFAULT 0,
    employee_insurance REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','paid')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(period_id, employee_id)
);

CREATE TABLE IF NOT EXISTS salary_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payroll_entry_id INTEGER NOT NULL REFERENCES payroll_entries(id),
    paid_date TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    journal_entry_id INTEGER REFERENCES journal_entries(id),
    method TEXT NOT NULL DEFAULT 'cash' CHECK(method IN ('cash','bank','check')),
    reference TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_employees_company ON employees(company_id);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_period ON payroll_entries(period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_employee ON payroll_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_salary_payments_entry ON salary_payments(payroll_entry_id);
