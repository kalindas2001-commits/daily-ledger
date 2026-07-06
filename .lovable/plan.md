
## Scope

Seven coordinated improvements delivered together.

---

### 1. Export module — download states + smart filenames
- Track per-export state: `idle | loading | success | failure` (per button).
- Show spinner in the button while working, toast on success ("Downloaded X"), toast on failure with the error message.
- Filenames include the active preset + range, e.g. `cungacash-transactions_last-7-days_2026-06-29_to_2026-07-06.pdf`. Custom range uses `custom_YYYY-MM-DD_to_YYYY-MM-DD`.
- Apply to every export button in `src/pages/ExportPage.tsx` (transactions, accounts, goals, budgets, recurring — PDF + Excel).

### 2. Confirmation dialogs
- Archive account → AlertDialog: "Archive {name}? It will be hidden from lists. Balance: {formatted}."
- Transfer submit → AlertDialog summarising source, destination, amount before running the two updates.
- Reversal (transaction) → AlertDialog before creating the reversing entry.
- Uses shadcn `AlertDialog` throughout.

### 3. Stronger form validation (Accounts)
- Introduce `zod` schemas in `src/pages/Accounts.tsx` for:
  - Create/Edit: `name` trim + 2–60 chars, `account_number` optional ≤32, `current_balance` numeric ≥ 0, `kind` enum, `color` optional hex.
  - Deposit/Withdraw: amount > 0, ≤ 1e12; withdraw amount ≤ current_balance (helpful message: "Insufficient balance. Available: X").
  - Transfer: same-account rejected, positive amount, ≤ source balance, source ≠ destination.
- Errors surface inline (red text under field) + on submit.

### 4. Branding polish
- Payment/account-kind logos: Add colored SVG-ish glyphs (Lucide + a small inline SVG set) for CASH, BANK, MOBILE_MONEY (MTN/Airtel style badges), CREDIT_CARD, DEBIT_CARD, SAVINGS, INVESTMENT, CRYPTO, DIGITAL — shown on Account cards and in the Add Transaction account picker.
- Language switcher (`src/components/LanguageSwitcher.tsx`): show flag emoji on desktop too (currently `hidden sm:inline` — will always display). Keep dropdown as-is.

### 5. Dashboard revamp (`src/pages/Dashboard.tsx`)
Professional, user-friendly layout — no data-model change, just presentation:
```text
+---------------------------------------------------------------+
| Greeting + period selector (This month ▾)   Quick actions     |
+-----------+-----------+-----------+---------------------------+
| Net worth | Income    | Expenses  | Savings rate              |
+-----------+-----------+-----------+---------------------------+
| Cashflow chart (bar)          | Accounts snapshot (top 4)     |
+-------------------------------+-------------------------------+
| Top categories (donut)        | Goals progress (list, bars)   |
+-------------------------------+-------------------------------+
| Recent transactions (10)      | Alerts / insights             |
+---------------------------------------------------------------+
```
Reuses existing hooks (`useTransactions`, `useAccounts`, `useGoals`, `useAlerts`). Uses Recharts (already present via ui/chart).

### 6. Sidebar — Assistance section + icon
- In `AppLayout.tsx`, split `moreNavCfg` so Assist is not in "Manage".
- Render a new labelled group "Assistance" containing only CungaCash Assist as the last group in the sidebar.
- Swap the icon from `Sparkles` to `LifeBuoy` (or `Headset`) — a professional support-desk feel.

### 7. Team oversight + transaction edit-approval workflow
This is the largest piece.

**Database (migration):**
- New table `transaction_edit_requests`:
  - `transaction_id`, `user_id`, `tenant_id`, `requested_changes` (jsonb), `reason` (text), `status` (`pending|approved|rejected`), `admin_notes`, `reviewed_by`, `reviewed_at`, timestamps.
  - GRANTs, RLS: user can insert/select own; admins can select/update within their tenant; super_admin all.
- `transactions` RLS UPDATE policy tightened: **user can no longer UPDATE their own transactions directly** (only via approved edit request applied by a security-definer function). INSERT + SELECT + DELETE remain (DELETE also requires no pending request, optional — keeping DELETE simple for now).
- Function `apply_transaction_edit_request(request_id)` (security definer): only tenant admin or super_admin can call; on approve, applies jsonb patch to the transaction and marks request `approved` with `reviewed_by`, `reviewed_at`.
- RPC `admin_list_tenant_transactions(_user_id uuid?)`: returns transactions for the admin's tenant, optionally filtered by user; joins profiles for display name.

**UI:**
- `src/components/TransactionDetailDialog.tsx` (and edit inline in `TransactionsList.tsx` if any): replace direct save with "Request edit" dialog — user enters proposed changes + reason → row goes to `transaction_edit_requests`. Show current pending request badge on the transaction.
- `src/components/admin/TeamMembers.tsx`: augment with a per-member "View transactions" action opening a drawer/dialog listing that user's transactions (read-only, with filters: date range, type, category).
- New tab in Team page: **Overview** (aggregate: total tx count per member, income/expense totals, active goals) + **Members** (existing) + **Edit requests** (pending queue: transaction snapshot, requested changes diff, reason, Approve/Reject with admin notes).
- Approve → calls `apply_transaction_edit_request`; Reject → updates status + admin_notes.
- Realtime subscription on `transaction_edit_requests` so admins see new requests instantly (toast + badge count).

**i18n:** add English keys for all new labels; French/Kinyarwanda fall back to English (can be translated later).

---

## Technical notes

- No new packages needed (zod, recharts, radix alert-dialog, sonner already in project).
- All migrations follow: CREATE TABLE → GRANT → ENABLE RLS → POLICY.
- Every new public table gets `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated; GRANT ALL ... TO service_role;`.
- Tightening `transactions` UPDATE policy will break any current inline edit; those code paths are switched to the request flow in the same batch.
- Roles use existing `has_role(auth.uid(),'admin'|'super_admin')`.

## Delivery order in the batch
1. Migration (new table + tightened transactions UPDATE + RPC/function).
2. Sidebar + LanguageSwitcher + payment-kind glyphs (small, isolated).
3. Export states + filenames.
4. Confirmation dialogs + account validation.
5. Dashboard revamp.
6. Transaction edit-request UI (user side) + Team oversight tabs (admin side).
7. i18n keys.

Reply "approve" to build, or tell me what to trim/adjust.
