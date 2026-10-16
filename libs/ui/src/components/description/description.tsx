// Ported from HeroUI v3.2.6 packages/react/src/components/description/description.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `className` → `class` (string); `react-aria-components/Text` → `@rivetjs/cdk/text`; `@heroui/styles` → vendored
//   `styles/`. `useHasTextSlot` / `FieldSlotsGate` dropped: cdk collection parts are not mounted in a hidden build pass
//   (`isHiddenPart` returns null inside `Text`), so the slot is always available (`libs/ui/CLAUDE.md` Known diffs).
// Live props: `class` is read lazily (`splitLive`); the composed class is a local (a plain value for cdk `Text`), so when one of them is a live
//   getter (`hasLiveProp`) the class goes in as a function (`renderClass`, bound by the cdk element); static props keep the string path.
import { Text } from "@rivetjs/cdk/text";
import type { TextProps } from "@rivetjs/cdk/text";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";

import type { DescriptionVariants } from "../../../styles/src/components/description/index.ts";
import { descriptionVariants } from "../../../styles/src/components/description/index.ts";
import { renderClass, hasLiveProp, splitLive } from "../../utils/live.tsx";
import { slotProbing } from "@rivetjs/cdk/slot-probe";

/* -------------------------------------------------------------------------------------------------
 * Description Root
 * -----------------------------------------------------------------------------------------------*/
interface DescriptionRootProps extends TextProps, DescriptionVariants {}

const DescriptionRoot = (props: DescriptionRootProps): JSX.Element => {
  // Server slot probe of the enclosing field (`@rivetjs/cdk/slot-probe`; browser: the constant `false`, folded away): no classes.
  if (slotProbing) return Text({ slot: props.slot ?? "description", id: props.id }) as JSX.Element;
  const [local, rest] = splitLive(props, ["children", "class"]);
  const classOf = (): string | ((values: never) => string) => descriptionVariants({ class: local.class });
  const cls = hasLiveProp(local, ["class"]) ? (values: unknown) => renderClass(classOf(), values) : classOf();

  return (
    <Text class={cls as string} data-slot="description" slot="description" {...rest}>
      {local.children}
    </Text>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { DescriptionRoot };

export type { DescriptionRootProps };
