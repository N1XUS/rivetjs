---
title: Kanban
description: "A drag-and-drop board: columns, card lists, cards with an optional drag handle, keyboard moves, an add-a-card composer and three sizes."
template: reference
status: experimental
related: [showcase/kanban, components/scroll-shadow, components/chip]
---

`Kanban` lays out columns of cards you drag within and between columns. Drag and drop comes from `@rivetjs/cdk/drag-drop` (the Angular CDK port): every card list in a board is connected. `createKanban` keeps the cards in one signal and moves a card where it was dropped. Mouse and touch drags work out of the box; pass `onCardMove` for keyboard moves. Nothing drag-related loads until the first press on a card.

## Usage

```tsx
import { Kanban, createKanban } from "@rivetjs/ui/kanban";
```

::example{id=kanban-basic}

## Anatomy

```tsx
import { Kanban, KanbanComposer } from "@rivetjs/ui/kanban";

export default function Anatomy() {
  return (
    <Kanban>
      <Kanban.Column>
        <Kanban.ColumnHeader>
          <Kanban.ColumnIndicator />
          <Kanban.ColumnTitle />
          <Kanban.ColumnCount />
          <Kanban.ColumnActions />
        </Kanban.ColumnHeader>
        <Kanban.ColumnBody>
          <Kanban.ScrollShadow>
            <Kanban.CardList>
              <Kanban.Card>
                <Kanban.CardContent />
                <Kanban.DragHandle />
              </Kanban.Card>
            </Kanban.CardList>
          </Kanban.ScrollShadow>
          <KanbanComposer />
        </Kanban.ColumnBody>
      </Kanban.Column>
    </Kanban>
  );
}
```

Additional exported parts: `Kanban.Root`.

## Examples

### Notion Board

::example{id=kanban-notion-board}

### Project Board

::example{id=kanban-project-board}

### Sizes

::example{id=kanban-sizes}

### Keyboard Moves

`onCardMove` on the board makes every card focusable (`tabindex="0"`, described by visually hidden instructions). Space or Enter picks the focused card up, Up / Down move it within its column, Left / Right to the neighbouring column (mirrored in RTL), Space or Enter drops it and Escape puts it back where it was picked up; Tab away drops it in place. Each step is announced (cdk live announcer, polite); change the texts with `messages`. The board calls `onCardMove({ key, column, index, from })` for every step: `createKanban().onCardMove` applies it.

::example{id=kanban-keyboard}

### Add a Card

`KanbanComposer` (its own export, so a board without one loads no form code) is the "add a card" row of a column: a ghost trigger that opens an inline title field. Enter or the Add button calls `onSubmit(title)` (trimmed, never empty) and closes it (`keepOpen` keeps it open for the next card); Escape or Cancel closes it and focus returns to the trigger.

::example{id=kanban-composer}

### Not Yet Supported

- Card selection (`selectionMode`).

## Styling Reference

The component’s parts emit these additional `data-slot` values: `kanban-column-indicator`, `kanban-column-title`, `kanban-column-count`, `kanban-column-actions`, `kanban-column-body`, `kanban-drop-indicator`.

### CSS Classes

- `.kanban` - The board (grid of columns, horizontal snap scrolling); `.kanban--sm` / `--md` / `--lg`.
- `.kanban__column`, `.kanban__column-header`, `.kanban__column-indicator` (`[data-icon]` with children), `.kanban__column-title`, `.kanban__column-count`, `.kanban__column-actions` (revealed on header hover / focus) - Columns.
- `.kanban__column-body`, `.kanban__scroll-shadow` - Column container and its optional scroll wrapper.
- `.kanban__card-list` - The drop list (`.cdk-drop-list-dragging` / `-receiving` while dragging).
- `.kanban__card`, `.kanban__card-content` - Cards (`.cdk-drag-preview` = the dragged copy, `.cdk-drag-placeholder` = the slot it left, `[data-grabbed]` = picked up with the keyboard).
- `.kanban__composer`, `.kanban__composer-trigger`, `.kanban__composer-form`, `.kanban__composer-actions` - `KanbanComposer`.
- `.kanban__drag-handle` - The grip (`Kanban.DragHandle`), shown on card hover / focus.
- `.kanban__drop-indicator` - A custom landing slot (`Kanban.DropIndicator`).
- `.kanban__empty` - Empty column state, shown while the list has no cards.

### CSS Variables

| Variable                    | Default | Description                                |
| --------------------------- | ------- | ------------------------------------------ |
| `--kanban-column-min-width` | `280px` | Column width (`sm` 240px, `lg` 320px)      |
| `--kanban-column-gap`       | `16px`  | Gap between columns (`sm` 12px, `lg` 20px) |
| `--kanban-column-height`    | `480px` | Max height of `Kanban.ScrollShadow`        |
| `--kanban-column-color`     | muted   | Indicator colour (`color`)                 |
| `--kanban-drop-height`      | `64px`  | `Kanban.DropIndicator` height (`height`)   |

### Data Attributes

- `[data-size]` on the board: `sm` / `md` / `lg`.
- `[data-slot]`: `kanban`, `kanban-column`, `kanban-column-header`, `kanban-card-list`, `kanban-card`, `kanban-card-content`, `kanban-empty`, `kanban-composer`, `kanban-composer-trigger`, `kanban-composer-form`, …
- `[data-kanban-column]` on each card list (its `data`), `[data-kanban-key]` on each card (its `data`).
- Keyboard moves: `[data-grabbed]` on the picked-up card; `[data-kanban-grabbed]` (the card key) on the board.

## API Reference

See the [full module API](/api/rivetjs/ui/kanban/) for every named export and part prop type.

### Kanban

| Prop         | Type                             | Default | Description                                                         |
| ------------ | -------------------------------- | ------- | ------------------------------------------------------------------- |
| `size`       | `"sm"` \| `"md"` \| `"lg"`       | `"md"`  | Column width, gap and card density                                  |
| `disabled`   | `boolean`                        | `false` | Disable dragging on every list                                      |
| `onCardMove` | `(move: KanbanCardMove) => void` | -       | Keyboard moves: `{ key, column, index, from }` per step (read once) |
| `messages`   | `Partial<KanbanMessages>`        | English | Instructions and announcement texts of keyboard moves               |

Also supports the cdk `DropListGroup` props and native attributes.

### Kanban.Column / ColumnHeader / ColumnTitle / ColumnCount / ColumnActions / ColumnBody

`section` / `header` / `h3` / `span` / `div` / `div`; all native attributes.

### Kanban.ColumnIndicator

| Prop       | Type      | Default | Description                |
| ---------- | --------- | ------- | -------------------------- |
| `color`    | `string`  | muted   | Dot or icon colour         |
| `children` | `Content` | -       | An icon instead of the dot |

### Kanban.CardList

| Prop               | Type                        | Default | Description                                          |
| ------------------ | --------------------------- | ------- | ---------------------------------------------------- |
| `data`             | `string`                    | -       | The column id (what `onDropped` receives)            |
| `onDropped`        | `(event: DragDrop) => void` | -       | A card was dropped here (`createKanban().onDropped`) |
| `renderEmptyState` | `() => Content`             | -       | Shown while the list has no cards                    |

Also supports every cdk `DropList` prop (`orientation`, `disabled`, `sortingDisabled`, `enterPredicate`, …).

### Kanban.Card

| Prop        | Type      | Default | Description                                                 |
| ----------- | --------- | ------- | ----------------------------------------------------------- |
| `data`      | `string`  | -       | The card key                                                |
| `textValue` | `string`  | -       | Accessible name (`role="group"` + `aria-label` on the card) |
| `disabled`  | `boolean` | `false` | Not draggable                                               |

Also supports every cdk `Drag` prop.

### KanbanComposer

| Prop           | Type                                          | Default        | Description                                                  |
| -------------- | --------------------------------------------- | -------------- | ------------------------------------------------------------ |
| `onSubmit`     | `(title: string) => void`                     | -              | Called with the trimmed title                                |
| `label`        | `string`                                      | `"Add a card"` | Trigger text and the field's accessible name                 |
| `placeholder`  | `string`                                      | `"Card title"` | Field placeholder                                            |
| `submitLabel`  | `string`                                      | `"Add card"`   | Submit button text                                           |
| `cancelLabel`  | `string`                                      | `"Cancel"`     | Cancel button text                                           |
| `isOpen`       | `boolean \| Signal<boolean> \| () => boolean` | -              | Open state (controlled or two-way)                           |
| `defaultOpen`  | `boolean`                                     | `false`        | Initial open state                                           |
| `onOpenChange` | `(isOpen: boolean) => void`                   | -              | Open state changed                                           |
| `keepOpen`     | `boolean`                                     | `false`        | Stay open after a submit                                     |
| `id`           | `string`                                      | -              | Trigger id; the field gets `${id}-input`, Add `${id}-submit` |

### Kanban.DragHandle

A cdk `DragHandle` with a lucide grip named by `aria-label` (default "Drag"); once a card has a handle, only the handle starts a drag.

### Kanban.DropIndicator

| Prop     | Type     | Default | Description       |
| -------- | -------- | ------- | ----------------- |
| `height` | `number` | `64`    | Slot height in px |

Put it inside a `Kanban.Card`: it replaces the faded card left in place while dragging (cdk `DragPlaceholder`).

### createKanban

```tsx
const board = createKanban({
  initialItems: tasks,
  getKey: (task) => task.id,
  getColumn: (task) => task.status,
  setColumn: (task, status) => ({ ...task, status }),
});
```

| Option         | Type                                               | Description                           |
| -------------- | -------------------------------------------------- | ------------------------------------- |
| `initialItems` | `T[]` \| `Signal<T[]>`                             | The cards (pass a signal to share it) |
| `getKey`       | `(item: T) => string`                              | Stable key (the card's `data`)        |
| `getColumn`    | `(item: T) => string`                              | The card's column id                  |
| `setColumn`    | `(item: T, column: string) => T`                   | The card with its new column          |
| `onMove`       | `(item: T, column: string, index: number) => void` | After a move                          |

Returns `{ items, itemsOf(column), move(key, column, index), onDropped, onCardMove }` (`onCardMove` = `Kanban onCardMove`).

## Accessibility

- Columns are `section`s; name each with `aria-labelledby` pointing at its `Kanban.ColumnTitle` (an `h3`).
- Name every card with `textValue` (its `aria-label`).
- Pass `onCardMove` so keyboard and screen reader users can move cards: each card gets `tabindex="0"` and `aria-describedby` pointing at the instructions; every pick up, move, drop and cancel is announced with the card's name, column and position.
- `KanbanComposer`'s field is named by its `label`; Escape closes it and returns focus to the trigger.

## Related Components

- [Kanban showcase](/showcase/kanban/): A full board with keyboard moves and composers.
- [ScrollShadow](/components/scroll-shadow/): Scroll wrapper for tall columns.
- [Chip](/components/chip/): Tags on cards.
