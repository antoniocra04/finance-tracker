# FX charts and history verification, 25 October 2026

## Delivered behavior

- Analytics shows a separate chart for every currently held foreign currency against the reporting currency, with a quote per one unit, publication date, selected-window percentage and contribution over the aggregate FX observation period.
- Quote-window controls are independent of the capital chart and aggregate observation period. The contribution dates are explicit. Missing initial/current quotes stay unavailable rather than becoming zero; chart lines break at missing snapshots.
- Quote data is also available as an expandable table. Public exchange rates remain visible under privacy mode; private contributions, including their signs, are masked.
- History entries have edit/delete actions. Editing prefills the original amount, effective date and note, preserves identity/creation time, and recalculates history and export. Same-date corrections retain insertion-id priority.
- Deletion requires an irreversible-action confirmation and initially focuses Cancel. The sole entry of an account cannot be deleted, enforced by the store as well as the interface. Archived history remains editable up to its archive date without unarchiving the account.

## Automated checks

22 tests pass, including real SQLite and authenticated HTTP mutation tests. New cases cover opposite-sign currency contributions, cross-base quotes, unavailable initial rates, past-only baselines, currency precision, archived edits, deletion of corrections, sole-entry rollback, auth/origin rejection, sparse windows, missing observations, flat/tiny values and real calendar spacing.

The new store contracts and API routes were tested failing before implementation. A fresh read-only review identified two sparse-data defects: overlapping date-axis labels and a single-quote message using the date of a later snapshot that omitted that currency. Both received failing regression tests, then fixes and a passing full suite.

`npm run check` includes the new browser module; syntax and Git whitespace checks pass. The API tests need permission to bind temporary loopback ports; they pass with that permission. No network access is needed by the test suite.

## Real browser checks

All browser work used isolated local fixtures with fictional accounts and in-memory databases. Owner databases and the Raspberry Pi were not accessed or modified.

- Analytics and History at 320, 390, 581, 768, 1024 and 1280px: 12 combinations with no horizontal overflow or invalid SVG coordinates.
- Inspected desktop and mobile charts, mobile history, edit validation and deletion confirmation. Mobile history actions measure 44×44px.
- Saved an edit to fictional entry 10: amount/date/note updated, confirmation appeared, focus returned to the same entry's edit action, and the aggregate capital changed accordingly.
- Invalid precision leaves the dialog open and shows the server error above the pinned footer at 320×740px. The error and footer remain within the viewport.
- Opened deletion confirmation and cancelled it; did not perform an irreversible browser deletion. Real deletion/recalculation and safeguards were tested through isolated HTTP/store tests.
- Changed the test reporting currency RUB → KZT → RUB; pairs recalculated and excluded the reporting currency itself.
- Changed the quote period and verified contributions remained unchanged; keyboard focus stayed on the selected period.
- Verified privacy mode masks contributions without revealing their signs while preserving public quotes.
- Expanded the 90-observation table without overflow. Browser warning/error log was empty.
- Separate sparse fixtures verified calendar-spaced labels and the correct October 20 publication date when the October 22 snapshot omitted JPY.

Screenshots: `docs/screenshots/fx-history/`. Viewports were emulated; physical devices and the remote Raspberry Pi deployment were not directly tested.
