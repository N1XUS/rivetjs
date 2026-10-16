// Site navigation: areas (top-bar sections) → sections → groups (collapsible in the side nav) → content
// paths (files under content/, without `.md`). Order here is reading order (prev/next). Every page must
// appear exactly once; the build fails on orphans and on entries without a file. Each part keeps its
// groups in its own file under _nav/ (one owner per file).

import type { NavArea, NavSection } from "@rivetjs/docs-kit/tools/nav.ts";
import * as start from "./_nav/start.ts";
import * as forms from "./_nav/forms.ts";
import * as collections from "./_nav/collections.ts";
import * as overlays from "./_nav/overlays.ts";
import * as pickers from "./_nav/pickers.ts";
import * as interactions from "./_nav/interactions.ts";
import * as utilities from "./_nav/utilities.ts";

const parts = [forms, collections, overlays, pickers, interactions, utilities];

export const areas: NavArea[] = [
  { id: "start", title: "Start" },
  { id: "components", title: "Components" },
  { id: "foundations", title: "Foundations" },
];

export const nav: NavSection[] = [
  { id: "start", title: "Start", area: "start", groups: start.groups },
  { id: "components", title: "Components", area: "components", groups: parts.flatMap((part) => part.components) },
  { id: "foundations", title: "Foundations", area: "foundations", groups: parts.flatMap((part) => part.foundations) },
];
