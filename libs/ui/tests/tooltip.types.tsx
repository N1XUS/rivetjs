// Type-level suite (`tsc -p libs/ui` only): `Tooltip` parts accept the cdk props (+ `class`, `showArrow`), `Tooltip["…Props"]`,
// generic `Tooltip.Trigger<"span">`; errors: unknown placement, missing Content children.
import { signal } from "@rivetjs/reactivity";
import { Tooltip } from "../src/components/tooltip/index.ts";

const open = signal(false);

export const ok = () => (
  <Tooltip isOpen={open} delay={0} closeDelay={100} shouldSkipAnimation>
    <Tooltip.Trigger aria-label="x">t</Tooltip.Trigger>
    <Tooltip.Content class="max-w-64" placement="right" showArrow offset={10}>
      <Tooltip.Arrow />
      Tip
    </Tooltip.Content>
  </Tooltip>
);

export const generic = () => <Tooltip.Trigger<"span"> class="x">t</Tooltip.Trigger>;

const props: Tooltip["ContentProps"] = { children: "x", placement: "bottom" };
void props;

// @ts-expect-error unknown placement
export const badPlacement = () => <Tooltip.Content placement="middle">x</Tooltip.Content>;

// @ts-expect-error Content requires children
export const noChildren = () => <Tooltip.Content />;
