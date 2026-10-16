// Buttons, form fields, links.
import type { NavGroup } from "@rivetjs/docs-kit/tools/nav.ts";

export const components: NavGroup[] = [
  {
    title: "Buttons",
    pages: ["components/button", "components/toggle-button", "components/toggle-button-group", "components/toolbar", "components/file-trigger"],
  },
  {
    title: "Forms",
    pages: [
      "components/form",
      "components/text-field",
      "components/text-area",
      "components/native-select",
      "components/search-field",
      "components/number-field",
      "components/slider",
      "components/checkbox",
      "components/checkbox-group",
      "components/switch",
      "components/radio-group",
      "components/field",
      "components/label",
      "components/group",
    ],
  },
  { title: "Status", pages: ["components/meter", "components/progress-bar"] },
  { title: "Links", pages: ["components/link", "components/breadcrumbs"] },
];
export const foundations: NavGroup[] = [];
