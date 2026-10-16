# @rivetjs/cdk/link
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC Link: `<a href>` (or `<span role="link">` without href / disabled) with RA press, hover, focus ring and `RouterProvider` client routing.

## Entry points
- `@rivetjs/cdk/link` -> `index.tsx`: `Link`, `LinkContext` (id `rv-link`, default null), types `LinkProps`, `LinkRenderProps`, `PressEvent`; re-exports from `router.ts` (= `../utils/links.tsx`): `RouterProvider`, `createRouter`, `openLink`, `routerHref`, `RouterContext`, `shouldClientNavigate`, `useRouter`, types `Href`, `LinkDOMProps`, `Router`, `RouterOptions`, `RouterProviderProps`
- `@rivetjs/cdk/link/behaviour` -> `behaviour.ts`: `linkProps(props, router?)`, `ariaCurrentAttr`, handlers `linkClick(e, o, router, href, routerOptions)`, `linkKeyDown`, `linkPointerDown`, `linkPointerUp`, `linkMouseDown`, `linkDragStart` (`(e, pressOptions)`), types `AriaLinkBaseProps`, `AriaLinkProps`, `AriaLinkOptions`
- `router.ts`: not a subpath; re-export shim of `../utils/links.tsx`

## Layout
- `index.tsx` - `Link` (contextProps LinkContext, `mergeFocusableContext` FocusableContext, `renderLink` picks `<a>` / `<span>`; accessor `isDisabled` → `{() => relink(...)}` re-creates the element)
- tests: `tests/link.browser.test.tsx` (RAC Link.test.js port), `tests/pilots-ssr.test.ts` (FocusableContext attrs SSR), `tests-components/links.test.ts`, `tests-components/dom-events-forms.test.ts`
- docs: `apps/cdk-docs/content/components/link.md`, examples `link-*`

## Rules / invariants
- `OWNED = ["onClick", "onPointerDown", "onPointerUp", "onMouseDown", "onPointerEnter", "onPointerLeave", "onPointerOver", "style"]`; own handlers in an object literal (`handlers`), user ones chained after; delegated hover / focus wiring as Button (`hoverStateOver`, `focusStateIn`), dragstart only during a press (`pressOf` `track`; `linkDragStart` stays exported for custom elements)
- press callbacks destructured into locals before closures (PROPS-CAPTURE)
- `aria-current` / `aria-label` / `aria-labelledby` may be accessors; `linkProps` keeps accessor identity (a wrapper made in a `.ts` module does not resume) — bind with `ariaCurrentAttr(read(v))`
- states `data-hovered` / `data-pressed` / `data-focused` / `data-focus-visible` written by handlers; `data-current`, `data-disabled` bindings
- disabled → `<span role="link" aria-disabled="true">`, href kept; custom router: `linkClick` → `handleLinkClick`

## Gotchas
- first press lost after another component resumed (gaps.md); `render` prop via `renderElement` (`LinkRenderProps`; `<a>` or `<span role="link">` default)

## See also
- [../CLAUDE.md](../CLAUDE.md) (Component conventions), [../breadcrumbs/CLAUDE.md](../breadcrumbs/CLAUDE.md), [../button/CLAUDE.md](../button/CLAUDE.md)
