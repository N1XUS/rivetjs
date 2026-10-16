// Ported from HeroUI v3.2.6 packages/styles/src/components/tag-group/tag-group.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/tag-group.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const tagGroupVariants = tv({
  slots: {
    base: "tag-group",
    list: "tag-group__list",
  },
});

export type TagGroupVariants = VariantProps<typeof tagGroupVariants>;
