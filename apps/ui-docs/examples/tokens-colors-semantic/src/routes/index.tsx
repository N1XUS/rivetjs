// Rivet-authored demo: the semantic color tokens of the current theme, values read from the live CSS.
import { signal } from "@rivetjs/reactivity";
import { clientEffect, ref } from "@rivetjs/runtime/dom";

export const head = { title: "Colors: Semantic tokens" };

// #region demo
const FAMILIES = [
  {
    name: "accent",
    tiles: [
      { token: "--accent", fg: "--accent-foreground", class: "bg-accent text-accent-foreground" },
      { token: "--accent-hover", fg: "--accent-foreground", class: "bg-accent-hover text-accent-foreground" },
      { token: "--accent-soft", fg: "--accent-soft-foreground", class: "bg-accent-soft text-accent-soft-foreground" },
      { token: "--accent-soft-hover", fg: "--accent-soft-foreground", class: "bg-accent-soft-hover text-accent-soft-foreground" },
    ],
  },
  {
    name: "default",
    tiles: [
      { token: "--default", fg: "--default-foreground", class: "bg-default text-default-foreground" },
      { token: "--default-hover", fg: "--default-foreground", class: "bg-default-hover text-default-foreground" },
      { token: "--default-soft", fg: "--default-soft-foreground", class: "bg-default-soft text-default-soft-foreground" },
      { token: "--default-soft-hover", fg: "--default-soft-foreground", class: "bg-default-soft-hover text-default-soft-foreground" },
    ],
  },
  {
    name: "success",
    tiles: [
      { token: "--success", fg: "--success-foreground", class: "bg-success text-success-foreground" },
      { token: "--success-hover", fg: "--success-foreground", class: "bg-success-hover text-success-foreground" },
      { token: "--success-soft", fg: "--success-soft-foreground", class: "bg-success-soft text-success-soft-foreground" },
      { token: "--success-soft-hover", fg: "--success-soft-foreground", class: "bg-success-soft-hover text-success-soft-foreground" },
    ],
  },
  {
    name: "warning",
    tiles: [
      { token: "--warning", fg: "--warning-foreground", class: "bg-warning text-warning-foreground" },
      { token: "--warning-hover", fg: "--warning-foreground", class: "bg-warning-hover text-warning-foreground" },
      { token: "--warning-soft", fg: "--warning-soft-foreground", class: "bg-warning-soft text-warning-soft-foreground" },
      { token: "--warning-soft-hover", fg: "--warning-soft-foreground", class: "bg-warning-soft-hover text-warning-soft-foreground" },
    ],
  },
  {
    name: "danger",
    tiles: [
      { token: "--danger", fg: "--danger-foreground", class: "bg-danger text-danger-foreground" },
      { token: "--danger-hover", fg: "--danger-foreground", class: "bg-danger-hover text-danger-foreground" },
      { token: "--danger-soft", fg: "--danger-soft-foreground", class: "bg-danger-soft text-danger-soft-foreground" },
      { token: "--danger-soft-hover", fg: "--danger-soft-foreground", class: "bg-danger-soft-hover text-danger-soft-foreground" },
    ],
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

export function SemanticColors() {
  // Resolved background of every swatch, read in the browser on load and again on every light / dark switch.
  const values = signal<Record<string, string>>({});
  const root = ref<HTMLElement>();
  clientEffect(() => {
    const el = root();
    if (!el) return;
    const read = () =>
      values.set(
        Object.fromEntries([...el.querySelectorAll<HTMLElement>("[data-token]")].map((n) => [n.dataset.token!, tidy(getComputedStyle(n).backgroundColor)])),
      );
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => observer.disconnect();
  });
  return (
    <div ref={root} class="grid gap-6 p-4 sm:p-6">
      {FAMILIES.map((family) => (
        <section class="grid gap-2" aria-label={`${family.name} colors`}>
          <h3 class="text-sm font-semibold capitalize">{family.name}</h3>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {family.tiles.map((tile) => (
              <figure class="m-0 grid gap-1.5" title={`Text: ${tile.fg}`}>
                <div data-token={tile.token} class={`flex h-14 items-center justify-center rounded-xl text-sm font-medium ${tile.class}`}>
                  Aa
                </div>
                <figcaption class="grid text-xs">
                  <code class="font-mono text-foreground">{tile.token}</code>
                  <span data-value={tile.token} class="font-mono text-muted tabular-nums">
                    {() => values()[tile.token] ?? ""}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
// #endregion

export default function Page() {
  return <SemanticColors />;
}
