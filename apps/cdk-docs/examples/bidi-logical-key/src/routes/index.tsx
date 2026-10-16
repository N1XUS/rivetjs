import { direction, logicalKey } from "@rivetjs/cdk/bidi";

export const head = { title: "logicalKey()" };

// #region demo
function Toolbar(props: { id: string; dir: "ltr" | "rtl"; labels: string[] }) {
  return (
    <div
      id={props.id}
      role="toolbar"
      aria-label={props.dir === "rtl" ? "Right-to-left toolbar" : "Left-to-right toolbar"}
      dir={props.dir}
      class="flex gap-1"
      onKeyDown={(event) => {
        // Reason in "start" / "end": in rtl, ArrowLeft moves forward.
        const key = logicalKey(event.key, direction(event.currentTarget));
        const items = [...event.currentTarget.querySelectorAll("button")];
        const at = items.indexOf(event.target as HTMLButtonElement);
        const next = key === "ArrowRight" ? at + 1 : key === "ArrowLeft" ? at - 1 : -2;
        if (next === -2) return;
        event.preventDefault();
        items[Math.max(0, Math.min(items.length - 1, next))]?.focus();
      }}
    >
      {props.labels.map((label, i) => (
        <button id={`${props.id}-${i}`} type="button" class="rounded border border-slate-300 px-3 py-1 focus:outline-2 focus:outline-teal-700">
          {label}
        </button>
      ))}
    </div>
  );
}

export default function Toolbars() {
  return (
    <section class="m-4 grid max-w-md gap-3 text-sm">
      <Toolbar id="ltr" dir="ltr" labels={["Bold", "Italic", "Underline"]} />
      <Toolbar id="rtl" dir="rtl" labels={["מודגש", "נטוי", "קו תחתון"]} />
    </section>
  );
}
// #endregion
