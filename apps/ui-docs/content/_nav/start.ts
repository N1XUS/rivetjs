// Getting started: Overview (what it is, setup, principles, licenses) then Handbook (guides).
import type { NavGroup } from "@rivetjs/docs-kit/tools/nav.ts";

export const groups: NavGroup[] = [
  { title: "Overview", pages: ["start/introduction", "start/installation", "start/design-principles", "start/licenses"] },
  // The theme builder (`/themes/`) is a top-bar area (../_nav.ts).
  {
    title: "Handbook",
    pages: [
      "start/colors",
      "start/theming",
      "start/themes",
      "start/dark-mode",
      "start/styling",
      "start/animation",
      "start/composition",
      "start/forms",
      "start/hooks",
      "start/differences",
    ],
  },
];
