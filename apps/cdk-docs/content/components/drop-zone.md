---
title: DropZone
description: Accept native file, text and directory drops and clipboard paste with an accessible DropZone and a keyboard file-picker alternative.
template: guide
status: experimental
related: [components/file-trigger, components/drag-and-drop, foundations/chat]
---

`DropZone` accepts native file, text and directory drops and clipboard paste in an area you style.

## Import and example

```tsx check
import { signal } from "@rivetjs/reactivity";
import { DropZone } from "@rivetjs/cdk/drop-zone";
import { FileTrigger } from "@rivetjs/cdk/file-trigger";
import { Button } from "@rivetjs/cdk/button";
import { Text } from "@rivetjs/cdk/text";

export function Attachments() {
  const count = signal(0);
  return (
    <>
      <DropZone aria-label="Attachments" onDrop={(event) => count.set(event.items.length)}>
        <Text slot="label">Drop files or paste here</Text>
        <FileTrigger allowsMultiple onSelect={(files) => count.set(files?.length ?? 0)}>
          <Button>Choose files</Button>
        </FileTrigger>
      </DropZone>
      <p role="status">Received {count()} item(s)</p>
    </>
  );
}
```

::example{id=drop-zone-basic}

The live example above lists the names of dropped or chosen files. A paste goes to the zone's hidden button: focus it with :kbd[Tab] (it is named by `aria-label`) and paste.

## Anatomy

| Part | Element | Styling / role |
| --- | --- | --- |
| `DropZone` | `div` | Default `rv-DropZone`; your `class` replaces it. |
| Focus target | Visually hidden `button` inside a `span` | Receives focus and paste; named by `aria-label` and the label slot. |
| Label | `Text slot="label"` | Receives its id through `TextContext`. |
| Keyboard alternative | Your `FileTrigger` and `Button` | Opens the native file picker. |

## API

### Props

| Prop | Type / default | Behavior |
| --- | --- | --- |
| `children` | Content or render function | Render-state values are accessors. |
| `isDisabled` | Boolean or accessor; false when omitted | Blocks drops and paste and disables the hidden button. |
| `getDropOperation` | `(types, allowedOperations) => DropOperation` | Return an allowed operation or `"cancel"` to reject the drag. |
| `class`, `style` | Value or render function | Class defaults to `rv-DropZone`. |
| `render` | `(attributes, renderProps) => element` | Replaces the root; forward the attributes, ref and children. |
| `id`, `ref`, `slot` | Root id/ref and context slot | `ref` receives the root div. |
| ARIA labeling props | `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-details` | Labels identify the hidden focus target; global DOM props are forwarded to the root. |
| Global DOM props | `GlobalDOMAttributes<HTMLDivElement>` | The root owns pointer-up, pointer-over and native drag/drop handlers. |

`getDropOperationForPoint` is a member of the exported low-level `DropOptions` type, but is omitted from `DropZoneProps`.

### Events

| Event | Payload / timing |
| --- | --- |
| `onDrop` | `{ type: "drop", items, dropOperation, x, y }`; paste uses `"copy"` and coordinates `0, 0`. |
| `onDropEnter`, `onDropMove`, `onDropExit` | Valid native drag enters, moves within or exits the target; payload includes the event type and coordinates. |
| `onDropActivate` | Valid drag remains over the target for the activation delay. This does not add keyboard drag sessions. |
| `onHoverStart`, `onHoverEnd`, `onHoverChange` | Pointer hover callbacks. |

### Items and exports

| Export | Purpose |
| --- | --- |
| `DropZone`, `DropZoneContext` | Component and slotted props context. |
| `DropZoneProps`, `DropZoneRenderProps` | Component and render-state types. |
| `DropItem` | Union of text, file and directory items. |
| `TextDropItem` | `kind: "text"`, `types: Set<string>`, `getText(type): Promise<string>`. |
| `FileDropItem` | `kind: "file"`, `name`, `type`, `getFile(): Promise<File>`, `getText(): Promise<string>`. |
| `DirectoryDropItem` | `kind: "directory"`, `name`, `getEntries(): AsyncIterable<FileDropItem \| DirectoryDropItem>`. |
| `isTextDropItem`, `isFileDropItem`, `isDirectoryDropItem` | Type guards for those item variants. |
| `readFromDataTransfer` | Converts a DataTransfer to items; call during the native event while its data is available. |
| `DragTypes` | Construct from a DataTransfer; `has(type)` accepts a type or array of types and supports MIME wildcards. |
| `DragType`, `DragTypesLike`, `DIRECTORY_DRAG_TYPE` | String/symbol type identifiers, the `has` contract, and the directory identifier. |
| `DropOperation` | `"copy" \| "link" \| "move" \| "cancel"`. |
| `DropOptions` | Low-level operation and callback options. |
| `DropEvent`, `DropEnterEvent`, `DropMoveEvent`, `DropExitEvent`, `DropActivateEvent` | Typed callback payloads. |

## Styling

The root exposes `data-hovered`, `data-focused`, `data-focus-visible`, `data-drop-target` and `data-disabled`. Active flags use `"true"`; inactive flags are absent. Render functions receive `isHovered()`, `isFocused()`, `isFocusVisible()`, `isDropTarget()` and `isDisabled()`.

## Keyboard and accessibility

- :kbd[Tab] reaches the hidden focus target; paste there invokes `onDrop` when enabled. Style the root's `data-focus-visible` state so focus is visible.
- Supply an accessible label and a [FileTrigger](file-trigger.md) button for keyboard file selection.
- Keyboard and screen-reader drag sessions are not implemented. The hidden button alone does not start a file picker or a virtual drop session.

## Resumability

Native drag handlers load on the first drag event. Repeated `dragover` events establish the target after loading; a drop before the code is ready can fall back to the browser default. Clipboard items and File objects should be processed in handlers; store serializable metadata in application state.

## Upstream

DropZone and its native drop/paste behavior derive from React Aria Components and React Aria, Apache-2.0, copyright Adobe. Rivet supplies the component, context and resumable event wiring described here.
