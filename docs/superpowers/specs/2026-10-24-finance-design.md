# Свод application design

User authorizes planning followed by implementation in this session.

## Scope

Password-protected single-owner responsive web application on Raspberry Pi. Create accounts with bank, name, type and ISO currency; record dated balances, preserve edits in history, archive accounts. Dashboard shows current capital, currency allocation, balance age, historical capital, and change decomposition. Analytics and full balance journal, settings, password change, JSON/CSV export and consistent SQLite backup.

## Architecture and alternatives

Chosen by implementer: Node.js 24 built-in HTTP server and SQLite plus native browser JS/CSS. Small operational footprint, no frontend build, no runtime dependency installation. React + separate API adds build/dependency maintenance without helping this small personal app. Cloud hosting conflicts with requested Raspberry Pi deployment.

Amounts stored as integers in the currency's ISO minor unit (JPY 0, KWD 3, USD/RUB/KZT 2), validated against safe limits. FX rates stored as timestamped USD-based snapshots. Conversion is amount / sourceRate * targetRate. No fake initial rates. Supported currency catalog uses runtime ISO currency metadata plus provider currencies; currencies without rates can still hold balances but total is explicitly incomplete.

History uses latest balance on/before each date and last FX snapshot known by that date. History before first rate is unavailable for converted currencies, not backfilled with today's rate. Daily points use UTC dates and compare closing balances. Archived accounts remain in history until archive date. Balance corrections for same date replace that date's closing balance while audit entries preserve the change. Changes = balance effect at previous rates + rate effect on ending holdings. These are valuation changes, never claimed investment profit.

## Security and persistence

scrypt password hash with random salt; opaque random sessions stored hashed in SQLite; HttpOnly SameSite=Strict cookies; expiring sessions; login throttling; origin checks on mutations; body limits; parameterized SQL; CSP and no external scripts. First setup requires one-time server bootstrap token, never exposed by API. Password changes invalidate sessions. Docker volume stores DB; data is not encrypted at rest. HTTPS reverse proxy or private VPN recommended for remote access. No bank integration.

## Rates

ExchangeRate-API open endpoint supports broad world currencies including USD/RUB/KZT, updates daily. Cache response and respect next-update timestamp, poll scheduling hourly and retry outages with backoff. Background refresh runs even without browser. Show provider timestamp and stale warning after 48 hours. Attribution link required. Rates indicative, not bank execution prices.

## UI

Свод; Russian labels. Light whitespace-rich dashboard, amber action, minimal monochrome navigation. Account creation and balance entry via native accessible dialog. Dashboard, accounts, analytics, journal, settings. Empty state with direct creation action; mobile navigation; no fake production data.

## Verification

node:test covers integer amounts, cross rates, missing FX, snapshot dates, archive history, auth, setup race, unauthorized API requests, invalid inputs, origin rejection, sessions, exports, FX provider failures. Browser verify setup, add USD/RUB/KZT accounts, update balance, navigation, mobile overflow and keyboard dialogs. Docker config checked if Docker available.
