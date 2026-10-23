---
title: Licenses
description: "License of @rivetjs/ui and the third-party code it and @rivetjs/cdk build on: HeroUI, React Spectrum, Angular CDK, Radix UI, Embla Carousel and others."
template: guide
status: experimental
related: [start/introduction]
---

## @rivetjs/ui

`@rivetjs/ui` is licensed under the Apache License 2.0 (`libs/ui/package.json`). Copyright Rivet contributors. `@rivetjs/cdk` and the Rivet repository as a whole are MIT-licensed.

### HeroUI

`@rivetjs/ui` includes modified code from [HeroUI](https://github.com/heroui-inc/heroui) v3.2.6, Copyright 2025 NextUI Inc., Apache License 2.0:

- the stylesheet (`styles/`) and the component designs and sources (`src/`), modified; each file header marks the change;
- the theme derivation and presets of `@rivetjs/ui/theme` (`src/theme/derive.ts`, `src/theme/presets.ts`), ported from the HeroUI docs theme builder.

HeroUI is a trademark of its owner. Rivet UI is not affiliated with or endorsed by the HeroUI project.

### Scheduler

The Scheduler feature set and its seven showcase sections are inspired by the public HeroUI Pro Agenda documentation. The Rivet implementation and examples are independent; no HeroUI Pro source is included. Scheduler behavior is ported from the Rivet author's own MIT-licensed `@malva-ui/scheduler`, copyright 2026 Malva UI; its source notice and license text are included in `@rivetjs/cdk/NOTICE`.

### Other notices in @rivetjs/ui

| Project                                                                                          | License    | Copyright               | Use                                                                     |
| ------------------------------------------------------------------------------------------------ | ---------- | ----------------------- | ----------------------------------------------------------------------- |
| [react-aria-components](https://github.com/adobe/react-spectrum)                                 | Apache-2.0 | Adobe                   | `src/utils/dom.tsx`, modified port                                      |
| [@radix-ui/react-avatar](https://github.com/radix-ui/primitives) 1.2.6                           | MIT        | (c) 2022 WorkOS         | Avatar loading-status logic, ported (`src/vendor/radix-avatar/`)        |
| [input-otp](https://github.com/guilhermerodz/input-otp) 1.5.0                                    | MIT        | (c) 2024 Guilherme Rodz | One-time-password input, ported (`src/vendor/input-otp/`)               |
| [shadcn/ui](https://github.com/shadcn-ui/ui) (shadcn@4.21.4)                                     | MIT        | (c) 2023 shadcn         | Sidebar layout classes (`styles/components/sidebar.css`)                |
| [yet-another-react-lightbox](https://github.com/igordanchenko/yet-another-react-lightbox) 3.32.2 | MIT        | (c) 2022 Igor Danchenko | `@rivetjs/ui/lightbox` wraps the cdk port; stylesheet is Rivet-authored |
| [tailwind-variants](https://github.com/heroui-inc/tailwind-variants) 3.3.1                       | MIT        | see package             | Runtime dependency, not vendored                                        |
| [tw-animate-css](https://github.com/Wombosvideo/tw-animate-css) 1.4.0                            | MIT        | see package             | Runtime dependency, not vendored                                        |

## @rivetjs/cdk

`@rivetjs/cdk` (MIT, Copyright Rivet contributors) contains code ported from these projects; each ported file names its source in a header comment.

| Project                                                                                                                                                                   | License    | Copyright               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------- |
| [React Spectrum](https://github.com/adobe/react-spectrum) (react-aria, react-stately, `@react-aria/*`, `@react-stately/*`, `@react-types/shared`, `@internationalized/*`) | Apache-2.0 | 2020 Adobe              |
| [Angular Components](https://github.com/angular/components) (`@angular/cdk`)                                                                                              | MIT        | (c) Google LLC          |
| [shadcn/ui](https://github.com/shadcn-ui/ui) (shadcn@4.21.4)                                                                                                              | MIT        | (c) 2023 shadcn         |
| [Radix UI Primitives](https://github.com/radix-ui/primitives) (react-scroll-area 1.3.0, react-presence 1.1.11, number 1.1.3, react-direction 1.1.5)                       | MIT        | (c) 2022 WorkOS         |
| [embla-carousel](https://github.com/davidjerleke/embla-carousel) 8.6.0 and its autoplay, auto-scroll, class-names, fade and auto-height plugins                           | MIT        | (c) David Jerleke       |
| [yet-another-react-lightbox](https://github.com/igordanchenko/yet-another-react-lightbox) 3.32.2                                                                          | MIT        | (c) 2022 Igor Danchenko |
| [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels) 4.14.3                                                                                        | MIT        | (c) 2018 Brian Vaughn   |
| [flickr/justified-layout](https://github.com/flickr/justified-layout) 4.1.0                                                                                               | MIT        | 2019 SmugMug, Inc.      |

## Full texts

The complete license texts and attribution notices ship in the `NOTICE` file of each package (`libs/ui/NOTICE`, `libs/cdk/NOTICE` in the repository).
