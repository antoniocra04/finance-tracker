# Currency Charts and History Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Explain FX effects with per-currency charts and support deliberate history corrections.

**Architecture:** Extend the existing dashboard response with per-currency initial/current quotes, contributions and compact historical quote series. Keep chart-window calculations in a pure browser module. Add authenticated balance-row mutations and reuse native dialogs for history actions.

**Tech Stack:** Node.js 24, built-in SQLite and node:test, vanilla JavaScript, CSS, native SVG.

**Spec:** `docs/superpowers/specs/2026-10-25-fx-history-design.md`

## Global Constraints

- No new runtime dependency, database migration, provider change, fabricated history or marketing copy.
- Preserve auth, origin checks, currency precision, account identity and reporting-period semantics.
- Keep at least one balance per account; confirm deletion; retain id and creation time on edit.
- Single inset focus and at least 44px mobile action targets.

## Review Focus

- Missing initial quotes must not create a fictional full-period percentage or zero FX impact.
- Changing reporting currency recalculates every pair and omits that currency's own chart.
- Same-date corrections, deletion of the latest row and editing archived history retain established priority rules.
- Sparse or constant quotes and tiny values never produce invalid SVG coordinates.
- Mutations recalculate history/export and cannot be performed unauthenticated or cross-origin.

### Task 1: Data and mutation contracts

**Files:** `server/store.mjs`, `server/app.mjs`, `tests/store.test.mjs`, `tests/api.test.mjs`.

**Interfaces:** Dashboard currencies add `rate`, `initialRate`, `fx`. Dashboard adds `fxHistory: [{currency, points: [{date, rate, rateDate}]}]` for used non-base currencies. Store adds `updateBalance(id, input)` and `deleteBalance(id)`. HTTP adds PATCH/DELETE `/api/balances/:id`.

- [x] Write and run failing tests for opposite-sign FX contributions, cross-base quotes, sparse/missing history, editing with ISO precision and archived dates, deletion rollback and sole-entry protection.
- [x] Implement Store data/mutations and authenticated HTTP routes.
- [x] Run store and HTTP tests, then the complete suite; expect all pass.

### Task 2: Analytics and history UI

**Files:** `public/fx.mjs`, `public/app.js`, `public/styles.css`, `server/app.mjs`, `tests/fx.test.mjs`, `README.md`, `DESIGN.md`.

**Interfaces:** Pure `rateWindow(points, days, endDate)` returns bounded points and percentage change; `rateGeometry(points)` returns SVG path, ticks, labels and endpoint geometry. The static asset allowlist serves `/fx.mjs`.

- [x] Write and run failing pure-function tests for carried baselines, missing-start percentages, discontinuous lines, flat/single/tiny rates and real calendar spacing.
- [x] Implement helpers and stacked divider-separated currency charts with a shared quote-window selector and separately dated contribution labels.
- [x] Add history row actions, edit dialog and irreversible-delete confirmation; preserve field precision, form associations, feedback and focus.
- [x] Verify analytics and history in an isolated browser fixture at 320, 390, 581, 768, 1024 and 1280px; inspect screenshots and exercise mutations without touching owner data.
- [x] Update operational/design docs; run complete tests, syntax and whitespace checks. Obtain a fresh read-only review. Do not commit or push without a request for this change.
