# Visual system

## Scene

The owner checks balances on a laptop at a daylight-lit kitchen table, then enters an updated amount on a phone. White surfaces keep numbers legible in both settings.

## Strategy

Restrained color. Pure white content, neutral gray shell, warm amber primary anchored at hue 91, dark ink, teal positive state. Currency visualization adds purposeful blue and violet.

## Tokens

Use OKLCH custom properties. Primary: oklch(0.88 0.15 91), ink: oklch(0.23 0.015 91), muted: oklch(0.49 0.012 91). White canvas and light achromatic sidebar. Amber buttons use dark text on pale fill.

## Typography

System sans, tabular numerals, fixed rem scale. Headers 28px, primary total 44px desktop / 32px mobile. No display fonts. No external font requests.

## Structure

Compact left sidebar, broad content canvas, clear account rows, capital chart and currency breakdown. Dividers separate data rather than nested cards. Radii 8–14px. Native dialogs for focused balance entry and account creation. Fixed bottom navigation on small screens.

Authentication is a single centered 360px column on white: small brand, task heading, necessary fields, one action. First run says «Настройка доступа» / «Сохранить пароль»; later visits say «Вход» / «Войти». No marketing panel, currency decorations, signup language, or account selection.

## States

Explicit empty, loading, stale rate, missing conversion, validation, saving and failure states. Motion only for interaction feedback, 160ms, disabled under reduced-motion preference.
