# Architecture rules
- Keep Team member detail pages under the authenticated Team routes and load member information through tenant-scoped admin APIs, so links cannot expose another tenant's profile.
- Money Capture uses owner-only evidence and server-controlled import/decision RPCs with row locks and unique posting links; browser extraction produces untrusted candidates, never direct ledger writes.
- Capture adapters and document readers are isolated under src/lib/capture; versioned deterministic parsing works without AI credits and unfamiliar financial treatments remain review-only.