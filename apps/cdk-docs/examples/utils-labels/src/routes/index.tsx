import { clientEffect } from "@rivetjs/runtime/dom";
import { useDescription, useLabels } from "@rivetjs/cdk/utils";
import { CircleQuestionMark, Trash, X } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "useLabels() and useDescription()" };

// #region demo
export default function Labels() {
  // Pure: with aria-label and aria-labelledby, the element labels itself too, so both are read.
  const both = useLabels({ id: "delete", "aria-label": "Delete", "aria-labelledby": "row-title" });
  const fallback = useLabels({ id: "close" }, "Close");
  let help!: HTMLButtonElement;
  // Browser only: a shared hidden node per description text, reference counted.
  clientEffect(() => useDescription(help, "Opens the keyboard shortcut list"));
  return (
    <section class="m-4 grid max-w-md gap-2 text-sm">
      <p id="row-title" class="font-semibold">
        Quarterly report
      </p>
      <div class="flex gap-2">
        <button {...both} type="button" class="rounded-md border border-slate-300 px-3 py-1">
          <Icon icon={Trash} />
        </button>
        <button {...fallback} type="button" class="rounded-md border border-slate-300 px-3 py-1">
          <Icon icon={X} />
        </button>
        <button id="help" ref={(el) => (help = el)} type="button" class="rounded-md border border-slate-300 px-3 py-1">
          <Icon icon={CircleQuestionMark} />
        </button>
      </div>
      <pre class="rounded bg-slate-100 p-2 text-xs">{JSON.stringify({ both, fallback })}</pre>
    </section>
  );
}
// #endregion
