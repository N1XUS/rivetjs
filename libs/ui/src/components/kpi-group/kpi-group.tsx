// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no KPI group). Feature set inspired by HeroUI Pro's public KPI Group
// docs (several KPI cards on one shared surface, horizontal / vertical, separators); independent implementation,
// Rivet-authored styles on HeroUI tokens.
// - `KpiGroup` is a `div role="group"`; the `Kpi` cards inside drop their own surface (CSS) and share the width.
// - `KpiGroup.Separator` is a decorative 1 px line (`aria-hidden`), vertical in a horizontal group and horizontal in a
//   vertical one (CSS from the group's orientation modifier).
// - Pure markup: no state, no script.
import type { JSX } from "@rivetjs/runtime/jsx-runtime";

import type { KpiGroupVariants } from "../../../styles/src/components/kpi-group/index.ts";
import { kpiGroupVariants } from "../../../styles/src/components/kpi-group/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import { splitLive } from "../../utils/live.tsx";

const SLOTS = kpiGroupVariants();

interface KpiGroupRootProps extends Omit<JSX.IntrinsicElements["div"], "class">, KpiGroupVariants {
  class?: string;
}

const KpiGroupRoot = (props: KpiGroupRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "orientation"]);
  return (
    <div
      role="group"
      class={kpiGroupVariants({ orientation: local.orientation }).base({ class: local.class })}
      data-slot="kpi-group"
      data-orientation={local.orientation ?? "horizontal"}
      {...rest}
    >
      {local.children}
    </div>
  );
};

type KpiGroupSeparatorProps = Omit<JSX.IntrinsicElements["span"], "class"> & { class?: string };

const KpiGroupSeparator = (props: KpiGroupSeparatorProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  return <span aria-hidden="true" class={composeSlotClassName(SLOTS.separator, local.class)} data-slot="kpi-group-separator" {...rest} />;
};

export { KpiGroupRoot, KpiGroupSeparator };
export type { KpiGroupRootProps, KpiGroupSeparatorProps };
