// Rivet-authored demo: the spacing scale and density modes of the current theme, values read from the live CSS.
import { signal } from "@rivetjs/reactivity";
import { clientEffect, ref } from "@rivetjs/runtime/dom";
import { Button } from "@rivetjs/ui/button";
import { Input } from "@rivetjs/ui/input";

export const head = { title: "Styling: Spacing tokens" };

// #region demo
const SCALE = [
  { token: "--space-1", tailwind: "1", class: "w-(--space-1)" },
  { token: "--space-2", tailwind: "1.5", class: "w-(--space-2)" },
  { token: "--space-3", tailwind: "2", class: "w-(--space-3)" },
  { token: "--space-4", tailwind: "3", class: "w-(--space-4)" },
  { token: "--space-5", tailwind: "4", class: "w-(--space-5)" },
  { token: "--space-6", tailwind: "6", class: "w-(--space-6)" },
  { token: "--space-7", tailwind: "9", class: "w-(--space-7)" },
  { token: "--space-8", tailwind: "13", class: "w-(--space-8)" },
];
const DENSITIES = [
  { id: "compact", label: "Compact" },
  { id: "default", label: "Default" },
  { id: "comfortable", label: "Comfortable" },
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
export function Spacing() {
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
  return (
    <div ref={root} class="grid gap-8 p-4 sm:p-6">
      <section class="grid gap-2" aria-label="Spacing scale">
        {SCALE.map((s) => (
          <div class="grid grid-cols-[5.5rem_3.5rem_1fr] items-center gap-3 text-xs">
            <code class="font-mono font-medium">{s.token}</code>
            {value(s.token)}
            <div class="flex items-center gap-2">
              <div data-token={s.token} data-prop="width" class={`h-4 rounded-xs bg-accent ${s.class}`} />
              <span class="text-muted">
                Tailwind <code class="font-mono">p-{s.tailwind}</code>
              </span>
            </div>
          </div>
        ))}
      </section>
      <section class="grid gap-4 sm:grid-cols-3" aria-label="Density">
        {DENSITIES.map((d) => (
          <div data-density={d.id === "default" ? undefined : d.id} class="grid content-start gap-3 rounded-2xl bg-surface p-4 shadow-surface">
            <p class="m-0 grid text-sm font-medium">
              {d.label} <code class="font-mono text-xs text-muted">{d.id === "default" ? "no attribute" : `data-density="${d.id}"`}</code>
            </p>
            <div data-token={`${d.id}-input`} data-prop="height" class="grid">
              <Input aria-label={`${d.label} email`} placeholder="Email" />
            </div>
            <div data-token={`${d.id}-button`} data-prop="height" class="flex items-start gap-2">
              <Button size="md">Subscribe</Button>
            </div>
            <p class="m-0 text-xs text-muted">
              Input {value(`${d.id}-input`)} · Button {value(`${d.id}-button`)}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}
// #endregion

export default function Page() {
  return <Spacing />;
}
