// Ported from HeroUI v3.2.6 packages/styles/src/components/breadcrumbs/breadcrumbs.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/breadcrumbs.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const breadcrumbsVariants = tv({
  slots: {
    base: "breadcrumbs",
    item: "breadcrumbs__item",
    link: "breadcrumbs__link",
    separator: "breadcrumbs__separator",
  },
});

export type BreadcrumbsVariants = VariantProps<typeof breadcrumbsVariants>;
