// Rivet (BIG-UI): the contexts of `./index.tsx`, as a leaf (re-exported there), so parents that provide them (ColorPicker
// provides every color child's context) do not import the component and its behaviour.
import { createContext } from "@rivetjs/reactivity";
import type { ColorAreaState } from "@rivetjs/cdk/color";
import type { ContextValue } from "../slots/index.tsx";
import type { ColorAreaProps } from "./index.tsx";

/** RAC `ColorAreaContext`. */
export const ColorAreaContext = createContext<ContextValue<Partial<ColorAreaProps>, HTMLDivElement>>(null);
/** RAC `ColorAreaStateContext`. */
export const ColorAreaStateContext = createContext<ColorAreaState | null>(null);
