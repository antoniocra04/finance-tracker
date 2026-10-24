# Interface cleanup, 24 October 2026

Follow-up to the interface review. The owner requested removal of meaningless copy, consistent icons, and a single focus frame for fields.

## Changes

- Removed personal-space labels, owner avatar, version badge, breadcrumbs, slogan, global attribution footer, and redundant introductory copy.
- Kept operational information: rate freshness, missing conversions, balance-entry guidance, correction history, password/session consequences, and unencrypted export warnings.
- Moved provider attribution into the expandable rate date. The free provider requires an attribution link: https://www.exchangerate-api.com/docs/free.
- Replaced custom interface icons with pinned Lucide SVG paths. Normalized stroke width, caps, joins, icon layout, chevrons, edit actions, and the privacy toggle's visible/hidden states. License notices accompany the vendored icons.
- Focused inputs and selects use their existing border plus an inset stroke: one contiguous 2px frame inside the control, without a second external outline or size change. Links and buttons retain keyboard focus; forced-colors mode uses a system-color inset outline.
- Reduced the top bar height and removed orphaned CSS. Login retains only the brand, heading, password field, error, and action.
- A fresh-eyes review found a settings attribution popup extending to 624px in a 581px viewport. Reproduced in-browser, constrained it to its column, then verified the page and popup end at or before the viewport edge.

## Verification

Used an isolated local server with fictional accounts and an in-memory database. The owner's local database and Raspberry Pi were not modified.

- Five sections at 320, 390, 581, 768, 1024, and 1280px: 30 combinations, no horizontal page overflow, no unnamed visible buttons, and none of the removed labels in rendered text.
- Expanded settings rate details at all six widths without overflow. Expanded the header details at 320px; verified Escape and outside-click dismissal.
- Inspected desktop overview, mobile overview, mobile select focus, narrow-tablet settings, and login screenshots.
- Keyboard focus on text, amount, date, and select fields has no external outline, a 1px border plus a 1px inset stroke, and unchanged 44px control height.
- Checked mobile modal scrolling and pinned actions. Checked logout, invalid-password feedback, and subsequent successful login. Browser warning/error log was empty.
- `npm test`: 10 passed. HTTP tests require permission to bind temporary localhost ports; an initial sandbox-only run failed with EPERM, then the permitted run passed.
- `npm run check` and `git diff --check`: passed.

Screenshots: `docs/screenshots/ui-cleanup/`. Phone/tablet testing used browser viewport emulation; physical devices and the Raspberry Pi deployment were not tested directly.
