// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no feature list). Perks / plan features as a `ul` with a leading
// icon per item (Rivet-authored, SHOWCASE-2: the pricing and product pages hand-built check lists).
// - `FeatureList` = `ul` (`color`: the icons' colour, `success` default / `accent` / `default` = muted), `.Item` = `li`
//   with a lucide icon (`icon`, default `Check`; decorative, `aria-hidden`) and the label.
// - Pure markup: no state, no script.
import type { IconNode } from "@rivetjs/kit/icon";
import { Icon } from "@rivetjs/kit/icon";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { Check } from "lucide";

import type { FeatureListVariants } from "../../../styles/src/components/feature-list/index.ts";
import { featureListVariants } from "../../../styles/src/components/feature-list/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import { splitLive } from "../../utils/live.tsx";

const SLOTS = featureListVariants();

interface FeatureListRootProps extends Omit<JSX.IntrinsicElements["ul"], "class" | "color">, FeatureListVariants {
  class?: string;
}

const FeatureListRoot = (props: FeatureListRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "color"]);
  return (
    <ul class={featureListVariants({ color: local.color }).base({ class: local.class })} data-slot="feature-list" {...rest}>
      {local.children}
    </ul>
  );
};

interface FeatureListItemProps extends Omit<JSX.IntrinsicElements["li"], "class"> {
  class?: string;
  children?: Content;
  /** Leading lucide icon. @default Check */
  icon?: IconNode;
}

const FeatureListItem = (props: FeatureListItemProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "icon"]);
  return (
    <li class={composeSlotClassName(SLOTS.item, local.class)} data-slot="feature-list-item" {...rest}>
      <Icon icon={local.icon ?? Check} size={16} class={SLOTS.icon()} />
      <span class={SLOTS.label()} data-slot="feature-list-label">
        {local.children}
      </span>
    </li>
  );
};

export { FeatureListRoot, FeatureListItem };
export type { FeatureListRootProps, FeatureListItemProps };
