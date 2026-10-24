# Свод

## Register

product

## Platform

web

## Users

One owner, self-hosting on Raspberry Pi, opening the app occasionally to record meaningful changes in account balances.

The owner explicitly wants a private utility, with no promotional welcome page or public registration. First run configures the sole owner's password; subsequent visits show only password login. No usernames, signup, or additional users.

## Product Purpose

Keep account balances in their original currencies and show total wealth, its history, and currency exposure. Rates refresh daily independently of manual balance updates.

## Positioning

All your money, one clear picture.

## Brand Personality

Light, precise, modern. Russian interface. Working name chosen by implementer: Свод.

## Design Principles

- Recording a new balance should take seconds.
- Distinguish balance changes from exchange-rate effects.
- Preserve history and original currency amounts.
- Always disclose missing or outdated rates.
- No slogans, version badges, personal-space labels, decorative avatars, or redundant explanatory copy. Keep dates, actionable labels, and operational warnings.

## Accessibility & Inclusion

Implementation defaults: keyboard navigation, visible focus, semantic controls, readable contrast, reduced motion, responsive mobile layout.

## Implementation Choices

User requested worldwide currency selection, initially USD, RUB, KZT. Default reporting currency is RUB, changeable in settings. No bank credentials or bank integrations. One owner password. Node.js 24 and SQLite, no runtime package dependencies, Docker for ARM64 Raspberry Pi.

## Anti-references

Implementer choices: avoid decorative gradients, trading-terminal density, heavy shadows, and misleading fabricated history.
