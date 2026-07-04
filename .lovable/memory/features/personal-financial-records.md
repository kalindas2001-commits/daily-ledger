---
name: Personal Financial Records
description: Extended transaction model turning each entry into a full Personal Financial Record with accounts, goals, attachments, mood/life event, and one-click report
type: feature
---

## Phase 1 (shipped)
- `transactions` extended with: status, currency, exchange_rate, original_amount, transaction_fee, discount, tax_amount, final_amount, account_id, subcategory, merchant_name, merchant_phone, merchant_location, country, city, district, place_type, purpose, income_source, mood, life_event, tags[], notes
- New tables: `accounts`, `transaction_attachments`, `financial_goals`, `goal_contributions`, `spending_challenges`, `achievement_badges` — all per-user with RLS + updated_at trigger
- Private storage bucket `transaction-attachments` with per-user folder RLS (`{user_id}/{tx_id}/...`), signed URLs via `getSignedUrl`
- Trigger `apply_goal_contribution` keeps `financial_goals.current_amount` in sync
- Pages: `/accounts` (Accounts.tsx), `/goals` (Goals.tsx)
- `AddTransaction` has advanced collapsible: merchant, place, city, purpose, income source, mood, life event, tags, notes, fee/discount/tax
- `TransactionDetailDialog` renders hero card, breakdown, tags, journal, attachments (upload/download signed), timeline, and one-click printable report
- Nav updated (Accounts + Goals). i18n keys use fallback so untranslated labels work.

## Remaining phases
- Phase 2: budget links per transaction (auto %-used), recurring polish, transfers between accounts
- Phase 3: AI insights per transaction + monthly financial story via Lovable AI (google/gemini-3-flash-preview) — edge function
- Phase 4: mood analytics, badges auto-award, challenges, personal document vault
