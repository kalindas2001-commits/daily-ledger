# Money Capture delivery status

## Available
- Authenticated `/capture` route, desktop navigation and mobile menu entry.
- Selected-message import and local TXT, CSV, XLSX, PDF and receipt-image reading.
- Explicit source consent; extracted records remain private review candidates.
- Paginated inbox with status filters, original evidence, import metadata and decision history.
- Editable payment details, compatible transaction matching, duplicate-review acknowledgement, and confirmed post/match/reject/defer decisions.
- Server-controlled atomic posting and cache refresh for ledger, accounts and dashboard summaries.

## Release checks
- Parser, PDF-reader and posting validation tests pass.
- Preview opens without runtime errors and requires sign-in for `/capture`.
- Real-account import, match, post, repeated-post protection and balance read-back remain unverified: session minting cannot match the requesting user's account. A signed-in preview is required.
- Verify signed-in layouts at desktop and phone widths before announcing fully verified delivery.

## Later stages (not available)
- Provider integrations, background SMS access, controlled automation and unfamiliar financial treatments are not included.
- Transfers, loans, withdrawals, invoices, failures and unmatched reversals stay review-only in this workflow.
- Scanned PDFs require receipt-image uploads; statement formats require supported structured columns or manual field review.