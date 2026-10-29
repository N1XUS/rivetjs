---
title: NavigationTree
description: NavigationTree from @rivetjs/cdk is a tree of links for sidebars; selectedRoute marks the current item and its ancestors, rendered on the server.
template: guide
status: experimental
related: [components/tree, components/link, foundations/collections]
---

`NavigationTree` is a [Tree](tree.md) of links: a `role="treegrid"` with no selection, :kbd[Tab] navigation (arrow keys work too) and one `Link` per item. Set `selectedRoute` to the current path: the item whose `href` matches gets `aria-current="page"` on its link and `data-current` on its row, its ancestors get `data-current-ancestor`, and the tree's focus moves to it. Wrap it in a `<nav aria-label="…">` when it is the page's main navigation.

::example{id=navigation-tree-basic}

## Anatomy

```html
<nav aria-label="Main">
  <div role="treegrid" id="sidebar" aria-label="Files" class="rv-NavigationTree">
    <div role="row" id="sidebar-files" aria-level="1" aria-expanded="true" data-href="/files"
         class="rv-NavigationTreeItem" data-expanded="true" data-has-child-items="true" data-current-ancestor="true" …>
      <div role="gridcell" style="display:contents">
        <button slot="chevron" id="sidebar-files-chevron" aria-label="Collapse" tabindex="-1" …>…</button>
        <a href="/files" class="rv-Link">Files</a>
      </div>
    </div>
    <div role="row" id="sidebar-photos" aria-level="2" class="rv-NavigationTreeItem" data-current="true" …>
      <div role="gridcell" style="display:contents"><a href="/photos" aria-current="page" class="rv-Link">Photos</a></div>
    </div>
  </div>
</nav>
```

```tsx
<NavigationTree>
  <NavigationTreeSection>
    <NavigationTreeHeader />
    <NavigationTreeItem>
      <NavigationTreeItemContent>
        <Link />
        <Button slot="chevron" />
      </NavigationTreeItemContent>
    </NavigationTreeItem>
  </NavigationTreeSection>
</NavigationTree>
```

| Part | Element | Default class | Notes |
| --- | --- | --- | --- |
| `NavigationTree` | `div[role=treegrid]` | `rv-NavigationTree` | A `Tree` with `selectionMode="none"`, `keyboardNavigationBehavior="tab"`. |
| `NavigationTreeItem` | `div[role=row]` | `rv-NavigationTreeItem` | A `TreeItem` with `allowsArrowNavigation`; `focusMode="child"` when it has an `href` (focusing the row focuses its link). |
| `NavigationTreeItemContent` | none (its children) | none | Provides the item's `href`, `aria-current` and focus tracking to the `Link` inside. |
| `Link` | `a` | `rv-Link` | From `@rivetjs/cdk/link`; gets the item's `href`, `target`, `rel`, … |
| `Button slot="chevron"` | `button` | `rv-Button` | Expand toggle, as in the Tree. |
| `NavigationTreeSection`, `NavigationTreeHeader` | `div[role=rowgroup]`, `div[role=row]` | `rv-NavigationTreeSection`, `rv-NavigationTreeHeader` | A `TreeSection` / `TreeHeader`. |

| Attribute | Where | Value |
| --- | --- | --- |
| `data-current` | row | `href` equals `selectedRoute` |
| `aria-current="page"` | link | the current item's link |
| `data-current-ancestor` | row | an ancestor (any level, expanded or not) of the current item |
| `data-focus-visible` | row | keyboard focus on the row or on its link |
| the Tree row attributes | row | `aria-level`, `aria-expanded`, `data-expanded`, `data-level`, `data-href`, `--tree-item-level`, … (see [Tree](tree.md#anatomy)) |

## Import

```ts
import {
  NavigationTree,
  NavigationTreeItem,
  NavigationTreeItemContent,
  NavigationTreeSection,
  NavigationTreeHeader,
} from "@rivetjs/cdk/navigation-tree";
import { Link, RouterProvider } from "@rivetjs/cdk/link";
```

## Props

### NavigationTree

The [Tree props](tree.md#tree) except the selection props (`selectionMode`, `selectionBehavior`, `selectedKeys`, `defaultSelectedKeys`, `onSelectionChange`, `disallowEmptySelection`, `disabledBehavior`), `keyboardNavigationBehavior`, `escapeKeyBehavior`, `shouldSelectOnPressUp`, `renderEmptyState` and `onAction`, plus:

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `selectedRoute` | `string \| null \| undefined`, or an accessor / Signal | none | The current route, matched against each item's `href`. |
| `class`, `style` | value or `(props: NavigationTreeRenderProps) => value` | `rv-NavigationTree` | |

Kept from Tree: `children`, `items`, `aria-label` / `aria-labelledby` / `aria-describedby` / `aria-details`, `expandedKeys`, `defaultExpandedKeys`, `onExpandedChange`, `disabledKeys`, `disallowTypeAhead`, `autoFocus`, `linkBehavior`, `direction`, `locale`, `id`, `slot`, `ref`, global DOM props.

`NavigationTreeRenderProps` (accessors): `isEmpty()`, `isFocused()`, `isFocusVisible()`, `state`.

### NavigationTreeItem

The [TreeItem props](tree.md#treeitem) except `onAction`, `allowsArrowNavigation` (always on) and `value`:

| Prop | Type | Notes |
| --- | --- | --- |
| `id`, `textValue`, `aria-label`, `isDisabled`, `hasChildItems` | | As TreeItem. |
| `href`, `hrefLang`, `target`, `rel`, `download`, `ping`, `referrerPolicy`, `routerOptions` | | Passed to the item's `Link`; `href` is matched against `selectedRoute`. |
| `focusMode` | `"row" \| "child"` | Default `"child"` with an `href`, else `"row"`. |
| `onHoverStart`, `onHoverEnd`, `onHoverChange` | | |
| `children` | `NavigationTreeItemContent`, child items, `Collection` | |
| `class`, `style` | value or function of `NavigationTreeItemRenderProps` | Default `rv-NavigationTreeItem`. |

`NavigationTreeItemRenderProps`: the `TreeItemRenderProps` plus `isCurrent()` and `isCurrentAncestor()`.

### NavigationTreeItemContent, NavigationTreeSection, NavigationTreeHeader

- `NavigationTreeItemContent`: `children`, content or `(props: NavigationTreeItemContentRenderProps) => content` (the item render props, with `isCurrent()` / `isCurrentAncestor()`).
- `NavigationTreeSection`: the `TreeSection` props except `value`; class `rv-NavigationTreeSection`.
- `NavigationTreeHeader`: the `TreeHeader` props; class `rv-NavigationTreeHeader`.

`NavigationTreeContext` (props for the NavigationTrees inside a component) and `NavigationTreeItemStateContext` (`{ isCurrentAncestor }` of the enclosing item) are exported for custom parts.

### Events

| Event | Fires |
| --- | --- |
| `onExpandedChange(keys)` | An item expanded or collapsed. |
| `Link` `onPress` and the router's `navigate` | A link was pressed (click, :kbd[Enter]). Without a `RouterProvider` the browser follows the `href`. |

## Current route

Each `NavigationTreeItem` takes an `href`. Pass the current path as `selectedRoute` (a value, an accessor or a signal): the matching item is marked, and when the route changes the tree's focused item moves to it (the closest visible ancestor when it is inside a collapsed item). With a client-side router, wrap the tree in a `RouterProvider` and pass the router's current path.

```tsx
<RouterProvider navigate={(href) => router.push(href)}>
  {() => (
    <NavigationTree aria-label="Docs" selectedRoute={() => router.pathname()}>
      …
    </NavigationTree>
  )}
</RouterProvider>
```

## Content

`NavigationTree` takes static items or `items` with an item renderer, like the Tree.

::example{id=navigation-tree-dynamic}

### Sections

`NavigationTreeSection` groups items under an optional `NavigationTreeHeader` (sections without a header need an `aria-label`).

```tsx
<NavigationTree aria-label="Workspace" selectedRoute={route}>
  <NavigationTreeSection>
    <NavigationTreeHeader>Personal</NavigationTreeHeader>
    <NavigationTreeItem href="/home" textValue="Home">
      <NavigationTreeItemContent>
        <Link>Home</Link>
      </NavigationTreeItemContent>
    </NavigationTreeItem>
  </NavigationTreeSection>
</NavigationTree>
```

:::warning
Sections do not render on the server yet (see [Tree sections](tree.md#sections)), so there is no live example here.
:::

## DOM events and attributes

`NavigationTree` props land on the treegrid, `NavigationTreeItem` props on the row, as for the [Tree](tree.md#dom-events-and-attributes). Link props (`href`, `target`, …) land on the `<a>`. `on…Capture` handlers work on resumed pages too, the first event included.

## Styling

| Selector | Matches | Tailwind |
| --- | --- | --- |
| `.rv-NavigationTree` | treegrid | `class` |
| `.rv-NavigationTreeItem[data-current]` | current item's row | `data-current:` |
| `.rv-NavigationTreeItem[data-current-ancestor]` | its ancestors | `data-current-ancestor:` |
| `[aria-current="page"]` | current link | `aria-[current=page]:` |
| `.rv-NavigationTreeItem[data-focus-visible]` | keyboard focus on the row or its link | `data-focus-visible:` |
| `.rv-NavigationTreeItem[data-expanded]`, `var(--tree-item-level)` | expanded, depth | `data-expanded:` |
| `.rv-NavigationTreeSection`, `.rv-NavigationTreeHeader` | section, header | `class` |

`@rivetjs/cdk/theme.css` has no `rv-NavigationTree*` rules yet.

## Accessibility

- A `role="treegrid"` without selection; name it with `aria-label`. As main navigation, put it in a `<nav>` landmark with its own `aria-label`.
- The current item's link has `aria-current="page"`.
- Items with an `href` focus their link (`focusMode="child"`), so screen readers announce a link.

### Keyboard

| Key | Action |
| --- | --- |
| :kbd[Tab], :kbd[Shift]+:kbd[Tab] | Next / previous item link (and the row's other buttons). |
| :kbd[ArrowDown], :kbd[ArrowUp] | Next / previous visible item. |
| :kbd[ArrowRight], :kbd[ArrowLeft] | Expand / collapse, or move to the parent. |
| :kbd[Enter] | Follow the focused link. |
| Letters | Typeahead on `textValue`. |

## Resumability

- The server renders the rows with `data-current`, `data-current-ancestor` and `aria-current` for the initial `selectedRoute`; no tree code runs before the first interaction.
- `selectedRoute` as a signal or accessor updates the marks in place.
- The route focus sync runs in a client effect.
- Known issue: an item without `href` that holds a `Link` (the link then toggles the item) does not resume yet; give every item an `href`.

## Upstream

| Rivet | Upstream |
| --- | --- |
| `NavigationTree`, `NavigationTreeItem`, `NavigationTreeItemContent`, `NavigationTreeSection`, `NavigationTreeHeader`, `NavigationTreeContext`, `NavigationTreeItemStateContext` | RAC `NavigationTree.tsx` |

Deviations:

- `render` passes through to `Tree`, `TreeItem`, `TreeSection` and `TreeHeader`. `TreeItem` adds `data-current`, `data-current-ancestor` and the link-driven `data-focus-visible` itself when it sits inside a NavigationTree.
- `selectedRoute` may be an accessor or a signal (a re-render in React).
- Render props are accessors; `class` is RAC `className`.

## Not yet supported

- `renderLink` / `NavigationTreeItemLink` of newer RAC releases: use `Link` inside `NavigationTreeItemContent`, routed by a `RouterProvider`.
- Sections in server-rendered pages; drag and drop (Tree has it: [Tree: drag and drop](tree.md#drag-and-drop)); virtualization.
