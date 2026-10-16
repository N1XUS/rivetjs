// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no app layout): tv() slots of @rivetjs/ui/app-layout in
// the vendored format. Feature set inspired by HeroUI Pro's public AppLayout docs (class / variable names); independent
// implementation. Sidebar behaviour = @rivetjs/cdk/sidebar (shadcn/ui port).
// Rivet: the stylesheets of the classes these slots compose (TWEAKS.md TW-122), in components/index.css order.
import "../../../out/sidebar.css";
import "../../../out/app-layout.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const appLayoutVariants = tv({
  defaultVariants: {
    scrollMode: "page",
  },
  slots: {
    aside: "app-layout__aside",
    asideInner: "app-layout__aside-inner",
    asideTrigger: "app-layout__aside-trigger",
    base: "app-layout",
    body: "sidebar__inset app-layout__body",
    content: "app-layout__content",
    footer: "app-layout__footer",
    header: "app-layout__header",
    main: "app-layout__main",
    menuToggle: "app-layout__menu-toggle",
    resizeHandle: "app-layout__resize-handle",
    sheet: "app-layout__sheet",
    sheetBackdrop: "app-layout__sheet-backdrop",
    toolbar: "app-layout__toolbar",
  },
  variants: {
    scrollMode: {
      content: {
        base: "app-layout--scroll-content",
      },
      page: {
        base: "app-layout--scroll-page",
      },
    },
  },
});

export type AppLayoutVariants = VariantProps<typeof appLayoutVariants>;
