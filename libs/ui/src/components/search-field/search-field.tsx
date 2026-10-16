// Ported from HeroUI v3.2.6 packages/react/src/components/search-field/search-field.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components/{SearchField,Group,Input}` → `@rivetjs/cdk/{search-field,group,input}`
//   (accessor render props); `@heroui/styles` → vendored `styles/`.
// - `SearchFieldContext` carries plain data (`{ fullWidth, variant }`, getters when the root's props are live; resumable token
//   `rv-ui-search-field`, `{}` default) instead of the tv `slots`; parts look the slots up in a module-level memo per `fullWidth|variant`
//   (`slotsFor`), `undefined` outside a SearchField (= upstream `slots?.x`).
// - `SearchIcon` default: upstream's inline `IconSearch` svg (16px) → lucide `Search` via `@rivetjs/kit/icon` (16px,
//   `data-slot="search-field-search-icon"`); custom `children` are not cloned (Rivet JSX has no element clone): they render inside a
//   `span` carrying the slot class + `data-slot` (upstream merges both onto the child element).
// - Live props (`splitLive`): a live `class` / `fullWidth` / `variant` makes the cdk `class` a render-prop function (`renderClass`).
// - Children: upstream's `(values) => typeof children === "function" ? children(values) : children` = what the cdk parts do with
//   `children` themselves (passed through).
// - Rivet addition (identity spec §4.2): shorthand `label` / `description` / `errorMessage` / `placeholder` when no children are
//   given: Label + Group(SearchIcon, Input, ClearButton) + Description + FieldError (the compound form's markup). Read once at mount: whether
//   the shorthand form renders.
import { Group as GroupPrimitive } from "@rivetjs/cdk/group";
import type { GroupProps as GroupPrimitiveProps, GroupRenderProps } from "@rivetjs/cdk/group";
import { Input as InputPrimitive } from "@rivetjs/cdk/input";
import type { InputProps as InputPrimitiveProps, InputRenderProps } from "@rivetjs/cdk/input";
import { SearchField as SearchFieldPrimitive } from "@rivetjs/cdk/search-field";
import type { SearchFieldProps as SearchFieldPrimitiveProps, SearchFieldRenderProps } from "@rivetjs/cdk/search-field";
import { Icon } from "@rivetjs/kit/icon";
import type { IconProps } from "@rivetjs/kit/icon";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { resumableContext } from "@rivetjs/runtime/resume-format";
import { Search } from "lucide";

import type { SearchFieldVariants } from "../../../styles/src/components/search-field/index.ts";
import { searchFieldVariants } from "../../../styles/src/components/search-field/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";
import { DescriptionRoot } from "../description/description.tsx";
import { FieldErrorRoot, type FieldErrorRootProps } from "../field-error/field-error.tsx";
import { LabelRoot } from "../label/label.tsx";
import { CloseButtonRoot as CloseButton } from "../close-button/close-button.tsx";
import type { CloseButtonRootProps } from "../close-button/close-button.tsx";
import { DEV } from "#dev";
import { warnShorthandIgnored } from "../../utils/shorthand.ts";

/* -------------------------------------------------------------------------------------------------
 * SearchField Context
 * -----------------------------------------------------------------------------------------------*/
type SearchFieldContext = {
  /** Set inside a SearchField (upstream: `slots`). */
  inField?: true;
  fullWidth?: boolean;
  variant?: SearchFieldVariants["variant"];
};

const SearchFieldContext = resumableContext(createContext<SearchFieldContext>({}, { id: "rv-ui-search-field" }));

type SearchFieldSlots = ReturnType<typeof searchFieldVariants>;

/** Module-level memo per `fullWidth|variant` (upstream `useMemo` per root; tv slot functions are pure). */
const SLOTS: Record<string, SearchFieldSlots> = {};
const slotsFor = (fullWidth: boolean | undefined, variant: SearchFieldVariants["variant"]): SearchFieldSlots =>
  (SLOTS[`${!!fullWidth}|${variant}`] ??= searchFieldVariants({ fullWidth, variant }));

/** Upstream `use(SearchFieldContext).slots`: `undefined` outside a SearchField. */
const slotsOf = (context: SearchFieldContext): SearchFieldSlots | undefined => (context.inField ? slotsFor(context.fullWidth, context.variant) : undefined);

const CONTEXT_KEYS = ["fullWidth", "variant"] as const;

/* -------------------------------------------------------------------------------------------------
 * SearchField Root
 * -----------------------------------------------------------------------------------------------*/
interface SearchFieldRootProps extends SearchFieldPrimitiveProps, SearchFieldVariants {
  /** Shorthand (no children): the field's Label. */
  label?: Content;
  /** Shorthand (no children): a Description under the group. */
  description?: Content;
  /** Shorthand (no children): the FieldError text (shown while the field is invalid). */
  errorMessage?: FieldErrorRootProps["children"];
  /** Shorthand (no children): the input's placeholder. */
  placeholder?: string;
}

const ROOT_STYLE = ["class", "fullWidth", "variant"] as const;

const SearchFieldRoot = (props: SearchFieldRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "description", "errorMessage", "fullWidth", "label", "placeholder", "variant"]);
  if (DEV && local.children !== undefined) warnShorthandIgnored("SearchField", local, ["label", "description", "errorMessage", "placeholder"]);
  // Getters only when a field is live (readers then take the render-prop class path), plain data otherwise.
  const contextValue: SearchFieldContext = hasLiveProp(local, CONTEXT_KEYS)
    ? {
        inField: true,
        get fullWidth() {
          return local.fullWidth;
        },
        get variant() {
          return local.variant;
        },
      }
    : { inField: true, fullWidth: local.fullWidth, variant: local.variant };

  const classOf = (): string | ((values: SearchFieldRenderProps) => string) =>
    composeTwRenderProps(local.class as never, slotsFor(local.fullWidth, local.variant).base());
  const cls = hasLiveProp(local, ROOT_STYLE) ? (values: SearchFieldRenderProps) => renderClass(classOf(), values) : classOf();

  // A function: Rivet JSX builds nodes eagerly, so the field is created inside the provider.
  const content = () => (
    <SearchFieldPrimitive data-slot="search-field" {...(rest as object)} class={cls as never}>
      {local.children === undefined ? (
        <>
          {local.label !== undefined && <LabelRoot>{local.label}</LabelRoot>}
          <SearchFieldGroup>
            <SearchFieldSearchIcon />
            <SearchFieldInput placeholder={local.placeholder} />
            <SearchFieldClearButton />
          </SearchFieldGroup>
          {local.description !== undefined && <DescriptionRoot>{local.description}</DescriptionRoot>}
          {local.errorMessage !== undefined && <FieldErrorRoot>{local.errorMessage}</FieldErrorRoot>}
        </>
      ) : (
        (local.children as Content)
      )}
    </SearchFieldPrimitive>
  );

  return (
    <Provider token={SearchFieldContext} value={contextValue}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * SearchField Group
 * -----------------------------------------------------------------------------------------------*/
interface SearchFieldGroupProps extends GroupPrimitiveProps {}

const SearchFieldGroup = (props: SearchFieldGroupProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(SearchFieldContext);
  const classOf = (): string | ((values: GroupRenderProps) => string) => composeTwRenderProps(local.class as never, slotsOf(context)?.group());
  const cls = hasLiveProp(local, ["class"]) || hasLiveProp(context, CONTEXT_KEYS) ? (values: GroupRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <GroupPrimitive class={cls as never} data-slot="search-field-group" {...(rest as object)}>
      {local.children as Content}
    </GroupPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * SearchField Input
 * -----------------------------------------------------------------------------------------------*/
interface SearchFieldInputProps extends InputPrimitiveProps {}

const SearchFieldInput = (props: SearchFieldInputProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const context = useContext(SearchFieldContext);
  const classOf = (): string | ((values: InputRenderProps) => string) => composeTwRenderProps(local.class as never, slotsOf(context)?.input());
  const cls = hasLiveProp(local, ["class"]) || hasLiveProp(context, CONTEXT_KEYS) ? (values: InputRenderProps) => renderClass(classOf(), values) : classOf();

  return <InputPrimitive class={cls as never} data-slot="search-field-input" {...(rest as object)} />;
};

/* -------------------------------------------------------------------------------------------------
 * SearchField Search Icon
 * -----------------------------------------------------------------------------------------------*/
interface SearchFieldSearchIconProps extends Omit<IconProps, "icon" | "class"> {
  children?: Content;
  class?: string;
}

const SearchFieldSearchIcon = (props: SearchFieldSearchIconProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(SearchFieldContext);

  if (local.children !== undefined) {
    return (
      <span class={composeSlotClassName(slotsOf(context)?.searchIcon, local.class)} data-slot="search-field-search-icon" {...(rest as object)}>
        {local.children}
      </span>
    );
  }

  return (
    <Icon
      class={composeSlotClassName(slotsOf(context)?.searchIcon, local.class)}
      data-slot="search-field-search-icon"
      icon={Search}
      size={16}
      {...(rest as Omit<IconProps, "icon">)}
    />
  );
};

/* -------------------------------------------------------------------------------------------------
 * SearchField Clear Button
 * -----------------------------------------------------------------------------------------------*/
interface SearchFieldClearButtonProps extends CloseButtonRootProps {}

const SearchFieldClearButton = (props: SearchFieldClearButtonProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const context = useContext(SearchFieldContext);
  const classOf = (): string | ((values: never) => string) => composeTwRenderProps(local.class as never, slotsOf(context)?.clearButton());
  const cls = hasLiveProp(local, ["class"]) || hasLiveProp(context, CONTEXT_KEYS) ? (values: never) => renderClass(classOf(), values) : classOf();

  return <CloseButton class={cls as never} data-slot="search-field-clear-button" slot="clear" {...(rest as object)} />;
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { SearchFieldRoot, SearchFieldGroup, SearchFieldInput, SearchFieldSearchIcon, SearchFieldClearButton, SearchFieldContext };

export type { SearchFieldRootProps, SearchFieldGroupProps, SearchFieldInputProps, SearchFieldSearchIconProps, SearchFieldClearButtonProps };
