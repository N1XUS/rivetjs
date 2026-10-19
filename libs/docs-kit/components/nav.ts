// Navigation model over the generated nav data (`virtual:docs/nav`): which top-bar item a URL belongs
// to and what the side nav shows for an area. Pure functions (server render + drawer render).
import type { NavAreas, NavData, NavItem } from "./types.ts";

export type Section = NavData[number];

/** Top-bar entries after the content areas (shared site routes every docs site has). */
export const ROUTE_ITEMS = [
  { id: "api", title: "API", href: "/api/" },
  { id: "examples", title: "Examples", href: "/examples/" },
] as const;

/** Top-bar items: the content areas, then the site routes. */
export const topItems = (areas: NavAreas): { id: string; title: string; href: string }[] => [...areas, ...ROUTE_ITEMS];

const trail = (path: string) => (path.endsWith("/") ? path : path + "/");

/** The item is the page at `href` or stands for it (one of its `children`). */
export const holds = (item: NavItem, href: string): boolean => item.href === href || !!item.children?.includes(href);

/** Section that lists the page at `path` (exact page match), if any. */
export function sectionOf(sections: NavData, path: string): Section | undefined {
  const href = trail(path);
  return sections.find((section) => section.groups.some((group) => group.items.some((item) => holds(item, href))));
}

/** Top-bar item for `path`: the page's area; API / examples routes by prefix. */
export function areaOf(sections: NavData, path: string): string | undefined {
  const href = trail(path);
  for (const item of ROUTE_ITEMS) if (href.startsWith(item.href)) return item.id;
  return sectionOf(sections, href)?.area;
}

export interface SideGroup {
  title: string;
  items: NavItem[];
  /** Rendered open: holds the current page, or the area is small (≤ OPEN_ALL groups). */
  open: boolean;
  /** Holds the current page. */
  current: boolean;
}
export interface SidePart {
  /** Heading (section title); omitted when the area is one section named like the area. */
  title?: string;
  groups: SideGroup[];
}

/** Areas with at most this many groups render every group open. */
const OPEN_ALL = 4;

/** Side nav of area `areaId`: its sections (headings) with their groups (collapsible). */
export function sideModel(sections: NavData, areas: NavAreas, areaId: string, path: string): SidePart[] | undefined {
  const own = sections.filter((section) => section.area === areaId);
  if (!own.length) return undefined;
  const href = trail(path);
  const area = areas.find((a) => a.id === areaId);
  const labelled = own.length > 1 || own[0]!.title !== area?.title;
  const small = own.reduce((n, section) => n + section.groups.length, 0) <= OPEN_ALL;
  return own.map((section) => ({
    ...(labelled ? { title: section.title } : {}),
    groups: section.groups.map((group) => {
      const current = group.items.some((item) => holds(item, href));
      return { title: group.title, items: group.items, open: current || small, current };
    }),
  }));
}

/** Breadcrumb of a page: area, section (when the area has several), group (when named unlike its section). */
export function breadcrumbOf(sections: NavData, areas: NavAreas, path: string): { title: string; href: string }[] {
  const href = trail(path);
  const section = sectionOf(sections, href);
  if (!section) return [];
  const area = areas.find((a) => a.id === section.area);
  const crumbs: { title: string; href: string }[] = [];
  if (area) crumbs.push({ title: area.title, href: area.href });
  if (section.title !== area?.title) crumbs.push({ title: section.title, href: section.href });
  const group = section.groups.find((g) => g.items.some((item) => holds(item, href)));
  if (group && group.title !== section.title) crumbs.push({ title: group.title, href: group.items[0]!.href });
  return crumbs;
}
