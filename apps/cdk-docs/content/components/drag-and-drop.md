---
title: Drag and drop
description: Drag, DropList and friends from @rivetjs/cdk/drag-drop - free dragging, sortable and connected lists, handles, previews (Angular CDK drag-drop port).
template: guide
status: experimental
related: [components/carousel, foundations/keyboard-shortcuts, foundations/motion]
---

`@rivetjs/cdk/drag-drop` is a port of the [Angular CDK drag and drop](https://angular.dev/guide/drag-drop) package: the engine (`DragRef`, `DropListRef`, the registry, the sort strategies, the preview) file by file, and the `cdkDrag` / `cdkDropList` / … directives as resumable components. It covers:

- Free dragging
- Lists of reorderable draggable elements
- Transferring draggable elements between lists
- Dragging animations
- Locking draggable elements along an axis or inside an element
- Custom drag handles
- Custom previews and placeholders

Every example on this page is a port of the matching Angular docs example (`adev/src/content/examples/drag-drop`), with the same markup, data and styles.

## Before you start

### Importing drag and drop

Import the components from `@rivetjs/cdk/drag-drop`. Each one replaces an Angular directive: `cdkDrag` → `Drag`, `cdkDropList` → `DropList`, `cdkDropListGroup` → `DropListGroup`, `cdkDragHandle` → `DragHandle`, `*cdkDragPreview` → `DragPreview`, `*cdkDragPlaceholder` → `DragPlaceholder`. Directive inputs are props without the prefix (`cdkDragData` → `data`, `cdkDropListOrientation` → `orientation`), outputs are `on*` callbacks (`cdkDropListDropped` → `onDropped`, `cdkDragStarted` → `onStarted`).

```tsx
import { Drag, DropList, moveItemInArray } from "@rivetjs/cdk/drag-drop";
```

`@rivetjs/cdk/drag-drop/utils` holds only the array helpers (`moveItemInArray`, `transferArrayItem`, `copyArrayItem`; server-safe), `@rivetjs/cdk/drag-drop/cdk` only the engine (`dragDrop` service, `createDragRef`, `createDropListRef`).

## Create draggable elements

Any element becomes draggable when you render it as a `Drag`. A `Drag` outside a `DropList` supports free dragging: the engine keeps its position as a `transform`.

::example{id=drag-drop-overview}

## Create a list of reorderable draggable elements

Put `Drag` elements in a `DropList` to make them a reorderable collection. The list defines where its items can be dropped, and its items move out of the way while one is dragged.

The components don't update your data. Listen to `onDropped` (the user finished dragging) and update the data yourself, for example with `moveItemInArray`. Render the items with a keyed `For` so the same elements follow the new order.

::example{id=drag-drop-sorting}

`dropListInstance(element)` returns the `DropListInstance` of a rendered list (Angular `CDK_DROP_LIST` / `@ViewChild(CdkDropList)`), `dragInstance(element)` the `DragInstance` of an item.

## Transfer draggable elements between lists

A `DropList` can transfer its items to connected lists. There are two ways to connect lists:

- Set `connectedTo` to other lists: their ids, or `DropListInstance`s.
- Wrap the lists in a `DropListGroup`.

```tsx
<DropList id="list-one" connectedTo={["list-two"]}>…</DropList>
<DropList id="list-two" connectedTo={["list-one"]}>…</DropList>
```

::example{id=drag-drop-connected-sorting}

Use `DropListGroup` when you don't know how many lists there will be: every `DropList` rendered inside the group is connected to all the others.

```tsx
<DropListGroup>
  {/* All lists in here are connected. */}
  {lists.map((list) => (
    <DropList data={list}>…</DropList>
  ))}
</DropListGroup>
```

::example{id=drag-drop-connected-sorting-group}

### Selective dragging

By default an item can move from a list into any connected list. `enterPredicate` decides which items may enter a list: it is called whenever an item enters a new container, with the `DragInstance` and the `DropListInstance`, and the item only enters when it returns `true`.

::example{id=drag-drop-enter-predicate}

## Attach data

`data` on a `Drag` or a `DropList` attaches any value to it. The events carry it (`event.item.data`, `event.container.data`, `event.previousContainer.data`), which identifies where a drag came from and where it ended.

```tsx
{
  lists.map((list) => (
    <DropList data={list} onDropped={(event) => drop(event)}>
      <For each={list.items} by={(item) => item.id}>
        {(item) => <Drag data={item()}>{item().title}</Drag>}
      </For>
    </DropList>
  ));
}
```

The examples pass a key (`data="todo"`) and look the signal up in the drop handler, so the handler can `set` the right list.

## Dragging customizations

### Customize drag handle

By default the whole `Drag` element starts a drag. Put a `DragHandle` inside it to restrict dragging to the handle; a `Drag` can have any number of handles. `DragHandle` takes `disabled` and `elementType` (`div`, `span` or `button`).

::example{id=drag-drop-custom-handle}

### Customize drag preview

While a `Drag` is dragged, a preview follows the pointer. By default it is a clone of the dragged element. Put a `DragPreview` inside the `Drag` to show your own content instead. The custom preview does not take the size of the dragged element; pass `matchSize` to give it that size.

The clone drops its `id` attribute so the page never has two elements with one id: CSS that targets the id does not apply to the preview.

::example{id=drag-drop-custom-preview}

### Customize drag insertion point

The preview is inserted into the `<body>` by default (or the closest shadow root), so `overflow` and `z-index` of the parents can't clip or cover it. `previewContainer` on `Drag` changes that:

| Value                                             | Description                                                             | Advantages                                                                                               | Disadvantages                                                                                                              |
| ------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `global`                                          | Default. The preview goes into the `<body>` or the closest shadow root. | Not affected by `z-index` or `overflow: hidden`; does not affect `:nth-child` selectors or flex layouts. | Inherits from `<body>`: only the text styles below are kept.                                                               |
| `parent`                                          | The preview goes into the parent of the dragged element.                | Inherits the styles of the dragged element.                                                              | Can be clipped by `overflow: hidden` or covered due to `z-index`; can affect `:nth-child` selectors and some flex layouts. |
| an element (`{ nativeElement }` or `HTMLElement`) | The preview goes into that element.                                     | Inherits the styles of that element.                                                                     | Same as `parent`.                                                                                                          |

`DragDropConfigContext` sets `previewContainer` (`global` or `parent`) for every `Drag` below it; see [Configuration](#configuration).

A `global` preview keeps the text styles the dragged element inherits from its parent: color, font family / size / style / weight, numeric font variants and feature settings, line height, letter and word spacing, text alignment and transform, white space. A card in a `text-sm` list keeps its `text-sm` size in the preview instead of the `<body>` font size. The values are defaults in the lowest-priority cascade layer, so a class on the element or a `.cdk-drag-preview` rule still wins. Other inherited styles (custom properties, `cursor`, `visibility`) come from `<body>`. This is a Rivet addition: an Angular CDK global preview inherits everything from `<body>`.

### Customize drag placeholder

While a `Drag` is dragged, a placeholder shows where it will land. By default it is a clone of the dragged element. Put a `DragPlaceholder` inside the `Drag` to replace it.

::example{id=drag-drop-custom-placeholder}

### Customize drag root element

`rootElementSelector` makes an ancestor of the `Drag` the element that moves, when you can't render that element as a `Drag` yourself. The selector is matched from the `Drag` up the DOM; the matching element is dragged. This makes a dialog draggable by its content, for example. The example uses a cdk [Modal](modal.md) on the div overlay layer instead of the upstream overlay pane.

::example{id=drag-drop-root-element}

`DragDropConfigContext` sets `rootElementSelector` for every `Drag` below it.

### Set DOM position of a draggable element

A `Drag` outside a `DropList` only moves when the user moves it. `freeDragPosition` sets its position (`{ x, y }`, a value or a Signal), for example to restore where a returning user left it. The position is rendered on the server too (the `transform`), so the element doesn't jump when the page resumes.

::example{id=drag-drop-free-drag-position}

### Restrict movement within an element

`boundaryElement` keeps a `Drag` inside another element. It takes a CSS selector, matched from the element's parent up the DOM, or an element. It also works for a `Drag` inside a `DropList`.

::example{id=drag-drop-boundary}

`DragDropConfigContext` sets `boundaryElement` for every `Drag` below it.

### Restrict movement along an axis

A `Drag` moves in every direction by default. `lockAxis="x"` or `lockAxis="y"` restricts it to one axis. For all the items of a list, set `lockAxis` on the `DropList` instead.

::example{id=drag-drop-axis-lock}

`DragDropConfigContext` sets `lockAxis` for every `Drag` below it.

### Delay dragging

By default the drag sequence starts as soon as the pointer goes down on a `Drag`. On touch devices a full-screen draggable then starts a drag when the user only wants to scroll. `dragStartDelay` waits until the pointer has been held down for that many milliseconds; it also takes `{ touch, mouse }` delays.

::example{id=drag-drop-delay}

`DragDropConfigContext` sets `dragStartDelay` for every `Drag` below it.

### Disable dragging

`disabled` on a `Drag` stops it from being dragged; `disabled` on a `DropList` disables the whole list (and on a `DropListGroup`, every list in it); `disabled` on a `DragHandle` disables that handle only. A disabled `Drag` carries `cdk-drag-disabled` and `data-disabled="true"` from the server render on.

::example{id=drag-drop-disabled}

`DragDropConfigContext` sets `draggingDisabled` for every `Drag` below it.

## Sorting customizations

### List orientation

A `DropList` is vertical by default. `orientation="horizontal"` sorts along the x axis.

::example{id=drag-drop-horizontal-sorting}

`DragDropConfigContext` sets `listOrientation` for every `DropList` below it.

### List wrapping

By default a `DropList` sorts its items by moving them with a CSS `transform`, so the sorting can be animated. This only works in one direction, vertical or horizontal.

For a list that wraps onto new lines, set `orientation="mixed"`. The list then uses another sort strategy (`MixedSortStrategy`) that moves the items in the DOM, and the sorting can no longer be animated.

::example{id=drag-drop-mixed-sorting}

### Selective sorting

Items can be sorted into any position of a `DropList` by default. `sortPredicate` is called whenever an item is about to move to a new index, with the index, the `DragInstance` and the `DropListInstance`; the item moves only when it returns `true`, otherwise it keeps its position.

::example{id=drag-drop-sort-predicate}

### Disable sorting

Sometimes the items of a list can be dragged into another list, but must not be reordered in their own. `sortingDisabled` on the `DropList` keeps its order: a dragged item keeps its initial position in the list unless it is dropped somewhere else.

::example{id=drag-drop-disabled-sorting}

`DragDropConfigContext` sets `sortingDisabled` for every `DropList` below it.

### Copying items between lists

An item dragged into another list moves out of its own list by default. To copy it instead, set `hasAnchor` on the source list: the list leaves an anchor (a clone of the placeholder) in the item's original slot while the item travels; when the item returns, the anchor is removed. Style it with the `cdk-drag-anchor` class. Copy the data in `onDropped` with `copyArrayItem`.

`hasAnchor` together with `sortingDisabled` gives a list users can copy from but not reorder, such as a product list next to a shopping cart.

::example{id=drag-drop-copy-list}

## Customize animations

Drag and drop animates:

- the items of a list while one is sorted inside it, and
- the dropped item from where the user released it to its place in the list.

The animations are CSS transitions on `transform` that you define. These classes take them:

| CSS class             | Result of adding a `transform` transition                                                                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.cdk-drag`           | The items animate as they are sorted. Scope it to lists that are dragging: `.cdk-drop-list-dragging .cdk-drag:not(.cdk-drag-placeholder)`.                                                |
| `.cdk-drag-animating` | The dragged item animates from where it was dropped to its final position in the `DropList`. The class is on the preview only after the drag stopped; the drop waits for that transition. |

```css
.cdk-drag-animating,
.cdk-drop-list-dragging .cdk-drag:not(.cdk-drag-placeholder) {
  transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
}
@media (prefers-reduced-motion: reduce) {
  .cdk-drag-animating,
  .cdk-drop-list-dragging .cdk-drag:not(.cdk-drag-placeholder) {
    transition: none;
  }
}
```

:::note
**Rivet: animated transfers between lists.** Upstream, an item that enters another list moves its placeholder there with a plain DOM insert, so the receiving list's items jump to make room, and the items of the list it left jump into the gap; only sorting inside a list animates. Rivet animates that shift too: when an item enters or leaves a list, `DropListRef` measures the other items before the change and plays a short Web Animation from their old position to the new one (additive, so the sort transforms and your transitions keep working on top). Its duration and easing are the items' own `transform` transition — the CSS above — so items without one still jump, as upstream, and `prefers-reduced-motion` rules that remove the transition remove the animation as well.
:::

## Styling

`Drag` and `DropList` only apply the styles their behaviour needs (inline: the transforms, `touch-action` on handles while dragging, the preview's fixed position and `z-index`). Style the rest with these classes; the components also set the default `rv-*` class (replaced by `class`) and `data-*` attributes:

| CSS class                              | Attribute               | Description                                                                                                               |
| -------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `.cdk-drop-list` (+ `rv-DropList`)     | `data-orientation`      | A `DropList` element.                                                                                                     |
| `.cdk-drag` (+ `rv-Drag`)              |                         | A `Drag` element.                                                                                                         |
| `.cdk-drag-disabled`                   | `data-disabled="true"`  | A disabled `Drag`.                                                                                                        |
| `.cdk-drag-dragging`                   | `data-dragging="true"`  | A `Drag` while it is dragged.                                                                                             |
| `.cdk-drag-handle` (+ `rv-DragHandle`) | `data-disabled`         | A `DragHandle` element.                                                                                                   |
| `.cdk-drag-preview`                    |                         | The preview that follows the pointer. A clone of the dragged element unless a `DragPreview` replaces it.                  |
| `.cdk-drag-placeholder`                |                         | The placeholder in the slot the item will land in. A clone of the dragged element unless a `DragPlaceholder` replaces it. |
| `.cdk-drop-list-dragging`              | `data-dragging="true"`  | A `DropList` with an item being dragged in it.                                                                            |
| `.cdk-drop-list-disabled`              | `data-disabled="true"`  | A disabled `DropList`.                                                                                                    |
| `.cdk-drop-list-receiving`             | `data-receiving="true"` | A `DropList` that can receive the item currently dragged from a connected list.                                           |
| `.cdk-drag-anchor`                     |                         | The anchor a `hasAnchor` list leaves in the item's original slot.                                                         |
| `rv-DropListGroup`                     | `data-disabled`         | A `DropListGroup` element.                                                                                                |

On the first drag the engine adds the upstream resets for the preview (`padding`, `border`, `background`, `overflow`, `inset`; they undo the `popover` user-agent styles) as `@layer cdk-resets`, inserted first in `<head>` so it is the lowest-priority layer: any style of the app wins, in a layer (Tailwind) or not. Upstream appends it, which lets it beat layered app styles.

The examples are plain CSS (the upstream `app.css` files, with colour variables for the dark theme). In Tailwind, target the state classes with arbitrary variants (`[&.cdk-drop-list-receiving]:bg-indigo-50`) or the attributes (`data-[receiving=true]:bg-indigo-50`); the [Kanban showcase](site:ui/showcase/kanban/) styles them on `@rivetjs/ui`.

## Dragging in a scrollable container

A `DropList` auto-scrolls the window and its own element when the pointer gets close to their edges (`autoScrollDisabled`, `autoScrollStep`). Other scrollable ancestors only auto-scroll when they are registered with the scroll dispatcher, as with Angular's `cdkScrollable`: create a `CdkScrollable` for the element (`new CdkScrollable(element).init()` from `@rivetjs/cdk/scrolling`) before the drag starts. The cdk virtual scroll viewport registers itself.

## Integrations with other components

Any element can be a drop list or an item (`elementType`: `DropList` renders `div`, `ul`, `ol`, `tbody` or `section`; `Drag` renders `div`, `li`, `tr`, `span`, `section` or `article`). The Angular Material table example ports to a plain table: the `tbody` is the `DropList` and every `tr` a `Drag`.

::example{id=drag-drop-table}

When the items are not direct children of the list element, `elementContainerSelector` names the element that holds them.

## Configuration

`DragDropConfigContext` (Angular `CDK_DRAG_CONFIG`) sets defaults for every `Drag` and `DropList` below it. Props set on a component win.

```tsx
import { Provider } from "@rivetjs/runtime/dom";
import { DragDropConfigContext } from "@rivetjs/cdk/drag-drop";

<Provider token={DragDropConfigContext} value={{ dragStartDelay: { touch: 200, mouse: 0 }, lockAxis: "y", zIndex: 1100 }}>
  {/* … */}
</Provider>;
```

| Field                             | Type                                                             | Applies to                                                  |
| --------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------- |
| `lockAxis`                        | `"x" \| "y" \| null`                                             | `Drag`                                                      |
| `dragStartDelay`                  | `number \| { touch: number; mouse: number }`                     | `Drag`                                                      |
| `constrainPosition`               | `(point, dragRef, dimensions, pickupPositionInElement) => Point` | `Drag`                                                      |
| `previewClass`                    | `string \| string[]`                                             | `Drag`                                                      |
| `boundaryElement`                 | `string`                                                         | `Drag`                                                      |
| `rootElementSelector`             | `string`                                                         | `Drag`                                                      |
| `draggingDisabled`                | `boolean`                                                        | `Drag`                                                      |
| `previewContainer`                | `"global" \| "parent"`                                           | `Drag`                                                      |
| `zIndex`                          | `number`                                                         | the preview (default `1000`)                                |
| `dragStartThreshold`              | `number`                                                         | pixels the pointer moves before a drag starts (default `5`) |
| `pointerDirectionChangeThreshold` | `number`                                                         | pixels before a change of direction counts (default `5`)    |
| `sortingDisabled`                 | `boolean`                                                        | `DropList`                                                  |
| `listAutoScrollDisabled`          | `boolean`                                                        | `DropList`                                                  |
| `listOrientation`                 | `"vertical" \| "horizontal" \| "mixed"`                          | `DropList`                                                  |

## API

Every component takes `id`, `class` (replaces the default `rv-*` class; the `cdk-*` class always stays), `style`, `children` and every global DOM attribute and event. Inputs take a value or an accessor / Signal, except the function-valued ones (`constrainPosition`, `enterPredicate`, `sortPredicate`), which are plain functions.

### Drag

| Prop                  | Type                                                             | Default    | Notes                                                                                                           |
| --------------------- | ---------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------- |
| `data`                | `T`                                                              | none       | Angular `cdkDragData`.                                                                                          |
| `lockAxis`            | `"x" \| "y" \| null`                                             | none       | Locks the movement to one axis.                                                                                 |
| `rootElementSelector` | `string`                                                         | none       | Ancestor that is dragged instead of the element.                                                                |
| `isHandle`            | `boolean`                                                        | `false`    | With `rootElementSelector`: the element is also a handle (Angular: `cdkDrag` + `cdkDragHandle` on one element). |
| `boundaryElement`     | `string \| element`                                              | none       | Element the item can't leave.                                                                                   |
| `dragStartDelay`      | `number \| { touch, mouse }`                                     | `0`        | Milliseconds the pointer is held down before the drag starts.                                                   |
| `freeDragPosition`    | `{ x, y }`                                                       | none       | Position of a free `Drag`.                                                                                      |
| `disabled`            | `boolean`                                                        | `false`    |                                                                                                                 |
| `constrainPosition`   | `(point, dragRef, dimensions, pickupPositionInElement) => Point` | none       | Custom position logic while dragging.                                                                           |
| `previewClass`        | `string \| string[]`                                             | none       | Class(es) added to the preview.                                                                                 |
| `previewContainer`    | `"global" \| "parent" \| element`                                | `"global"` | Where the preview is inserted.                                                                                  |
| `scale`               | `number`                                                         | `1`        | Scale transform of a parent, so positions stay right.                                                           |
| `elementType`         | `"div" \| "li" \| "tr" \| "span" \| "section" \| "article"`      | `"div"`    |                                                                                                                 |

| Event        | Payload                                                                | When                                                                        |
| ------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `onStarted`  | `DragStart` (`source`, `event`)                                        | The user starts dragging the item.                                          |
| `onReleased` | `DragRelease` (`source`, `event`)                                      | The user releases the item, before any animation.                           |
| `onEnded`    | `DragEnd` (`source`, `distance`, `dropPoint`, `event`)                 | The drag sequence ends.                                                     |
| `onEntered`  | `DragEnter` (`container`, `item`, `currentIndex`)                      | The item moves into a new container.                                        |
| `onExited`   | `DragExit` (`container`, `item`)                                       | The item leaves its container for another one.                              |
| `onDropped`  | `DragDrop`                                                             | The item is dropped in a container.                                         |
| `onMoved`    | `DragMove` (`source`, `pointerPosition`, `event`, `distance`, `delta`) | Every pointer move while dragging. Use with care: it fires for every pixel. |

`DragInstance` (`dragInstance(element)`): `data`, `getPlaceholderElement()`, `getRootElement()`, `reset()`, `resetToBoundary()`, `getFreeDragPosition()`, `setFreeDragPosition(point)`, the resolved inputs.

### DropList

| Prop                       | Type                                                           | Default       | Notes                                                            |
| -------------------------- | -------------------------------------------------------------- | ------------- | ---------------------------------------------------------------- |
| `connectedTo`              | `(DropListInstance \| string)[] \| DropListInstance \| string` | none          | Connected lists (instances or ids).                              |
| `data`                     | `T`                                                            | none          | Angular `cdkDropListData`.                                       |
| `orientation`              | `"vertical" \| "horizontal" \| "mixed"`                        | `"vertical"`  | `mixed` sorts a wrapping list in the DOM.                        |
| `lockAxis`                 | `"x" \| "y" \| null`                                           | none          | For every item of the list.                                      |
| `disabled`                 | `boolean`                                                      | `false`       |                                                                  |
| `sortingDisabled`          | `boolean`                                                      | `false`       | Items keep their order in this list.                             |
| `enterPredicate`           | `(drag, drop) => boolean`                                      | always `true` | Whether an item may enter.                                       |
| `sortPredicate`            | `(index, drag, drop) => boolean`                               | always `true` | Whether an item may move to `index`.                             |
| `autoScrollDisabled`       | `boolean`                                                      | `false`       |                                                                  |
| `autoScrollStep`           | `number`                                                       | `2`           | Pixels per frame while auto-scrolling.                           |
| `elementContainerSelector` | `string`                                                       | none          | Element that holds the items, when they are not direct children. |
| `hasAnchor`                | `boolean`                                                      | `false`       | Leave an anchor in the original slot (copying).                  |
| `elementType`              | `"div" \| "ul" \| "ol" \| "tbody" \| "section"`                | `"div"`       |                                                                  |

| Event       | Payload                                                                                                                                            | When                                     |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `onDropped` | `DragDrop` (`previousIndex`, `currentIndex`, `item`, `container`, `previousContainer`, `isPointerOverContainer`, `distance`, `dropPoint`, `event`) | An item is dropped in the list.          |
| `onEntered` | `DragEnter`                                                                                                                                        | An item enters the list.                 |
| `onExited`  | `DragExit`                                                                                                                                         | An item leaves the list for another one. |
| `onSorted`  | `DragSortEvent` (`previousIndex`, `currentIndex`, `container`, `item`)                                                                             | An item changes position while dragged.  |

`DropListInstance` (`dropListInstance(element)`): `data`, `getSortedItems()`, the resolved inputs.

### DropListGroup, DragHandle, DragPreview, DragPlaceholder

| Component         | Props                                                                    |
| ----------------- | ------------------------------------------------------------------------ |
| `DropListGroup`   | `disabled` (every list inside), `elementType` (`div` or `section`).      |
| `DragHandle`      | `disabled`, `elementType` (`div`, `span` or `button`).                   |
| `DragPreview`     | `matchSize` (the preview takes the size of the dragged element), `data`. |
| `DragPlaceholder` | `data`.                                                                  |

`DragPreview` and `DragPlaceholder` render an inert `<template>` inside the `Drag` (no layout, no requests); its nodes move into the preview / placeholder when a drag starts and back afterwards.

::api{symbol="@rivetjs/cdk/drag-drop#Drag"}

::api{symbol="@rivetjs/cdk/drag-drop#DropList"}

### Array helpers

| Function                                                                  | Does                                               |
| ------------------------------------------------------------------------- | -------------------------------------------------- |
| `moveItemInArray(array, fromIndex, toIndex)`                              | Moves an item to another index, in place.          |
| `transferArrayItem(currentArray, targetArray, currentIndex, targetIndex)` | Moves an item from one array to another, in place. |
| `copyArrayItem(currentArray, targetArray, currentIndex, targetIndex)`     | Copies an item into another array, in place.       |

The arrays are mutated: copy a signal's array first (`const next = items().slice()`), then `set` it.

## Accessibility

Angular CDK drag and drop is pointer only (mouse and touch): there is no keyboard or screen reader dragging, upstream or here. Give every drag interaction an alternative that every user can operate, such as move buttons or :kbd[Alt+ArrowUp] / :kbd[Alt+ArrowDown] shortcuts ([Keyboard shortcuts](../foundations/keyboard-shortcuts.md)), and announce the result in a live region ([Announcements](../foundations/announcements.md)). The [Kanban showcase](site:ui/showcase/kanban/) does both.

## Resumability

- Nothing runs before the first press: the server renders the elements with their classes, `data-*` attributes, handle styles and `freeDragPosition` transform; a `Drag` or `DropList` creates its instance from the props it captured when it is pressed. Handles, groups, previews and placeholders ship no code (they are found in the DOM).
- The components declare `preload = "visible"`: their code is fetched when they scroll into view, so the first drag after that starts synchronously. A press before the code arrived is replayed once it has loaded.
- Callbacks (`onDropped`, `enterPredicate`, `sortPredicate`, `constrainPosition`) must be inline arrows or local constants, like every resumable handler.
- A keyed `For` inside a `DropList` reorders the same elements after a drop on a resumed page.

## Upstream

- Ported from Angular Components `src/cdk/drag-drop` (engine 1:1, directives as components, upstream specs ported to `libs/cdk/tests`).
- Deviations: no dependency injection (`DragDropConfigContext` replaces `CDK_DRAG_CONFIG`; `dragInstance` / `dropListInstance` replace `@ViewChild`); RxJS subjects are emitters; `ng-template` previews / placeholders are `<template>` elements; the transfer between lists animates the items' layout shift (see [Customize animations](#customize-animations)).
- Not yet supported: the React Aria drag and drop (native HTML drag and drop, files, keyboard and screen reader dragging) planned for the same module.
