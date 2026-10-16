// `CheckboxGroupContext` (resumable `rv-ui-checkbox-group`, `{}` default): own module so `checkbox.tsx` reads it and
// `checkbox-group.tsx` (the `items` shorthand renders Checkboxes) imports `checkbox.tsx` without an import cycle.
import { createContext } from "@rivetjs/reactivity";
import { resumableContext } from "@rivetjs/runtime/resume-format";

import type { CheckboxVariants } from "../../../styles/src/components/checkbox/index.ts";

interface CheckboxGroupContext {
  variant?: CheckboxVariants["variant"];
}

const CheckboxGroupContext = resumableContext(createContext<CheckboxGroupContext>({}, { id: "rv-ui-checkbox-group" }));

export { CheckboxGroupContext };
export type { CheckboxGroupContext as CheckboxGroupContextValue };
