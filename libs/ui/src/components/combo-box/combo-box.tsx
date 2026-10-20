// Ported from HeroUI v3.2.6 packages/react/src/components/combo-box/combo-box.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components/{Button,ComboBox,Group}` → `@rivetjs/cdk/{button,combobox,
//   group,popover}` (render props are accessors); `@heroui/styles` → vendored `styles/`.
// - `ComboBoxContext` (own module `combo-box-context.ts`, read by `Input` too) carries plain data `{ inComboBox, fullWidth, variant }`
//   instead of `{ slots, variant }` (tv slot functions do not serialize; slots = a module-level memo per `fullWidth`). Resumable
//   token `rv-ui-combo-box`, default `{}`.
// - `ComboBox.InputGroup`: upstream injects its props into the last child (the Trigger) through a collection slot
//   (`createCollectionSlot` + `Children.toArray`), and the Trigger renders `Group > [siblings…, Button]`. Rivet JSX has no children
//   inspection / clone: the InputGroup is the cdk `Group` itself (`combo-box__input-group`, `data-slot="combo-box-input-group"`)
//   around its children, the Trigger is always a plain Button. Same DOM (`div[role=group] > input + button`) for the upstream
//   composition (Input first, Trigger last); `render` goes to the cdk Group.
// - Root children: upstream wraps them in a render-prop fragment; the cdk ComboBox takes the same children (value or function).
// - `FieldSlotsGate` is not ported (`libs/ui/CLAUDE.md` Known diffs: cdk `Text` hides itself in a collection build pass).
// - Default trigger icon = the morph chevron (CSS bars, `morph-icon.css`, TW-149; upstream `IconChevronDown` inline svg that rotates).
// - Rivet additions (identity spec §4.2, plan T22): `ComboBox.Item` (= ListBox.Item + ItemIndicator, `textValue` from string
//   children) and the auto form: a root with `label`, `placeholder`, `description`, `errorMessage` or `items` renders Label +
//   InputGroup (Input + Trigger) + Popover + ListBox around its children (ListBox content, or a render function of the root's
//   `items`) + Description + FieldError. Decided once at render; the compound form is unchanged.
import { Button } from "@rivetjs/cdk/button";
import type { ButtonProps, ButtonRenderProps } from "@rivetjs/cdk/button";
import { ComboBox as ComboBoxPrimitive, ComboBoxStateContext, ComboBoxValue as ComboBoxValuePrimitive } from "@rivetjs/cdk/combobox";
import type {
  ComboBoxProps as ComboBoxPrimitiveProps,
  ComboBoxRenderProps,
  ComboBoxState,
  ComboBoxValueProps as ComboBoxValuePrimitiveProps,
  ComboBoxValueRenderProps,
  SelectionMode,
} from "@rivetjs/cdk/combobox";
import { Group as GroupPrimitive } from "@rivetjs/cdk/group";
import type { GroupProps as GroupPrimitiveProps, GroupRenderProps } from "@rivetjs/cdk/group";
import { Popover as PopoverPrimitive } from "@rivetjs/cdk/popover";
import type { PopoverProps as PopoverPrimitiveProps, PopoverRenderProps } from "@rivetjs/cdk/popover";
import { useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import type { ComboBoxVariants } from "../../../styles/src/components/combo-box/index.ts";
import { comboBoxVariants } from "../../../styles/src/components/combo-box/index.ts";
import type { SurfaceVariants } from "../../../styles/src/components/surface/index.ts";
import { composeTwRenderProps } from "../../utils/compose.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";
import { DescriptionRoot } from "../description/description.tsx";
import { FieldErrorRoot, type FieldErrorRootProps } from "../field-error/field-error.tsx";
import { InputRoot } from "../input/input.tsx";
import { LabelRoot } from "../label/label.tsx";
import { ListBoxRoot } from "../list-box/list-box.tsx";
import { ListBoxItemWithIndicator, type ListBoxItemRootProps } from "../list-box-item/list-box-item.tsx";
import { SurfaceContext } from "../surface/index.ts";
import { ComboBoxContext } from "./combo-box-context.ts";
import type { ComboBoxContextValue } from "./combo-box-context.ts";
import { isSlot } from "@rivetjs/runtime/slot";
import { portalTheme } from "../../utils/portal-theme.ts";

type ComboBoxSlots = ReturnType<typeof comboBoxVariants>;
const SLOTS = new Map<string, ComboBoxSlots>();
/** Upstream `use(ComboBoxContext).slots`: `undefined` outside a ComboBox. */
const slotsOf = (context: ComboBoxContextValue): ComboBoxSlots | undefined => {
  if (!context.inComboBox) return undefined;
  const fullWidth = context.fullWidth;
  const key = `${fullWidth}`;
  let slots = SLOTS.get(key);
  if (!slots) SLOTS.set(key, (slots = comboBoxVariants({ fullWidth })));
  return slots;
};

const DEFAULT_SURFACE_CONTEXT = { variant: "default" as SurfaceVariants["variant"] };

/* -------------------------------------------------------------------------------------------------
 * ComboBox Root
 * -----------------------------------------------------------------------------------------------*/
type ComboBoxRootProps<T extends object = object, M extends SelectionMode = "single"> = Omit<ComboBoxPrimitiveProps<T, M>, "children"> &
  ComboBoxVariants & {
    /**
     * The variant of the combo box.
     * @default "primary"
     */
    variant?: "primary" | "secondary";
    /** Auto form: the visible Label content (any shorthand prop renders InputGroup + Popover + ListBox around the children). */
    label?: Content;
    /** Auto form: placeholder of the Input. */
    placeholder?: string;
    /** Auto form: Description below the field. */
    description?: Content;
    /** Auto form: FieldError content (shown while the field is invalid). */
    errorMessage?: FieldErrorRootProps["children"];
  } & (
    | { items?: undefined; children?: ComboBoxPrimitiveProps<T, M>["children"] }
    | {
        items: Iterable<T>;
        /** Compound parts, or (auto form) a render function of one item returning `ComboBox.Item`. */
        children?: ComboBoxPrimitiveProps<T, M>["children"] | ((item: T) => Content);
      }
  );

function ComboBoxRoot<T extends object = object, M extends SelectionMode = "single">(props: ComboBoxRootProps<T, M>): JSX.Element {
  const [local, rest] = splitLive(props as ComboBoxRootProps, [
    "children",
    "class",
    "description",
    "errorMessage",
    "fullWidth",
    "label",
    "menuTrigger",
    "placeholder",
    "variant",
  ]);
  const contextValue: ComboBoxContextValue = hasLiveProp(local, ["fullWidth", "variant"])
    ? {
        inComboBox: true,
        get fullWidth() {
          return local.fullWidth;
        },
        get variant() {
          return local.variant;
        },
      }
    : { inComboBox: true, fullWidth: local.fullWidth, variant: local.variant };
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(contextValue)?.base()) as string | ((v: ComboBoxRenderProps) => string);
  const cls = hasLiveProp(local, ["class", "fullWidth"]) ? (values: ComboBoxRenderProps) => renderClass(classOf(), values) : classOf();
  // `items` next to compound (slot) children: the compound form renders and `items` stays on the cdk ComboBox (RAC: the
  // ListBox inside inherits the root's items). Decided once.
  const compound = (rest as { items?: unknown }).items !== undefined && isSlot(local.children);
  const auto =
    !compound &&
    (local.label !== undefined ||
      local.placeholder !== undefined ||
      local.description !== undefined ||
      local.errorMessage !== undefined ||
      (rest as { items?: unknown }).items !== undefined);
  const content = () => (
    <ComboBoxPrimitive data-slot="combo-box" menuTrigger={local.menuTrigger ?? "focus"} {...(rest as ComboBoxPrimitiveProps)} class={cls as never}>
      {auto ? (
        <>
          {local.label !== undefined && <LabelRoot>{local.label}</LabelRoot>}
          <ComboBoxInputGroup>
            <InputRoot placeholder={local.placeholder} />
            <ComboBoxTrigger />
          </ComboBoxInputGroup>
          <ComboBoxPopover>
            <ListBoxRoot>{local.children as never}</ListBoxRoot>
          </ComboBoxPopover>
          {local.description !== undefined && <DescriptionRoot>{local.description}</DescriptionRoot>}
          {local.errorMessage !== undefined && <FieldErrorRoot>{local.errorMessage}</FieldErrorRoot>}
        </>
      ) : (
        local.children
      )}
    </ComboBoxPrimitive>
  );

  return (
    <Provider token={ComboBoxContext} value={contextValue}>
      {content()}
    </Provider>
  );
}

/* -------------------------------------------------------------------------------------------------
 * ComboBox InputGroup
 * -----------------------------------------------------------------------------------------------*/
interface ComboBoxInputGroupProps extends GroupPrimitiveProps {
  children?: Content;
}

const ComboBoxInputGroup = (props: ComboBoxInputGroupProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(ComboBoxContext);
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.inputGroup()) as string | ((v: GroupRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: GroupRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <GroupPrimitive {...(rest as GroupPrimitiveProps)} class={cls as never} data-slot="combo-box-input-group">
      {local.children}
    </GroupPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * ComboBox Value
 * -----------------------------------------------------------------------------------------------*/
interface ComboBoxValueProps<T extends object = object> extends ComboBoxValuePrimitiveProps<T> {}

const ComboBoxValue = <T extends object = object>(props: ComboBoxValueProps<T>): JSX.Element => {
  const [local, rest] = splitLive(props as unknown as ComboBoxValueProps, ["children", "class"]);
  const context = useContext(ComboBoxContext);
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.value()) as string | ((v: ComboBoxValueRenderProps<T>) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: ComboBoxValueRenderProps<T>) => renderClass(classOf(), values) : classOf();

  return (
    <ComboBoxValuePrimitive class={cls as never} data-slot="combo-box-value" {...(rest as ComboBoxValuePrimitiveProps)}>
      {local.children as never}
    </ComboBoxValuePrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * ComboBox Trigger
 * -----------------------------------------------------------------------------------------------*/
interface ComboBoxTriggerProps extends ButtonProps {
  class?: ButtonProps["class"];
  children?: Content;
}

const ComboBoxTrigger = (props: ComboBoxTriggerProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(ComboBoxContext);
  const state = useContext(ComboBoxStateContext) as ComboBoxState<any, SelectionMode> | null;
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.trigger()) as string | ((v: ButtonRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: ButtonRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <Button class={cls as never} data-open={(() => (state?.isOpen() ? "true" : undefined)) as never} data-slot="combo-box-trigger" {...(rest as ButtonProps)}>
      {local.children ?? (
        // Default = morph chevron (CSS bars, `morph-icon.css`, TW-149), `data-open` on the icon itself.
        <span aria-hidden="true" class="morph-chevron" data-open={state?.isOpen() ? "true" : undefined} data-slot="combo-box-trigger-default-icon" />
      )}
    </Button>
  );
};

/* -------------------------------------------------------------------------------------------------
 * ComboBox Popover
 * -----------------------------------------------------------------------------------------------*/
interface ComboBoxPopoverProps extends Omit<PopoverPrimitiveProps, "children"> {
  children: Content;
}

const ComboBoxPopover = (props: ComboBoxPopoverProps): JSX.Element => {
  portalTheme();
  const [local, rest] = splitLive(props, ["children", "class", "placement"]);
  const context = useContext(ComboBoxContext);
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.popover()) as string | ((v: PopoverRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: PopoverRenderProps) => renderClass(classOf(), values) : classOf();
  const content = () => (
    <PopoverPrimitive {...(rest as PopoverPrimitiveProps)} class={cls as never} data-slot="combo-box-popover" placement={local.placement ?? "bottom"}>
      {local.children}
    </PopoverPrimitive>
  );

  return (
    <Provider token={SurfaceContext} value={DEFAULT_SURFACE_CONTEXT}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * ComboBox Item (Rivet)
 * -----------------------------------------------------------------------------------------------*/
interface ComboBoxItemProps<T extends object = object> extends ListBoxItemRootProps<T> {}

/** `ListBox.Item` + `ListBox.ItemIndicator`; `textValue` defaults to string / number children. */
const ComboBoxItem = ListBoxItemWithIndicator as <T extends object = object>(props: ComboBoxItemProps<T>) => JSX.Element;

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { ComboBoxRoot, ComboBoxInputGroup, ComboBoxValue, ComboBoxTrigger, ComboBoxPopover, ComboBoxItem, ComboBoxContext };

export type {
  ComboBoxRootProps,
  ComboBoxInputGroupProps,
  ComboBoxValueProps,
  ComboBoxValueRenderProps,
  ComboBoxTriggerProps,
  ComboBoxPopoverProps,
  ComboBoxItemProps,
};
