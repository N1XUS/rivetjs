---
title: Kanban
description: "A drag-and-drop board: columns with a header, count and actions, card lists, cards with an optional drag handle, an empty state and three sizes."
template: reference
status: experimental
related: [showcase/kanban, components/scroll-shadow, components/chip]
---

`Kanban` lays out columns of cards you drag within and between columns. Drag and drop comes from `@rivetjs/cdk/drag-drop` (the Angular CDK port): every card list in a board is connected. `createKanban` keeps the cards in one signal and moves a card where it was dropped. Nothing drag-related loads until the first press on a card.

## Usage

```tsx
import { Kanban, createKanban } from "@rivetjs/ui/kanban";
```

::example{id=kanban-basic}

## Anatomy

```tsx
import { Kanban } from "@rivetjs/ui/kanban";

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
        </Kanban.ColumnBody>
      </Kanban.Column>
    </Kanban>
  );
}
```

## Notion Board

::example{id=kanban-notion-board}

## Project Board

::example{id=kanban-project-board}

## Sizes

::example{id=kanban-sizes}

## Accessibility

- Columns are `section`s; name each with `aria-labelledby` pointing at its `Kanban.ColumnTitle` (an `h3`).
- Name every card with `textValue` (its `aria-label`).
- Dragging needs a pointer: give keyboard and screen reader users another way to move a card, for example move buttons per card and a polite status message (see the [Kanban showcase](/showcase/kanban/)).

## Not Yet Supported

- Keyboard drag and drop (the cdk keyboard drag engine is pending).
- Card selection (`selectionMode`).

## Styling Reference

### CSS Classes

- `.kanban` - The board (grid of columns, horizontal snap scrolling); `.kanban--sm` / `--md` / `--lg`.
- `.kanban__column`, `.kanban__column-header`, `.kanban__column-indicator` (`[data-icon]` with children), `.kanban__column-title`, `.kanban__column-count`, `.kanban__column-actions` (revealed on header hover / focus) - Columns.
- `.kanban__column-body`, `.kanban__scroll-shadow` - Column container and its optional scroll wrapper.
- `.kanban__card-list` - The drop list (`.cdk-drop-list-dragging` / `-receiving` while dragging).
- `.kanban__card`, `.kanban__card-group` (`textValue`, `display: contents`), `.kanban__card-content` - Cards (`.cdk-drag-preview` = the dragged copy, `.cdk-drag-placeholder` = the slot it left).
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
- `[data-slot]`: `kanban`, `kanban-column`, `kanban-column-header`, `kanban-card-list`, `kanban-card`, `kanban-card-content`, `kanban-empty`, …

## API Reference

### Kanban

| Prop       | Type                       | Default | Description                        |
| ---------- | -------------------------- | ------- | ---------------------------------- |
| `size`     | `"sm"` \| `"md"` \| `"lg"` | `"md"`  | Column width, gap and card density |
| `disabled` | `boolean`                  | `false` | Disable dragging on every list     |

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

| Prop        | Type      | Default | Description                                |
| ----------- | --------- | ------- | ------------------------------------------ |
| `data`      | `string`  | -       | The card key                               |
| `textValue` | `string`  | -       | Accessible name (a `role="group"` wrapper) |
| `disabled`  | `boolean` | `false` | Not draggable                              |

Also supports every cdk `Drag` prop.

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

Returns `{ items, itemsOf(column), move(key, column, index), onDropped }`.

## Related Components

- [Kanban showcase](/showcase/kanban/): A full board with move buttons and add forms.
- [ScrollShadow](/components/scroll-shadow/): Scroll wrapper for tall columns.
- [Chip](/components/chip/): Tags on cards.
