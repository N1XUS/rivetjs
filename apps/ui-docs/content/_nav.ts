// Site navigation: areas (top-bar sections) → sections → groups (collapsible in the side nav) → content
// paths (files under content/, without `.md`). Order here is reading order (prev/next). Every page must
// appear exactly once; the build fails on orphans and on entries without a file. Component groups are
// categories by use (buttons, forms, pickers, overlays, …).

import type { NavArea, NavSection } from "@rivetjs/docs-kit/tools/nav.ts";
import { groups as start } from "./_nav/start.ts";
import { groups as components } from "./_nav/components.ts";
import { groups as showcase } from "./_nav/showcase.ts";

export const areas: NavArea[] = [
  { id: "start", title: "Getting started" },
  { id: "components", title: "Components" },
  { id: "showcase", title: "Showcase" },
  // Top-bar "Themes": the theme builder route (`src/routes/themes.tsx` + `src/theme-builder/**`).
  { id: "themes", title: "Themes", href: "/themes/" },
];

export const nav: NavSection[] = [
  { id: "start", title: "Getting started", area: "start", groups: start },
  { id: "components", title: "Components", area: "components", groups: components },
  { id: "showcase", title: "Showcase", area: "showcase", groups: showcase },
];
