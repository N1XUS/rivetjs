---
title: Tabs
description: "Tabs organize content into multiple sections and allow users to navigate between them."
template: reference
status: experimental
related: [components/breadcrumbs]
---

`Tabs` is the [cdk Tabs](site:cdk/components/tabs/) family with the Rivet UI look: `Tabs` = cdk `Tabs`, `Tabs.List` = cdk `TabList`, `Tabs.Tab` = cdk `Tab`, `Tabs.Panel` = cdk `TabPanel`, `Tabs.Indicator` = the cdk `SelectionIndicator` (one shared element that moves between the tabs). `Tabs.List` renders its container (a ScrollShadow with scroll buttons) and every `Tabs.Tab` its `Tabs.Indicator`, so a tab list is `Tabs.List` + `Tabs.Tab`s.

Notes:

- `class`, not `className`. `selectedKey` also takes a two-way signal (`signal<Key | null>`); a plain value is controlled and `onSelectionChange` still fires.
- Panel content is a render function (`{() => …}`) in the demos: on a resumed page the content of a panel that was not selected on the server is created in the browser when its tab is selected. Plain JSX works for the panel the server renders.
- Wrapper folds (Rivet): `Tabs.List` renders the list container itself; `container={false}` renders the bare tablist. `Tabs.Tab` appends a `Tabs.Indicator` after its children unless one renders inside it (a custom one; one that mounts later, e.g. inside `<Show>`, replaces the appended one) or `indicator={false}` is set on the Tab or the root `Tabs`.
- The scroll buttons use the lucide `ChevronLeft` / `ChevronRight` / `ChevronUp` / `ChevronDown` icons.
- Render Function demo: the tabs render a plain `<a>`; the cdk Tab renders a link for `href` and navigates through the cdk router. `render` functions receive accessor-valued attributes: type them `(props: Record<string, any>)`.

Accessibility: The list has `role="tablist"` with `aria-orientation`; each tab has `role="tab"`, `aria-selected` and, while selected, `aria-controls` for its panel (`role="tabpanel"`, labelled by the tab). Arrow keys move between tabs and select them (automatic activation; `keyboardActivation="manual"` selects on Enter / Space), Home / End jump to the ends, disabled tabs are skipped. The scroll buttons are out of the tab order (`tabIndex=-1`).

## Usage

```tsx
import { Tabs } from "@rivetjs/ui/tabs";
```

::example{id=tabs-basic}

## Anatomy

```tsx
import { Tabs } from "@rivetjs/ui/tabs";

export default () => (
  <Tabs>
    <Tabs.List aria-label="Options">
      {/* renders the list container (scroll buttons); container={false} for a bare list */}
      <Tabs.Tab>
        <Tabs.Separator /> {/* Optional */}
        {/* the Tabs.Indicator is appended (indicator={false} turns it off) */}
      </Tabs.Tab>
    </Tabs.List>
    <Tabs.Panel />
  </Tabs>
);
```

## Examples

### Vertical

::example{id=tabs-vertical}

### Overflow

When the tab list exceeds the available space, the list container that `Tabs.List` renders shows scroll chevrons and fading edges so users can navigate the hidden tabs. This works the same way for both horizontal and vertical orientations.

::example{id=tabs-overflow}

### Disabled Tab

::example{id=tabs-disabled}

### With Separator

Add `<Tabs.Separator />` inside each `<Tabs.Tab>` (except the first) to display separator lines between tabs.

::example{id=tabs-with-separator}

### Secondary Variant

::example{id=tabs-secondary}

### Secondary Variant Vertical

::example{id=tabs-secondary-vertical}

### Alignment

Tab content is centered by default. Use `align` to align it to the `start` or `end` instead, which is especially useful for vertical, sidebar-style navigation. Individual tabs can still be overridden with `class` on `Tabs.Tab`.

::example{id=tabs-vertical-alignment}

### Render Function

::example{id=tabs-render-function}

## Customization

### Tailwind CSS

::example{id=tabs-custom-styles}

### Global CSS

To customize the Tabs component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .tabs__list {
    @apply rounded-xl border border-border bg-surface p-1;
  }

  .tabs__tab {
    @apply rounded-lg font-medium;
  }

  .tabs__indicator {
    @apply rounded-lg bg-foreground shadow-sm;
  }

  .tabs--secondary > .tabs__list-container > .tabs__list {
    @apply border-b border-border bg-transparent p-0;
  }

  .tabs--secondary > .tabs__list-container .tabs__indicator {
    @apply rounded-none bg-accent;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The Tabs component uses these CSS classes ([View source styles](https://github.com/rivetjs/rivet/blob/main/libs/ui/styles/components/tabs.css)):

#### Base Classes

- `.tabs` - Base tabs container
- `.tabs__list-container` - Tab list container wrapper
- `.tabs__list-container__scroller` - Scrollable wrapper around the tab list (handles overflow and fading edges)
- `.tabs__list-container__scroll-prev` - Scroll chevron button for the previous (left / up) direction
- `.tabs__list-container__scroll-next` - Scroll chevron button for the next (right / down) direction
- `.tabs__list` - Tab list container
- `.tabs__tab` - Individual tab button
- `.tabs__separator` - Separator between tabs
- `.tabs__panel` - Tab panel content
- `.tabs__indicator` - Tab indicator

#### Orientation Attributes

- `.tabs[data-orientation="horizontal"]` - Horizontal tab layout (default)
- `.tabs[data-orientation="vertical"]` - Vertical tab layout

#### Variant Classes

- `.tabs--secondary` - Secondary variant with underline indicator

#### Alignment Classes

- `.tabs--align-start` - Aligns tab content to the start
- `.tabs--align-end` - Aligns tab content to the end

### Interactive States

The component supports both CSS pseudo-classes and data attributes:

- **Selected**: `[aria-selected="true"]`
- **Hover**: `:hover` or `[data-hovered="true"]`
- **Focus**: `:focus-visible` or `[data-focus-visible="true"]`
- **Disabled**: `[aria-disabled="true"]`

## API Reference

### Tabs

| Prop                 | Type                                        | Default        | Description                                                                                  |
| -------------------- | ------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------- |
| `variant`            | `"primary" \| "secondary"`                  | `"primary"`    | Visual style variant. Primary uses a filled indicator, secondary uses an underline indicator |
| `orientation`        | `"horizontal" \| "vertical"`                | `"horizontal"` | Tab layout orientation (read once)                                                           |
| `align`              | `"start" \| "center" \| "end"`              | `"center"`     | Alignment of the content inside each tab                                                     |
| `selectedKey`        | `Key \| null \| Signal<Key \| null>`        | -              | Controlled selected tab key (a signal is two-way)                                            |
| `defaultSelectedKey` | `Key`                                       | -              | Default selected tab key                                                                     |
| `onSelectionChange`  | `(key: Key) => void`                        | -              | Selection change handler                                                                     |
| `disabledKeys`       | `Iterable<Key>`                             | -              | Keys of the disabled tabs                                                                    |
| `isDisabled`         | `boolean`                                   | `false`        | Whether every tab is disabled                                                                |
| `keyboardActivation` | `"automatic" \| "manual"`                   | `"automatic"`  | Whether tabs are selected on focus or on Enter / Space                                       |
| `class`              | `string`                                    | -              | Additional CSS classes                                                                       |
| `render`             | `DOMRenderFunction<"div", TabsRenderProps>` | -              | Overrides the default DOM element with a custom render function.                             |
| `indicator`          | `boolean`                                   | `true`         | Rivet: `false` turns off the indicator each `Tabs.Tab` appends                               |

### Tabs.List

The List renders the `div.tabs__list-container` around itself. To style it, wrap the List in `Tabs.ListContainer`: its `class`, `render` and `div` attributes apply to that container.

| Prop         | Type                                           | Default | Description                                                          |
| ------------ | ---------------------------------------------- | ------- | -------------------------------------------------------------------- |
| `aria-label` | `string`                                       | -       | Accessibility label for tab list                                     |
| `container`  | `boolean`                                      | `true`  | Rivet: render the list container (read once); `false` = bare tablist |
| `class`      | `string`                                       | -       | Additional CSS classes                                               |
| `render`     | `DOMRenderFunction<"div", TabListRenderProps>` | -       | Overrides the default DOM element with a custom render function.     |

### Tabs.Tab

| Prop         | Type                                       | Default    | Description                                                                   |
| ------------ | ------------------------------------------ | ---------- | ----------------------------------------------------------------------------- |
| `id`         | `Key`                                      | -          | Unique tab identifier                                                         |
| `isDisabled` | `boolean`                                  | `false`    | Whether tab is disabled                                                       |
| `href`       | `string`                                   | -          | Renders the tab as a link                                                     |
| `indicator`  | `boolean`                                  | the root's | Rivet: append a `Tabs.Indicator` (skipped when one renders inside; read once) |
| `class`      | `string \| (values) => string`             | -          | Additional CSS classes (a function gets the cdk render props)                 |
| `render`     | `DOMRenderFunction<"div", TabRenderProps>` | -          | Overrides the default DOM element with a custom render function.              |

### Tabs.Separator

| Prop    | Type     | Default | Description            |
| ------- | -------- | ------- | ---------------------- |
| `class` | `string` | -       | Additional CSS classes |

### Tabs.Panel

| Prop               | Type                                            | Default | Description                                                      |
| ------------------ | ----------------------------------------------- | ------- | ---------------------------------------------------------------- |
| `id`               | `Key`                                           | -       | Panel identifier matching tab id                                 |
| `shouldForceMount` | `boolean`                                       | `false` | Keep the panel mounted (inert) while not selected                |
| `class`            | `string`                                        | -       | Additional CSS classes                                           |
| `render`           | `DOMRenderFunction<"div", TabPanelRenderProps>` | -       | Overrides the default DOM element with a custom render function. |

::api{symbol="@rivetjs/ui/tabs#TabsRootProps"}

## Related Components

- [Breadcrumbs](/components/breadcrumbs/): Display the user's current location within a hierarchy.
