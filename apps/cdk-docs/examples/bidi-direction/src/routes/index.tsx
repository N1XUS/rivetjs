import { signal } from "@rivetjs/reactivity";
import { direction, isRtlLocale } from "@rivetjs/cdk/bidi";

export const head = { title: "direction() and isRtlLocale()" };

// #region demo
export default function Directions() {
  const read = signal("Press a button");
  const locale = signal("ar-EG");
  const onRead = (event: MouseEvent & { currentTarget: HTMLButtonElement }) => read.set(`${event.currentTarget.id}: ${direction(event.currentTarget)}`);
  return (
    <section class="m-4 grid max-w-lg gap-3 text-sm">
      <div class="flex flex-wrap gap-2">
        <button id="page" type="button" class="rounded-md border border-slate-300 px-3 py-1" onClick={onRead}>
          Page (ltr)
        </button>
        <div dir="rtl" class="rounded border border-dashed border-slate-300 p-1">
          <button id="hebrew" type="button" class="rounded-md border border-slate-300 px-3 py-1" onClick={onRead}>
            עברית (dir=rtl)
          </button>
        </div>
        <div style={{ direction: "rtl" }} class="rounded border border-dashed border-slate-300 p-1">
          <button id="css" type="button" class="rounded-md border border-slate-300 px-3 py-1" onClick={onRead}>
            CSS direction: rtl
          </button>
        </div>
      </div>
      <p id="read" role="status">
        {read()}
      </p>
      <label class="grid gap-1">
        Locale
        <input id="locale" class="rounded border border-slate-300 px-2 py-1" value={locale()} onInput={(event) => locale.set(event.currentTarget.value)} />
      </label>
      <p id="locale-dir">
        isRtlLocale("{locale()}"): {String(isRtlLocale(locale()))}
      </p>
    </section>
  );
}
// #endregion
