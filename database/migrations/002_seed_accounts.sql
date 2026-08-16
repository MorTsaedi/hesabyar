-- 002_seed_accounts.sql
-- Iranian standard chart of accounts (4 levels)
-- Based on Iran's accounting standards

-- We seed per company_id dynamically, so this uses variables
-- Level 1: Main categories

-- Note: Seeding is done via Rust code with dynamic company_id
-- This file is kept as reference for the account structure
-- The actual seeding uses INSERT statements with ?1 placeholder for company_id

-- ==========================================
-- LEVEL 1: Main Groups (کدهای کل)
-- ==========================================

-- Assets (دارایی‌ها) - Code 1
INSERT OR IGNORE INTO accounts (company_id, code, name, parent_id, level, type) VALUES
(?1, '1', 'دارایی‌ها', NULL, 1, 'asset'),
(?1, '2', 'بدهی‌ها', NULL, 1, 'liability'),
(?1, '3', 'حقوق صاحبان سرمایه', NULL, 1, 'equity'),
(?1, '4', 'درآمدها', NULL, 1, 'revenue'),
(?1, '5', 'هزینه‌ها', NULL, 1, 'expense');

-- ==========================================
-- LEVEL 2: Sub-groups (گروه‌های اصلی)
-- ==========================================

-- دارایی‌های جاری (Current Assets) - Code 11
INSERT OR IGNORE INTO accounts (company_id, code, name, parent_id, level, type) VALUES
(?1, '11', 'دارایی‌های جاری', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '1'), 2, 'asset'),
(?1, '12', 'دارایی‌های غیرجاری', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '1'), 2, 'asset'),
(?1, '21', 'بدهی‌های جاری', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '2'), 2, 'liability'),
(?1, '22', 'بدهی‌های غیرجاری', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '2'), 2, 'liability'),
(?1, '31', 'سرمایه', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '3'), 2, 'equity'),
(?1, '32', 'اندوخته‌ها و سود و زیان', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '3'), 2, 'equity'),
(?1, '41', 'درآمدهای عملیاتی', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '4'), 2, 'revenue'),
(?1, '42', 'درآمدهای غیرعملیاتی', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '4'), 2, 'revenue'),
(?1, '51', 'هزینه‌های عملیاتی', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '5'), 2, 'expense'),
(?1, '52', 'هزینه‌های غیرعملیاتی', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '5'), 2, 'expense');

-- ==========================================
-- LEVEL 3: Detail groups (معین‌ها)
-- ==========================================

-- دارایی‌های جاری
INSERT OR IGNORE INTO accounts (company_id, code, name, parent_id, level, type) VALUES
(?1, '1101', 'موجودی نقد', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '11'), 3, 'asset'),
(?1, '1102', 'بانک', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '11'), 3, 'asset'),
(?1, '1103', 'حساب‌های دریافتنی', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '11'), 3, 'asset'),
(?1, '1104', 'اسناد دریافتنی', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '11'), 3, 'asset'),
(?1, '1105', 'چک‌های دریافتی', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '11'), 3, 'asset'),
(?1, '1106', 'موجودی مواد و کالا', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '11'), 3, 'asset'),
(?1, '1107', 'پیش‌پرداخت‌ها', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '11'), 3, 'asset'),
(?1, '1108', 'سپرده‌ها', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '11'), 3, 'asset');

-- دارایی‌های غیرجاری
INSERT OR IGNORE INTO accounts (company_id, code, name, parent_id, level, type) VALUES
(?1, '1201', 'زمین', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '12'), 3, 'asset'),
(?1, '1202', 'ساختمان', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '12'), 3, 'asset'),
(?1, '1203', 'تأسیسات', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '12'), 3, 'asset'),
(?1, '1204', 'ماشین‌آلات و تجهیزات', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '12'), 3, 'asset'),
(?1, '1205', 'وسایل نقلیه', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '12'), 3, 'asset'),
(?1, '1206', 'اثاثه و لوازم اداری', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '12'), 3, 'asset'),
(?1, '1207', 'سرقفلی و حق امتیاز', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '12'), 3, 'asset'),
(?1, '1208', 'استهلاک انباشته', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '12'), 3, 'contra');

-- بدهی‌های جاری
INSERT OR IGNORE INTO accounts (company_id, code, name, parent_id, level, type) VALUES
(?1, '2101', 'حساب‌های پرداختنی', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '21'), 3, 'liability'),
(?1, '2102', 'اسناد پرداختنی', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '21'), 3, 'liability'),
(?1, '2103', 'چک‌های پرداختنی', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '21'), 3, 'liability'),
(?1, '2104', 'حقوق و دستمزد پرداختنی', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '21'), 3, 'liability'),
(?1, '2105', 'مالیات پرداختنی', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '21'), 3, 'liability'),
(?1, '2106', 'سهم بیمه پرداختنی', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '21'), 3, 'liability'),
(?1, '2107', 'پیش‌دریافت‌ها', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '21'), 3, 'liability');

-- بدهی‌های غیرجاری
INSERT OR IGNORE INTO accounts (company_id, code, name, parent_id, level, type) VALUES
(?1, '2201', 'تسهیلات مالی بلندمدت', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '22'), 3, 'liability'),
(?1, '2202', 'ذخیره مزایای پایان خدمت', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '22'), 3, 'liability');

-- سرمایه
INSERT OR IGNORE INTO accounts (company_id, code, name, parent_id, level, type) VALUES
(?1, '3101', 'سرمایه', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '31'), 3, 'equity'),
(?1, '3201', 'اندوخته قانونی', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '32'), 3, 'equity'),
(?1, '3202', 'سود (زیان) انباشته', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '32'), 3, 'equity'),
(?1, '3203', 'سود (زیان) سال جاری', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '32'), 3, 'equity');

-- درآمدهای عملیاتی
INSERT OR IGNORE INTO accounts (company_id, code, name, parent_id, level, type) VALUES
(?1, '4101', 'فروش کالا و خدمات', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '41'), 3, 'revenue'),
(?1, '4102', 'برگشت از فروش', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '41'), 3, 'contra');

-- درآمدهای غیرعملیاتی
INSERT OR IGNORE INTO accounts (company_id, code, name, parent_id, level, type) VALUES
(?1, '4201', 'درآمد سرمایه‌گذاری', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '42'), 3, 'revenue'),
(?1, '4202', 'سایر درآمدها', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '42'), 3, 'revenue');

-- هزینه‌های عملیاتی
INSERT OR IGNORE INTO accounts (company_id, code, name, parent_id, level, type) VALUES
(?1, '5101', 'قیمت تمام شده کالای فروش رفته', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '51'), 3, 'expense'),
(?1, '5102', 'هزینه حقوق و دستمزد', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '51'), 3, 'expense'),
(?1, '5103', 'هزینه اجاره', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '51'), 3, 'expense'),
(?1, '5104', 'هزینه آب، برق و گاز', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '51'), 3, 'expense'),
(?1, '5105', 'هزینه تلفن و ارتباطات', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '51'), 3, 'expense'),
(?1, '5106', 'هزینه تعمیر و نگهداری', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '51'), 3, 'expense'),
(?1, '5107', 'هزینه استهلاک', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '51'), 3, 'expense'),
(?1, '5108', 'هزینه بیمه', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '51'), 3, 'expense'),
(?1, '5109', 'هزینه تبلیغات و بازاریابی', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '51'), 3, 'expense'),
(?1, '5110', 'هزینه حمل و نقل', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '51'), 3, 'expense'),
(?1, '5111', 'هزینه اداری و عمومی', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '51'), 3, 'expense');

-- هزینه‌های غیرعملیاتی
INSERT OR IGNORE INTO accounts (company_id, code, name, parent_id, level, type) VALUES
(?1, '5201', 'هزینه مالی (بهره)', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '52'), 3, 'expense'),
(?1, '5202', 'هزینه جرایم', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '52'), 3, 'expense'),
(?1, '5203', 'سایر هزینه‌ها', (SELECT id FROM accounts WHERE company_id = ?1 AND code = '52'), 3, 'expense');
