// Type-level tests, checked by `tsc -p libs/ui` (not a vitest suite): `SurfaceRoot` keeps HeroUI's generic signature.
import { Surface, SurfaceRoot } from "../src/components/surface/index.ts";

export const DefaultElement = () => (
  <SurfaceRoot variant="secondary" class="p-4" id="s1" aria-label="panel" ref={(el: HTMLDivElement) => void el}>
    x
  </SurfaceRoot>
);

export const Compound = () => <Surface.Root variant="tertiary">y</Surface.Root>;

export const Handlers = () => (
  <Surface onClick={(e) => void e.currentTarget.tagName} ref={(el: Element) => void el}>
    h
  </Surface>
);

export const OtherElement = () => (
  <SurfaceRoot<"span"> title="t" ref={(el: HTMLSpanElement) => void el}>
    z
  </SurfaceRoot>
);

export const Props: Surface["Props"] = { children: "w", variant: "transparent", id: "p" };

// @ts-expect-error unknown variant
export const BadVariant = () => <SurfaceRoot variant="nope">v</SurfaceRoot>;

// @ts-expect-error unknown variant (Props type)
export const BadProps: Surface["Props"] = { children: "w", variant: "nope" };
