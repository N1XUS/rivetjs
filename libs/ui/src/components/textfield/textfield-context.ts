// Ported from HeroUI v3.2.6 packages/react/src/components/textfield/textfield.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `TextFieldContext` in its own module (upstream: `textfield.tsx`) so `Input` / `TextArea` / `InputGroup` read the variant
// fallback without pulling in the TextField root and the cdk TextField (BIG-UI). Resumable token `rv-ui-textfield`, default `{}`.
import { createContext } from "@rivetjs/reactivity";

/* ------------------------------------------------------------------------------------------------
 * TextField Context
 * --------------------------------------------------------------------------------------------- */
type TextFieldContext = {
  variant?: "primary" | "secondary";
};

const TextFieldContext = createContext<TextFieldContext>({});

export { TextFieldContext };
export type { TextFieldContext as TextFieldContextValue };
