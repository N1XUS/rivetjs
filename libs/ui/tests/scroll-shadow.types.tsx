// Type-level tests, checked by `tsc -p libs/ui`: ScrollShadow props (plain div root, as upstream: no generic, no `render`) + the
// hook's options.
import { ref } from "@rivetjs/runtime/dom";
import { ScrollShadow, ScrollShadowRoot, useScrollShadow } from "../src/components/scroll-shadow/index.ts";
import type { ScrollShadow as ScrollShadowTypes, ScrollShadowVisibility } from "../src/components/scroll-shadow/index.ts";

const el = ref<HTMLDivElement>();

export const Shadows = () => (
  <>
    <ScrollShadow
      ref={el}
      size={20}
      offset={4}
      orientation="horizontal"
      visibility="left"
      isEnabled
      hideScrollBar
      variant="fade"
      class="x"
      style={{ height: "200px" }}
      onVisibilityChange={(v: ScrollShadowVisibility) => void v}
    >
      x
    </ScrollShadow>
    <ScrollShadowRoot aria-label="feed" tabIndex={0}>
      x
    </ScrollShadowRoot>
  </>
);

export const rootProps: ScrollShadowTypes["Props"] = { size: 40, visibility: "auto" };

export const hook = () => useScrollShadow({ containerRef: el, orientation: "vertical", offset: 0, visibility: "auto", isEnabled: true });

// @ts-expect-error bad visibility
export const BadVisibility = () => <ScrollShadow visibility="middle">x</ScrollShadow>;
// @ts-expect-error size is a number
export const BadSize = () => <ScrollShadow size="40px">x</ScrollShadow>;
// @ts-expect-error bad orientation
export const BadOrientation = () => <ScrollShadow orientation="diagonal">x</ScrollShadow>;
// @ts-expect-error no `render` prop (upstream root is a plain div)
export const NoRender = () => <ScrollShadow render={() => <section />}>x</ScrollShadow>;
