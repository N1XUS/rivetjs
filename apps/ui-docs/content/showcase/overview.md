---
title: Showcase
description: "Whole screens built from @rivetjs/ui: a storefront, a dashboard, mail, chat, a kanban board, settings, sign-in, pricing and a music player."
template: guide
status: experimental
related: [components/overview, start/introduction]
---

Each showcase is a complete, interactive screen made only from `@rivetjs/ui` components, `@rivetjs/kit` icons and a few Tailwind classes. Every one renders on the server, resumes without re-rendering, works at phone width and follows the light and dark theme. Open the code tab to copy a screen into your app.

:::note
Rivet-authored screens with invented content (shops, people, numbers). Product photos in the storefront are AI-generated sample images.
:::

## Commerce

- [Storefront](/showcase/storefront/): product grid with filters and sorting, a product page with gallery, sizes and reviews, a cart drawer, a bag pill that morphs into the order summary, and checkout (in the browser, and on the server with the live forms API).
- [Pricing](/showcase/pricing/): monthly / yearly billing, a seat stepper that updates every plan's total, a comparison table and an FAQ accordion.

## Analytics

- [Dashboard](/showcase/dashboard/): KPIs with sparklines and trend chips, a revenue area chart against the previous period, a channel donut, and an orders grid with status filter, search and sorting.

## Communication

- [Mail](/showcase/mail/): folders, a searchable message list with an unread filter, a reading pane with star / archive / trash, and a compose dialog with validation.
- [AI chat](/showcase/chat/): an assistant thread with history, copy and feedback actions, suggestions, a pending state and a composer that sends on Enter.

## Productivity

- [Kanban](/showcase/kanban/): task cards sorted and moved between connected drop lists (Angular CDK drag-drop), move buttons for keyboard users, per-column add forms and a done progress bar.

## Media

- [Music](/showcase/music/): a library sidebar, a scrolling album row, a track list with likes and a player bar with play / pause, skip, shuffle, repeat, seek and volume.

## Account

- [Settings](/showcase/settings/): profile form with validation, notification switches, theme cards, two-step sign-in and a destructive confirmation, in tabs.
- [Sign in](/showcase/auth/): sign in and sign up with a password strength meter, a reset-link flow and a one-time code step.
