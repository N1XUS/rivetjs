// Rivet-authored Bento demo (Rivet addition, no HeroUI counterpart): a feature highlights section.
import { Bento } from "@rivetjs/ui/masonry";
import { Card } from "@rivetjs/ui/card";
import { Icon } from "@rivetjs/kit/icon";
import { Globe, Layers, Palette, Rocket, ShieldCheck, Zap } from "lucide";

export const head = { title: "Bento: Feature highlights" };

const features = [
  {
    id: "resume",
    title: "Resumable pages",
    text: "The server renders, the client resumes: no hydration pass, and a click loads only its handler.",
    icon: Rocket,
    colSpan: 2,
  },
  { id: "signals", title: "Fine-grained signals", text: "Updates touch only the nodes that changed.", icon: Zap },
  { id: "i18n", title: "Compile-time i18n", text: "Message catalogs are inlined per locale, so no runtime parser ships.", icon: Globe, rowSpan: 2 },
  { id: "a11y", title: "Accessible parts", text: "React Aria behaviour, ported one to one.", icon: ShieldCheck },
  { id: "styles", title: "Rivet UI look", text: "Tokens, themes and Tailwind v4 classes.", icon: Palette },
  { id: "layers", title: "One overlay layer", text: "Modals, popovers and menus share one stacking layer.", icon: Layers, colSpan: 2 },
];

// #region demo
export function BentoFeatures() {
  return (
    <Bento
      id="bento-features"
      items={features}
      columns={{ 0: 2, 560: 3 }}
      rowHeight="auto"
      gap={12}
      semantics="list"
      aria-label="Features"
      class="w-[min(48rem,100%)]"
    >
      {(feature) => (
        <Card class="h-full">
          <span class="grid size-9 place-items-center rounded-xl bg-accent-soft text-accent">
            <Icon icon={feature.icon} size={18} />
          </span>
          <Card.Header>
            <Card.Title>{feature.title}</Card.Title>
            <Card.Description>{feature.text}</Card.Description>
          </Card.Header>
        </Card>
      )}
    </Bento>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-start justify-center p-6 [:where(&>*)]:max-w-full">
      <BentoFeatures />
    </div>
  );
}
