---
title: DropZone
description: "A drag-and-drop file upload area with a browse button, file type filtering and a file list with progress."
template: reference
status: experimental
related: [components/progress-bar, components/button]
---

`DropZone` is an area that files can be dragged onto, pasted into, or picked through a browse button, plus parts for the list of uploaded files. The area is the cdk `DropZone` (native drag and drop, paste on its focus target). Nothing loads before the first drag or press: the first `dragenter` loads the zone, and the drag's next `dragover` (browsers repeat it every ~50 ms) marks it as the drop target.

## Usage

```tsx
import { DropZone } from "@rivetjs/ui/drop-zone";
```

::example{id=drop-zone-basic}

## Anatomy

```tsx
import { DropZone } from "@rivetjs/ui/drop-zone";

export default function Anatomy() {
  return (
    <DropZone>
      <DropZone.Area>
        <DropZone.Icon />
        <DropZone.Label>Drag files here or click to browse</DropZone.Label>
        <DropZone.Description>PDF, DOCX, PNG, or JPG up to 10 MB.</DropZone.Description>
        <DropZone.Trigger>Select files</DropZone.Trigger>
      </DropZone.Area>
      <DropZone.Input />
      <DropZone.FileList>
        <DropZone.FileItem>
          <DropZone.FileFormatIcon />
          <DropZone.FileInfo>
            <DropZone.FileName>Proposal.pdf</DropZone.FileName>
            <DropZone.FileMeta>2.4 MB</DropZone.FileMeta>
          </DropZone.FileInfo>
          <DropZone.FileProgress>
            <DropZone.FileProgressTrack>
              <DropZone.FileProgressFill />
            </DropZone.FileProgressTrack>
          </DropZone.FileProgress>
          <DropZone.FileRetryTrigger />
          <DropZone.FileRemoveTrigger />
        </DropZone.FileItem>
      </DropZone.FileList>
    </DropZone>
  );
}
```

## With File List

Keep the files in a signal and render a `FileItem` per file. `status` (`uploading`, `complete`, `failed`) styles the row; show `FileProgress` while uploading and `FileRetryTrigger` after a failure.

::example{id=drop-zone-file-list}

## Compact File List

::example{id=drop-zone-compact}

## Disabled

`isDisabled` on `.Area` turns off drops and paste. Disable the trigger and the input too.

::example{id=drop-zone-disabled}

## Image Only

`getDropOperation(types, allowedOperations)` decides while dragging: return `"cancel"` to refuse the drag (no drop target state), or an operation such as `"copy"`. `accept` on `.Input` filters the file picker.

::example{id=drop-zone-image-only}

## Max Size Limit

Sizes are known once the files arrive: check them in `onDrop` and `onSelect`.

::example{id=drop-zone-max-size}

## Multiple Files

::example{id=drop-zone-multiple}

## Custom Icon

::example{id=drop-zone-custom-icon}

## Custom Triggers

::example{id=drop-zone-custom-triggers}

## Reading Dropped Files

`onDrop` receives `DropItem`s. Filter file items with `isFileDropItem` from `@rivetjs/cdk/drop-zone` and read each with `getFile()`:

```tsx
import { isFileDropItem, type DropEvent } from "@rivetjs/cdk/drop-zone";

const onDrop = async (e: DropEvent) => {
  const files = await Promise.all(e.items.filter(isFileDropItem).map((item) => item.getFile()));
  console.log(files.map((file) => file.name));
};
```

Text items (`isTextDropItem`, `getText(type)`) and directories (`isDirectoryDropItem`, `getEntries()`) arrive the same way.

## Styling Reference

### CSS Classes

- `.drop-zone` - Root wrapper.
- `.drop-zone__area` - The droppable area.
- `.drop-zone__icon` - Upload icon container.
- `.drop-zone__label` - Primary label text.
- `.drop-zone__description` - Secondary description text.
- `.drop-zone__trigger` - Browse button.
- `.drop-zone__input` - Hidden file input.
- `.drop-zone__file-list` - File list container.
- `.drop-zone__file-item` - One file row.
- `.drop-zone__file-format-icon` - File icon with its format badge (`.drop-zone__file-format-badge`).
- `.drop-zone__file-info` - File name and metadata container.
- `.drop-zone__file-name` - File name text.
- `.drop-zone__file-meta` - File size or status text.
- `.drop-zone__file-progress` - Upload progress bar.
- `.drop-zone__file-retry-trigger` - Retry button for failed uploads.
- `.drop-zone__file-remove-trigger` - Remove button.

### Data Attributes

- `[data-drop-target="true"]` on the area while an accepted drag is over it.
- `[data-focus-visible="true"]` / `[data-focused="true"]` on the area when its hidden button has focus.
- `[data-hovered="true"]` and `[data-disabled="true"]` on the area.
- `[data-status="uploading|complete|failed"]` on a file item.
- `[data-color]` on the format icon: `default`, `accent`, `success`, `warning`, `danger`.

## API Reference

### DropZone

The root wrapper. Takes `div` props, `class` and `render`.

### DropZone.Area

The cdk `DropZone`.

| Prop               | Type                                                            | Default | Description                                          |
| ------------------ | --------------------------------------------------------------- | ------- | ---------------------------------------------------- |
| `onDrop`           | `(e: DropEvent) => void`                                        | -       | Called with the dropped or pasted items              |
| `getDropOperation` | `(types: DragTypesLike, allowed: DropOperation[]) => DropOperation` | -   | Accept (`"copy"`, `"move"`, `"link"`) or `"cancel"`  |
| `onDropEnter`      | `(e: DropEnterEvent) => void`                                   | -       | A drag entered the area                              |
| `onDropMove`       | `(e: DropMoveEvent) => void`                                    | -       | A drag moved over the area                           |
| `onDropExit`       | `(e: DropExitEvent) => void`                                    | -       | A drag left the area                                 |
| `onDropActivate`   | `(e: DropActivateEvent) => void`                                | -       | A drag held still over the area                      |
| `isDisabled`       | `boolean \| () => boolean`                                      | -       | No drops and no paste                                |
| `class`            | `string \| (values) => string`                                  | -       | Class, or a function of the render props             |

Render props (accessors): `isHovered`, `isFocused`, `isFocusVisible`, `isDropTarget`, `isDisabled`.

### DropZone.Icon

Upload icon container. Renders a lucide cloud upload icon when no children are given.

### DropZone.Label

The area's label (`Text slot="label"`): names the area's focus target.

### DropZone.Description

Secondary description text.

### DropZone.Input

The hidden file input the triggers open.

| Prop       | Type                         | Default | Description                                   |
| ---------- | ---------------------------- | ------- | --------------------------------------------- |
| `accept`   | `string`                     | -       | Accepted file types (e.g. `"image/*,.pdf"`)   |
| `multiple` | `boolean`                    | -       | Whether multiple files can be selected        |
| `onSelect` | `(files: FileList) => void`  | -       | Called when files are picked                  |
| `disabled` | `boolean`                    | -       | Triggers do not open the picker               |
| `name`     | `string`                     | -       | Form field name                               |

### DropZone.Trigger

A [Button](/components/button/) (`variant="secondary"`, `size="sm"` by default) that opens the root's file picker. Renders "Select files" when no children are given.

### DropZone.FileList

The list of files (`ul`).

### DropZone.FileItem

| Prop     | Type                                    | Default | Description                    |
| -------- | --------------------------------------- | ------- | ------------------------------ |
| `status` | `"uploading" \| "complete" \| "failed"` | -       | Upload status (`data-status`)  |

### DropZone.FileFormatIcon

| Prop     | Type     | Default  | Description                                                                          |
| -------- | -------- | -------- | ------------------------------------------------------------------------------------ |
| `format` | `string` | -        | Format badge text (e.g. `"PDF"`)                                                      |
| `color`  | `string` | `"gray"` | `gray`, `blue`, `green`, `orange`, `yellow`, `red`, or a theme colour (`accent`, `success`, `warning`, `danger`, `default`) |

### DropZone.FileInfo, FileName, FileMeta

Containers for the file's name and its size or status.

### DropZone.FileProgress, FileProgressTrack, FileProgressFill

A [ProgressBar](/components/progress-bar/) (`size="sm"` by default) with its track and fill.

### DropZone.FileRetryTrigger, FileRemoveTrigger

Icon [Buttons](/components/button/) labelled "Retry upload" and "Remove file" (override with `aria-label` or children).

## Accessibility

- The area has a visually hidden button as its focus target, named by `.Label` (or `aria-label`). Tab reaches it; the focus ring shows on the area.
- Paste (Cmd/Ctrl+V) while it has focus drops the clipboard contents.
- Keyboard users pick files with `.Trigger`. Keyboard drag and drop between elements is not supported yet.
- A drop released before the zone's script has loaded (within the first moments of the very first drag on a page) falls back to the browser's default for that drop.

## Related Components

- [ProgressBar](/components/progress-bar/): Upload progress.
- [Button](/components/button/): The browse and row triggers.
