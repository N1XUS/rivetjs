// Ported from react-spectrum packages/react-aria-components/src/SharedElementTransition.tsx, Apache-2.0, © Adobe.
// The scope half (`SharedElementContext`, `SharedElementTransition`), apart from `SharedElement` (./index.tsx):
// Tabs / RadioGroup provide a scope on every page, so their chunks carry these few bytes and never the
// SharedElement code (that one loads with the first SelectionIndicator that changes).
import { createContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, Slot } from "@rivetjs/runtime/jsx-runtime";
import { renderSlot } from "@rivetjs/runtime/slot";

export interface Snapshot {
  rect: DOMRect;
  style: [string, string][];
}

/** Snapshots by name (RAC: a ref object). Plain data on the server, so a resumed page re-provides the same object to every re-created element. */
export type SharedElementScope = { [name: string]: Snapshot };

/** RAC `SharedElementContext`. */
export const SharedElementContext = createContext<SharedElementScope | null>(null);

export interface SharedElementTransitionProps {
  /** Plain JSX children are lazy (rendered inside the scope); a function `{() => …}` works too. */
  children?: Content | Slot;
}

/**
 * A scope for SharedElements, which animate between parents.
 */
export function SharedElementTransition(props: SharedElementTransitionProps) {
  const scope: SharedElementScope = {};
  const children = props.children;
  return (
    <Provider token={SharedElementContext} value={scope}>
      {renderSlot(children)}
    </Provider>
  );
}
