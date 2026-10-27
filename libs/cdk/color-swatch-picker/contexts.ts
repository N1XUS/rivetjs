// Rivet (BIG-UI): the contexts of `./index.tsx`, as a leaf (re-exported there), so parents that provide them (ColorPicker
// provides every color child's context) do not import the component and its behaviour.
import { createContext } from "@rivetjs/reactivity";
import type { ContextValue } from "../slots/index.tsx";
import type { ColorSwatchPickerProps } from "./index.tsx";

/** RAC `ColorSwatchPickerContext`. */
export const ColorSwatchPickerContext = createContext<ContextValue<ColorSwatchPickerProps, HTMLDivElement>>(null);
