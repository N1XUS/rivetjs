// Navigation config of a site (`content/_nav.ts` → `export const areas: NavArea[]` + `export const nav:
// NavSection[]`): areas (top-bar sections) → sections (side-nav parts) → groups (collapsible in the side
// nav) → content paths (files under content/, without `.md`).

/** Status tag after a page title in the side nav. */
export type NavTag = "new" | "updated";

/** A page of a group: its content path, or the path with a status tag. */
export type NavPage = string | { path: string; tag: NavTag };

/** A collapsible group of the side nav (open when it holds the current page). */
export interface NavGroup {
  title: string;
  pages: NavPage[];
}
/** A top-bar section. Its side nav lists every section of the area, in `nav` order. */
export interface NavArea {
  /** Stable id (top-bar highlight). */
  id: string;
  title: string;
  /** Route area: a hand-written site route (`src/routes/…`, e.g. `/themes/`) linked from the top bar; it has no sections. */
  href?: string;
}
export interface NavSection {
  /** Stable id (search filter). */
  id: string;
  /** Heading above its groups in the side nav ("Start", "Learn", …) when the area has several sections. */
  title: string;
  /** Id of the area (`areas`) whose side nav lists this section. */
  area: string;
  groups: NavGroup[];
}

export const navPath = (page: NavPage): string => (typeof page === "string" ? page : page.path);
export const navTag = (page: NavPage): NavTag | undefined => (typeof page === "string" ? undefined : page.tag);
