---
title: Components
description: "Every @rivetjs/ui component shipped so far, by category, with its subpath and the cdk component it is built on."
template: guide
status: experimental
related: [start/introduction, start/differences]
---

Each component is its own subpath: `import { Button } from "@rivetjs/ui/button"`. Every one exports a `.Root` alias (except `Header`), named part exports (`CardHeader`, …), its prop types and its `tailwind-variants` definition (`buttonVariants`).

## Buttons

| Component                                   | Subpath                           | Built on              |
| ------------------------------------------- | --------------------------------- | --------------------- |
| [Button](button.md)                         | `@rivetjs/ui/button`              | cdk Button            |
| [ButtonGroup](button-group.md)              | `@rivetjs/ui/button-group`        | cdk Group             |
| [CloseButton](close-button.md)              | `@rivetjs/ui/close-button`        | cdk Button            |
| [ToggleButton](toggle-button.md)            | `@rivetjs/ui/toggle-button`       | cdk ToggleButton      |
| [ToggleButtonGroup](toggle-button-group.md) | `@rivetjs/ui/toggle-button-group` | cdk ToggleButtonGroup |

## Feedback

| Component                            | Subpath                       | Built on        |
| ------------------------------------ | ----------------------------- | --------------- |
| [Alert](alert.md)                    | `@rivetjs/ui/alert`           | markup          |
| [Meter](meter.md)                    | `@rivetjs/ui/meter`           | cdk Meter       |
| [ProgressBar](progress-bar.md)       | `@rivetjs/ui/progress-bar`    | cdk ProgressBar |
| [ProgressCircle](progress-circle.md) | `@rivetjs/ui/progress-circle` | cdk ProgressBar |
| [Skeleton](skeleton.md)              | `@rivetjs/ui/skeleton`        | markup          |
| [Spinner](spinner.md)                | `@rivetjs/ui/spinner`         | markup          |

## Data display

| Component                      | Subpath                    | Built on          |
| ------------------------------ | -------------------------- | ----------------- |
| [Avatar](avatar.md)            | `@rivetjs/ui/avatar`       | Radix avatar port |
| [AvatarGroup](avatar-group.md) | `@rivetjs/ui/avatar-group` | markup            |
| [Badge](badge.md)              | `@rivetjs/ui/badge`        | markup            |
| [Chip](chip.md)                | `@rivetjs/ui/chip`         | markup            |
| [Kbd](kbd.md)                  | `@rivetjs/ui/kbd`          | markup            |
| [EmptyState](empty-state.md)   | `@rivetjs/ui/empty-state`  | markup            |

## Forms

| Component                        | Subpath                     | Built on       |
| -------------------------------- | --------------------------- | -------------- |
| [Label](label.md)                | `@rivetjs/ui/label`         | cdk Label      |
| [Description](description.md)    | `@rivetjs/ui/description`   | cdk Text       |
| [ErrorMessage](error-message.md) | `@rivetjs/ui/error-message` | cdk Text       |
| [FieldError](field-error.md)     | `@rivetjs/ui/field-error`   | cdk FieldError |
| [Header](header.md)              | `@rivetjs/ui/header`        | cdk Header     |

## Layout and text

| Component                   | Subpath                  | Built on      |
| --------------------------- | ------------------------ | ------------- |
| [Card](card.md)             | `@rivetjs/ui/card`       | markup        |
| [Separator](separator.md)   | `@rivetjs/ui/separator`  | cdk Separator |
| [Surface](surface.md)       | `@rivetjs/ui/surface`    | markup        |
| [Link](link.md)             | `@rivetjs/ui/link`       | cdk Link      |
| [Typography](typography.md) | `@rivetjs/ui/typography` | cdk Text      |

"Markup" components render plain elements and ship no JavaScript of their own.
