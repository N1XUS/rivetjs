// Rivet-only helper (no HeroUI counterpart). Apache-2.0 port tree (© 2025 NextUI Inc. for the ported files).
// Shorthand precedence (identity spec §4.2): explicit `children` win over the shorthand props (`label` / `description` /
// `errorMessage` / `placeholder` / `items`); the shorthand is ignored. Reached only through the dev hooks object (`dev-on.ts`
// `DEV.shorthandIgnored` / `DEV.itemsIgnored`, call sites `if (DEV && …)`): production builds (`dev-off.ts`, `DEV = false`) never
// import this module.

const warned = new Set<string>();

/** Dev warning (once per component) when `children` and any shorthand prop in `keys` are both given (call only when
 *  `children` is defined). Once: a server slot probe renders field children twice. */
export function warnShorthandIgnored(component: string, props: object, keys: readonly string[]): void {
  if (warned.has(component)) return;
  for (let i = 0; i < keys.length; i++) {
    if ((props as Record<string, unknown>)[keys[i]!] !== undefined) {
      // eslint-disable-next-line no-console
      warned.add(component);
      console.warn(`[rivet ui] ${component}: children and label/items both given; children win`);
      return;
    }
  }
}

/** Dev warning (once per component) when a picker root gets `items` next to compound (slot) children: the compound form
 *  renders and `items` is ignored. */
export function warnItemsIgnored(component: string): void {
  // Own key: a Select that already warned about `label` + children still warns about `items` + compound children.
  const key = `${component}:items`;
  if (warned.has(key)) return;
  warned.add(key);
  // eslint-disable-next-line no-console
  console.warn(`[rivet ui] ${component}: items and compound children both given; children win, items ignored`);
}
