// Rivet-authored demo: border, separator and focus tokens of the current theme, values read from the live CSS.
import { signal } from "@rivetjs/reactivity";
import { clientEffect, ref } from "@rivetjs/runtime/dom";
import { Button } from "@rivetjs/ui/button";
import { Input } from "@rivetjs/ui/input";

export const head = { title: "Styling: Border tokens" };

// #region demo
const BORDERS = [
  { token: "--border", class: "border-border" },
  { token: "--border-secondary", class: "border-border-secondary" },
  { token: "--border-tertiary", class: "border-border-tertiary" },
];
const SEPARATORS = [
  { token: "--separator", class: "bg-separator" },
  { token: "--separator-secondary", class: "bg-separator-secondary" },
  { token: "--separator-tertiary", class: "bg-separator-tertiary" },
];

/** Shortens long decimals of a computed value (`oklch(0.5200001 …)` → `oklch(0.52 …)`). */
function tidy(value: string) {
  return value
    .trim()
    .replace(/\d*\.\d{4,}/g, (n) => String(+(+n).toFixed(3)))
    .replace(/(^|[^\d])\.(\d)/g, (_, before: string, digit: string) => `${before}0.${digit}`)
    .replace(/(^|[^\d.])-0(?![.\d])/g, (_, before: string) => `${before}0`)
    .replace(/\d[\d.]*e\+\d+px/g, "calc(infinity * 1px)");
}
export function Borders() {
  // Resolved CSS of every [data-token] element, root included (properties in data-prop, space-separated, default background-color;
  // data-target measures a descendant), read in the browser on load and again on every light / dark switch.
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
            .map((n) => {
              const style = getComputedStyle((n.dataset.target && n.querySelector(n.dataset.target)) || n);
              const props = (n.dataset.prop ?? "background-color").split(" ");
              return [n.dataset.token!, props.map((p) => tidy(style.getPropertyValue(p))).join(" · ")];
            }),
        ),
      );
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => observer.disconnect();
  });
  const value = (key: string) => (
    <span data-value={key} class="font-mono text-muted tabular-nums">
      {() => values()[key] ?? ""}
    </span>
  );
  const name = (token: string) => <code class="font-mono font-medium text-foreground">{token}</code>;
  return (
    <div ref={root} class="grid gap-8 p-4 sm:p-6">
      <section class="grid gap-4 sm:grid-cols-2" aria-label="Border widths">
        <figure class="m-0 grid gap-2">
          <div data-token="--border-width" data-prop="border-top-width" class="h-16 rounded-2xl border-(length:--border-width) border-border bg-surface" />
          <figcaption class="flex flex-wrap gap-x-2 text-xs">
            {name("--border-width")} <span class="text-muted">surfaces, outlines</span> {value("--border-width")}
          </figcaption>
        </figure>
        <figure class="m-0 grid gap-2">
          <div data-token="--field-border-width" data-prop="border-top-width" data-target="input" class="grid">
            <Input id="tb-field" aria-label="Field border" placeholder="Field" />
          </div>
          <figcaption class="flex flex-wrap gap-x-2 text-xs">
            {name("--field-border-width")} <span class="text-muted">inputs</span> {value("--field-border-width")}
          </figcaption>
        </figure>
      </section>
      <section class="grid gap-3 sm:grid-cols-3" aria-label="Border colors">
        {BORDERS.map((b) => (
          <figure class="m-0 grid gap-2">
            <div data-token={b.token} data-prop="border-top-color" class={`h-14 rounded-2xl border-2 ${b.class}`} />
            <figcaption class="grid text-xs">
              {name(b.token)}
              {value(b.token)}
            </figcaption>
          </figure>
        ))}
      </section>
      <section class="grid gap-3 sm:grid-cols-3" aria-label="Separators">
        {SEPARATORS.map((s) => (
          <figure class="m-0 grid gap-2">
            <div class="flex h-14 items-center rounded-2xl bg-surface px-4">
              <hr data-token={s.token} class={`m-0 h-px w-full border-0 ${s.class}`} />
            </div>
            <figcaption class="grid text-xs">
              {name(s.token)}
              {value(s.token)}
            </figcaption>
          </figure>
        ))}
      </section>
      <section class="grid gap-3" aria-label="Focus ring">
        <div class="flex flex-wrap items-center gap-4">
          <span data-token="--focus" data-prop="--tw-ring-color" class="inline-flex h-9 items-center rounded-full bg-surface px-4 text-sm focus-ring">
            focus-ring
          </span>
          <Button id="tb-focus-button" variant="secondary">
            Tab to me
          </Button>
          <Input aria-label="Then to me" placeholder="Then to me" class="w-40" />
        </div>
        <p class="m-0 flex flex-wrap gap-x-2 text-xs">
          {name("--focus")} {value("--focus")}
          <span data-token="--ring-offset-width" data-prop="--ring-offset-width" class="contents" />
          {name("--ring-offset-width")} {value("--ring-offset-width")}
        </p>
      </section>
    </div>
  );
}
// #endregion

export default function Page() {
  return <Borders />;
}
