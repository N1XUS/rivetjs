// Ported from HeroUI v3.2.6 packages/react/src/components/error-message/error-message.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `className` → `class` (string); `react-aria-components/Text` → `@rivetjs/cdk/text`; `@heroui/styles` → vendored
//   `styles/`. `useHasTextSlot` / `FieldSlotsGate` dropped: cdk collection parts are not mounted in a hidden build pass
//   (`isHiddenPart` returns null inside `Text`), so the slot is always available (`libs/ui/CLAUDE.md` Known diffs).
// Live props: `class` is read lazily (`splitLive`); the composed class is a local (a plain value for cdk `Text`), so when one of them is a live
//   getter (`hasLiveProp`) the class goes in as a function (`renderClass`, bound by the cdk element); static props keep the string path.
import { Text } from "@rivetjs/cdk/text";
import type { TextProps } from "@rivetjs/cdk/text";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";

import type { ErrorMessageVariants } from "../../../styles/src/components/error-message/index.ts";
import { errorMessageVariants } from "../../../styles/src/components/error-message/index.ts";
import { renderClass, hasLiveProp, splitLive } from "../../utils/live.tsx";

/* -------------------------------------------------------------------------------------------------
 * ErrorMessage Root
 * -----------------------------------------------------------------------------------------------*/
interface ErrorMessageRootProps extends TextProps, ErrorMessageVariants {}

const ErrorMessageRoot = (props: ErrorMessageRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const classOf = (): string | ((values: never) => string) => errorMessageVariants({ class: local.class });
  const cls = hasLiveProp(local, ["class"]) ? (values: unknown) => renderClass(classOf(), values) : classOf();

  return (
    <Text class={cls as string} data-slot="error-message" slot="errorMessage" {...rest}>
      {local.children}
    </Text>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { ErrorMessageRoot };

export type { ErrorMessageRootProps };
