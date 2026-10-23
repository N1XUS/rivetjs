// RAC `ProgressBarContext` (react-aria-components ProgressBar.tsx), Apache-2.0, © Adobe. Its own module so a Button
// (which provides `{ id }` to its pending ProgressBar) does not load the ProgressBar part, its behaviour and the
// number formatter on pages without a ProgressBar.
import { createContext } from "@rivetjs/reactivity";
import { type ContextValue } from "../slots/index.tsx";
import type { ProgressBarProps } from "./index.tsx";

/** RAC `ProgressBarContext` (Button provides `{ id }` to its pending ProgressBar). */
export const ProgressBarContext = createContext<ContextValue<ProgressBarProps, HTMLDivElement>>(null);
