import { signal } from "@rivetjs/reactivity";
import { focusProps, focusWithinProps } from "@rivetjs/cdk/interactions/focus";

export const head = { title: "focusProps and focusWithinProps" };

// #region demo
export default function Contact() {
  const self = signal<string[]>([]);
  const within = signal<string[]>([]);
  const inside = signal(false);
  // Only the email input itself (focus of children would be ignored).
  const focus = focusProps({
    onFocus: () => self.update((l) => [...l, "email:focus"]),
    onBlur: () => self.update((l) => [...l, "email:blur"]),
  });
  // The fieldset and everything in it.
  const focusWithin = focusWithinProps({
    onFocusWithin: () => within.update((l) => [...l, "group:in"]),
    onBlurWithin: () => within.update((l) => [...l, "group:out"]),
    onFocusWithinChange: (focused) => inside.set(focused),
  });
  return (
    <section class="m-4 grid max-w-sm gap-3 text-sm">
      <fieldset
        {...focusWithin.focusWithinProps}
        data-focus-within={inside() || undefined}
        class="grid gap-2 rounded-md border border-slate-300 p-3 data-[focus-within]:border-teal-700"
      >
        <legend class="px-1">Contact</legend>
        <input id="email" aria-label="Email" {...focus.focusProps} class="rounded border border-slate-300 px-2 py-1" />
        <input id="phone" aria-label="Phone" class="rounded border border-slate-300 px-2 py-1" />
      </fieldset>
      <button id="outside" type="button" class="justify-self-start rounded border border-slate-300 px-2 py-1">
        Outside
      </button>
      <output id="self" class="block font-mono text-xs">
        {self().join(" ")}
      </output>
      <output id="within" class="block font-mono text-xs">
        {within().join(" ")}
      </output>
      <p id="state">group focused: {String(inside())}</p>
    </section>
  );
}
// #endregion
