// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no resizable panels): tv() slots of
// @rivetjs/ui/resizable in the vendored format. Behaviour = react-resizable-panels 4.14.3 (MIT, © Brian Vaughn) via
// @rivetjs/cdk/resizable; API = shadcn/ui Resizable (MIT).
import "../../../out/resizable.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const resizableVariants = tv({
  slots: {
    group: "resizable",
    handle: "resizable__handle",
    handleGrip: "resizable__grip",
    panel: "resizable__panel",
  },
});

export type ResizableVariants = VariantProps<typeof resizableVariants>;
