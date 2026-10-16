---
title: Introduction
description: "@rivetjs/ui is the styled component library for Rivet: compound components on accessible @rivetjs/cdk behaviour, Tailwind CSS v4, server-rendered, resumable."
template: guide
status: experimental
related: [start/installation, start/design-principles, start/differences]
---

`@rivetjs/ui` is the styled component library for Rivet. Behaviour (press, hover, focus, keyboard, ARIA) comes from [@rivetjs/cdk](site:cdk/), the headless, accessible layer; looks come from a [Tailwind CSS v4](https://tailwindcss.com/) stylesheet, `@rivetjs/ui/styles`. The stylesheet and the component set started from an Apache-2.0 upstream project; see [Licenses](/start/licenses/).

You write compound JSX (`<Card>`, `<Card.Header>`, `<Button variant="secondary">`). Each part renders a stable `data-slot` attribute and plain [BEM](https://getbem.com/) class strings, so the same classes style server HTML, client updates and hand-written markup alike.

## Why Rivet UI

- **Styled out of the box.** One stylesheet and one theme (Rivet); other looks are variable presets ([Themes](/start/themes/)).
- **Accessible.** Interaction and ARIA semantics live in the cdk, not in the styled layer. Each component page names the cdk component it wraps.
- **Composable.** Components are sets of parts (`Card.Header`, `Avatar.Fallback`). Rearrange, restyle or leave out the parts you need.
- **Typed, live props.** Props such as `isDisabled`, `onPress` and `variant` are typed; pass `variant={variant()}` and the classes update in place.
- **Server-rendered and resumable.** Pages arrive as HTML. Markup-only components (Card, Chip, Alert, Badge, Typography, …) ship no JavaScript; interactive ones resume on first interaction, with no hydration pass.
- **Pay for what you import.** Every component has its own subpath (`@rivetjs/ui/button`); a component you do not import adds nothing to the page.

## A package, not copy-paste

`@rivetjs/ui` is installed and updated as a dependency; you do not copy component sources into your app. The stylesheet lives in `libs/ui/styles` (local changes listed in `libs/ui/styles/TWEAKS.md`), and each component module imports its own compiled CSS.

The library is experimental and not on npm yet. [All components](/components/overview/) lists what ships today.

## Where it fits

- **[Rivet](site:docs/)**: the compiled, resumable JSX framework.
- **[@rivetjs/cdk](site:cdk/)**: headless components and utilities (collections, focus, overlays, date, drag and drop) underneath.
- **@rivetjs/ui**: this library, the styled layer on top of the cdk.

The cdk follows React Aria's conventions (`isDisabled`, `onPress`, `selectionMode`), so the component props here use the same names.

## FAQ

**Is it free?**
Yes. It is open source under the Apache License 2.0.

**Is it production-ready?**
No. `@rivetjs/ui` and Rivet are experimental; APIs may still change.

**Can I customize the components?**
Yes: Tailwind utilities through `class`, CSS variables, BEM modifiers, or a different composition of the parts. See [Styling](/start/styling/) and [Theming](/start/theming/).

**Does it work with TypeScript?**
Yes. Every component is typed, and the `::api` cards on each component page are generated from the source.

**What about accessibility?**
Keyboard navigation, focus management and screen reader support come from the cdk.

**Can I use the styles without Rivet?**
Yes. The stylesheet is plain CSS over class names and works on any HTML; see [Composition](/start/composition/).

## Get involved

- [Rivet repository](https://github.com/rivetjs/rivet): issues and contributions.
