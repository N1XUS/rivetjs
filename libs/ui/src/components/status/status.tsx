// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no status dot). User request 2026-10-27: "simple component called
// status that will use semantic colors we have, plus size, plus pulse effect from props".
// - A `span` dot: `color` = the Chip / Badge semantic colours (`default` / `accent` / `success` / `warning` / `danger`),
//   `size` `sm` / `md` / `lg`, `pulse` = CSS ring animation (none under prefers-reduced-motion).
// - A dot is not text: with `aria-label` (or `aria-labelledby`) it is `role="img"`, without one `aria-hidden` (put the
//   meaning in nearby text then).
// - Pure markup: no state, no script, never a resume boundary.
import type { JSX } from "@rivetjs/runtime/jsx-runtime";

import type { StatusVariants } from "../../../styles/src/components/status/index.ts";
import { statusVariants } from "../../../styles/src/components/status/index.ts";
import { splitLive } from "../../utils/live.tsx";

interface StatusRootProps extends Omit<JSX.IntrinsicElements["span"], "class" | "color" | "children">, StatusVariants {
  class?: string;
}

const StatusRoot = (props: StatusRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "color", "pulse", "size"]);
  const labelled = rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined;
  return (
    <span
      class={statusVariants({ color: local.color, pulse: local.pulse, size: local.size, class: local.class })}
      data-slot="status"
      role={labelled ? "img" : undefined}
      aria-hidden={labelled ? undefined : "true"}
      {...rest}
    />
  );
};

export { StatusRoot };
export type { StatusRootProps };
