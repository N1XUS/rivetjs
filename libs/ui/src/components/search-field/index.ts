// Ported from HeroUI v3.2.6 packages/react/src/components/search-field/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
import { SearchFieldClearButton, SearchFieldGroup, SearchFieldInput, SearchFieldRoot, SearchFieldSearchIcon } from "./search-field.tsx";
import type {
  SearchFieldClearButtonProps,
  SearchFieldGroupProps,
  SearchFieldInputProps,
  SearchFieldRootProps,
  SearchFieldSearchIconProps,
} from "./search-field.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const SearchField = Object.assign(SearchFieldRoot, {
  Root: SearchFieldRoot,
  Group: SearchFieldGroup,
  Input: SearchFieldInput,
  SearchIcon: SearchFieldSearchIcon,
  ClearButton: SearchFieldClearButton,
});

export type SearchField = {
  Props: SearchFieldRootProps;
  RootProps: SearchFieldRootProps;
  GroupProps: SearchFieldGroupProps;
  InputProps: SearchFieldInputProps;
  SearchIconProps: SearchFieldSearchIconProps;
  ClearButtonProps: SearchFieldClearButtonProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { SearchFieldClearButton, SearchFieldGroup, SearchFieldInput, SearchFieldRoot, SearchFieldSearchIcon };

export type {
  SearchFieldRootProps,
  SearchFieldRootProps as SearchFieldProps,
  SearchFieldGroupProps,
  SearchFieldInputProps,
  SearchFieldSearchIconProps,
  SearchFieldClearButtonProps,
} from "./search-field.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { searchFieldVariants } from "../../../styles/src/components/search-field/index.ts";

export type { SearchFieldVariants } from "../../../styles/src/components/search-field/index.ts";
