// Ported from HeroUI v3.2.6 packages/react/src/components/date-field/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof X>` → the parts' prop types; `@heroui/styles` → vendored `styles/`.
import {
  DateInputGroupInput,
  DateInputGroupInputContainer,
  DateInputGroupPrefix,
  DateInputGroupRoot,
  DateInputGroupSegment,
  DateInputGroupSuffix,
} from "../date-input-group/index.ts";
import type {
  DateInputGroupInputContainerProps,
  DateInputGroupInputProps,
  DateInputGroupPrefixProps,
  DateInputGroupRootProps,
  DateInputGroupSegmentProps,
  DateInputGroupSuffixProps,
} from "../date-input-group/index.ts";

import { DateFieldRoot } from "./date-field.tsx";
import type { DateFieldRootProps } from "./date-field.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const DateField = Object.assign(DateFieldRoot, {
  Root: DateFieldRoot,
  Group: DateInputGroupRoot,
  Input: DateInputGroupInput,
  InputContainer: DateInputGroupInputContainer,
  Segment: DateInputGroupSegment,
  Prefix: DateInputGroupPrefix,
  Suffix: DateInputGroupSuffix,
});

export type DateField = {
  Props: DateFieldRootProps;
  RootProps: DateFieldRootProps;
  GroupProps: DateInputGroupRootProps;
  InputProps: DateInputGroupInputProps;
  InputContainerProps: DateInputGroupInputContainerProps;
  SegmentProps: DateInputGroupSegmentProps;
  PrefixProps: DateInputGroupPrefixProps;
  SuffixProps: DateInputGroupSuffixProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { DateFieldRoot };

export type { DateFieldRootProps, DateFieldRootProps as DateFieldProps } from "./date-field.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { dateFieldVariants } from "../../../styles/src/components/date-field/index.ts";

export type { DateFieldVariants } from "../../../styles/src/components/date-field/index.ts";
