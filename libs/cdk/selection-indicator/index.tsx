// Ported from react-spectrum packages/react-aria-components/src/SelectionIndicator.tsx, Apache-2.0, © Adobe.
// An animated indicator of selection state within a group of items: a `SharedElement` named
// "SelectionIndicator", visible while the enclosing item (Tab, Radio, ToggleButton) is selected.
// Rivet: the context value's `isSelected` is an accessor (a boolean is accepted too), so the item never
// re-renders; RAC `useContextProps` → own props win over the context's (`isSelected`, `class`, `style`).
import { useContext } from "@rivetjs/reactivity";
import { SelectionIndicatorContext } from "./context.ts";
import { SharedElement, type SharedElementPropsBase, type SharedElementRenderProps } from "../shared-element-transition/index.tsx";

export type { SharedElementRenderProps } from "../shared-element-transition/index.tsx";
export { SelectionIndicatorContext, type SelectionIndicatorContextValue } from "./context.ts";

export interface SelectionIndicatorProps extends SharedElementPropsBase {
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-SelectionIndicator'
   */
  class?: string | ((values: SharedElementRenderProps) => string | undefined);
  /**
   * Whether the SelectionIndicator is visible. This is usually set automatically by the parent
   * component (an accessor or a boolean).
   */
  isSelected?: boolean | (() => boolean);
}

/**
 * An animated indicator of selection state within a group of items.
 */
export function SelectionIndicator(props: SelectionIndicatorProps) {
  const context = useContext(SelectionIndicatorContext);
  const isSelected = props.isSelected ?? context.isSelected;
  const className = props.class ?? context.class ?? "rv-SelectionIndicator";
  const style = props.style ?? context.style;
  const children = props.children;
  const rest: SharedElementPropsBase = {};
  for (const key in props)
    if (key !== "isSelected" && key !== "class" && key !== "style" && key !== "children")
      (rest as Record<string, unknown>)[key] = (props as Record<string, unknown>)[key];
  // A plain call (not JSX): its reads belong to this component's site, and `children` reaches it as given (a render function stays one).
  return SharedElement({ ...rest, class: className, style, children, name: "SelectionIndicator", isVisible: isSelected ?? false });
}
