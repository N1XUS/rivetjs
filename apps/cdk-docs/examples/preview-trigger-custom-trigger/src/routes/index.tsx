import { Focusable } from "@rivetjs/cdk/focusable";
import { Popover } from "@rivetjs/cdk/popover";
import { PreviewTrigger } from "@rivetjs/cdk/preview-trigger";

export const head = { title: "PreviewTrigger custom trigger" };

// #region demo
export default function CustomTrigger() {
  return (
    <section class="mx-4 mt-8 text-sm">
      <PreviewTrigger delay={0}>
        {/* Focusable passes the trigger props to the element: spread them and pass the ref. A role is required. */}
        <Focusable>
          {(p) => (
            <span {...p} ref={p.ref as never} id="ptc-trigger" role="link" class="cursor-pointer text-indigo-700 underline">
              Custom trigger
            </span>
          )}
        </Focusable>
        <Popover id="ptc-preview" class="rv-Popover p-4">
          This preview was triggered by a custom element.
        </Popover>
      </PreviewTrigger>
    </section>
  );
}
// #endregion
