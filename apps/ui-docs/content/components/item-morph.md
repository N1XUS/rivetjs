---
title: ItemMorph
description: "An iOS-style item preview: a held, right-clicked or pressed list item lifts out of its list into a panel and morphs back when it closes."
template: reference
status: experimental
related: [components/list-box, components/morph, components/popover]
---

`ItemMorph` opens a panel from a list item: the user presses and holds a [ListBox](/components/list-box/) item (or right-clicks it, or presses :kbd[Shift+F10]), the row lifts out of the list and grows into a panel over a dimmed page, and the panel shrinks back into the row when it closes. Use it for a quick preview, a few actions or inline settings of one item, without leaving the list. For a panel that opens from a button, see [Morph](/components/morph/); for a menu of actions, see [Dropdown](/components/dropdown/). Behaviour and motion come from the [cdk item morph](site:cdk/components/listbox/#item-morph).

## Usage

```tsx
import { ListBox } from "@rivetjs/ui/list-box";
import { ItemMorph, itemMorphProps, useItemMorph } from "@rivetjs/ui/item-morph";

function Contacts() {
  const preview = useItemMorph({ trigger: ["longPress", "contextMenu"] });
  return (
    <>
      <ListBox aria-label="Contacts" selectionMode="single">
        <ListBox.Item id="bob" textValue="Bob" {...itemMorphProps(preview)}>
          Bob
        </ListBox.Item>
      </ListBox>
      <ItemMorph morph={preview}>{(key) => <p>Contact {String(key())}</p>}</ItemMorph>
    </>
  );
}
```

::example{id=list-box-item-morph-contacts}

## Anatomy

| Part | Element | Notes |
| --- | --- | --- |
| `useItemMorph(options)` | — | One morph state per list (`trigger`, `threshold`, `openKey`, `onOpenChange`). |
| `itemMorphProps(morph)` | — | Spread on every item that can open the panel. |
| `ItemMorph` (`.Root`) | backdrop + `div role="dialog"` | `.item-morph`, `.item-morph__backdrop`, `.item-morph__panel`. Its child is a render function of the open item's key (an accessor). |
| `ItemMorph.Close` | `button` (ui Button) | `data-slot="item-morph-close"`; morphs the panel back, then runs its own `onPress`. |
| `useItemMorphPanel()` | — | Inside the panel: `{ morph, key, close }`. |

## Examples

### Triggers

`trigger` takes one value or a list: `"longPress"` (default; a 500 ms hold, `threshold`; the row shrinks a little while held, and the hold never selects the item or runs its action), `"contextMenu"` (right click, or a long press on touch screens), `"press"` (the item's action, for lists without selection), `"doubleClick"`, or `"none"` (only the controlled `openKey` opens it). The ContextMenu key and :kbd[Shift+F10] open the panel for every trigger except `"none"`.

### Settings panel on press

With `trigger: "press"`, a press or :kbd[Enter] on a row opens its panel; here the panel holds Switches for the row's settings and uses a transparent backdrop.

::example{id=list-box-item-morph-settings}

### Controlled

`openKey` (a key or `null`, as a value or a two-way Signal) opens and closes the panel from outside; `onOpenChange(key | null)` reports every open and close.

### Backdrop and size

`backdrop` is `"blur"` (default), `"opaque"` or `"transparent"`; `hideBackdrop` removes it. `panelClass` sets the panel's width (and any other panel class).

## Styling Reference

| Class / attribute | Part |
| --- | --- |
| `.item-morph` | Root. |
| `.item-morph__backdrop` | Backdrop (blur, opaque or transparent variant). |
| `.item-morph__panel` | Panel. |
| `.item-morph__close` | Close button (`data-slot="item-morph-close"`). |
| `[data-morph-autofocus]` | Put it on the element inside the panel that should get the focus when it opens. |

## API Reference

See the [full module API](/api/rivetjs/ui/item-morph/) for every named export and part prop type.

| Prop       | Values                          | Default |
| ---------- | ------------------------------- | ------- |
| `backdrop` | `blur`, `opaque`, `transparent` | `blur`  |

::api{symbol="@rivetjs/ui/item-morph#ItemMorphCloseProps"}

::api{symbol="@rivetjs/ui/item-morph#ItemMorphRootProps"}

::api{symbol="@rivetjs/ui/item-morph#itemMorphProps"}

## Accessibility

- The panel is a `dialog` named by its row (or by `aria-label`). When it opens, the focus moves to `[data-morph-autofocus]`, else to the first focusable element; the rest of the page is `inert` and page scroll is locked.
- :kbd[Escape], a press on the backdrop, `ItemMorph.Close` and `close()` all morph the panel back and return the focus to the row.
- A long press is hard for some users: keep a second way in (`"contextMenu"` and :kbd[Shift+F10] are on by default), or use `trigger: "press"`.
- With reduced motion, the panel opens and closes without the morph.

## Common mistakes

- **One morph per item.** Create one `useItemMorph` per list and render one `ItemMorph`; the render function receives the key of the item that opened it.
- **Forgetting `itemMorphProps` on an item.** Only items with the spread props open the panel.
- **Building the panel content outside the render function.** Content in the function renders only when a panel opens; content outside renders with the page.

## Related Components

- [ListBox](/components/list-box/)
- [Morph](/components/morph/)
- [Popover](/components/popover/)
