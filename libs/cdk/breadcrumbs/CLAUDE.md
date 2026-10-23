# @rivetjs/cdk/breadcrumbs
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC Breadcrumbs: `<ol>` collection of `<Breadcrumb>` parts; each provides `LinkContext` (`aria-current="page"` + disabled on the last, `onPress` → `onAction(id)`) to the Link inside it.

## Entry points
- `@rivetjs/cdk/breadcrumbs` -> `index.tsx`: `Breadcrumbs`, `Breadcrumb`, `BreadcrumbsContext` (default null), types `BreadcrumbsProps<T>`, `BreadcrumbProps`, `BreadcrumbRenderProps`, `BreadcrumbsOverflowItem`, `Key`; re-exports `breadcrumbsProps`, `AriaBreadcrumbsProps`
- `@rivetjs/cdk/breadcrumbs/behaviour` -> `behaviour.ts`: `breadcrumbsProps(props)` (RA useBreadcrumbs: list attrs, localized default aria-label)
- `intl.ts`: generated from react-aria `intl/breadcrumbs` (all locales)

## Layout
- `index.tsx` - `Breadcrumbs<T>` (contextProps + `collectionOf` build, `CollectionRoot`), `Breadcrumb` = `createLeafComponent(BreadcrumbNode)`; internal `BreadcrumbsCollectionContext`
- `collapsingBreadcrumbs` (same file): `overflowMode="collapse"` path — `createOverflow({ collapse: "start" })` over the collection keys, one keyed `For` over `overflow.items()` (`OVERFLOW` → `<li class={overflowClass} data-overflow="true">{renderOverflow(hiddenItems())}</li>`, else `renderNodeAt`), `render` variant duplicated like the default path
- deps: `../collections/components.tsx` (B5 builder, `renderNodeAt`), `../link/index.tsx` (`LinkContext`), `../overflow/index.tsx`, `../interactions/merge-props.tsx` (`mergeRefs`), `../slots`, `../utils/data-attrs.tsx`
- tests: `tests/breadcrumbs.browser.test.tsx` (RAC Breadcrumbs.test.js port + Rivet), `tests/overflow.browser.test.tsx` (Spectrum Breadcrumbs collapsing port), `tests/overflow-ssr.test.ts`, `tests/pilots-ssr.test.ts` (RAC Breadcrumbs.ssr port, signal-driven items, Breadcrumb on* handler), `tests-components/links.test.ts`, `tests-components/dom-events-forms.test.ts`
- docs: `apps/cdk-docs/content/components/breadcrumbs.md`, examples `breadcrumbs-*`

## Rules / invariants
- `isCurrent` = `collection().getItem(key)?.nextKey == null` (live: appending moves current); Breadcrumb captures `key` / `isLast`, never `node`
- `isDisabled` (accessor ok) on Breadcrumbs → every Breadcrumb; current is always disabled
- resumable captures: collection content = object-literal fn (`build.content`), default renderer referenced by import (`customRenderer ?? DefaultCollectionRenderer`), LinkContext `aria-current` accessor passed through unchanged
- Overflow (Rivet addition, React Spectrum v3 Breadcrumbs): props `overflowMode` (`"wrap"` default = RAC, no measuring; `"collapse"`), `showRoot`, `maxVisibleItems` (default 4, `"auto"`), `defaultVisibleItems` (SSR), `renderOverflow(items: BreadcrumbsOverflowItem[])` (inline arrow), `overflowClass` (default `rv-Breadcrumb`); all read once. Hidden items = `{ key, textValue, href, props }`: `textValue` / `href` from the node (`Breadcrumb textValue`, an `href` prop) else read from the DOM while every item is shown (`onMeasureAll`: `textContent`, first `a[href]`). The current (last) breadcrumb never collapses. Measured `<ol>` = the caller's `ref()` when given (resumes), else an own `ref()` (a callback / object ref is merged in the browser only). Rows the overflow re-creates on a resumed page come from the captured collection, whose build pass the runtime re-runs under the providers that enclosed it on the server (captured computed `v`, RESUME-CTX 2026-10-09; before, it ran at the resume root and a wrapper reading a context in its body got the default). `@rivetjs/ui` `Breadcrumbs.Item` still reads its context at render time (class / children render props); check-example `breadcrumbs-overflow` asserts the slot classes.
- `data-current` / `data-disabled` on `<li>`; default classes `rv-Breadcrumbs` / `rv-Breadcrumb`; global DOM props → `<ol>` / `<li>`
- Live props (P5): `Breadcrumbs` body untracked; `liveOptions(props, ["isDisabled"])` → every Breadcrumb reads the accessor; a live `class` goes into the `<ol>` spread (`liveClass`); Breadcrumb class / style / children from a live view

## Gotchas
- `render` prop (RAC DOMRenderProps; `(attrs, renderProps)` → spread attrs; early return before the compiled element; `tests/render-collections.browser.test.tsx`) on Breadcrumbs (`ol`) and Breadcrumb (`li`)
- inherits Link gaps (../link/CLAUDE.md)

## See also
- [../CLAUDE.md](../CLAUDE.md) (Component conventions), [../link/CLAUDE.md](../link/CLAUDE.md)
