---
title: Tabs
description: Tabs, TabList, Tab, TabPanels and TabPanel from @rivetjs/cdk (React Aria Components port): keyboard navigation, link tabs and an items preset.
template: guide
status: experimental
related: [components/overview, components/disclosure, foundations/keyboard-navigation, foundations/selection]
---

`Tabs` is a port of React Aria Components `Tabs` / `TabList` / `Tab` / `TabPanels` / `TabPanel` (with react-aria `useTabList` / `useTab` / `useTabPanel` and react-stately `useTabListState`). Compose the parts: a `TabList` of `Tab`s and one `TabPanel` per tab, matched by `id`. Only the selected panel is rendered (RAC), unless a panel has `shouldForceMount`. The selected key can be a signal. No library code runs until the first interaction with the tablist. For tabs from data, the [items preset](#items-preset) renders the same parts from an `items` array.

::example{id=tabs-basic}

## Anatomy

```tsx
import { Tab, TabList, TabPanel, TabPanels, Tabs } from "@rivetjs/cdk/tabs";

<Tabs>
  <TabList aria-label="…">
    <Tab id="a">…</Tab>
  </TabList>
  <TabPanels>
    <TabPanel id="a">{() => …}</TabPanel>
  </TabPanels>
</Tabs>
```

`TabPanels` is optional: put `TabPanel`s straight into `Tabs`, or group them in `TabPanels` to animate the panel size (see [Animated panels](#animated-panels)).

```html
<div id="product" class="rv-Tabs" data-orientation="horizontal">
  <div id="product-tablist" role="tablist" class="rv-TabList" aria-label="Product" aria-orientation="horizontal" data-orientation="horizontal" data-collection="product" data-rk="ArrowLeft ArrowRight Home End Space Enter">
    <div id="product-tab-overview" role="tab" class="rv-Tab" data-key="overview" aria-selected="true" aria-controls="product-tabpanel-overview" tabindex="0" data-selected="true">Overview</div>
    <div id="product-tab-specs" role="tab" class="rv-Tab" data-key="specs" aria-selected="false" tabindex="-1">Specs</div>
    <div id="product-tab-reviews" role="tab" class="rv-Tab" data-key="reviews" aria-selected="false" aria-disabled="true" data-disabled="true">Reviews</div>
  </div>
  <div id="product-tabpanel-overview" role="tabpanel" class="rv-TabPanel" aria-labelledby="product-tab-overview" tabindex="0"><p>Overview</p></div>
</div>
```

| Part | Element | Default class | Id |
| --- | --- | --- | --- |
| `Tabs` | `div` | `rv-Tabs` | `id` (base of the other ids; generated when omitted) |
| `TabList` | `div[role=tablist]` | `rv-TabList` | `<id>-tablist` |
| `Tab` | `div[role=tab]`, or `a[role=tab]` with `href` | `rv-Tab` | `<id>-tab-<key>` |
| `TabPanels` | `div` | `rv-TabPanels` | none |
| `TabPanel` | `div[role=tabpanel]` | `rv-TabPanel` | `<id>-tabpanel-<key>` (while selected) |

Keys are escaped into the ids, so any string or number works as a key.

## Import

```tsx
import { Tab, TabList, TabPanel, TabPanels, Tabs, type Key, type TabItem } from "@rivetjs/cdk/tabs";
```

## Props

### Tabs

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `selectedKey` | `Key \| null \| Signal<Key \| null>` | none | A signal: two-way. A plain value: controlled (never written; `onSelectionChange` still fires). |
| `defaultSelectedKey` | `Key` | the first enabled tab | Initial key (uncontrolled). |
| `onSelectionChange` | `(key: Key) => void` | none | Every selection, also a repeated press of the selected tab. Not called for the default selection. |
| `disabledKeys` | `Iterable<Key>` | none | Tabs that cannot be focused or selected. |
| `isDisabled` | `boolean` | `false` | Disables every tab (the selection is kept). |
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` | Vertical tablists also answer :kbd[ArrowUp] / :kbd[ArrowDown]. |
| `keyboardActivation` | `"automatic" \| "manual"` | `"automatic"` | Automatic: moving focus selects. Manual: :kbd[Enter] or :kbd[Space] selects. |
| `id` | `string` | generated | Base of the tablist, tab and panel ids. |
| `class`, `style` | value or `(renderProps) => value` | `rv-Tabs` | Render props: `orientation()`. |
| `children` | parts, or `(renderProps) => parts` | none | |
| `render` | `(props, renderProps) => element` | none | Your own root element (spread `props`). |
| `items`, `tab`, `panel`, `aria-label`, `aria-labelledby` | | | The [items preset](#items-preset). |
| `dir`, `lang`, `hidden`, `inert`, `translate`, `on*` | `GlobalDOMAttributes` | none | Forwarded to the root element. |

### TabList

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-details` | `string` | none | Name the tablist. |
| `items` | `Iterable<T>` or accessor | none | Data for a `(item) => <Tab …>` children renderer (ids default to `item.id`). |
| `children` | `Tab`s, or `(item) => Tab` | none | |
| `class`, `style` | value or `(renderProps) => value` | `rv-TabList` | Render props: `orientation()`, `state`. |
| `render` | `(props, renderProps) => element` | none | Your own tablist element. |
| global DOM props | `GlobalDOMAttributes` | none | `onKeyDown`, `onPointerDown`, `onFocusIn` / `onFocusOut` are owned (yours run after). |

### Tab

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `id` | `Key` | `item.id` inside `TabList items` | Matches the `TabPanel` `id`. |
| `isDisabled` | `boolean` | `false` | |
| `textValue` | `string` | the text children | `data-text`. |
| `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-details` | `string` | none | For icon tabs. |
| `href`, `hrefLang`, `target`, `rel`, `download`, `ping`, `referrerPolicy`, `routerOptions` | link props | none | A link tab: `<a role="tab">`, see [Link tabs](#link-tabs). |
| `onPress`, `onPressStart`, `onPressEnd`, `onPressChange`, `onPressUp`, `onClick` | press events | none | RA `usePress`. |
| `onHoverStart`, `onHoverEnd`, `onHoverChange` | hover events | none | |
| `onFocus`, `onBlur`, `onFocusChange` | focus events | none | |
| `class`, `style`, `children` | value or `(renderProps) => value` | `rv-Tab` | Render props: `isSelected()`, `isFocused()`, `isFocusVisible()`, `isHovered()`, `isPressed()`, `isDisabled()`. |
| `render` | `(props, renderProps) => element` | none | Your own tab element. |

### TabPanels

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `items` | `Iterable<T>` or accessor | none | Data for a `(item) => <TabPanel …>` children renderer. |
| `children` | `TabPanel`s, or `(item) => TabPanel` | none | |
| `class`, `style` | value | `rv-TabPanels` | |
| `render` | `(props) => element` | none | |

### TabPanel

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `id` | `Key` | `item.id` inside `TabPanels items` | The tab it belongs to. |
| `shouldForceMount` | `boolean` | `false` | Keep the panel in the DOM while its tab is not selected (then `inert`, without role and id). |
| `children` | content, or `(renderProps) => content` | none | Panels of tabs that are not selected at first: render-function children (`{() => …}`), see [Resumability](#resumability). |
| `class`, `style` | value or `(renderProps) => value` | `rv-TabPanel` | Render props: `isFocused()`, `isFocusVisible()`, `isInert()`, `isEntering()`, `isExiting()`, `state`. |
| `render` | `(props, renderProps) => element` | none | Your own panel element. |
| `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-details`, global DOM props | | none | `inert`, `onFocus`, `onBlur` are owned. |

## Selection

### Controlled and uncontrolled

Pass a `Signal<Key | null>` as `selectedKey` to own the selection: set it from anywhere and the tabs follow; the tab stop (`tabindex="0"`) moves with it while the tablist is not focused. Without it, `defaultSelectedKey` picks the first tab; when nothing is selected or the key is not one of the tabs, the first enabled tab is selected (react-stately `useTabListState`). A tab is always selected: user input never empties the selection. Number keys keep their type.

::example{id=tabs-controlled}

### Events

`onSelectionChange` is called with the key on every selection, including a repeated press of the selected tab.

::example{id=tabs-events}

## Keyboard activation

By default focus and selection move together (automatic activation). With `keyboardActivation="manual"`, arrow keys only move focus, and :kbd[Enter] or :kbd[Space] selects. Use manual activation when showing a panel is expensive. Pointer presses always select.

::example{id=tabs-manual}

## Orientation

`orientation="vertical"` sets `aria-orientation` and `data-orientation` (use it for layout) and adds :kbd[ArrowUp] / :kbd[ArrowDown]. :kbd[ArrowLeft] / :kbd[ArrowRight] keep working in both orientations (React Aria `TabsKeyboardDelegate`).

::example{id=tabs-orientation}

In right-to-left text the horizontal arrows are mirrored: :kbd[ArrowLeft] moves to the next tab. The direction is read from the tablist (`dir` on any ancestor, or on `Tabs` itself).

::example{id=tabs-rtl}

## Disabled

Disable one tab with its `isDisabled`, several with `disabledKeys`, or all of them with `isDisabled` on `Tabs`. Disabled tabs have `aria-disabled="true"`, `data-disabled` and no `tabindex`; keyboard navigation skips them and presses are ignored. The default selection skips them too; when every tab is disabled the first one stays selected. The example renders the tabs and panels from `items` (`TabList items` + `TabPanels items` with a renderer).

::example{id=tabs-disabled}

## Link tabs

A `Tab` with `href` renders as `<a role="tab">`. A click or :kbd[Enter] opens the link through the router in scope: `@rivetjs/router` intercepts same-origin links, `RouterProvider` from `@rivetjs/cdk/link` routes through a custom `navigate`. Cross-origin links, `target` other than `_self`, `download` and modifier-key presses open natively. Link tabs never select themselves on press (React Aria `linkBehavior: "selection"`): drive `selectedKey` from the current URL. Mouse presses navigate on click, not on press down.

::example{id=tabs-links}

## Nested tabs

A panel can hold another `Tabs`. Each tablist keeps its own keyboard navigation, selection and ids (give the inner ones distinct `id`s).

::example{id=tabs-nested}

## Items preset

`items` on `Tabs` (no children) renders the same parts from data: a `TabList` with one `Tab` per item and, with a `panel` slot, a `TabPanels` with one force-mounted `TabPanel` per item. Every panel is in the server HTML (inactive ones `hidden` and `inert`), so find-in-page and search engines see all of them. Omit `panel` for URL-driven link tabs whose route renders the content.

| Prop | Type | Notes |
| --- | --- | --- |
| `items` | `readonly TabItem[]` | `{ id, label?, textValue?, isDisabled?, "aria-label"?, href?, target?, rel?, download?, … }`. |
| `tab` | `(item: TabItem) => content` | Content of each tab (default `label`, else `textValue`). |
| `panel` | `(item: TabItem) => content` | Content of each panel. |
| `aria-label`, `aria-labelledby` | `string` | Passed to the `TabList`. |

::example{id=tabs-slots}

## Animated selection indicator

Render a `<SelectionIndicator />` (`@rivetjs/cdk/selection-indicator`, RAC `SelectionIndicator`) inside each `Tab`. It renders in the selected tab only; when the selection changes it moves to the new tab, and every CSS property listed in its `transition-property` animates from the previous tab's indicator. Include `translate` to animate the position (`width` / `height` for tabs of different sizes).

- Position the indicator against its tab (`position: relative` on the tab, `position: absolute` on `.rv-SelectionIndicator`).
- `data-entering` is set for one frame when it appears with no previous indicator, `data-exiting` while it leaves with no next one; style them for a fade or slide.
- Respect reduced motion: `@media (prefers-reduced-motion: reduce) { .rv-SelectionIndicator { transition: none } }`, or Tailwind `motion-safe:transition-[translate,width]`.
- The `TabList` is a `SharedElementTransition` scope; each `Tab` provides `SelectionIndicatorContext` with an `isSelected` accessor, so no tab re-renders.
- Resumed pages: the indicator is server-rendered in the selected tab; its code loads with the first selection change, which animates from the server-rendered position.

::example{id=tabs-indicator}

::example{id=tabs-indicator-css}

## Animated panels

`TabPanel` sets `data-entering` when it appears and `data-exiting` while it leaves (the panel stays until its CSS animations finish), for panels created in the browser. `TabPanels` sets `--tab-panel-width` / `--tab-panel-height` from the previous to the next panel size when its CSS `transition` lists `width`, `height`, `inline-size`, `block-size` or `all`: write `.rv-TabPanels { transition: height 200ms; height: var(--tab-panel-height) }`.

## DOM events and attributes

Every part takes the global DOM events and attributes (`GlobalDOMAttributes` from `@rivetjs/cdk/dom-props`: mouse, touch, pointer, scroll, wheel, animation and transition events with their `…Capture` forms, plus `dir`, `lang`, `hidden`, `inert`, `translate`) and forwards them to its own element. A tab's press handling (RA `usePress`) stops the propagation of its clicks, so a `TabList` `onClick` sees no tab clicks (like RAC); double clicks and pointer events bubble.

::example{id=tabs-dom-events}

`on…Capture` handlers do not resume yet.

## Styling

| Selector | Matches | Tailwind |
| --- | --- | --- |
| `.rv-Tabs[data-orientation="vertical"]` | vertical root (also on the tablist) | `orientation-vertical:` (from `@rivetjs/cdk/tailwind.css`) |
| `.rv-Tabs[data-disabled]` | root with `isDisabled` | `data-disabled:` |
| `.rv-Tabs[data-focus-visible]` | keyboard focus inside the tabs | `data-focus-visible:` |
| `.rv-Tab[data-selected]` | selected tab | `data-selected:` |
| `.rv-Tab[data-disabled]` | disabled tab | `data-disabled:` |
| `.rv-Tab[data-hovered]`, `[data-pressed]` | hovered / pressed tab | `data-hovered:`, `data-pressed:` |
| `.rv-Tab[data-focus-visible]` | keyboard-focused tab | `data-focus-visible:` |
| `.rv-TabPanel[data-focus-visible]` | panel reached with :kbd[Tab] | `data-focus-visible:` |
| `.rv-TabPanel[data-entering]`, `[data-exiting]` | panel transitions | `data-entering:`, `data-exiting:` |
| `.rv-TabPanel[data-inert]` | force-mounted panel of an unselected tab | `data-inert:` |

`class` / `style` replace the default class names (or compute them from the render props); the attributes stay. `aria-selected` and `aria-disabled` work as selectors too.

### Tailwind

::example{id=tabs-tailwind}

### Plain CSS

::example{id=tabs-css}

### Starter theme

`@rivetjs/cdk/theme.css` (imported by the first example on this page) gives the tablist an underline, the selected tab an accent border, a vertical layout for `data-orientation="vertical"` and a focus ring. Its rules use `:where(…)`, so any rule of yours wins.

## Custom elements

Each part takes `render`: return your own element and spread the props it receives (ARIA attributes, handlers, reactive attributes as accessors). `render` must be an inline arrow.

::example{id=tabs-custom}

`@rivetjs/cdk/tabs/behaviour` holds the react-aria handlers the parts run (`tabListKeyDown`, `tabListPointerDown`, `tabListFocusIn` / `tabListFocusOut`, `tabPressStart` / `tabPressUp` / `tabPress`, `tabClick`), the ids (`tabId`, `tabPanelId`), the readers (`isTabSelected`, `isTabDisabled`, `tabSelected`, `tabTabIndex`), `syncPanelTabIndex` and `TabsKeyboardDelegate`. `@rivetjs/cdk/state/tabs` exports `createTabListState(options)`, `selectTab(state, key)`, `effectiveFocusedKey(state)`, `setTabFocusedKey`, `findDefaultSelectedKey` and `TabListState`.

## Accessibility

- The tablist is `role="tablist"` with `aria-orientation`; name it with `aria-label` or `aria-labelledby`.
- Each tab is `role="tab"` with `aria-selected`; the selected one has `aria-controls`, its panel is `role="tabpanel"` named by the tab (`aria-labelledby`).
- Roving tabindex: the tablist is one tab stop. :kbd[Tab] moves from the selected tab into its panel; the panel itself is focusable only while it has no tabbable content.
- Force-mounted panels of unselected tabs are `inert`: no focus, no screen reader access.
- Disabled tabs stay in the reading order with `aria-disabled="true"`.

### Keyboard

| Key | Action |
| --- | --- |
| :kbd[ArrowRight], :kbd[ArrowLeft] | Next or previous enabled tab, wrapping at the ends. Mirrored in right-to-left text. Both orientations. |
| :kbd[ArrowDown], :kbd[ArrowUp] | Next or previous enabled tab, for `orientation="vertical"` only. |
| :kbd[Home], :kbd[End] | First or last enabled tab. |
| :kbd[Enter], :kbd[Space] | Manual activation: select the focused tab. Link tabs: follow the link. |
| :kbd[Tab] | From the tablist to the selected panel (or its first tabbable element). |

There is no typeahead (React Aria's `TabsKeyboardDelegate` has none). Pointer: a mouse press selects on press down; touch and pen select on release; link tabs navigate on click. Screen reader (virtual) clicks select.

## Resumability

- The server renders the tablist, the tab stop and the selected panel. Before the first interaction the page runs no tabs code; the tablist's `data-rk` keys are held while the handler chunk loads.
- State is signals plus JSON (`createTabListState`), so a `selectedKey` signal, number keys and the focused key resume as they were.
- A `TabPanel` whose tab is not selected on the server is created later, in the browser: give it render-function children (`<TabPanel id="b">{() => <p>…</p>}</TabPanel>`), plain JSX children do not resume there. `Tab` children and the selected panel may be plain JSX.
- `on…Capture` handlers do not resume yet.

## Testing

`@rivetjs/testing/user` ships the ported `TabsTester` (React Aria test-utils): `user.createTester("Tabs", { root, interactionType?, direction? })`, then `getTabs()`, `getTablist()`, `getTabpanels()`, `getSelectedTab()`, `getActiveTabpanel()`, `findTab({ indexOrText })` and `triggerTab({ tab, interactionType?, manualActivation? })`.

```tsx
import { render } from "@rivetjs/runtime/testing";
import { User } from "@rivetjs/testing/user";
import { Tab, TabList, TabPanel, Tabs } from "@rivetjs/cdk/tabs";

render(() => (
  <Tabs id="t">
    <TabList aria-label="Views">
      <Tab id="a">A</Tab>
      <Tab id="b">B</Tab>
    </TabList>
    <TabPanel id="a">A panel</TabPanel>
    <TabPanel id="b">{() => "B panel"}</TabPanel>
  </Tabs>
));
const tabs = new User({ interactionType: "keyboard" }).createTester("Tabs", { root: document.getElementById("t")! });
await tabs.triggerTab({ tab: "B" });
expect(tabs.getSelectedTab()?.textContent).toBe("B");
```

## Upstream

| Rivet | Upstream |
| --- | --- |
| `Tabs`, `TabList`, `Tab`, `TabPanels`, `TabPanel`, `TabsContext`, `TabListStateContext` | RAC `Tabs.tsx` |
| `@rivetjs/cdk/tabs/behaviour` | react-aria `useTabList`, `useTab`, `useTabPanel` (ids from `generateId`) |
| `TabsKeyboardDelegate` | react-aria `TabsKeyboardDelegate` |
| `@rivetjs/cdk/state/tabs` | react-stately `useTabListState` / `useSingleSelectListState` |

Deviations:

- `items` on `Tabs` is a Rivet preset over the parts (force-mounted panels, `hidden` + `inert`).
- The default selection is computed when the state is created (a build pass over the children) and does not call `onSelectionChange` (useTabListState fires it from a mount effect).
- Tab and panel ids derive from the `Tabs` `id` (`<id>-tab-<key>`), not from `useId` per collection.
- The keyboard delegate reads the text direction from the DOM, not from the `I18nProvider` locale.
- Panel enter / exit animations and the `TabPanels` size variables run for parts created in the browser (none on the server-rendered panel before the first change).

## Common mistakes

- **Plain JSX children on a panel that is not selected at first.** It is created in the browser on selection; on a resumed page plain JSX there cannot be rebuilt. Use `{() => …}`.
- **A `TabPanel` `id` without a matching `Tab`.** The panel never shows.
- **Tabs for page navigation without `href`.** For tabs that change the URL, give the tabs `href` and drive `selectedKey` from the route.
- **Two `Tabs` with the same `id`.** Tab and panel ids collide; nested tabs need their own `id`.
