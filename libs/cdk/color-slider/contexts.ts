// Rivet (BIG-UI): the contexts of `./index.tsx`, as a leaf (re-exported there), so parents that provide them (ColorPicker
// provides every color child's context) do not import the component and its behaviour.
import { createContext } from "@rivetjs/reactivity";
import type { ColorSliderState } from "@rivetjs/cdk/color";
import type { ContextValue } from "../slots/index.tsx";
import type { ColorSliderProps } from "./index.tsx";

/** RAC `ColorSliderContext`. */
export const ColorSliderContext = createContext<ContextValue<Partial<ColorSliderProps>, HTMLDivElement>>(null);
/** RAC `ColorSliderStateContext`. */
export const ColorSliderStateContext = createContext<ColorSliderState | null>(null);
