// Rivet-authored demo: the shadow tokens of the current theme next to a light sample, the elevation ladder and stacked
// layers; values read from the live CSS.
import { signal } from "@rivetjs/reactivity";
import { clientEffect, ref } from "@rivetjs/runtime/dom";

export const head = { title: "Styling: Shadow tokens" };

// #region demo
const SHADOWS = [
  { token: "--field-shadow", utility: "shadow-field", use: "Input, TextArea, Select trigger", class: "bg-field shadow-field rounded-field" },
  { token: "--surface-shadow", utility: "shadow-surface", use: "Card, Surface, DataGrid", class: "bg-surface shadow-surface rounded-3xl" },
  { token: "--overlay-shadow", utility: "shadow-overlay", use: "Popover, Menu, Select, Modal, Toast", class: "bg-overlay shadow-overlay rounded-3xl" },
];
const LADDER = [
  { level: 0, lift: "sm:pb-0", name: "none", token: "", use: "Page (--background)", class: "bg-background border border-dashed border-border" },
  { level: 1, lift: "sm:pb-3", name: "field", token: "--field-shadow", use: "Input on a Card", class: "bg-field shadow-field rounded-field" },
  { level: 2, lift: "sm:pb-6", name: "surface", token: "--surface-shadow", use: "Card over the page", class: "bg-surface shadow-surface rounded-3xl" },
  {
    level: 3,
    lift: "sm:pb-9",
    name: "overlay",
    token: "--overlay-shadow",
    use: "Popover over a Card, Modal over everything",
    class: "bg-overlay shadow-overlay rounded-3xl",
  },
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
export function Shadows() {
  // Resolved CSS of every [data-token] element (key = data-token, properties in data-prop, space-separated), read in the
  // browser on load and again on every light / dark switch. Custom properties read as declared (computed box-shadow
  // carries Tailwind's ring placeholders).
  const values = signal<Record<string, string>>({});
  const root = ref<HTMLElement>();
  clientEffect(() => {
    const el = root();
    if (!el) return;
    const read = () =>
      values.set(
        Object.fromEntries(
          [...el.querySelectorAll<HTMLElement>("[data-token]")].map((n) => {
            const style = getComputedStyle(n);
            return [
              n.dataset.token!,
              (n.dataset.prop ?? "")
                .split(" ")
                .map((p) => tidy(style.getPropertyValue(p)))
                .join(" · "),
            ];
          }),
        ),
      );
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => observer.disconnect();
  });
  const value = (key: string) => (
    <span data-value={key} class="font-mono break-words text-muted">
      {() => values()[key] ?? ""}
    </span>
  );
  const tiles = (scope: string) =>
    SHADOWS.map((s) => (
      <figure class="m-0 grid content-start gap-3">
        <div data-token={scope + s.token} data-prop={s.token} class={`flex h-36 items-center justify-center text-sm font-medium ${s.class}`}>
          <code class="font-mono">{s.utility}</code>
        </div>
        <figcaption class="grid gap-1 text-xs">
          <code class="font-mono font-medium text-foreground">{s.token}</code>
          <span class="text-muted">{s.use}</span>
          {value(scope + s.token)}
        </figcaption>
      </figure>
    ));
  return (
    <div ref={root} class="grid gap-8 bg-background p-6 text-foreground sm:p-8">
      <section aria-label="Shadow tokens, current theme" class="grid gap-4">
        <p class="m-0 text-xs font-medium text-muted">Current theme (follows the light / dark toggle)</p>
        <div class="grid gap-8 sm:grid-cols-3">{tiles("")}</div>
      </section>
      <section
        id="sh-light"
        data-theme="light"
        aria-label="Shadow tokens, light sample"
        class="grid gap-4 rounded-3xl bg-background p-6 text-foreground [color-scheme:light]"
      >
        <p class="m-0 text-xs font-medium text-muted">
          Light sample (<code class="font-mono">data-theme="light"</code>): the drop shadows, in both modes
        </p>
        <div class="grid gap-8 sm:grid-cols-3">{tiles("light")}</div>
      </section>
      <p id="sh-dark-note" class="m-0 max-w-prose text-xs text-muted">
        The theme has three shadow tokens. In dark mode the Rivet theme draws no drop shadows: <code class="font-mono whitespace-nowrap">--surface-shadow</code>{" "}
        and <code class="font-mono whitespace-nowrap">--overlay-shadow</code> become a 1 px inset white hairline and{" "}
        <code class="font-mono whitespace-nowrap">--field-shadow</code> is transparent (the default theme: no surface edge, a faint inset glow on overlays).
        Elevation in dark comes from lighter surface colours{" "}
        <span class="whitespace-nowrap">
          (<code class="font-mono">--surface</code>,
        </span>{" "}
        <code class="font-mono whitespace-nowrap">--overlay</code> over <code class="font-mono whitespace-nowrap">--background</code>) instead.
      </p>
      <section aria-label="Elevation ladder" class="grid gap-4">
        <p class="m-0 text-xs font-medium text-muted">Elevation ladder</p>
        <ol class="m-0 grid list-none gap-6 p-0 sm:grid-cols-4 sm:items-end">
          {LADDER.map((step) => (
            <li class={`grid gap-3 ${step.lift}`}>
              <div data-token={"ladder" + step.level} data-prop={step.token} class={`flex h-24 items-center justify-center text-sm font-medium ${step.class}`}>
                {step.level} · {step.name}
              </div>
              <span class="grid gap-1 text-xs">
                <code class="font-mono font-medium text-foreground">{step.token || "no shadow"}</code>
                <span class="text-muted">{step.use}</span>
                {step.token ? value("ladder" + step.level) : null}
              </span>
            </li>
          ))}
        </ol>
      </section>
      <section aria-label="Stacked layers" class="grid gap-6 sm:grid-cols-2">
        <figure class="m-0 grid gap-2">
          <div class="relative h-64 overflow-hidden rounded-3xl border border-dashed border-border bg-background">
            <div class="absolute inset-x-6 top-6 grid h-40 content-start gap-3 rounded-3xl bg-surface p-5 shadow-surface">
              <p class="m-0 text-sm font-medium">Card</p>
              <div class="h-9 rounded-field bg-field shadow-field" />
            </div>
            <div class="absolute top-28 right-10 grid w-44 gap-1 rounded-2xl bg-overlay p-2 text-sm shadow-overlay">
              <span class="rounded-xl bg-default px-3 py-1.5">Popover</span>
              <span class="px-3 py-1.5 text-muted">over the Card</span>
            </div>
          </div>
          <figcaption class="text-xs text-muted">Page → Card (surface) → Input (field) → Popover (overlay)</figcaption>
        </figure>
        <figure class="m-0 grid gap-2">
          <div class="relative h-64 overflow-hidden rounded-3xl border border-dashed border-border bg-background">
            <div class="absolute inset-x-6 top-6 h-40 rounded-3xl bg-surface p-5 shadow-surface">
              <p class="m-0 text-sm font-medium">Card</p>
            </div>
            <div class="absolute inset-0 bg-backdrop" />
            <div class="absolute inset-x-10 top-14 grid gap-2 rounded-3xl bg-overlay p-5 shadow-overlay">
              <p class="m-0 text-sm font-medium">Modal</p>
              <p class="m-0 text-xs text-muted">over everything: --backdrop dims the page</p>
            </div>
          </div>
          <figcaption class="text-xs text-muted">Modal (overlay) above a --backdrop above the page</figcaption>
        </figure>
      </section>
      <section aria-label="Custom shadow token" class="grid gap-3 sm:grid-cols-3">
        <figure class="m-0 grid content-start gap-3">
          <div
            data-token="--raised-shadow"
            data-prop="--raised-shadow"
            class="flex h-36 items-center justify-center rounded-3xl bg-surface text-sm font-medium shadow-raised"
          >
            <code class="font-mono">shadow-raised</code>
          </div>
          <figcaption class="grid gap-1 text-xs">
            <code class="font-mono font-medium text-foreground">--raised-shadow</code>
            <span class="text-muted">Custom token, defined in this example's CSS</span>
            {value("--raised-shadow")}
          </figcaption>
        </figure>
      </section>
    </div>
  );
}
// #endregion

export default function Page() {
  return <Shadows />;
}
