# Money Capture delivery status

## Available
- Android carrier-inbox permission request, one-minute checks while Money Capture is visible, resume/online reconciliation and per-message checkpoints. Failed uploads are retried without advancing past the unsaved payment.
- Android SMS_RECEIVED receiver captures financial delivery evidence in app-private, owner-scoped storage without a running WebView. Requires READ_SMS and RECEIVE_SMS permission and device/distribution eligibility. Stop/revocation/sign-out clears queued evidence.
- Destination accounts are ledger destinations, not SMS sources. All financial interpretation remains pending explicit review.
- Authenticated `/capture` route, desktop navigation and mobile menu entry.
- Selected-message import and local TXT, CSV, XLSX, PDF and receipt-image reading.
- Receipt camera selection on supported devices, single-file drag-and-drop, and visible document/OCR progress.
- Scanned PDF pages are rendered locally for OCR within the existing 20-page limit; OCR output still requires review.
- Explicit source consent; extracted records remain private review candidates.
- Paginated inbox with status filters, original evidence, import metadata and decision history.
- Editable payment details, compatible transaction matching, duplicate-review acknowledgement, and confirmed post/match/reject/defer decisions.
- Server-controlled atomic posting and cache refresh for ledger, accounts and dashboard summaries.

## Release checks
- Parser, PDF-reader and posting validation tests pass.
- 33 capture tests pass; browser OCR reads a generated scanned payment PDF as 25,000 RWF without runtime errors.
- Preview opens without runtime errors and requires sign-in for `/capture`.
- Real-account import, match, post, repeated-post protection and balance read-back remain unverified: session minting cannot match the requesting user's account. A signed-in preview is required.
- Verify signed-in layouts at desktop and phone widths before announcing fully verified delivery.

## Later stages (not available)
- Background cloud uploads and controlled automatic ledger posting are not enabled. Native compilation, receiver delivery, app-killed behavior and physical-device permissions remain unverified: this environment has no Android SDK, Java or attached phone. Android may delay/suppress background delivery; Google Play SMS permission eligibility must be resolved before release.
- Provider integrations and unfamiliar financial treatments are not included.
- Transfers, loans, withdrawals, invoices, failures and unmatched reversals stay review-only in this workflow.
- Statement formats require supported structured columns or manual field review. Receipt cropping, line-item extraction and statement balance reconciliation remain staged work.