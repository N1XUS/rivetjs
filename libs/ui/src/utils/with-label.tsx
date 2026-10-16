// Rivet helper for `Badge` / `Chip` / `Modal.Header` (no upstream counterpart). Upstream wraps `typeof children === "string" | "number"` in the
// part's `*Label` (React children are values). Rivet component children are compiler thunks (`_slot`) for any JSX child
// including `{expr}`, so a literal string / number child (`<Chip>text</Chip>`) is still a value but `{name}` / `{count()}` is a
// slot: it resolves in a child accessor (re-evaluated when its signals change) and a string / number result is wrapped (also
// when the server's resume lowering made it a text binding record: `slotText`).
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { isSlot, slotText } from "@rivetjs/runtime/slot";

type LabelComponent = (props: { children?: Content }) => JSX.Element;

export const withLabel = (children: Content, Label: LabelComponent): Content => {
  if (isSlot(children))
    return (() => {
      // On a resumed page the server lowers `{expr}` to a text binding record (`slotText` sees through it; the record stays
      // the Label's child so the browser's binding keeps its marker): same markup as the DOM lowering.
      const value = children() as Content,
        text = slotText(value);
      return typeof text === "string" || typeof text === "number" ? <Label>{value}</Label> : value;
    }) as unknown as Content;
  return typeof children === "string" || typeof children === "number" ? <Label>{children}</Label> : children;
};
