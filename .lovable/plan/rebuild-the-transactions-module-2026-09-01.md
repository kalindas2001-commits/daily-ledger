# Rebuild the Transactions module

## Goal
Restore a consistently visible, professional Transactions page for users and tenant admins without changing transaction business rules.

## Implementation
- Rebuild the page structure with a clear summary strip, responsive filters, and high-contrast transaction rows.
- Keep personal and team scopes for admins, with member identity visible in team mode.
- Use safe formatting for legacy dates, times, amounts, and optional transaction fields so one malformed record cannot blank the page.
- Keep loading, empty, query-error, detail, edit, delete, and incremental “show more” states functional.
- Use existing semantic design tokens and components so the page remains readable in light and dark themes.

## Verification
- Confirm the frontend builds without errors.
- Exercise the authenticated Transactions route when a preview session is available; otherwise verify the component and data path statically against the live database schema.
