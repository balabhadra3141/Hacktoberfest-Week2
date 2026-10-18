# UdhaarOS 🏪
### AI-Powered Credit Ledger & Payment Intelligence for Small Businesses
*Hacktoberfest 2026 — Week 2 "Side Hustle" Challenge*

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://react.dev/)
[![Node](https://img.shields.io/badge/Node-20+-green.svg)](https://nodejs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.0-2D3748.svg)](https://www.prisma.io/)
[![Ollama](https://img.shields.io/badge/Ollama-Offline%20AI-orange.svg)](https://ollama.ai/)
[![Privacy](https://img.shields.io/badge/Privacy-100%25%20Local-emerald.svg)](#privacy-first-architecture)
[![License](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

---

## 💡 The Problem

In India and across emerging markets, over **30 million Kirana stores, corner grocers, pharmacies, and small traders** sell on informal credit (*Udhaar*). 

While credit drives repeat business and local trust:
1. **Paper Khatabooks & Messy Notes:** Shopkeepers jot down transactions on loose paper slips or unorganized diaries, resulting in lost entries and disputed balances.
2. **Delayed & Awkward Collections:** Merchants feel uncomfortable chasing neighbors and regulars for money. Reminders are either never sent or sound too aggressive.
3. **Cash-Flow Blindspots:** Store owners rarely know their exact aging breakdown (how much money is overdue past 30, 60, or 90 days), leading to bad debts and working capital crunches.
4. **Data Privacy Fears:** Small merchants distrust cloud platforms that harvest customer data or lock their financial records behind subscription paywalls.

---

## ⚡ The Solution: UdhaarOS

**UdhaarOS** is a privacy-first, open-source credit ledger and payment intelligence system designed specifically for neighborhood merchants. It pairs a **deterministic financial ledger** with **local, privacy-preserving AI** to automate bookkeeping and accelerate debt recovery.

### Key Highlights:
- **⚡ AI Smart Khatabook Digitizer:** Converts messy text notes, voice transcripts, and Hinglish messages (e.g. *"Ramesh ji 450 udhaar diya 2 packet aata"*, *"Sunil paid 1200 via gpay"*) into structured ledger entries.
- **🛡️ Two-Phase Human-in-the-Loop Review:** AI never writes blindly to the ledger. Extracted entries are presented with match confidence and duplicate alerts for merchant review before posting. Auto-matches existing customers or provisions new customer profiles instantly.
- **💬 AI Payment Reminders:** Crafts culturally tailored, polite, firm, or urgent WhatsApp and SMS payment reminders in Hindi, Hinglish, English, or regional languages with instant UPI payment links.
- **📊 Aging Analytics & Risk Scores:** Categorizes receivables into 0–15d, 16–30d, 31–60d, and 60+d critical risk buckets with visual delinquency trends.
- **🔒 100% Offline & Private:** Runs entirely on-device with local Ollama LLMs (default `llama3`, switchable at runtime) and an instant rule-based deterministic fallback engine. Zero financial data leaves the local machine.

---

## 🛠️ Tech Stack & Architecture

```
┌────────────────────────────────────────────────────────┐
│                   UdhaarOS Frontend                    │
│      Vite + React 19 + TypeScript + TailwindCSS        │
│   (Dashboard, Khata, Smart Import, WhatsApp Reminders) │
└───────────────────────────┬────────────────────────────┘
                            │ REST API (JSON)
┌───────────────────────────▼────────────────────────────┐
│                   UdhaarOS Backend                     │
│               Node.js + Express + TypeScript           │
│      Zod Validation · Financial Ledger Service         │
└─────────────┬────────────────────────────┬─────────────┘
              │                            │
   Prisma ORM + SQLite             Local AI Engine
 (Audit Trails & Reversals)   (Ollama LLM + Rule Parser)
```

- **Frontend:** React 19, TypeScript, Vite, TailwindCSS, TanStack React Query, Recharts, Lucide Icons, React Hot Toast.
- **Backend:** Node.js, Express, TypeScript, Zod schema validation, Dayjs (Indian standard timezone).
- **Database:** SQLite via Prisma ORM (stored in paise to guarantee zero floating-point rounding errors).
- **AI Engine (Dual-Path):**
  - **Local LLM:** Ollama (default `llama3`) with structured JSON output schemas. The active model can be chosen from Store Settings and persisted in the database; `OLLAMA_MODEL` in `.env` serves as the fallback default.
  - **Deterministic Rule Engine (`rule-parser.service.ts`):** High-speed regex & Hinglish NLP heuristics that extract entries with zero latency, and automatically take over whenever the LLM is unreachable or times out.
  - **Environment Loading (`config.ts`):** `.env` is loaded explicitly via `dotenv` with multi-path resolution, so `PORT`, `CORS_ORIGIN`, `OLLAMA_*` and upload limits apply whether the process is started from root or from `server/`.

---

## 🚀 Key Features Walkthrough

### 1. Unified Ledger & Real-Time Dashboard
- **Instant KPIs:** Total Udhaar Owed, Overdue Receivables (> due date), Total Jama (collected), and Credit velocity.
- **30-Day Debt Trend Chart:** Interactive area chart showing day-by-day debt exposure.
- **AI Health Audit:** Real-time collection insights and actionable recovery recommendations.
- **Fast Entry Actions:** Instant "+ Udhaar Dena" and "+ Jama Lena" modal dialogs.

### 2. Customer Khata Directory
- Searchable customer directory with phone numbers, credit limits, and addresses.
- **Credit Limit Progress Bar:** Real-time visual tracking of credit utilization per customer.
- **Status Badges:** Clear tagging for *Cleared*, *Active Due*, and *Overdue*.

### 3. Non-Destructive Ledger Statement
- Full double-entry-inspired ledger with running balance.
- **Audit-Compliant Reversals:** Transactions are never deleted; clean offsetting reversal records preserve accounting integrity.
- **One-Click Export:** Download full ledger statements in CSV format.

### 4. AI Smart Khatabook (Voice/Text Digitizer)
- Natural language parsing of mixed Hindi, English, and Hinglish merchant logs.
- Preloaded sample presets for quick demonstration:
  - *Hinglish Grocery Udhaar:* `"Ramesh ji 450 udhaar diya 2 packet aata"`
  - *UPI Payment / Jama:* `"Sunil paid 1200 via gpay / phonepe jama"`
  - *Bulk Daily Register:* Multi-line entries with mixed customers, quantities, and cash/credit directions.
- **Interactive Review Table:** Inline editing of customer name, amount, description, and direction before posting. Auto customer creation ensures entries are never rejected.

### 5. AI Payment Intelligence & WhatsApp Dispatch
- Select customer with pending balance.
- Choose tone:
  - 🤝 **Friendly & Polite:** Soft reminder for regular customers.
  - ⚖️ **Firm & Professional:** Formal due date follow-up.
  - 🚨 **Urgent Notice:** Final demand for delinquent accounts.
- Choose language: **Hindi / Hinglish**, **English**, or **Regional**.
- Direct **"Open in WhatsApp"** button pre-fills a personalized payment message with store name, customer name, overdue days, and merchant UPI ID.

### 6. Financial Reports & Aging
- Delinquency timeline segmentation: 0–15 Days (Current), 16–30 Days (Due Soon), 31–60 Days (Overdue), 60+ Days (Critical).
- Top debtor accounts ranking.
- CSV exports for external accountant review.

### 7. Merchant Settings & Demo Sandbox
- Store profile configuration (Store name, phone, address, currency symbol, default credit limits).
- AI connection status monitor (Ollama connectivity, installed models, active model) with one-click model switching and an offline rule-engine fallback.
- **Database Backup & Restore:** Complete JSON export and import.
- **Demo Dataset Sandbox:** One-click reset to seed data with 8 realistic customers and 25+ transactions.

---

## 📡 API Reference Overview

| Endpoint | Method | Description |
| :--- | :---: | :--- |
| `GET /api` | GET | Root API index listing service metadata & active routes |
| `GET /api/health` | GET | Health check returning status and timestamp |
| `GET /api/dashboard` | GET | Overall KPI stats, debt trend, follow-up priority list, recent ledger entries |
| `GET /api/customers` | GET | Paginated customer list with calculated balances and overdue indicators |
| `POST /api/customers` | POST | Create a new customer profile |
| `GET /api/customers/:id` | GET | Customer profile, balance, and transaction history |
| `GET /api/transactions` | GET | Store ledger transactions with type, customer, and date filtering |
| `POST /api/transactions` | POST | Record a new Credit (Udhaar), Payment (Jama), or Adjustment entry |
| `POST /api/transactions/:id/reverse` | POST | Reverse a transaction with mandatory audit reason |
| `POST /api/import/text` | POST | Parse freeform text/transcripts via LLM or Rule Engine |
| `POST /api/import/confirm` | POST | Confirm and batch-post accepted candidates to the ledger |
| `POST /api/reminders/generate` | POST | Generate a personalized WhatsApp/SMS payment reminder |
| `GET /api/reports/outstanding` | GET | Outstanding balance and delinquency report by customer |
| `GET /api/reports/export/transactions` | GET | Export all posted transactions as CSV |
| `GET /api/settings/ai-models` | GET | List installed Ollama models and current active model |
| `PUT /api/settings/ai-model` | PUT | Switch the active Ollama model at runtime |
| `POST /api/settings/backup` | POST | Export full database backup as JSON |
| `POST /api/settings/restore` | POST | Restore database from JSON backup file |
| `POST /api/settings/seed` | POST | Reset database with Kirana demo dataset |

---

## 📦 Getting Started

### Prerequisites
- Node.js v18 or later
- npm or pnpm
- (Optional) [Ollama](https://ollama.ai) with a model installed (`ollama pull llama3`) for local LLM inference. Without Ollama the app automatically works using the offline rule engine.

### 1. Clone & Setup Backend
```bash
cd Hacktoberfest-Week2/server
npm install
npx prisma db push
npx tsx prisma/seed.ts
npm run dev
```
*Backend runs on `http://localhost:3001`.*

### 2. Setup Frontend
```bash
cd Hacktoberfest-Week2/client
npm install
npm run dev
```
*Frontend runs on `http://localhost:5173`.*

---

## 🔒 Privacy-First Architecture

UdhaarOS is built with strict privacy guarantees:
1. **Zero External Telemetry:** No customer names, phone numbers, or ledger balances are transmitted to cloud APIs.
2. **Local AI Inference:** Ollama runs on `localhost:11434` without internet connectivity.
3. **Self-Contained SQLite Database:** All financial records are stored locally in an inspectable SQLite file (`prisma/dev.db`).

---

## 📄 License
MIT License. Built with ❤️ for Hacktoberfest 2026.
