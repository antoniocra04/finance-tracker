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

## Controls and responsive details

Shared inputs and selects are 44px high with 8px corners. Native selects reserve 40px at the trailing edge for a consistent chevron; mobile control text is 16px. Toolbar controls have no top margin, and search icons align to the input's center. Compact desktop row actions are 36px; mobile targets are at least 44px.

Dialogs keep their heading and action footer visible while the body scrolls. Footer submit buttons stay associated with their form. Busy labels preserve button dimensions; validation messages scroll into view with 16px clearance. On phones, currency and account type occupy separate full-width rows.

Mobile account rows show the full name, then the balance and conversion underneath, with actions beside them. Search and sorting stack below 380px. The journal stacks amounts below the entry instead of squeezing three columns. Icon-only tablet navigation retains accessible names. Settings always provide logout, including when the sidebar footer is hidden.
