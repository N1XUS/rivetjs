// Rivet (BIG-UI): the contexts of `./index.tsx`, as a leaf (re-exported there), so parents that provide them (ColorPicker
// provides every color child's context; tables / grid lists / trees the checkbox ones) do not import the component.
import { createContext } from "@rivetjs/reactivity";
import type { CheckboxGroupState } from "../state/checkbox-group.ts";
import type { ContextValue } from "../slots/index.tsx";
import type { CheckboxFieldProps, CheckboxGroupProps, CheckboxProps } from "./index.tsx";

/** RAC `CheckboxContext`. */
export const CheckboxContext = createContext<ContextValue<CheckboxProps, HTMLLabelElement>>(null);
/** RAC `CheckboxFieldContext`. */
export const CheckboxFieldContext = createContext<ContextValue<CheckboxFieldProps, HTMLDivElement>>(null);
/** RAC `CheckboxGroupContext`. */
export const CheckboxGroupContext = createContext<ContextValue<CheckboxGroupProps, HTMLDivElement>>(null);
/** RAC `CheckboxGroupStateContext`. */
export const CheckboxGroupStateContext = createContext<CheckboxGroupState | null>(null);
