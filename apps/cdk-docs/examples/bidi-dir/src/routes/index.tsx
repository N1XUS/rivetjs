import { signal } from "@rivetjs/reactivity";
import { Dir } from "@rivetjs/cdk/bidi-dir";
import { injectDirectionality } from "@rivetjs/cdk/bidi";

export const head = { title: "<Dir>" };

// #region demo
// Reads the closest <Dir> (Angular `inject(Directionality)`), else the document's direction.
function DirectionBadge(props: { id: string }) {
  const { valueSignal, rawDir } = injectDirectionality();
  return (
    <p id={props.id} class="rounded bg-slate-100 px-2 py-1">
      direction: {valueSignal()} (dir attribute: {rawDir()})
    </p>
  );
}

export default function Directionality() {
  const value = signal("rtl");
  return (
    <section class="m-4 grid max-w-md gap-3 text-sm">
      <div role="group" aria-label="dir" class="flex gap-2">
        {["ltr", "rtl", "RTL"].map((option) => (
          <button
            id={`set-${option}`}
            type="button"
            aria-pressed={value() === option ? "true" : "false"}
            class="rounded-md border border-slate-300 px-3 py-1 aria-pressed:bg-teal-700 aria-pressed:text-white"
            onClick={() => value.set(option)}
          >
            {option}
          </button>
        ))}
      </div>
      {/* Children that read the Directionality: a render function, so they run inside the provider. */}
      {value() === "ltr" ? (
        <Dir id="region" dir="ltr" class="rounded border border-dashed border-slate-300 p-2">
          {() => <DirectionBadge id="inside" />}
        </Dir>
      ) : value() === "rtl" ? (
        <Dir id="region" dir="rtl" class="rounded border border-dashed border-slate-300 p-2">
          {() => <DirectionBadge id="inside" />}
        </Dir>
      ) : (
        <Dir id="region" dir="RTL" as="section" class="rounded border border-dashed border-slate-300 p-2">
          {() => <DirectionBadge id="inside" />}
        </Dir>
      )}
      <DirectionBadge id="outside" />
    </section>
  );
}
// #endregion
