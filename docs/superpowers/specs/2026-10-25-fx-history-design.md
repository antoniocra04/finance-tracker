# Currency charts and editable history

## Intent

Explain the aggregate exchange-rate effect through individual currencies, and let the owner correct or delete recorded balance changes.

## Approved direction

Separate charts in Analytics for each currently used foreign currency against the reporting currency. Show the latest quote, percentage change over the selected chart window, and each currency's contribution over the same observation period as the aggregate FX effect. Reuse locally collected rates; do not invent or fetch pre-installation history. Shared chart windows: 30, 90, 180, 365 days.

Separate charts were chosen over a combined percentage chart because they expose actual quotes and are easier to interpret. Existing aggregate capital calculations retain their observation period. Label contribution dates separately from the selected quote window.

The owner additionally requested editing and deleting history entries. Edit amount, effective date and note in a native dialog; currency and account remain fixed. Deletion requires a confirmation explaining recalculation and irreversibility.

## Implementation decisions

- Preserve the established current-balance-at-initial-rates decomposition. Per-currency contributions must sum to the aggregate effect whenever it is available.
- Missing quotes remain null, break chart lines, and cannot yield a percentage change from an unknown start. Carry forward the last available quote without using future data; expose its publication date.
- Main-currency-only accounts need no FX chart. Sparse, flat, single-quote and missing-rate states must remain legible.
- Edit history rows in place, retaining their id and creation timestamp. For same-date corrections, the highest id remains authoritative.
- Keep at least one balance per account. Reject deletion of its sole entry and offer editing instead; otherwise the account would silently disappear from the existing dashboard.
- Permit historical edits for archived accounts up to their archive date. Never unarchive an account through a history change.
- Existing authentication, origin validation and ISO precision checks apply to mutations. No database migration, new runtime dependency or provider change.
- Match the current minimal UI, Lucide icons, single inset field focus, 44px mobile targets and pinned dialog actions.

## Non-goals

Historical-market-data subscriptions, financial recommendations, transactions, audit-log versioning, account currency changes, new dashboard periods, and deployment to the Raspberry Pi.
