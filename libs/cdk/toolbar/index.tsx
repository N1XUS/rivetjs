// Ported from react-aria-components `Toolbar` (packages/react-aria-components/src/Toolbar.tsx), Apache-2.0, © Adobe.
// A toolbar is a container for a set of interactive controls with arrow key navigation (also across `Group`s and
// separators); Tab leaves the toolbar.
// Rivet:
// - keyboard handling = `./behaviour.ts` (RA useToolbar port; bubbling listeners, see its header); `data-rk`
//   holds the arrow keys while the handler chunk loads.
// - a Toolbar inside another Toolbar renders `role="group"` from the server on (RA decides in a layout effect).
// - render props are accessors (`class={({ orientation }) => …}`); `class` = RAC `className` (default `rv-Toolbar`).
// `render` (RAC DOMRenderProps): given, the attributes object (handlers included) goes to `render(attrs, ToolbarRenderProps)` instead of the default `<div>`.
import { createContext, provide, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import { type DOMRenderProps } from "../utils/render.ts";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import { contextProps, resumableContext, type ContextValue, type RefValue, type RenderProps, type SlotProps } from "../slots/index.tsx";
import type { Orientation } from "../utils/types.ts";
import { useLocale } from "../i18n/index.ts";
import { toolbarBlur, toolbarFocus, toolbarKeyDown, toolbarKeys, toolbarProps, type AriaToolbarProps } from "./behaviour.ts";
import { renderPropsOf } from "../slots/index.tsx";

export interface ToolbarRenderProps {
  /** The current orientation of the toolbar. `[data-orientation]` */
  orientation: () => Orientation;
}

export interface ToolbarProps
  extends
    AriaToolbarProps,
    SlotProps,
    RenderProps<ToolbarRenderProps>,
    DOMRenderProps<"div", ToolbarRenderProps>,
    Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  ref?: RefValue<HTMLDivElement>;
}

/** RAC `ToolbarContext`. */
export const ToolbarContext = resumableContext(createContext<ContextValue<ToolbarProps, HTMLDivElement>>({}, { id: "rv-toolbar" }));

/** Rivet: set inside a toolbar, so a nested one renders `role="group"` (RA `isInToolbar`). */
const InToolbarContext = resumableContext(createContext<boolean>(false, { id: "rv-in-toolbar" }));

/** A toolbar is a container for a set of interactive controls with arrow key navigation (RAC `Toolbar`). */
export function Toolbar(inProps: ToolbarProps) {
  const [props, ref] = contextProps(inProps, inProps.ref, ToolbarContext) as [ToolbarProps, RefValue<HTMLDivElement> | undefined];
  const orientation: Orientation = props.orientation || "horizontal";
  const isInToolbar = useContext(InToolbarContext);
  const aria = toolbarProps(props, isInToolbar);
  // Options hoisted: no function in the `rp` initializer (spread sites capture `rp.class` /
  // `rp.style`, not the children accessor: per-key live views).
  const rpOptions = {
    values: { orientation: () => orientation },
    defaultClassName: "rv-Toolbar",
  };
  const rp = renderPropsOf(props, rpOptions);
  const keyProps = { orientation, direction: useLocale().direction };
  // Read every prop up front: an element with a spread resumes as one binding over all its attributes.
  const dom = globalDOMProps(props, ["style"]);
  const slot = props.slot || undefined;
  if (props.render) {
    const attrs = {
      ...dom,
      ref: ref as never,
      id: aria.id as string | undefined,
      role: aria.role as string,
      "aria-orientation": orientation,
      "aria-label": aria["aria-label"] as string | undefined,
      "aria-labelledby": aria["aria-labelledby"] as string | undefined,
      "aria-describedby": aria["aria-describedby"] as string | undefined,
      "aria-details": aria["aria-details"] as string | undefined,
      slot: slot,
      class: () => rp.class(),
      style: () => rp.style(),
      "data-orientation": orientation,
      "data-rk": isInToolbar ? undefined : toolbarKeys(orientation),
      onKeyDown: (event: KeyboardEvent) => toolbarKeyDown(event as never, keyProps),
      onFocusIn: (event: FocusEvent) => toolbarFocus(event as never),
      onFocusOut: (event: FocusEvent) => toolbarBlur(event as never),
      children: () => (
        <Provider token={InToolbarContext} value={true}>
          {rp.children()}
        </Provider>
      ),
    };
    return props.render(attrs as never, { orientation: () => orientation });
  }
  return (
    <div
      {...dom}
      ref={ref as never}
      id={aria.id as string | undefined}
      role={aria.role as string}
      aria-orientation={orientation}
      aria-label={aria["aria-label"] as string | undefined}
      aria-labelledby={aria["aria-labelledby"] as string | undefined}
      aria-describedby={aria["aria-describedby"] as string | undefined}
      aria-details={aria["aria-details"] as string | undefined}
      slot={slot}
      class={rp.class()}
      style={rp.style()}
      data-orientation={orientation}
      data-rk={isInToolbar ? undefined : toolbarKeys(orientation)}
      onKeyDown={(event) => toolbarKeyDown(event, keyProps)}
      onFocusIn={(event) => toolbarFocus(event)}
      onFocusOut={(event) => toolbarBlur(event)}
    >
      {provide(InToolbarContext, true, () => rp.children())}
    </div>
  );
}
