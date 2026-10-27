// Rivet (BIG-UI): the contexts of `./index.tsx`, as a leaf (re-exported there), so parents that provide them (ColorPicker
// provides every color child's context) do not import the component and its behaviour.
import { createContext } from "@rivetjs/reactivity";
import type { ColorChannelFieldState, ColorFieldState } from "@rivetjs/cdk/color";
import type { ContextValue } from "../slots/index.tsx";
import type { ColorFieldProps } from "./index.tsx";

/** RAC `ColorFieldContext`. */
export const ColorFieldContext = createContext<ContextValue<Partial<ColorFieldProps>, HTMLDivElement>>(null);
/** RAC `ColorFieldStateContext`. */
export const ColorFieldStateContext = createContext<ColorFieldState | ColorChannelFieldState | null>(null);
