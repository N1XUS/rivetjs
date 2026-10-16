// Ported from HeroUI v3.2.6 packages/react/src/components/input-group/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
import { InputGroupInput, InputGroupPrefix, InputGroupRoot, InputGroupSuffix, InputGroupTextArea } from "./input-group.tsx";
import type { InputGroupInputProps, InputGroupPrefixProps, InputGroupRootProps, InputGroupSuffixProps, InputGroupTextAreaProps } from "./input-group.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const InputGroup = Object.assign(InputGroupRoot, {
  Root: InputGroupRoot,
  Input: InputGroupInput,
  TextArea: InputGroupTextArea,
  Prefix: InputGroupPrefix,
  Suffix: InputGroupSuffix,
});

export type InputGroup = {
  Props: InputGroupRootProps;
  RootProps: InputGroupRootProps;
  InputProps: InputGroupInputProps;
  TextAreaProps: InputGroupTextAreaProps;
  PrefixProps: InputGroupPrefixProps;
  SuffixProps: InputGroupSuffixProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { InputGroupInput, InputGroupPrefix, InputGroupRoot, InputGroupSuffix, InputGroupTextArea };

export type {
  InputGroupRootProps,
  InputGroupRootProps as InputGroupProps,
  InputGroupInputProps,
  InputGroupTextAreaProps,
  InputGroupPrefixProps,
  InputGroupSuffixProps,
} from "./input-group.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { inputGroupVariants } from "../../../styles/src/components/input-group/index.ts";

export type { InputGroupVariants } from "../../../styles/src/components/input-group/index.ts";
