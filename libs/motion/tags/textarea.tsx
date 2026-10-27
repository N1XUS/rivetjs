// `<Motion.textarea>` (`../tags.tsx`): one module per tag, so a page's chunk graph carries the tags it renders only.
import type { JSX } from "@rivetjs/runtime/jsx-runtime";
import { motionElement, type MotionTagProps } from "../element.tsx";
import { entrance } from "../entrance.ts";

export function Textarea(props: MotionTagProps<"textarea">): JSX.Element {
  const m = motionElement(props as never, "textarea", entrance);
  return m.mount(
    <textarea {...(m.rest as object)} {...(m.bind as object)} onPointerEnter={m.enter} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </textarea>,
  ) as JSX.Element;
}
