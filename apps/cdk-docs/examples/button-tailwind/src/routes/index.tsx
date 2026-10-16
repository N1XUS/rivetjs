import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";

export const head = { title: "Button with Tailwind" };

// #region demo
// `class` replaces the default `rv-Button`. State comes from attributes: data-pressed while
// pressed, data-pending, :disabled, :focus-visible and :hover.
const button =
  "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium outline-none transition " +
  "bg-teal-700 text-white hover:bg-teal-800 data-[pressed]:scale-95 data-[pressed]:bg-teal-900 " +
  "focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 " +
  "disabled:cursor-not-allowed disabled:bg-slate-300 data-[pending]:opacity-70";

export default function TailwindButtons() {
  const count = signal(0);
  return (
    <div class="m-4 flex items-center gap-3 text-sm">
      <Button id="tw-primary" class={button} onPress={() => count.update((n) => n + 1)}>
        Pressed <span id="tw-count">{count()}</span>
      </Button>
      <Button id="tw-off" class={button} isDisabled>
        Disabled
      </Button>
    </div>
  );
}
// #endregion
