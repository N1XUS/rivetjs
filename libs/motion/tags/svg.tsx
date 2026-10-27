// `<Motion.svg>` (`../tags.tsx`): one module per tag, so a page's chunk graph carries the tags it renders only.
import type { JSX } from "@rivetjs/runtime/jsx-runtime";
import { motionElement, type MotionTagProps } from "../element.tsx";
import { entrance } from "../entrance.ts";

export function Svg(props: MotionTagProps<"svg">): JSX.Element {
  const m = motionElement(props as never, "svg", entrance);
  return m.mount(
    <svg {...(m.rest as object)} {...(m.bind as object)} onPointerEnter={m.enter} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </svg>,
  ) as JSX.Element;
}
