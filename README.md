# HesabYar (حساب‌یار)

Free and open-source Persian accounting desktop application.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![CI](https://github.com/MorTsaedi/hesabyar/actions/workflows/ci.yml/badge.svg)](https://github.com/MorTsaedi/hesabyar/actions/workflows/ci.yml)
[![Build installers](https://github.com/MorTsaedi/hesabyar/actions/workflows/build-installers.yml/badge.svg)](https://github.com/MorTsaedi/hesabyar/actions/workflows/build-installers.yml)

[نسخه فارسی (Persian)](./README.fa.md)

HesabYar is a modern, fully offline accounting suite for Iranian small and
medium businesses, shopkeepers, freelancers and accounting firms. It is free
forever, MIT-licensed, and speaks Persian end to end — RTL interface, Jalali
(Shamsi) dates, Persian numerals and currency formatting.

---

## Why we made HesabYar

- **Free forever.** Professional accounting software in Iran is typically paid
  and closed-source. HesabYar gives every business a complete double-entry
  accounting system at zero cost, under the MIT license.
- **Persian first.** Most accounting tools are translated afterthoughts.
  HesabYar is designed around Persian from day one: RTL layout, Jalali
  calendar, Persian digits and ریال/تومان formatting, and Iranian accounting
  conventions (سند روزنامه, تراز آزمایشی, رسید دریافت/پرداخت, اظهارنامه).
- **Offline and private.** Data lives in a local SQLite database on the user's
  machine. No cloud, no internet dependency, no telemetry — with automatic
  local backup.
- **Modern and lightweight.** Built with 2025 technology (Tauri v2, React,
  Rust). The installer is a few megabytes instead of the ~150 MB typical of
  Electron apps, because Tauri reuses the operating system's native webview.
- **Open and extensible.** A modular, plugin-ready codebase that the community
  can extend — payroll, fixed assets, checks and bank reconciliation have
  already grown out of this architecture.

---

## Features

### Core accounting
- Multi-company support with per-company databases and company switching
- Hierarchical chart of accounts (unlimited levels, account types, currencies)
- Double-entry journal with automatic debit = credit validation
- General ledger and subsidiary ledger
- Trial balance (multi-column, with date-range filters)
- Opening and closing entries, fiscal-year management
- Recurring journal entry templates

### Financial reporting
- Trial balance, general ledger, balance sheet, income statement, cash flow
- Period-over-period comparison reports with variance and percentage columns
- Custom report builder
- Budget module: budget periods, per-account budget entries, budget vs. actual
- Dashboard with KPI cards, financial ratios and interactive charts
- PDF export (jspdf + html2canvas) and Excel export (SheetJS) with Persian headers

### Sales, purchasing & inventory
- Contacts (customers and suppliers) with credit limits and payment terms
- Sales, purchase and proforma invoices with discount and tax
- Early/late payment discounts
- Product catalog with min/max/reorder levels
- Stock movements (in/out/adjustment), WAC and FIFO valuation
- Stock status, low-stock alerts and inventory valuation reports
- Price lists

### Banking
- Bank accounts linked to general-ledger accounts
- Receipt vouchers (رسید دریافت) and payment vouchers (رسید پرداخت)
- Automatic journal entry creation for every voucher
- Check management (دسته چک) and bank reconciliation (مغایرت بانکی)

### Multi-currency
- Exchange-rate management and foreign-currency accounts
- Automatic currency revaluation engine with history

### Tax & Moadian
- VAT settings and per-product tax rates
- VAT summary computation and tax returns (create / record payment / delete)
- Samane Moadian (سامانه مودیان) e-invoicing integration

### Payroll & fixed assets
- Employees, salary templates and salary items
- Payroll periods and payslip entries
- Fixed-asset register, depreciation summaries and depreciation runs

### System
- Verified backup and safe restore
- Audit trail of changes (بازرسی و رویدادها)
- Company settings, light/dark theme, RTL-first responsive UI

### Quality
- 8 Rust smoke-test binaries covering banking, backup, cash flow, currency,
  inventory, Moadian, tax and the new modules

---

## Why Rust?

The backend is written in Rust, and that choice is deliberate:

- **Memory safety without a garbage collector.** The ownership system and
  borrow checker prevent use-after-free, data races and null-pointer bugs at
  compile time — important for an app that handles money.
- **Performance.** Zero-cost abstractions and native code make SQLite
  queries, report aggregation and multi-currency revaluation fast, even on
  low-end machines.
- **Small, fast binaries.** Combined with Tauri's reuse of the native webview,
  Rust keeps installers tiny (~5 MB) and startup near-instant, unlike
  Electron's bundled Chromium.
- **Correctness at compile time.** Rust's strong, expressive type system turns
  whole categories of runtime errors into compile errors, which is exactly what
  you want in accounting logic.
- **Safe concurrency.** Async tasks and threads can run database work, backup
  and Moadian HTTP calls without shared-state hazards.
- **A rich, battle-tested ecosystem for this domain:**
  - `rusqlite` (bundled SQLite) for the local per-company database
  - `serde`/`serde_json` for the typed JSON contract with the React frontend
  - `reqwest` + `rustls` for the Samane Moadian API
  - `rsa`, `aes-gcm`, `sha2`, `pbkdf2`, `hmac`, `base64` for encryption and
    signing
  - `chrono` for date handling and `uuid` for identifiers
- **One language, three platforms.** The same Rust core ships on Windows,
  macOS and Linux through Tauri.

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Desktop shell | Tauri v2 |
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS |
| State | Zustand |
| Charts | Chart.js (react-chartjs-2) |
| Tables | TanStack Table |
| Forms | React Hook Form + Zod |
| Dates | date-fns-jalali |
| PDF export | jspdf + html2canvas |
| Excel export | xlsx (SheetJS) |
| Backend | Rust (edition 2021) |
| Database | SQLite via rusqlite (bundled) |
| HTTP client | reqwest (rustls) |
| Serialization | serde + serde_json |

---

## Project structure

```
hesabyar/
├── src/                     # React + TypeScript frontend
│   ├── pages/               # One folder per feature page
│   ├── components/          # Layout, UI, wizard, shared components
│   ├── stores/              # Zustand stores
│   ├── lib/                 # Tauri invoke wrapper, Jalali/format/export utils
│   └── types/               # Shared TypeScript interfaces
├── src-tauri/               # Rust backend (Tauri v2)
│   ├── src/
│   │   ├── commands/        # Tauri commands per module
│   │   ├── db/              # SQLite data-access layer per module
│   │   ├── models/          # Shared data structures
│   │   ├── moadian/         # Samane Moadian client
│   │   └── bin/             # Smoke-test binaries
│   ├── capabilities/        # Tauri capability/permission config
│   └── tauri.conf.json      # App + bundle configuration
├── database/migrations/     # SQLite migrations (001 … 024)
├── index.html
├── package.json
└── vite.config.ts
```

---

## Getting started

### Prerequisites

- **Node.js** 20.19+ (22 recommended)
- **Rust** stable toolchain
- Tauri v2 system dependencies for your OS
  ([see the Tauri prerequisites guide](https://v2.tauri.app/start/prerequisites/))

### Development

```bash
npm install

# Run the desktop app (starts Vite + the Rust backend)
npm run tauri dev

# Or run only the frontend in the browser (Vite dev server on port 1420)
npm run dev
```

### Checks

```bash
npm run lint          # frontend lint (oxlint)
npm run build         # TypeScript check + production frontend build
cd src-tauri && cargo check   # Rust check
```

### Smoke tests

```bash
cd src-tauri
cargo run --bin banking_smoke_test
cargo run --bin backup_smoke_test
cargo run --bin cashflow_smoke_test
cargo run --bin currency_smoke_test
cargo run --bin inventory_smoke_test
cargo run --bin moadian_smoke_test
cargo run --bin new_modules_smoke_test
cargo run --bin tax_smoke_test
```

---

## Building installers

The Tauri bundler produces the platform installers:

```bash
npm run tauri build
```

| Platform | Artifacts |
|----------|-----------|
| Windows  | `.msi` (WiX) and `.exe` (NSIS) |
| macOS    | `.app` and `.dmg` |
| Linux    | `.deb`, `.rpm`, `.appimage` |

Artifacts are written to `src-tauri/target/release/bundle/`.

### CI/CD

GitHub Actions build installers automatically:

- **`.github/workflows/ci.yml`** — runs on every push and pull request:
  frontend lint, TypeScript build and `cargo check`.
- **`.github/workflows/build-installers.yml`** — builds Windows and macOS
  installers, uploads them as workflow artifacts, and (on a `v*` tag) attaches
  them to a GitHub Release.

---

## License

[MIT](./LICENSE) — free for personal and commercial use.
