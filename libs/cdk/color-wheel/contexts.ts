// Rivet (BIG-UI): the contexts of `./index.tsx`, as a leaf (re-exported there), so parents that provide them (ColorPicker
// provides every color child's context) do not import the component and its behaviour.
import { createContext } from "@rivetjs/reactivity";
import type { ColorWheelState } from "@rivetjs/cdk/color";
import type { ContextValue } from "../slots/index.tsx";
import type { ColorWheelProps } from "./index.tsx";

/** RAC `ColorWheelContext`. */
export const ColorWheelContext = createContext<ContextValue<Partial<ColorWheelProps>, HTMLDivElement>>(null);
/** RAC `ColorWheelStateContext`. */
export const ColorWheelStateContext = createContext<ColorWheelState | null>(null);
