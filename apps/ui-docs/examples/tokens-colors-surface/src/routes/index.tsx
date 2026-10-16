// Rivet-authored demo: the surface / layer color tokens of the current theme, values read from the live CSS.
import { signal } from "@rivetjs/reactivity";
import { clientEffect, ref } from "@rivetjs/runtime/dom";

export const head = { title: "Colors: Surface tokens" };

// #region demo
/** Shortens long decimals of a computed value (`oklch(0.5200001 …)` → `oklch(0.52 …)`). */
function tidy(value: string) {
  return value
    .trim()
    .replace(/\d*\.\d{4,}/g, (n) => String(+(+n).toFixed(3)))
    .replace(/(^|[^\d])\.(\d)/g, (_, before: string, digit: string) => `${before}0.${digit}`)
    .replace(/(^|[^\d.])-0(?![.\d])/g, (_, before: string) => `${before}0`)
    .replace(/\d[\d.]*e\+\d+px/g, "calc(infinity * 1px)");
}

export function SurfaceLayers() {
  // Resolved value of every [data-token] element, root included (CSS property in data-prop), read on load and on every theme switch.
  const values = signal<Record<string, string>>({});
  const root = ref<HTMLElement>();
  clientEffect(() => {
    const el = root();
    if (!el) return;
    const read = () =>
      values.set(
        Object.fromEntries(
          [el, ...el.querySelectorAll<HTMLElement>("[data-token]")]
            .filter((n) => n.dataset.token)
            .map((n) => [n.dataset.token!, tidy(getComputedStyle(n).getPropertyValue(n.dataset.prop ?? "background-color"))]),
        ),
      );
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => observer.disconnect();
  });
  const label = (token: string, use: string) => (
    <p class="m-0 flex flex-wrap items-baseline gap-x-2 text-xs">
      <code class="font-mono font-medium text-foreground">{token}</code>
      <span class="text-muted">{use}</span>
      <span data-value={token} class="font-mono text-muted tabular-nums">
        {() => values()[token] ?? ""}
      </span>
    </p>
  );
  return (
    <div ref={root} data-token="--background" class="grid gap-4 bg-background p-4 sm:p-6">
      {label("--background", "page")}
      <div data-token="--surface" class="grid gap-3 rounded-3xl bg-surface p-4 shadow-surface">
        {label("--surface", "cards, panels")}
        <div data-token="--surface-secondary" class="grid gap-3 rounded-2xl bg-surface-secondary p-4">
          {label("--surface-secondary", "nested areas")}
          <div data-token="--surface-tertiary" class="grid gap-2 rounded-xl bg-surface-tertiary p-4">
            {label("--surface-tertiary", "third level")}
          </div>
        </div>
        <div class="grid gap-2">
          {label("--field-background", "inputs")}
          <div
            data-token="--field-background"
            class="flex h-10 items-center rounded-field border-(length:--border-width-field) border-field-border bg-field px-3 text-sm text-field-placeholder shadow-field"
          >
            Search orders
          </div>
        </div>
        <div class="grid gap-2">
          {label("--separator", "dividers")}
          <hr data-token="--separator" class="m-0 h-px border-0 bg-separator" />
        </div>
        <div class="grid gap-2">
          {label("--border", "outlines")}
          <div data-token="--border" data-prop="border-top-color" class="h-10 rounded-xl border border-border" />
        </div>
      </div>
      <div data-token="--overlay" class="grid gap-2 justify-self-end rounded-3xl bg-overlay p-4 text-overlay-foreground shadow-overlay sm:w-80">
        {label("--overlay", "popovers, menus, dialogs")}
      </div>
    </div>
  );
}
// #endregion

export default function Page() {
  return <SurfaceLayers />;
}
