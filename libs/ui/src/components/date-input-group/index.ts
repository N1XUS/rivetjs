// Ported from HeroUI v3.2.6 packages/react/src/components/date-input-group/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof X>` → the parts' prop types; `@heroui/styles` → vendored `styles/`.
import {
  DateInputGroupInput,
  DateInputGroupInputContainer,
  DateInputGroupPrefix,
  DateInputGroupRoot,
  DateInputGroupSegment,
  DateInputGroupSuffix,
} from "./date-input-group.tsx";
import type {
  DateInputGroupInputContainerProps,
  DateInputGroupInputProps,
  DateInputGroupPrefixProps,
  DateInputGroupRootProps,
  DateInputGroupSegmentProps,
  DateInputGroupSuffixProps,
} from "./date-input-group.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const DateInputGroup = Object.assign(DateInputGroupRoot, {
  Root: DateInputGroupRoot,
  Input: DateInputGroupInput,
  InputContainer: DateInputGroupInputContainer,
  Segment: DateInputGroupSegment,
  Prefix: DateInputGroupPrefix,
  Suffix: DateInputGroupSuffix,
});

export type DateInputGroup = {
  Props: DateInputGroupRootProps;
  RootProps: DateInputGroupRootProps;
  InputProps: DateInputGroupInputProps;
  InputContainerProps: DateInputGroupInputContainerProps;
  SegmentProps: DateInputGroupSegmentProps;
  PrefixProps: DateInputGroupPrefixProps;
  SuffixProps: DateInputGroupSuffixProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { DateInputGroupInput, DateInputGroupInputContainer, DateInputGroupPrefix, DateInputGroupRoot, DateInputGroupSegment, DateInputGroupSuffix };

export type {
  DateInputGroupRootProps,
  DateInputGroupRootProps as DateInputGroupProps,
  DateInputGroupInputProps,
  DateInputGroupInputContainerProps,
  DateInputGroupSegmentProps,
  DateInputGroupPrefixProps,
  DateInputGroupSuffixProps,
} from "./date-input-group.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { dateInputGroupVariants } from "../../../styles/src/components/date-input-group/index.ts";

export type { DateInputGroupVariants } from "../../../styles/src/components/date-input-group/index.ts";
