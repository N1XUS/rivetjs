// The flag `openLink` (`./links.tsx`) sets while it dispatches its synthetic click. A leaf module (DOCS-COLD
// 2026-10-20): focus-visible / usePress read it through `../interactions/utils.ts` without reaching the router module.

/** Set while `openLink` dispatches its event (react-aria's `openLink.isOpening`); read by usePress / focus-visible / collections. */
export const linkState = { isOpening: false };

/** Whether `openLink` is dispatching its synthetic click (item click handlers let it through). */
export const isOpeningLink = (): boolean => linkState.isOpening;
