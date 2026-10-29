# libs/cdk/navigation-tree

`@rivetjs/cdk/navigation-tree`: RAC NavigationTree over `../tree` (selectionMode none, keyboardNavigationBehavior tab).

- Exports: NavigationTree (`selectedRoute` value or accessor/Signal), NavigationTreeItem (focusMode child when `href`, allowsArrowNavigation), NavigationTreeItemContent, NavigationTreeSection, NavigationTreeHeader, NavigationTreeContext, NavigationTreeItemStateContext.
- Default classes `rv-NavigationTree*`. Render props add `isCurrent()` / `isCurrentAncestor()`.
- Row attributes applied by TreeItem via `tree/navigation-context.tsx` (RAC `render` wrap not needed).
- Route focus sync: `clientEffect` in NavigationTreeItemContent: idle only when `selectedRoute` is set at render, else `interaction` (CEFF 2026-10-28). TreeItem's keep-current-row-visible effect: idle only for the server's current row.
- Tests: `tests/navigation-tree.browser.test.tsx` (port of RAC NavigationTree.test.tsx).
- Gotcha (open): a parent item without `href` whose content holds a `<Link>` crashes SSR (`renderLink capture #0 function is not serializable`; the `onPress` toggle closure); docs examples give every item an `href`.
- `render` passes through to Tree / TreeItem / TreeSection / TreeHeader (supported).
- NavigationTreeSection renders on the server (PRO-LAST 2026-10-29; was listed as an SSR crash).
