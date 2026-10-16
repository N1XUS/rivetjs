// Ported from HeroUI v3.2.6 packages/react/src/components/time-field/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
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

import { TimeFieldRoot } from "./time-field.tsx";
import type { TimeFieldRootProps } from "./time-field.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const TimeField = Object.assign(TimeFieldRoot, {
  Root: TimeFieldRoot,
  Group: DateInputGroupRoot,
  Input: DateInputGroupInput,
  InputContainer: DateInputGroupInputContainer,
  Segment: DateInputGroupSegment,
  Prefix: DateInputGroupPrefix,
  Suffix: DateInputGroupSuffix,
});

export type TimeField = {
  Props: TimeFieldRootProps;
  RootProps: TimeFieldRootProps;
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
export { TimeFieldRoot };

export type { TimeFieldRootProps, TimeFieldRootProps as TimeFieldProps } from "./time-field.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { timeFieldVariants } from "../../../styles/src/components/time-field/index.ts";

export type { TimeFieldVariants } from "../../../styles/src/components/time-field/index.ts";
