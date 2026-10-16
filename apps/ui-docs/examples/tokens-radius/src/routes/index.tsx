// Rivet-authored demo: the radius tokens of the current theme and concentric inner radii, values read from the live CSS.
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { clientEffect, ref } from "@rivetjs/runtime/dom";
import { Button } from "@rivetjs/ui/button";
import { Card } from "@rivetjs/ui/card";
import { ArrowUpRight } from "lucide";

export const head = { title: "Styling: Radius tokens" };

// #region demo
const SCALE = [
  { utility: "rounded-xs", factor: "× 0.25", class: "rounded-xs" },
  { utility: "rounded-sm", factor: "× 0.5", class: "rounded-sm" },
  { utility: "rounded-md", factor: "× 0.75", class: "rounded-md" },
  { utility: "rounded-lg", factor: "× 1", class: "rounded-lg" },
  { utility: "rounded-xl", factor: "× 1.5", class: "rounded-xl" },
  { utility: "rounded-2xl", factor: "× 2", class: "rounded-2xl" },
  { utility: "rounded-3xl", factor: "× 3", class: "rounded-3xl" },
  { utility: "rounded-4xl", factor: "× 4", class: "rounded-4xl" },
  { utility: "rounded-field", factor: "fields", class: "rounded-field" },
  { utility: "rounded-full", factor: "pills", class: "rounded-full" },
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
export function Radius() {
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
      <section class="grid gap-3" aria-label="Radius scale">
        <p data-token="--radius" data-prop="--radius" class="m-0 text-sm">
          <code class="font-mono font-medium">--radius</code> <span class="text-muted">base</span> {value("--radius")}
        </p>
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {SCALE.map((r) => (
            <figure class="m-0 grid gap-2">
              <div data-token={r.utility} data-prop="border-top-left-radius" class={`h-16 border-2 border-accent bg-accent-soft ${r.class}`} />
              <figcaption class="grid text-xs">
                <code class="font-mono font-medium">{r.utility}</code>
                <span class="text-muted">{r.factor}</span>
                {value(r.utility)}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
      <section class="grid items-start gap-6 sm:grid-cols-[minmax(0,20rem)_1fr]" aria-label="Concentric radii">
        <Card data-token="outer" data-prop="border-top-left-radius padding-top">
          <div data-token="inner" data-prop="border-top-left-radius" class="aspect-video rounded-(--r-inner) bg-linear-to-br from-accent to-rivet-violet" />
          <Card.Header>
            <Card.Title>Concentric</Card.Title>
            <Card.Description>Inner corners follow the card's curve.</Card.Description>
          </Card.Header>
          <Card.Footer class="justify-end">
            <Button data-radius="concentric" size="sm">
              Open
              <Icon icon={ArrowUpRight} />
            </Button>
          </Card.Footer>
        </Card>
        <dl class="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt class="text-muted">Card radius · padding (inset)</dt>
          <dd class="m-0">{value("outer")}</dd>
          <dt class="text-muted">Inner radius</dt>
          <dd class="m-0">
            {value("inner")} <span class="text-muted">= max(--r-min, card − inset)</span>
          </dd>
        </dl>
      </section>
    </div>
  );
}
// #endregion

export default function Page() {
  return <Radius />;
}
