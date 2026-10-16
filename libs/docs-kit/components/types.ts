// Shapes shared by generated data (src/generated/*) and the docs components.
import type { IconNode } from "@rivetjs/kit/icon";

export type Status = "stable" | "experimental" | "planned";

export interface NavItem {
  href: string;
  title: string;
  status: Status;
  /** Side-nav tag (`_nav.ts` `{ path, tag }`). */
  tag?: "new" | "updated";
}
/** Side-nav sections in nav order; each group is a collapsible group of the area's side nav. */
export type NavData = {
  id: string;
  title: string;
  /** Area (top-bar section) whose side nav lists this section. */
  area: string;
  href: string;
  groups: { title: string; items: NavItem[] }[];
}[];
/** Top-bar sections; `href` = the first page of the area's first section. */
export type NavAreas = { id: string; title: string; href: string }[];

export interface PageIndexEntry {
  href: string;
  title: string;
  description: string;
  status: Status;
  section: string;
  sectionTitle: string;
  group: string;
  tags: string[];
  template: string;
}

/** What a generated content page passes to `DocPage`. */
export interface PageInfo {
  path: string;
  title: string;
  description: string;
  status: Status;
  template: string;
  section: string;
  /** Repository path of the Markdown source (edit link). */
  source: string;
  toc: { depth: 2 | 3; id: string; text: string }[];
  related: { title: string; href: string }[];
  prev?: { title: string; href: string };
  next?: { title: string; href: string };
  /** Planned pages: design spec or issue. */
  spec?: string;
  since?: string;
}

/** One shown file of an example: plain text (the browser colours it, components/highlighter.ts). */
export interface ExampleFile {
  path: string;
  /** Shown text (`#region` markers and line notation stripped). */
  text: string;
  /** Line notation marks by 1-based line (`// [!code highlight|++|--]`). */
  marks?: Record<number, "highlight" | "add" | "remove">;
  /** Line range (1-based, inclusive) of the `#region demo` focus, when present. */
  focus?: [number, number];
}
export interface ExampleMeasure {
  /** Inline script + state bytes in the HTML (before any request). */
  inlineBytes: number;
  /** Brotli size of the HTML document. */
  htmlBrotli: number;
  /** Script requests before the first interaction (idle-time prefetches included) and their brotli bytes. */
  requestsBefore: number;
  bytesBefore: number;
  /** After the first scripted interaction: JS requests and their brotli bytes. */
  requestsAfter: number;
  bytesAfter: number;
}
/** One example (`src/generated/examples.json`, tools/examples.ts). */
export interface ExampleData {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  status: Status;
  /** iframe height in px (auto-height frames: until their page posts its content height). */
  height: number;
  /** The frame follows its page's content height (`frame.auto`). */
  auto?: true;
  phone: boolean;
  /** Why the example is shown as code only (it cannot run as a page of the static docs app); absent = live. */
  codeOnly?: string;
  /** Live examples: their frame page sub-paths (`""` = `/examples/<id>/frame/`). */
  pages?: string[];
  /** Shown files (code tabs). */
  files: ExampleFile[];
  /** Steps the build runs in Chromium against the frame page (`define.ts` `Step`). */
  test?: import("../define.ts").Step[];
  /** Content pages that embed this example. */
  usedOn: { title: string; href: string }[];
}
