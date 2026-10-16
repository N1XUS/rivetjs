---
title: UI overview
description: The layers of Rivet UI packages, the document kit, the low-level CDK and the accessible components, and the rules they share.
template: guide
status: experimental
related: [ui/kit, ui/heroui-port]
---

Rivet UI is a set of separate packages. Each one builds on the one below it, and you install only what you use. All three layers are experimental.

## The layers

| Layer | Package | Status | What it gives you |
| --- | --- | --- | --- |
| Document kit | `@rivetjs/kit` | Experimental | Head tags, SEO, scripts, fonts and image preloads for the page itself. See [Kit](kit.md). |
| Mechanisms | `@rivetjs/cdk` | Experimental | Building blocks without markup opinions: focus handling, overlays, keyboard navigation in lists, selection, unique ids, announcements. See the [cdk docs](site:cdk/foundations/overview/). |
| Accessible components | `@rivetjs/cdk` | Experimental | Unstyled components that follow the WAI-ARIA patterns: buttons, form fields, dialogs, popovers, menus, tabs, list boxes, combo boxes. See the [cdk docs](site:cdk/components/overview/). |

Shared rules from the designs:

- Use native HTML first (`<button>`, `<details>`, real form fields), so many parts work before any JavaScript loads. Overlays (dialogs, popovers, menus) render in one div overlay layer while open, not the native top layer.
- Resumed pages load no component code until the visitor interacts.
- Unstyled by default. You style with plain CSS, [scoped styles](../guides/styling/scoped-styles.md) or Tailwind.
- Parts you do not import cost nothing.

All three are experimental: the API may change.

## Where to start

- Try the styled [HeroUI port (preview)](heroui-port.md): `Card`, `Button`, `Link`, `Chip`, `Badge`, `Alert`, `Avatar`, `Typography` and more; each has a page under UI > Components, and the full reference with live examples is the [@rivetjs/ui docs site](site:ui/).
- Theme it: `@import "@rivetjs/ui/styles"` ships the Rivet brand theme (accent from the logo blue, AA contrast in light and dark); the upstream default look is a preset (`CLASSIC_PRESET`). Build your own from one OKLCH accent with the [theme builder](site:ui/themes/) or `deriveTheme()` from `@rivetjs/ui/theme`.
- Set the title, meta tags, scripts and fonts with the [kit](kit.md), or with the route `head` export: [head and SEO](../guides/routing/head-and-seo.md).
- Add accessible widgets with [@rivetjs/cdk](site:cdk/components/overview/): every component, its options and live examples live on the separate cdk docs site.
- Build your own widgets from the [CDK foundations](site:cdk/foundations/overview/).
- Style them with [CSS and Tailwind](../guides/styling/css-and-tailwind.md) or [scoped styles](../guides/styling/scoped-styles.md).
