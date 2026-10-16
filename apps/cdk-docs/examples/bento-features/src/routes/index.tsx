import { Bento } from "@rivetjs/cdk/masonry";
import { Globe, Layers, Palette, Rocket, ShieldCheck, Zap } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Bento: feature highlights" };

const features = [
  {
    id: "resume",
    title: "Resumable pages",
    text: "The server renders, the client resumes: no hydration pass, a click loads only its handler.",
    icon: Rocket,
    colSpan: 2,
  },
  { id: "signals", title: "Fine-grained signals", text: "Updates touch the nodes that changed.", icon: Zap },
  { id: "i18n", title: "Compile-time i18n", text: "Catalogs inlined per locale.", icon: Globe, rowSpan: 2 },
  { id: "a11y", title: "Accessible parts", text: "React Aria behaviour, ported 1:1.", icon: ShieldCheck },
  { id: "styles", title: "Headless styling", text: "rv-* classes and data-* state: bring your own CSS.", icon: Palette },
  { id: "layers", title: "One overlay layer", text: "Modals, popovers and menus share one stacking layer.", icon: Layers, colSpan: 2 },
];

// #region demo
export default function BentoFeatures() {
  return (
    <section class="m-4">
      <Bento id="features" items={features} columns={{ 0: 2, 560: 3 }} rowHeight="auto" gap={12} semantics="list" aria-label="Features">
        {(feature) => (
          <div class="flex h-full flex-col gap-2 rounded-2xl bg-gradient-to-br from-slate-50 to-indigo-50 p-5 ring-1 ring-slate-200">
            <span class="grid size-9 place-items-center rounded-lg bg-white text-indigo-600 shadow-sm">
              <Icon icon={feature.icon} size={18} />
            </span>
            <h3 class="m-0 text-base font-semibold">{feature.title}</h3>
            <p class="m-0 text-sm text-slate-600">{feature.text}</p>
          </div>
        )}
      </Bento>
    </section>
  );
}
// #endregion
