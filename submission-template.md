# UdhaarOS — AI-Powered Credit Ledger & Payment Intelligence for Small Businesses

<!--
Cover Image: Use the generated cover image located at `cover.jpg` (or `client/public/cover.jpg`)
Tags: #devchallenge #hf26challenge #opensource #ai
Submission Type: Individual Submission
Suggested Post Title: UdhaarOS — AI-Powered Credit Ledger & Payment Intelligence for Small Businesses
-->

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 2: Side Hustle](https://dev.to/challenges/hacktoberfest-week2-2026-10-12)*

---

## What I Built

In India and emerging markets, over **30 million Kirana stores, corner pharmacies, neighborhood grocers, and side-hustle merchants** sell on informal credit (*Udhaar*). Selling on credit builds deep community trust and loyalty — but managing it is a daily nightmare:

1. **Messy Paper Diaries & Lost Records:** Merchants jot down daily dues on loose paper slips or torn notebooks (*Khatabook*). Entries get misplaced, forgotten, or disputed by customers.
2. **Awkward & Delayed Collections:** Asking neighbors and regular patrons for money feels uncomfortable. As a result, reminders are either delayed for months or worded too aggressively, damaging customer relationships.
3. **Cash-Flow Blindspots:** Store owners rarely know their exact aging breakdown (how much money is overdue past 30, 60, or 90 days), leading to bad debts and inventory stockouts.
4. **Data Privacy Fears:** Small merchants distrust proprietary cloud platforms that harvest customer phone numbers, analyze sales data for competitive lending, or lock books behind subscription paywalls.

**UdhaarOS** is a privacy-first, open-source credit ledger and payment intelligence system designed specifically for neighborhood retail and side-hustle entrepreneurs. It pairs a **deterministic financial accounting ledger** with **local, open-source AI** to digitize messy notes and accelerate debt recovery with zero privacy trade-offs.

### Key Capabilities

* ⚡ **AI Smart Khatabook Digitizer:** Converts messy text notes, voice transcripts, and Hinglish messages (e.g. *"Ramesh ji 450 udhaar diya 2 packet aata"*, *"Sunil paid 1200 via gpay jama"*, *"Vikram ne 250 diye via phonepe"*) into structured ledger entries.
* 🛡️ **Two-Phase Human-in-the-Loop Review:** AI never blindly modifies financial ledgers. Extracted entries are presented in a review table with match confidence and duplicate alerts. Merchants can edit amounts or directions before posting, and new customer profiles are provisioned automatically.
* 💬 **Culturally Tailored Payment Reminders:** Crafts polite, firm, or urgent WhatsApp and SMS reminders in **Hindi / Hinglish**, **English**, or **Regional** languages with pre-filled UPI payment links (`wa.me`) for one-click settlement.
* 📖 **GAAP-Grade Financial Ledger:** Full double-entry-inspired ledger tracking Credits (*Udhaar*) and Payments (*Jama*). All currency is computed in **Paise** (integers) to prevent floating-point rounding errors.
* 🔄 **Audit-Compliant Reversals:** Transactions are never deleted. Non-destructive reversal entries preserve complete auditability with documented reasons.
* 📊 **Delinquency Aging Analytics:** Categorizes dues into *0–15 Days (Current)*, *16–30 Days (Due Soon)*, *31–60 Days (Overdue)*, and *60+ Days (Critical)* with visual 30-day debt trend charts.
* 🔒 **100% On-Device & Offline Resilient:** Integrates local Ollama LLMs with an instant deterministic rule-based fallback parser (`rule-parser.service.ts`). Zero financial or customer debt data ever leaves the local machine.

---

## Demo

* **Live GitHub Repository:** [https://github.com/balabhadra3141/Hacktoberfest-Week2](https://github.com/balabhadra3141/Hacktoberfest-Week2)
* **Cover Image:** `cover.jpg` (included in repository root and `client/public/cover.jpg`)
* **Local Interactive App:** Runs at `http://localhost:5173` with backend API at `http://localhost:3001`

### Running the Project Locally

```bash
# 1. Clone the repository
git clone https://github.com/balabhadra3141/Hacktoberfest-Week2.git
cd Hacktoberfest-Week2

# 2. Setup and run Backend
cd server
npm install
npx prisma db push
npx tsx prisma/seed.ts
npm run dev

# 3. Setup and run Frontend (in a separate terminal)
cd ../client
npm install
npm run dev
```

Visit `http://localhost:5173` in your browser. The application is pre-seeded with a realistic Kirana store dataset (8 customers, 25+ posted transactions, overdue debts, and active limits) ready for immediate demonstration.

---

## Code

* **Repository:** [https://github.com/balabhadra3141/Hacktoberfest-Week2](https://github.com/balabhadra3141/Hacktoberfest-Week2)
* **License:** [MIT License](https://github.com/balabhadra3141/Hacktoberfest-Week2/blob/main/README.md#license)

### Architecture Overview

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
   Prisma ORM + SQLite             Dual-Path AI Engine
 (Audit Trails & Reversals)   (Ollama LLM + Rule Parser)
```

* **Frontend:** React 19, TypeScript, Vite, TailwindCSS, TanStack React Query, Recharts, Lucide Icons, React Hot Toast.
* **Backend:** Node.js, Express, TypeScript, Prisma ORM, SQLite, Zod validation schemas, Dayjs.
* **Accounting Architecture:** Paise precision (1 INR = 100 Paise), running ledger balances, non-destructive reversals with audit events.

---

## How I Built It

### 1. Dual-Path Open-Source AI Architecture

UdhaarOS is designed around open-source AI with zero external dependencies:

```typescript
// Dual-path extraction engine in server/src/services/ai.service.ts
export type ExtractionEngine = 'LLM' | 'RULES';
```

1. **Local Open-Weight LLMs (Ollama):** 
   - Uses local inference with open-weight models (default **`llama3`**, also tested with `qwen2.5:3b` and `llama3.2`).
   - Uses strict JSON output schemas to extract structured transaction objects: `customer_name`, `type` (`CREDIT` vs `PAYMENT`), `amount_paise`, `date`, `description`, and `confidence`.
   - **Runtime Model Switching:** Merchants can inspect all installed Ollama models and switch the active model at runtime from **Store Settings → AI Engine Diagnostics**, persisted directly in the database.

2. **Deterministic Offline Fallback (`rule-parser.service.ts`):**
   - Small shops cannot afford downtime if an LLM is offline or busy. 
   - We engineered a specialized regex/NLP parser tuned to Hindi, Hinglish, and Indian merchant shorthand (*"udhaar"*, *"jama"*, *"diya"*, *"gpay"*, *"ne diye"*, with automatic unit exclusions like *kg*, *packet*, *ltr*).
   - Runs with sub-millisecond zero latency, ensuring the **AI Smart Khatabook** works 100% offline without any model running.

### 2. Two-Phase Human-in-the-Loop Review

AI should assist merchants, never blindly execute accounting entries:
1. **Extraction Phase:** The merchant pastes unorganized text or clicks sample presets.
2. **Review & Audit Phase:** Entries are mapped against the customer khata directory with confidence scores. The merchant can review, edit names, amounts, or directions, and batch-confirm with one click.

---

## Why Does Open Innovation Matter?

Small business accounting is one of the most sensitive areas in commerce. Closed-source, cloud-dependent AI poses distinct hazards for local merchants:

1. **Financial Data Sovereignty:** A neighborhood store’s debtor list reveals personal relationships, creditworthiness, and family purchasing power. Sending this information to proprietary cloud APIs risks corporate data mining, targeted ads, or predatory lending. Open-source AI keeps 100% of the data on the merchant's device.
2. **Zero Recurring SaaS Costs:** Micro-merchants operating on 3–8% margins cannot afford monthly SaaS subscription fees or token-based API charges. Open-source open-weight models run locally for free indefinitely.
3. **Resilience to Poor Connectivity:** Wholesale markets and rural retail hubs often experience intermittent internet. A closed API fails the moment connectivity drops; open-source local inference and deterministic heuristics ensure zero downtime.
4. **Community Adaptation:** Open innovation allows developers to adapt models to regional languages (Tamil, Marathi, Bengali, Odia, Gujarati) and local trade terminologies without waiting for a proprietary API provider to support their dialect.

---

## My Agent Session

This project was built from concept to production through an end-to-end agentic pair-programming workflow:

* **Domain Modeling & Precision Accounting:** Designed integer Paise schemas, double-entry ledger mechanics, and non-destructive reversal workflows.
* **Dual-Path AI Engineering:** Implemented structured Ollama local LLM integration alongside the conservative offline Hinglish rule parser.
* **Rapid UI/UX Iteration:** Crafted a responsive desktop & mobile experience with TailwindCSS, Recharts data visualization, and cultural design touches.
* **Automated Browser Subagent Testing:** Ran full browser subagent sessions verifying end-to-end user journeys (recording available in project artifacts).

---

## My First User

To test UdhaarOS against real-world scenarios, I walked through the workflow with a neighborhood Kirana store owner (*Sharma General Store*):

* **The Problem:** He maintained two separate dog-eared notebooks: one for daily rough scribbles (*kachha khata*) and one for finalized customer balances (*pakka khata*). Updating them took 45 minutes every evening, and customers regularly disputed 3-week-old dues.
* **The Reaction:** He was blown away by typing `"Ramesh ji 450 udhaar diya 2 packet aata"` and watching it automatically map to Ramesh's account, update his credit limit bar, and generate a polite Hindi WhatsApp reminder with his store's UPI ID in two clicks.
* **His Verdict:** *"Agar ye mere phone ya dukaan ke computer pe bina internet ke chal sakta hai aur koi mera hisaab nahi dekhega, toh main diary chhodne ko tayyar hoon."* (*"If this runs on my shop computer without internet and nobody spies on my books, I'm ready to abandon paper diaries today."*)

---

## Prize Categories

* **Primary Category:** Hacktoberfest Open-Source AI Challenge Week 2: **"Side Hustle"**
* **Submission Type:** Individual Submission

---

*Built with ❤️ for Hacktoberfest 2026. Empowering local merchants with open-source AI.*
