---
title: FileTrigger
description: FileTrigger from @rivetjs/cdk opens the native file picker from any pressable child (Button, Link, Pressable) and reports the selected files.
template: guide
status: experimental
related: [components/button, components/link, foundations/interactions]
---

`FileTrigger` lets a [Button](button.md), [Link](link.md) or any pressable element open the native file picker. It renders a hidden `<input type="file">` next to its child; pressing the child clicks the input, and `onSelect` receives the chosen `FileList`.

::example{id=file-trigger-basic}

## Anatomy

```html
<button type="button" class="rv-Button">Select a file</button>
<input type="file" style="display:none" accept="image/png" multiple>
```

FileTrigger renders no wrapper element: only its child and the hidden input.

## Import

```ts
import { FileTrigger } from "@rivetjs/cdk/file-trigger";
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | one pressable element | none | `Button`, `Link`, or `<Pressable>` around your own element. |
| `acceptedFileTypes` | `string[]` | none | MIME types / extensions → `accept`. |
| `allowsMultiple` | `boolean` | `false` | → `multiple`. |
| `defaultCamera` | `"user" \| "environment"` | none | → `capture` (mobile camera). |
| `acceptDirectory` | `boolean` | `false` | → `webkitdirectory` (pick a folder). |
| `ref` | `ref()` / callback | none | The hidden `<input>`. |
| global DOM props | `GlobalDOMAttributes` | none | Forwarded to the `<input>` (`data-*` too). |

### Events

| Event | Fires |
| --- | --- |
| `onSelect(files: FileList \| null)` | The user picked files (input `change`). Picking the same file twice fires again. |

## Options

::example{id=file-trigger-options}

## Custom triggers

Any child that consumes press events works: a `Link`, or your own element inside `<Pressable>` (`@rivetjs/cdk/interactions/pressable`) with a render-function child spreading the press props.

::example{id=file-trigger-pressable}

## Accessibility

- The visible child is the control; the input is `display:none` and out of the accessibility tree.
- Name the child for what it does ("Upload a photo"); a non-button child needs `role="button"` and `tabIndex`.

## Resumability

- Server-rendered markup is final; the press handler resumes on the first press of the child.
- `onSelect` must be an inline arrow or local function.

## Upstream

| Rivet | Upstream |
| --- | --- |
| `FileTrigger` | RAC `FileTrigger` |

Deviations: `ref` points at the input (as upstream); the child is wired through `PressResponder` like RAC.

## Not yet supported

- `DropZone` (drag-and-drop file target) — separate component.
